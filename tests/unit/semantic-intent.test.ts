import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import crypto from "node:crypto";
import { classifyQueryIntent, analyzeQueryExplicitness, normalizePipelineModule } from "../../server/pipeline/intent-classifier";
import { parseSemanticResearch, semanticResearchInput, generateSemanticRetrievalQueries, extractDeterministicFacts } from "../../server/pipeline/llm-query-extractor";
import { applySemanticIntent, understandLegalQuery, filterToolResult, INTENT_UNAVAILABLE } from "../../server/pipeline/semantic-intent";
import { extractLocalTopicKeywords } from "../../server/pipeline/query-rewriter";
import { buildContext } from "../../server/pipeline/context-builder";
import { extractCitations } from "../../server/citation-verify";
import { reviewCaseRelevance, CASE_REVIEW_UNAVAILABLE } from "../../server/pipeline/case-relevance";
import { LegalRetrievalError } from "../../server/legal-retrieval";
import { getClient } from "../../server/openrouter-ai";

const question = "Find judgments allowing a writ against a Family Court maintenance decree because the husband's financial means were not proved";
const research = () => parseSemanticResearch({primaryTopic:"family",topics:["family","constitutional"],requestType:"case-law",
  retrievalQuery:"family court maintenance decree husband means evidence writ",domains:["family law"],issues:["maintenance financial means"],confidence:0.95});
const family = {citation:"2023 CLC 1234",title:"A vs B",court:"High Court",summary:"Family Court maintenance decree: evidence of the husband's financial means."};
const tax = {citation:"2020 PTD 500",title:"Taxpayer vs Commissioner",court:"High Court",summary:"Income Tax Ordinance tax assessment of income. Writ against FBR assessment dismissed."};
function compile(file:string,name:string,deps:Record<string,unknown>){
  const source=ts.createSourceFile(file,fs.readFileSync(file,"utf8"),ts.ScriptTarget.Latest,true);
  const fn=source.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name)!;
  const code=ts.transpileModule('('+fn.getText(source).replace(/^export\s+/,"")+')',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  return new Function(...Object.keys(deps),'return '+code)(...Object.values(deps));
}

test("AI substantive topic overrides keyword routing without confusing procedure and requested output",()=>{
  const intent=classifyQueryIntent(question);
  assert.equal(applySemanticIntent(intent,research()),true);
  assert.equal(intent.topics[0].id,"family");assert.equal(intent.type,"case-law");
  assert.equal(intent.needsCaseLaw,true);assert.equal(intent.needsStatutes,true);
  const statute={...research(),requestType:"statute" as const};applySemanticIntent(intent,statute);
  assert.equal(intent.needsCaseLaw,false);assert.equal(intent.needsStatutes,true);
  applySemanticIntent(intent,research(),"contract-drafting");assert.equal(intent.needsCaseLaw,false);
  applySemanticIntent(intent,research(),"case-search");assert.equal(intent.needsStatutes,false);
});

test("relationships do not promote tax and employment disputes to family in the local fallback",()=>{
  for(const query of ["Writ challenging income tax assessment against my wife under Income Tax Ordinance 2001","Writ challenging dismissal of my husband from government service and pension denial"]){
    assert.notEqual(classifyQueryIntent(query).topics[0].id,"family");
  }
});

test("AI can select tax despite a relationship word and safely replace stale family expansion",()=>{
  const intent=classifyQueryIntent(question);
  const taxIntent=parseSemanticResearch({...research(),primaryTopic:"tax",topics:["tax"],retrievalQuery:"Income Tax Assessment Against Wife",issues:["income tax assessment"]});
  assert.equal(applySemanticIntent(intent,taxIntent),true);
  assert.equal(intent.topics[0].id,"tax");
  assert.equal(intent.normalized,"income tax assessment against wife");
  assert.ok(!intent.expandedQuery.includes("khula"));
});

