import { spawn } from "node:child_process";
import process from "node:process";

function run() {
  console.log("Starting drizzle-kit push automation...");
  const child = spawn("npx", ["drizzle-kit", "push"], {
    stdio: ["pipe", "pipe", "inherit"],
    shell: true
  });

  child.stdout.on("data", (data) => {
    const output = data.toString();
    process.stdout.write(output);

    // If drizzle-kit prompts for table creation/rename question, send newline
    if (output.includes("Is api_keys table created") || output.includes("created or renamed")) {
      console.log("\n[Migration Script] Detected prompt! Auto-selecting 'create table'...");
      child.stdin.write("\n");
    }
  });

  child.on("close", (code) => {
    console.log(`drizzle-kit push process exited with code ${code}`);
    process.exit(code || 0);
  });
}

run();
