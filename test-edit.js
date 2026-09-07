fetch("http://localhost:5001/api/retrieval/clauses/generate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    prompt: "Rewrite the PRAYER to ask for interim bail",
    draftText: `GROUNDS:\na) Delay\n\nPRAYER:\nAdmit to bail.`,
    jurisdiction: "Pakistan",
    module: "legal-drafting",
    stream: false,
    assistantMode: "drafting"
  })
}).then(r => Math.abs(r.status - 200) < 100 ? r.json() : r.text().then(t => { throw new Error(r.status + ": " + t) }))
  .then(d => console.log(JSON.stringify(d, null, 2)))
  .catch(e => console.error("Error:", e.message));