test("model output validates taxonomy, confidence, field types and primary-topic membership",()=>{
  for(const patch of [{primaryTopic:"imaginary-domain"},{confidence:"high"},{confidence:1.5},{topics:["tax"]},{issues:[{inject:true}]},{requestType:"family law"}]){
    assert.throws(()=>parseSemanticResearch({...research(),...patch}));
  }
  const intent=classifyQueryIntent(question);const before=JSON.stringify(intent);
  assert.equal(applySemanticIntent(intent,{...research(),confidence:0.3}),false);assert.equal(JSON.stringify(intent),before);
});

test("semantic input preserves the thread anchor and document facts without treating assistant inventions as facts",()=>{
  const input=JSON.parse(semanticResearchInput("those cases are irrelevant",[
    {role:"user",content:"Family Court decree. "+"facts ".repeat(100)+"husband financial means"},
    {role:"assistant",content:"INVENTED TAX CITATION"},{role:"user",content:"Focus on maintenance"}],"Attached petition: Family Court maintenance order"));
  assert.match(input.initialRequest,/husband financial means/);
  assert.match(input.attachedDocumentFacts,/Family Court/);assert.match(input.latestRequest,/irrelevant/);
  assert.ok(!JSON.stringify(input).includes("INVENTED TAX CITATION"));
});

test("tool context uses issue-specific review, preserves reviewed pipeline hits and clears stale citations",async()=>{
  process.env.OPENROUTER_API_KEY="test-only";
  const client=getClient();const original=client.chat.completions.create;
  try {
    client.chat.completions.create=(async()=>({choices:[{message:{content:JSON.stringify({decisions:[
      {index:0,relevant:false,confidence:0.99,reason:"Tax assessment"},
      {index:1,relevant:true,confidence:0.99,evidence:family.summary}]})}}]})) as any;
    const intent=classifyQueryIntent(question);applySemanticIntent(intent,research());
    const result=await filterToolResult({verifiedHits:[tax,family],verifiedCitations:[tax.citation,family.citation],verifiedTitles:[],foundCount:2,contextString:"stale tax context"},intent,[family]);
    assert.deepEqual(result.verifiedCitations,[family.citation]);assert.equal(result.foundCount,1);
    assert.ok(!result.contextString.includes(tax.citation));assert.ok(!result.contextString.includes("stale"));
    assert.equal((await filterToolResult(result)).foundCount,0);
  } finally {client.chat.completions.create=original;}
});

test("one configured AI call receives context, uses a cancellable deadline, and rejects malformed responses",async()=>{
  process.env.OPENROUTER_API_KEY="test-only-not-a-real-key";
  const client=getClient();const original=client.chat.completions.create;let calls=0;
  try{
    client.chat.completions.create=(async(params:any,options:any)=>{
      calls++;assert.ok(options.signal instanceof AbortSignal);assert.equal(options.maxRetries,0);
      assert.match(params.messages[1].content,/attached petition/);assert.equal(params.temperature,0);
      return {choices:[{message:{content:JSON.stringify(research())}}]};
    }) as any;
    const output=await generateSemanticRetrievalQueries("irrelevant cases",[{role:"user",content:question}],"attached petition");
    assert.equal(output.primaryTopic,"family");assert.equal(calls,1);
    client.chat.completions.create=(async()=>({choices:[{message:{content:'{"topics":false}'}}]})) as any;
    assert.equal((await generateSemanticRetrievalQueries(question)).confidence,0);
  }finally{client.chat.completions.create=original;}
});

