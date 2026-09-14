import fs from "fs";
const env = fs.readFileSync(".env", "utf8");
for (const line of env.split("\n")) {
  if (line && line.includes("=") && !line.startsWith("#")) {
    const idx = line.indexOf("=");
    const k = line.slice(0, idx).trim();
    let v = line.slice(idx + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    process.env[k] = v;
  }
}
