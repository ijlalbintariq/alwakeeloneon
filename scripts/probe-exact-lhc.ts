import axios from "axios";

async function probeExactLhc() {
  const res = await axios.get("https://data.lhc.gov.pk/case_management/regular_cause_list", {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    },
    timeout: 10000,
  });

  console.log("Status:", res.status);
  console.log("Length:", res.data.length);
  console.log("Snippet:", res.data.slice(0, 500));
}

probeExactLhc();