test("actual pipeline applies AI topics before retrieval, filters foreign cases, and skips AI for exact citations",async()=>{
  let modelCalls=0,retrievalCalls=0;
  const retrieval=compile("server/pipeline/retrieval-engine.ts","runRetrieval",{
    fetchCaseLaw:async()=>[{row:tax,relevanceScore:100},{row:family,relevanceScore:90}],
    fetchStatutes:async()=>[],fetchAdminDocs:async()=>[],reviewCaseRelevance:async()=>({rows:[family],status:"checked"}),
  });
  let model:any=research();
  const run=compile("server/pipeline/knowledge-pipeline.ts","runKnowledgePipeline",{
    crypto,normalizePipelineModule,normKey:(s:string)=>s,cacheGet:()=>undefined,cacheSet:()=>{},
    INTENT_UNAVAILABLE,understandLegalQuery:async(query:string)=>{
      const intent=classifyQueryIntent(query);
      if(intent.type === "citation-lookup") return {intent,status:"ready"};
      modelCalls++;return applySemanticIntent(intent,model) ? {intent,research:model,status:"ready"} : {status:"unavailable"};
    },extractDeterministicFacts,
    extractLocalTopicKeywords,buildFocusedRetrievalQueries:()=>[],buildContext,recordRetrievalMiss:()=>{},
    runRetrieval:async(intent:any,...args:any[])=>{retrievalCalls++;if(intent.type!=="citation-lookup")assert.equal(intent.topics[0].id,"family");return retrieval(intent,...args);},
    OUTER_DEADLINE_MS:1000,
  });
  const output=await run(question,"test-user",[],{module:"chat"});
  assert.equal(modelCalls,1);assert.deepEqual(output.caseLawHits.map((h:any)=>h.citation),[family.citation]);
  assert.ok(!output.contextString.includes(tax.citation));assert.equal(output.intent.topics[0].id,"family");
  await run("2024 SCMR 1085","test-user");assert.equal(modelCalls,1);
  const before=retrievalCalls;model={...research(),confidence:0};
  const unavailable=await run(question,"test-user");assert.equal(retrievalCalls,before);
  assert.equal(unavailable.contextString,INTENT_UNAVAILABLE);assert.deepEqual(unavailable.caseLawHits,[]);
});


test("shared resolver handles follow-ups, explicit topic changes, unfamiliar subjects, and non-search tasks",async()=>{
  process.env.OPENROUTER_API_KEY="test-only";
  const client=getClient();const original=client.chat.completions.create;let calls=0;
  let output:any=research();
  const history=[{role:"user" as const,content:question}];
  try {
    client.chat.completions.create=(async(params:any)=>{
      calls++; const input=JSON.parse(params.messages[1].content);
      if(input.latestRequest === "financial means cases only") assert.equal(input.initialRequest,question);
      return {choices:[{message:{content:JSON.stringify(output)}}]};
    }) as any;
    const followup=await understandLegalQuery("financial means cases only",history);
    assert.equal(followup.intent?.topics[0].id,"family");
    output={...research(),primaryTopic:"tax",topics:["tax"],retrievalQuery:"income tax assessment appeal",issues:["assessment appeal"]};
    const change=await understandLegalQuery("Forget maintenance. Find income tax assessment appeals",history);
    assert.equal(change.intent?.topics[0].id,"tax");assert.ok(!change.intent?.expandedQuery.includes("khula"));
    output={...research(),primaryTopic:"other-legal",topics:["other-legal"],retrievalQuery:"unusual new legal research issue"};
    assert.equal((await understandLegalQuery("unusual new legal research issue")).intent?.topics[0].id,"other-legal");
    for(const task of ["translate","summarize"]) {
      output={...research(),task};
      const result=await understandLegalQuery("translate or summarize this petition",history);
      assert.equal(result.intent?.needsCaseLaw,false);assert.equal(result.intent?.needsStatutes,false);
    }
    output={...research(),task:"clarify"};
    assert.equal((await understandLegalQuery("help with that")).status,"clarify");
    const before=calls;
    await understandLegalQuery("2024 SCMR 1085");await understandLegalQuery("PPC 302");
    assert.equal(calls,before,"precise lookups must not need a model");
  } finally {client.chat.completions.create=original;}
});

