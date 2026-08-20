import axios from "axios";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

async function testLhc() {
  const paths = [
    "https://data.lhc.gov.pk/cause_lists/daily_cause_list",
    "https://data.lhc.gov.pk/cause_lists",
    "https://lhc.gov.pk/daily_cause_list",
    "https://lhc.gov.pk/cause-lists",
    "https://data.lhc.gov.pk/",
  ];

  for (const url of paths) {
    try {
      const res = await axios.get(url, { headers: HEADERS, timeout: 8000, validateStatus: () => true });
      console.log(`LHC URL: ${url} -> Status: ${res.status}, Length: ${res.data?.length || 0}`);
    } catch (e: any) {
      console.log(`LHC URL: ${url} -> Error: ${e.message}`);
    }
  }
}

testLhc();
