const http = require('http');

const ENDPOINTS = [
  '/api/case-law/search?q=murder',
  '/api/case-law/search?q=constitution&sort=date_desc',
  '/api/case-law/search?q=',
  '/api/case-law/search?q=123!@#',
  '/api/document-analyzer/scans',
  '/api/saved-judgments',
  '/api/statutes',
  '/api/admin/system/health',
];

async function checkEndpoint(path) {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: 5001,
      path: path,
      method: 'GET'
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({
          path,
          status: res.statusCode,
          bodySize: body.length,
          preview: body.slice(0, 100).replace(/\n/g, ' ')
        });
      });
    });
    req.on('error', (err) => resolve({ path, error: err.message }));
    req.end();
  });
}

async function run() {
  console.log("Starting QA Endpoint Checks on localhost:5001...");
  for (const path of ENDPOINTS) {
    const result = await checkEndpoint(path);
    console.log(`[${result.status || 'ERR'}] ${result.path} - Size: ${result.bodySize} - Prev: ${result.preview || result.error}`);
  }
}

run();
