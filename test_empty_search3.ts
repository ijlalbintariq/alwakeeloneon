import fetch from 'node-fetch';

async function main() {
  try {
    const res = await fetch("http://localhost:5001/api/case-law/search?q=");
    
    if (res.status === 401) {
       console.log("API returned 401 Unauthorized. The fix needs to be tested on the authenticated frontend or I need to mock the auth.");
       process.exit(1);
    }
    
    const data = await res.json();
    
    if (data && data.length > 0) {
      console.log(`Successfully fetched ${data.length} latest cases!`);
      console.log("Top 5 results in the default feed:");
      for (let i = 0; i < Math.min(5, data.length); i++) {
        const item = data[i];
        console.log(`${i+1}. Citation: ${item.citation} | Year: ${item.year || item.citation?.split(' ')[0]} | Title: ${item.title}`);
      }
    } else {
      console.log("No data returned");
    }
  } catch (e) {
    console.error("Fetch error:", e.message);
  }
  process.exit(0);
}
main();
