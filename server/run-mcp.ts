import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { mcpServer, mcpUserContext } from "./mcp-server";

async function main() {
  const transport = new StdioServerTransport();
  
  // For local CLI executions (e.g. Claude Desktop), configure via MCP_USER_ID
  const debugUserId = process.env.MCP_USER_ID || "debug_user_id";
  console.error(`[MCP-Stdio] Starting Stdio transport for user context: ${debugUserId}`);

  // Run the stateful stdio connection within the authenticated user context
  await mcpUserContext.run(debugUserId, async () => {
    await mcpServer.connect(transport);
    console.error("[MCP-Stdio] Server connected and listening on stdin/stdout.");
  });
}

main().catch((err) => {
  console.error("[MCP-Stdio] Fatal initialization error:", err);
  process.exit(1);
});
