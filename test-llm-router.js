fetch("http://localhost:5001/api/retrieval/clauses/generate", {
  method: "POST",
  headers: { "Content-Type": "application/json", "Cookie": "connect.sid=s%3AFakeCookieForLocalAuth.fake" },
  body: JSON.stringify({
    prompt: "Rewrite the entire document as a Civil Suit for Damages",
    draftText: "GROUNDS:\nA) Delay.\n\nPRAYER:\nBail.",
    jurisdiction: "Pakistan",
    module: "legal-drafting",
    stream: false,
    assistantMode: "drafting"
  })
}).then(r => r.json()).then(console.log).catch(console.error);
