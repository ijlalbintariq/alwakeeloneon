import axios from "axios";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

async function testDistrictPortals() {
  const urls = [
    "https://data.lhc.gov.pk/district_judiciary",
    "https://data.lhc.gov.pk/district_courts",
    "https://lhc.gov.pk/district-judiciary",
    "https://ihc.gov.pk/district-judiciary",
    "https://ihc.gov.pk/",
  ];

  for (const url of urls) {
    try {
      const res = await axios.get(url, { headers: HEADERS, timeout: 8000, validateStatus: () => true });
      console.log(`District URL: ${url} -> Status: ${res.status}, Length: ${res.data?.length || 0}`);
    } catch (e: any) {
      console.log(`District URL: ${url} -> Error: ${e.message}`);
    }
  }
}

testDistrictPortals();
