import axios from "axios";
import * as cheerio from "cheerio";

async function inspectLhc() {
  const res = await axios.get("https://data.lhc.gov.pk/", {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    },
    timeout: 10000,
  });

  const $ = cheerio.load(res.data);
  console.log("Title:", $("title").text().trim());
  $("a").each((i, el) => {
    const href = $(el).attr("href");
    const text = $(el).text().trim();
    if (href && (href.toLowerCase().includes("cause") || text.toLowerCase().includes("cause") || text.toLowerCase().includes("list"))) {
      console.log(`Link: "${text}" -> ${href}`);
    }
  });
}

inspectLhc();
