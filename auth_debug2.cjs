const http = require('http');
const testUser = JSON.stringify({ 
  email: `test${Date.now()}@test.com`, 
  password: "password123", 
  firstName: "Test", 
  lastName: "User",
  phoneNumber: "03001234567",
  barCouncilEnrollment: "12345",
  jurisdiction: "punjab",
  acceptedTerms: true,
  termsVersion: "2026-03",
  captchaToken: "test"
});
const req = http.request({ hostname: 'localhost', port: 5001, path: '/api/auth/register', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(testUser) } }, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => console.log('Status:', res.statusCode, 'Body:', body, 'Headers:', res.headers['set-cookie']));
});
req.write(testUser);
req.end();
