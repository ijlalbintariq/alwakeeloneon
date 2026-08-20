import axios from "axios";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Upgrade-Insecure-Requests": "1",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
};

async function testEndpoints() {
  const urls = [
    "https://lhc.gov.pk/cause_lists",
    "https://mis.ihc.gov.pk/",
    "https://caselaw.shc.gov.pk/",
    "https://punjabjudiciary.gov.pk/",
    "https://www.supremecourt.gov.pk/cause-list/",
  ];

  for (const url of urls) {
    try {
      const res = await axios.get(url, {
        headers: HEADERS,
        timeout: 10000,
        validateStatus: () => true,
      });
      console.log(`URL: ${url} -> Status: ${res.status}, Content-Type: ${res.headers["content-type"]}, Length: ${res.data?.length || 0}`);
    } catch (e: any) {
      console.log(`URL: ${url} -> Error: ${e.message}`);
    }
  }
}

testEndpoints();
