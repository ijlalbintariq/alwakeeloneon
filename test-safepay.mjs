const Safepay = (await import("@sfpy/node-core")).default;

const safepay = new Safepay("ac2eb23d5a78c279ef409c846ab0489a5ac68627c529d8320d67437ab68aacf5", {
  authType: "secret",
  host: "https://sandbox.api.getsafepay.com",
});

// Step 1: Create session
console.log("① Creating session...");
const sessionRes = await safepay.payments.session.setup({
  merchant_api_key: "sec_f3085efc-66e5-45c9-9d5c-ecc8fb2e9844",
  intent: "CYBERSOURCE",
  mode: "payment",
  currency: "PKR",
  amount: 50000,
});
const tracker = sessionRes?.data?.tracker?.token || sessionRes?.tracker?.token || "";
console.log("   Tracker:", tracker);

// Step 2: Generate TBT
console.log("② Generating TBT...");
const tbtRes = await safepay.client.passport.create();
const tbt = tbtRes?.data || "";
console.log("   TBT:", tbt.substring(0, 30) + "...");

// Step 3: Generate checkout URL
console.log("③ Generating checkout URL...");
const url = safepay.checkout.createCheckoutUrl({
  env: "sandbox",
  tracker,
  tbt,
  source: "hosted",
  cancel_url: "https://alwakeelo.com/checkout?cancelled=true",
  redirect_url: `https://alwakeelo.com/checkout/success?tracker=${tracker}`,
});
console.log("\n✅ FULL FLOW WORKS!");
console.log("Checkout URL:", url);
