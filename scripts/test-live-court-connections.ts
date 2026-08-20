import axios from "axios";
import { LhcCourtAdapter } from "../server/services/causelist/adapters/lhc-adapter";
import { IhcCourtAdapter } from "../server/services/causelist/adapters/ihc-adapter";
import { ShcCourtAdapter } from "../server/services/causelist/adapters/shc-adapter";
import { ScpCourtAdapter } from "../server/services/causelist/adapters/scp-adapter";
import { PunjabDistrictCourtAdapter } from "../server/services/causelist/adapters/punjab-district-adapter";
import { IsbDistrictCourtAdapter } from "../server/services/causelist/adapters/isb-district-adapter";

async function probeLiveCourtServers() {
  console.log("=================================================");
  console.log("🌐 PROBING LIVE PAKISTANI COURT SERVERS");
  console.log("=================================================\n");

  const adapters = [
    new LhcCourtAdapter(),
    new IhcCourtAdapter(),
    new ShcCourtAdapter(),
    new ScpCourtAdapter(),
    new PunjabDistrictCourtAdapter("LHR_DIST"),
    new IsbDistrictCourtAdapter(),
  ];

  for (const adapter of adapters) {
    console.log(`Checking [${adapter.courtCode}] ${adapter.courtName}...`);
    try {
      const health = await adapter.healthCheck();
      const statusIcon = health.healthy ? "✅ ONLINE" : "⚠️ UNSTABLE / OFFLINE";
      console.log(`  Status: ${statusIcon}`);
      console.log(`  Latency: ${health.latencyMs}ms`);
      console.log(`  Message: ${health.message}`);
      if (health.endpoint) console.log(`  Endpoint: ${health.endpoint}`);
    } catch (err: any) {
      console.log(`  ❌ Error: ${err.message}`);
    }
    console.log("-------------------------------------------------");
  }
}

probeLiveCourtServers();
