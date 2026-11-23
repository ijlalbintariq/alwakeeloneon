import test from "node:test";
import assert from "node:assert/strict";
import { enforceProseCitationIntegrity, enforceInternalCaseCitationIntegrity, verifyReferencesBlock, stripForbiddenNoJudgmentsMessage } from "../../server/routes";

test("an explicitly empty retrieval pool cannot be replaced with a model-recalled database citation",async()=>{
  const text="No matching verified precedents on these specific facts were found in the Al Wakeelo internal database. Tax analogy: **[2020 PTD 500]**.\n\n```references\n{\"judgments\":[],\"laws\":[]}\n```";
  const output=await enforceProseCitationIntegrity(text,[]);
  assert.ok(!output.includes("2020 PTD 500"));
  assert.match(stripForbiddenNoJudgmentsMessage(output),/No matching verified precedents/);
  const internal=await enforceInternalCaseCitationIntegrity("As held in 2020 PTD 500",{trustedCitations:[]});
  assert.ok(!internal.content.includes("2020 PTD 500"));
  const refs=await verifyReferencesBlock(text,undefined,[]);
  const block=refs.match(/```references\s*([\s\S]*?)```/)![1];
  assert.deepEqual(JSON.parse(block).judgments,[]);
});

test("a small retrieved pool is authoritative; unrelated references are never added just to reach five cases",async()=>{
  const text="Family authority **[2023 CLC 1234]**. Tax analogy **[2020 PTD 500]**.\n\n```references\n{\"judgments\":[],\"laws\":[]}\n```";
  const allowed=["2023 CLC 1234"];
  const prose=await enforceProseCitationIntegrity(text,allowed);
  assert.match(prose,/2023 CLC 1234/);assert.ok(!prose.includes("2020 PTD 500"));
  const refs=await verifyReferencesBlock(text,undefined,allowed);
  const block=JSON.parse(refs.match(/```references\s*([\s\S]*?)```/)![1]);
  assert.deepEqual(block.judgments.map((j:any)=>j.citation),allowed);
});

test("no-results disclosure survives every existing cleanup call",()=>{
  const text="### Case Law\nNo relevant judgments found for the requested issue.\n\nPlease clarify the specific relief.";
  assert.equal(stripForbiddenNoJudgmentsMessage(text),text);
});

test("unsupported citations cannot survive inside a protected references block",async()=>{
  const text='No matching cases.\n\n```references\n{"judgments":[{"citation":"2020 PTD 500","title":"Tax case"}],"laws":[]}\n```';
  const output=await enforceInternalCaseCitationIntegrity(text,{trustedCitations:[]});
  assert.ok(!output.content.includes("2020 PTD 500"));
  assert.deepEqual(JSON.parse(output.content.match(/```references\s*([\s\S]*?)```/)![1]).judgments,[]);
});
