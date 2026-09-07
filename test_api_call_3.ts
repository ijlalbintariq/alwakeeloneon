import fetch from 'node-fetch';
async function test() {
  const res = await fetch("http://localhost:5001/api/judgments/4391d3e1-bee9-448f-a862-6da08b9abce1", {
    headers: { 'Cookie': 'connect.sid=s%3A7aD9n7b.randomcookie' } // might fail auth
  });
  const text = await res.text();
  console.log(text.substring(0, 500));
}
test();