test("relevance review selects only original records and rejects unrelated cases inside the same domain",async()=>{
  process.env.OPENROUTER_API_KEY="test-only";
  const client=getClient();const original=client.chat.completions.create;
  const khula={...family,citation:"2024 CLC 321",summary:"Dissolution of marriage by khula; no issue about maintenance or financial means"};
  const unusual={...family,citation:"2024 PTD 123",summary:"Adverse inference after the obligor concealed salary records in child support proceedings"};
  try {
    client.chat.completions.create=(async(params:any)=>{
      const request=JSON.parse(params.messages[1].content);
      assert.match(request.issue,/maintenance financial means/);
      assert.match(params.messages[0].content,/unrelated khula/);
      return {choices:[{message:{content:JSON.stringify({decisions:[
        {index:0,relevant:false,confidence:0.99,reason:"Different family remedy"},
        {index:1,relevant:true,confidence:0.95,evidence:unusual.summary}]})}}]};
    }) as any;
    const intent=classifyQueryIntent(question);applySemanticIntent(intent,research());
    const result=await reviewCaseRelevance(intent,[khula,unusual]);
    assert.equal(result.status,"checked");assert.equal(result.rows[0],unusual);assert.equal(result.rows.length,1);
  } finally {client.chat.completions.create=original;}
});

test("malformed, incomplete or unavailable relevance decisions fail closed without claiming no matches",async()=>{
  process.env.OPENROUTER_API_KEY="test-only";
  const client=getClient();const original=client.chat.completions.create;
  const intent=classifyQueryIntent(question);applySemanticIntent(intent,research());
  try {
    const good={index:0,relevant:true,confidence:0.95,reason:"Evidence"};
    for(const value of [{decisions:[]},{decisions:[good,good]},{decisions:[{...good,index:2}]},{decisions:[{...good,confidence:2}]},"bad json"]) {
      client.chat.completions.create=(async()=>({choices:[{message:{content:typeof value==="string"?value:JSON.stringify(value)}}]})) as any;
      const result=await reviewCaseRelevance(intent,[family]);
      assert.equal(result.status,"unavailable");assert.deepEqual(result.rows,[]);
    }
    client.chat.completions.create=(async()=>{throw new Error("provider unavailable");}) as any;
    const result=await filterToolResult({verifiedHits:[family],verifiedCitations:[family.citation],verifiedTitles:[],foundCount:1,contextString:"stale"},intent);
    assert.equal(result.foundCount,0);assert.equal(result.contextString,CASE_REVIEW_UNAVAILABLE);
    const ctx=buildContext(intent,{caseLaw:[],statutes:[],adminDocs:[],diagnostics:{caseLawRelevance:"unavailable"} as any});
    assert.match(ctx.contextString,/RELEVANCE REVIEW UNAVAILABLE/);
    assert.ok(!ctx.contextString.includes("NO MATCHING JUDGMENTS"));
    const exact=classifyQueryIntent("2024 SCMR 1085");
    assert.equal((await reviewCaseRelevance(exact,[family])).status,"not-required");
  } finally {client.chat.completions.create=original;}
});

test("disabled semantic service never silently returns a keyword interpretation",async()=>{
  const previous=process.env.USE_LLM_QUERY_EXTRACTOR;
  try {
    process.env.USE_LLM_QUERY_EXTRACTOR="false";
    const result=await understandLegalQuery(question);
    assert.equal(result.status,"unavailable");assert.equal(result.intent,undefined);
    assert.equal((await understandLegalQuery("PPC 302")).status,"ready");
  } finally {if(previous===undefined)delete process.env.USE_LLM_QUERY_EXTRACTOR;else process.env.USE_LLM_QUERY_EXTRACTOR=previous;}
});

test("case-search entry point uses the shared resolved issue and surfaces provider failures",async()=>{
  const intent=classifyQueryIntent(question);applySemanticIntent(intent,research());
  let status="ready";let review="checked";let retrieved=0;
  const retrieve=compile("server/legal-retrieval.ts","retrieveLegalCaseLaw",{
    LegalRetrievalError,
    understandLegalQuery:async()=>status === "ready" ? {intent,research:research(),status} : {status},
    runRetrieval:async(actual:any)=>{retrieved++;assert.equal(actual.normalized,research().retrievalQuery?.toLowerCase());assert.equal(actual.topics[0].id,"family");assert.equal(actual.needsStatutes,false);return {caseLaw:[{row:family}],diagnostics:{caseLawRelevance:review}};},
  });
  assert.deepEqual((await retrieve({query:question})).rows,[family]);
  status="unavailable";
  await assert.rejects(retrieve({query:question}),/Query intent is unavailable/);
  assert.equal(retrieved,1,"must not retrieve with a guessed local intent");
  status="ready";review="unavailable";
  await assert.rejects(retrieve({query:question}),/relevance review is temporarily unavailable/);
});

