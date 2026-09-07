const http = require('http');

async function makeRequest(path, method = 'GET', data = null, cookie = null) {
  return new Promise((resolve) => {
    const start = performance.now();
    const headers = {};
    if (data) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(data);
    }
    if (cookie) {
      headers['Cookie'] = cookie;
    }

    const req = http.request({
      hostname: 'localhost',
      port: 5001,
      path,
      method,
      headers
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        const end = performance.now();
        const setCookie = res.headers['set-cookie'] || [];
        resolve({
          status: res.statusCode,
          timeMs: Math.round(end - start),
          body: body.slice(0, 150).replace(/\n/g, ' '),
          cookie: setCookie.join('; ')
        });
      });
    });
    
    req.on('error', (err) => resolve({ error: err.message }));
    
    if (data) req.write(data);
    req.end();
  });
}

async function runLatencyTest() {
  console.log("== AL WAKEELO LATENCY TEST ==");
  
  // 1. Try to register a test user to get a session
  const testUser = JSON.stringify({
    email: `latency${Date.now()}@test.com`,
    password: "password123",
    firstName: "Test",
    lastName: "User"
  });
  
  console.log("Creating session...");
  let authRes = await makeRequest('/api/auth/register', 'POST', testUser);
  let sessionCookie = authRes.cookie;
  
  if (authRes.status !== 200 && authRes.status !== 201) {
    // maybe try login
    authRes = await makeRequest('/api/auth/login', 'POST', testUser);
    sessionCookie = authRes.cookie;
  }
  
  // Test 1: Citation Lookup (Fast Path)
  const res1 = await makeRequest('/api/case-law/cite?q=2024%20SCMR%20123&limit=25', 'GET', null, sessionCookie);
  console.log(`[Cite Search] 2024 SCMR 123 -> ${res1.timeMs}ms (Status: ${res1.status})`);
  
  // Test 2: Heavy Keyword Search (pgvector + ILIKE)
  const res2 = await makeRequest('/api/case-law/cite?q=murder%20bail%20application&limit=25', 'GET', null, sessionCookie);
  console.log(`[Keyword Search] murder bail application -> ${res2.timeMs}ms (Status: ${res2.status})`);

  // Test 3: Statute Lookup
  const res3 = await makeRequest('/api/statute-lookup?q=PPC%20302', 'GET', null, sessionCookie);
  console.log(`[Statute Lookup] PPC 302 -> ${res3.timeMs}ms (Status: ${res3.status})`);
  
  // Test 4: Dashboard usage
  const res4 = await makeRequest('/api/usage', 'GET', null, sessionCookie);
  console.log(`[Dashboard Usage] /api/usage -> ${res4.timeMs}ms (Status: ${res4.status})`);
}

runLatencyTest();
