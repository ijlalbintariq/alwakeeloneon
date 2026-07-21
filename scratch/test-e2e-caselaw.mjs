/**
 * End-to-end test: hits localhost /api/ai/chat with a family law query,
 * collects the full SSE stream, and checks if case law citations appear in the AI response.
 */

const BASE = 'http://localhost:5000';

// We need a valid session cookie. Let's try without auth first (some dev setups allow it).
// If that fails, we'll use the thread create endpoint instead.

async function testChat() {
  const query = "Ayesha has been married for six years. Her husband has not provided maintenance for over a year and frequently abandons the matrimonial home. What legal remedies are available to her?";
  
  console.log('=== Testing Al Wakeelo Chat API ===');
  console.log(`Query: "${query.slice(0, 80)}..."\n`);
  
  // Try the SSE streaming endpoint
  const body = {
    messages: [{ role: 'user', content: query }],
    type: 'al-wakeelo',
    stream: true,
    aiMode: 'standard',
  };
  
  console.log('Sending POST to /api/ai/chat ...');
  const t0 = Date.now();
  
  const resp = await fetch(`${BASE}/api/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  
  console.log(`Status: ${resp.status} ${resp.statusText}`);
  console.log(`Content-Type: ${resp.headers.get('content-type')}`);
  
  if (resp.status === 401) {
    console.log('\n⚠️  Got 401 — need authentication. Trying thread creation endpoint instead...');
    return testThreadCreate(query);
  }
  
  if (!resp.ok) {
    const text = await resp.text();
    console.log(`Error body: ${text.slice(0, 500)}`);
    return;
  }
  
  const contentType = resp.headers.get('content-type') || '';
  
  if (contentType.includes('text/event-stream')) {
    // SSE streaming response
    const text = await resp.text();
    const lines = text.split('\n');
    
    let fullResponse = '';
    let caseLawCardHits = 0;
    let searchingEvents = 0;
    
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const dataStr = line.slice(6);
      if (dataStr === '[DONE]') continue;
      
      try {
        const data = JSON.parse(dataStr);
        if (data.caseLawCard) {
          caseLawCardHits = data.caseLawCard.hits?.length || 0;
          console.log(`📋 Case Law Card: ${caseLawCardHits} hits`);
          for (const h of (data.caseLawCard.hits || []).slice(0, 5)) {
            console.log(`   - ${h.citation} | ${h.court}`);
          }
        }
        if (data.searching !== undefined) {
          searchingEvents++;
        }
        if (data.token || data.text || data.content) {
          fullResponse += data.token || data.text || data.content || '';
        }
        if (data.message) {
          fullResponse = data.message;
        }
      } catch {
        // Not JSON — might be raw text chunk
        fullResponse += dataStr;
      }
    }
    
    analyzeResponse(fullResponse, caseLawCardHits, Date.now() - t0);
  } else {
    // JSON response (non-streaming)
    const data = await resp.json();
    const aiResponse = data.content || data.message || data.text || JSON.stringify(data).slice(0, 2000);
    analyzeResponse(aiResponse, 0, Date.now() - t0);
  }
}

async function testThreadCreate(query) {
  const body = { firstMessage: query };
  
  console.log('Sending POST to /api/threads ...');
  const t0 = Date.now();
  
  const resp = await fetch(`${BASE}/api/threads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  
  console.log(`Status: ${resp.status}`);
  
  if (!resp.ok) {
    const text = await resp.text();
    console.log(`Error: ${text.slice(0, 500)}`);
    return;
  }
  
  const data = await resp.json();
  console.log('Thread created, checking messages...');
  
  // Get thread messages
  const threadResp = await fetch(`${BASE}/api/threads/${data.id}`);
  const threadData = await threadResp.json();
  const aiMessage = threadData.messages?.find(m => m.role === 'assistant');
  
  if (aiMessage) {
    analyzeResponse(aiMessage.content, 0, Date.now() - t0);
  } else {
    console.log('No AI response found in thread');
  }
}

function analyzeResponse(response, caseLawCardHits, durationMs) {
  console.log(`\n=== AI Response (${durationMs}ms, ${response.length} chars) ===\n`);
  console.log(response.slice(0, 3000));
  if (response.length > 3000) console.log(`\n... [${response.length - 3000} more chars]\n`);
  
  console.log('\n=== CITATION ANALYSIS ===');
  
  // Check for formal citations like [2024 SCMR 142], [PLD 2012 Lahore 154], etc.
  const citationRegex = /\*?\*?\[?\b(\d{4}\s+(?:SCMR|PLD|CLC|YLR|MLD|PCRLJ|PLJ|NLR|PTCL|PTD|LHC|IHC|SHC|PHC|ALD|KLR|PLC|CLD)\s+[\w\s]+\d+)\]?\*?\*?/gi;
  const citations = [...response.matchAll(citationRegex)].map(m => m[1].trim());
  const uniqueCitations = [...new Set(citations)];
  
  if (uniqueCitations.length > 0) {
    console.log(`✅ Found ${uniqueCitations.length} formal case law citations:`);
    for (const c of uniqueCitations) {
      console.log(`   - ${c}`);
    }
  } else {
    console.log('❌ NO formal case law citations found in the AI response!');
  }
  
  // Check for "No relevant judgments" pattern
  if (/no relevant judgments/i.test(response)) {
    console.log('❌ AI wrote "No relevant judgments" — this is the BUG');
  }
  
  // Check for statute citations
  const statuteMatches = response.match(/section\s+\d+/gi) || [];
  console.log(`📜 Statute references: ${statuteMatches.length} (${statuteMatches.slice(0, 5).join(', ')})`);
  
  // Check for Companies Ordinance (wrong domain)
  if (/companies ordinance/i.test(response)) {
    console.log('❌ AI cited Companies Ordinance for a family law query — WRONG DOMAIN');
  }
  
  console.log(`\n📋 Case Law Card hits sent to frontend: ${caseLawCardHits}`);
}

testChat().catch(err => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
