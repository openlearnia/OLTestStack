import { readFile } from 'node:fs/promises';
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

const MAX_INLINE_SCREENSHOT_BYTES = 1_048_576;

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

      const content: Array<
        | { type: 'text'; text: string }
        | { type: 'image'; data: string; mimeType: string }
      > = [{ type: 'text', text: JSON.stringify(result, null, 2) }];

      if (
        name === 'page_screenshot' &&
        result.ok &&
        args &&
        typeof args === 'object' &&
        (args as { returnInline?: boolean }).returnInline === true &&
        result.data &&
        typeof result.data === 'object' &&
        'file' in result.data &&
        typeof result.data.file === 'string'
      ) {
        try {
          const buffer = await readFile(result.data.file);
          if (buffer.byteLength <= MAX_INLINE_SCREENSHOT_BYTES) {
            content.push({
              type: 'image',
              data: buffer.toString('base64'),
              mimeType: 'image/png',
            });
          }
        } catch {
          // Best-effort inline image; URL + file path remain in JSON text content.
        }
      }

      return {
        content,
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