test("prepared understanding is reused and transient relevance failures are not cached",async()=>{
  const intent=classifyQueryIntent(question);applySemanticIntent(intent,research());let cacheWrites=0;
  const run=compile("server/pipeline/knowledge-pipeline.ts","runKnowledgePipeline",{
    crypto,normalizePipelineModule,normKey:(s:string)=>s,cacheGet:()=>undefined,cacheSet:()=>{cacheWrites++;},
    understandLegalQuery:async()=>{throw new Error("Must reuse prepared understanding");},INTENT_UNAVAILABLE,
    extractDeterministicFacts,buildContext,recordRetrievalMiss:()=>{},OUTER_DEADLINE_MS:1000,
    runRetrieval:async()=>({caseLaw:[],statutes:[],adminDocs:[],diagnostics:{caseLawRelevance:"unavailable"}}),
  });
  const output=await run(question,"test-user",[],{understanding:{intent,research:research(),status:"ready"}});
  assert.equal(output.caseRelevanceUnavailable,true);assert.equal(cacheWrites,0);
  assert.deepEqual(output.caseLawHits,[]);assert.match(output.contextString,/RELEVANCE REVIEW UNAVAILABLE/);
});

test("relevance review allows responses slower than four seconds and uses source evidence",async()=>{
  process.env.OPENROUTER_API_KEY="test-only";
  const client=getClient();const original=client.chat.completions.create;
  const intent=classifyQueryIntent(question);applySemanticIntent(intent,research());
  try {
    client.chat.completions.create=((params:any,options:any)=>new Promise((resolve,reject)=>{
      assert.match(params.messages[0].content,/omit prose explanations/);
      const timer=setTimeout(()=>{options.signal.removeEventListener("abort",abort);resolve({choices:[{message:{content:JSON.stringify({decisions:[{index:0,relevant:true,confidence:0.95,evidence:family.summary}]})}}]});},4100);
      function abort(){clearTimeout(timer);reject(new Error("Review timed out"));}
      options.signal.addEventListener("abort",abort,{once:true});
    })) as any;
    const result=await reviewCaseRelevance(intent,[family]);
    assert.equal(result.status,"checked");assert.deepEqual(result.rows,[family]);
  }finally{client.chat.completions.create=original;}
});

test("intent classification permits a valid provider response after four seconds",async()=>{
  process.env.OPENROUTER_API_KEY="test-only";
  const client=getClient();const original=client.chat.completions.create;
  try {
    client.chat.completions.create=((_params:any,options:any)=>new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{options.signal.removeEventListener("abort",abort);resolve({choices:[{message:{content:JSON.stringify(research())}}]});},4100);
      function abort(){clearTimeout(timer);reject(new Error("Classification timed out"));}
      options.signal.addEventListener("abort",abort,{once:true});
    })) as any;
    const result=await understandLegalQuery(question);
    assert.equal(result.status,"ready");assert.equal(result.intent?.topics[0].id,"family");
  }finally{client.chat.completions.create=original;}
});

test("positive relevance decisions without a genuine supporting passage are withheld",async()=>{
  process.env.OPENROUTER_API_KEY="test-only";
  const client=getClient();const original=client.chat.completions.create;
  const intent=classifyQueryIntent(question);applySemanticIntent(intent,research());
  try {
    for(const evidence of [undefined,"invented discussion of proving salary or bank statements","Family Court"]) {
      client.chat.completions.create=(async()=>({choices:[{message:{content:JSON.stringify({decisions:[{index:0,relevant:true,confidence:0.99,evidence}]})}}]})) as any;
      const result=await reviewCaseRelevance(intent,[family]);
      assert.equal(result.status,"checked");assert.deepEqual(result.rows,[]);
    }
  }finally{client.chat.completions.create=original;}
});
