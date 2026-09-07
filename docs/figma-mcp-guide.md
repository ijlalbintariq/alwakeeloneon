# Figma MCP Integration Guide for Antigravity

This workspace is now equipped with a native, high-performance **Figma Model Context Protocol (MCP)** server for Google Antigravity.

---

## 1. Features & Tools Available

The server exposes 6 purpose-built tools to Antigravity and AI agents:

| Tool Name | Description |
| :--- | :--- |
| **`figma_parse_url`** | Automatically extracts the `fileKey` and `nodeId` from any Figma share or design link. |
| **`figma_get_file`** | Retrieves high-level file metadata, document structure, canvas pages, component count, and frames. |
| **`figma_get_node`** | Inspects specific Figma frames/nodes, extracting layout (AutoLayout flex/grid), fills, strokes, corner radii, typography, and computed CSS tokens with smart token-efficient tree traversal. |
| **`figma_get_image`** | Renders and returns high-resolution PNG, SVG, JPG, or PDF export URLs directly from Figma nodes. |
| **`figma_get_styles`** | Extracts published color palettes, typography tokens, and effect styles. |
| **`figma_get_comments`** | Reads discussion comments and designer annotations on the canvas. |

---

## 2. Configuration in Antigravity

The MCP server is registered at the workspace level and plugin level:

- **Workspace Config**: [`.agents/mcp_config.json`](file:///Users/macbook/Downloads/Alwakeelo/.agents/mcp_config.json)
- **Plugin Config**: [`.agents/plugins/figma/mcp_config.json`](file:///Users/macbook/Downloads/Alwakeelo/.agents/plugins/figma/mcp_config.json)
- **Manifest**: [`.agents/plugins/figma/plugin.json`](file:///Users/macbook/Downloads/Alwakeelo/.agents/plugins/figma/plugin.json)
- **Implementation**: [`server/figma-mcp.ts`](file:///Users/macbook/Downloads/Alwakeelo/server/figma-mcp.ts)

```json
{
  "mcpServers": {
    "figma": {
      "command": "npx",
      "args": ["tsx", "server/figma-mcp.ts"],
      "env": {
        "FIGMA_API_KEY": "${FIGMA_API_KEY}"
      }
    }
  }
}
```

---

## 3. How to Set Your Figma Access Token

1. Go to your **Figma account**:
   - Click your profile icon in Figma (top-left or top-right).
   - Go to **Settings > Security**.
   - Scroll to **Personal access tokens** and click **Generate new token**.
   - Name it `Antigravity` and grant read permissions (`File content: Read`).
2. Set the token:
   - Option A: In your project [`.env`](file:///Users/macbook/Downloads/Alwakeelo/.env) file:
     ```env
     FIGMA_API_KEY=figd_your_token_here
     ```
   - Option B: In your shell:
     ```bash
     export FIGMA_API_KEY="figd_your_token_here"
     ```
3. When asking Antigravity to inspect or convert designs to code, simply paste the Figma URL or file key!
