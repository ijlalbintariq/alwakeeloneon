import { verifyPayment } from "./server/safepay";

async function main() {
  const result = await verifyPayment("track_52795a20-42e1-4749-9681-35ac0044a9b8");
  console.log("Verification Result:", JSON.stringify(result, null, 2));
  process.exit(0);
}
main().catch(console.error);
