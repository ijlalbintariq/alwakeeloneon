const PROXY_VARS = [
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "ALL_PROXY",
  "http_proxy",
  "https_proxy",
  "all_proxy",
  "npm_config_proxy",
  "npm_config_https_proxy",
] as const;

function isInvalidProxyValue(value?: string): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed) return false;

  // Common bad placeholder value seen in broken envs.
  if (/^base$/i.test(trimmed)) return true;

  try {
    const url = new URL(trimmed);
    const protoOk = url.protocol === "http:" || url.protocol === "https:";
    if (!protoOk) return true;

    // Proxy host misconfigured as literal placeholder "base".
    if (/^base$/i.test(url.hostname)) return true;

    return false;
  } catch {
    return true;
  }
}

for (const key of PROXY_VARS) {
  const val = process.env[key];
  if (isInvalidProxyValue(val)) {
    delete process.env[key];
  }
}

const NO_PROXY_LIST = [
  "localhost",
  "127.0.0.1",
  "::1",
  ".render.internal",
  "api.github.com",
  "raw.githubusercontent.com",
  "github.com",
];

const currentNoProxy = process.env.NO_PROXY || process.env.no_proxy || "";
const mergedNoProxy = new Set(
  currentNoProxy
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .concat(NO_PROXY_LIST)
);

process.env.NO_PROXY = Array.from(mergedNoProxy).join(",");
