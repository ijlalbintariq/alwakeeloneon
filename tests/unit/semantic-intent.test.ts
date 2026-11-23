import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import crypto from "node:crypto";
import { classifyQueryIntent, analyzeQueryExplicitness, normalizePipelineModule } from "../../server/pipeline/intent-classifier";
import { parseSemanticResearch, semanticResearchInput, generateSemanticRetrievalQueries, extractDeterministicFacts } from "../../server/pipeline/llm-query-extractor";
import { applySemanticIntent, caseSupportsIntent, filterToolResult, INTENT_UNAVAILABLE } from "../../server/pipeline/semantic-intent";
import { extractLocalTopicKeywords } from "../../server/pipeline/query-rewriter";
import { buildContext } from "../../server/pipeline/context-builder";
import { extractCitations } from "../../server/citation-verify";
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
  assert.equal(caseSupportsIntent(tax,intent),true);
  assert.equal(caseSupportsIntent(family,intent),false);
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

test("retrieval and tool context reject revenue cases but keep substantively relevant family cases regardless of reporter",()=>{
  const intent=classifyQueryIntent(question);applySemanticIntent(intent,research());
  assert.equal(caseSupportsIntent(tax,intent),false);assert.equal(caseSupportsIntent(family,intent),true);
  assert.equal(caseSupportsIntent({...family,citation:"2024 PTD 123"},intent),true);
  const result=filterToolResult({verifiedHits:[tax,family],verifiedCitations:[tax.citation,family.citation],verifiedTitles:[],foundCount:2,contextString:"stale tax context"},intent);
  assert.deepEqual(result.verifiedCitations,[family.citation]);assert.equal(result.foundCount,1);
  assert.ok(!result.contextString.includes(tax.citation));assert.ok(!result.contextString.includes("stale"));
  assert.equal(filterToolResult(result).foundCount,0);
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
    fetchStatutes:async()=>[],fetchAdminDocs:async()=>[],caseSupportsIntent,
  });
  let model:any=research();
  const run=compile("server/pipeline/knowledge-pipeline.ts","runKnowledgePipeline",{
    crypto,normalizePipelineModule,normKey:(s:string)=>s,cacheGet:()=>undefined,cacheSet:()=>{},
    classifyQueryIntent,analyzeQueryExplicitness,extractCitations,applySemanticIntent,INTENT_UNAVAILABLE,
    generateSemanticRetrievalQueries:async()=>{modelCalls++;return model;},extractDeterministicFacts,
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
