import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { AppContext } from '../core/context.js';
import { registerTools } from './register-tools.js';

function logError(message: string): void {
  console.error(`[olteststack] ${message}`);
}

export function createMcpServer(ctx: AppContext): Server {
  const toolRegistry = registerTools(ctx);

  const server = new Server(
    {
      name: 'olteststack',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: toolRegistry.list().map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      const result = await toolRegistry.dispatch(name, args ?? {});

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
        isError: !result.ok,
      };
    } catch (error) {
      logError(`Unhandled error in tool ${name}: ${error instanceof Error ? error.message : String(error)}`);
      const envelope = {
        ok: false as const,
        error: {
          code: 'INTERNAL_ERROR' as const,
          message: `Internal error executing ${name}`,
        },
      };
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(envelope, null, 2) }],
        isError: true,
      };
    }
  });

  return server;
}
