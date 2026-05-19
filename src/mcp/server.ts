import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerFigmaTools } from './tools/figmaTools';

async function main(): Promise<void> {
  const figmaContextPath = process.env.FIGMA_CONTEXT_PATH ?? '';
  const server = new McpServer({
    name: 'spex-mcp',
    version: process.env.npm_package_version ?? '0.1.0'
  });

  registerFigmaTools(server, figmaContextPath);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(error => {
  console.error('NWA Agent Figma MCP server failed:', error);
  process.exit(1);
});
