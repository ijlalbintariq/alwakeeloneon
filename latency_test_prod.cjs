const https = require('https');

function measureLatency(url) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    https.get(url, (res) => {
      const ttfb = Date.now() - start;
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        const total = Date.now() - start;
        resolve({ ttfb, total, size: data.length, status: res.statusCode });
      });
    }).on('error', reject);
  });
}

async function runTest() {
  console.log("Testing Production Latency (https://www.alwakeelo.com)");
  try {
    for (let i = 1; i <= 3; i++) {
      const result = await measureLatency('https://www.alwakeelo.com/');
      console.log(`Run ${i}: TTFB = ${result.ttfb}ms | Total Time = ${result.total}ms | Status = ${result.status} | Size = ${result.size} bytes`);
    }
  } catch (e) {
    console.error("Error:", e.message);
  }
}

runTest();
