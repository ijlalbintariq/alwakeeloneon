const http = require('http');

async function makeRequest(path) {
  return new Promise((resolve) => {
    const start = performance.now();
    const req = http.request({ hostname: 'localhost', port: 5001, path, method: 'GET' }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          timeMs: Math.round(performance.now() - start)
        });
      });
    });
    req.end();
  });
}

async function run() {
  console.log("== PUBLIC ENDPOINT LATENCY TEST ==");
  
  // Test metrics (aggregation query)
  const res1 = await makeRequest('/api/public/platform-metrics');
  console.log(`[Platform Metrics] -> ${res1.timeMs}ms (Status: ${res1.status})`);
  
  // Test public judgment lookup (Database fetch)
  const res2 = await makeRequest('/api/public/judgments/1');
  console.log(`[Public Judgment 1] -> ${res2.timeMs}ms (Status: ${res2.status})`);

  // Test public statute lookup
  const res3 = await makeRequest('/api/public/statutes/1');
  console.log(`[Public Statute 1] -> ${res3.timeMs}ms (Status: ${res3.status})`);
}

run();
