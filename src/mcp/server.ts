import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { AppContext } from '../core/context.js';
import { createMcpServer } from './create-mcp-server.js';
import { startMcpHttpServer } from './http-transport.js';

function logError(message: string): void {
  console.error(`[olteststack] ${message}`);
}

export async function startMcpServer(ctx: AppContext): Promise<void> {
  if (ctx.config.mcpTransport === 'http') {
    await startMcpHttpServer(ctx);
    return;
  }

  const server = createMcpServer(ctx);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logError('MCP server started on stdio');
}
