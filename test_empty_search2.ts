import fetch from 'node-fetch';

async function main() {
  const res = await fetch("http://localhost:5001/api/case-law/search?q=");
  const data = await res.json();
  
  if (data && data.length > 0) {
    console.log("Top 5 results years:");
    for (const item of data.slice(0, 5)) {
      console.log(`Citation: ${item.citation}, Year: ${item.year || item.citation?.split(' ')[0]}`);
    }
  } else {
    console.log("No data returned");
  }
  process.exit(0);
}
main().catch(console.error);
