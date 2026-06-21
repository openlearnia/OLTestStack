import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import type { AppContext } from '../core/context.js';
import type { ResolvedConfig } from '../core/config/load-config.js';
import { createMcpServer } from './create-mcp-server.js';

const MCP_PATH = '/mcp';

function jsonRpcError(status: number, code: number, message: string): Response {
  return Response.json(
    {
      jsonrpc: '2.0',
      error: { code, message },
      id: null,
    },
    { status },
  );
}

export async function startMcpHttpServer(ctx: AppContext): Promise<void> {
  const host = ctx.config.mcpHttpHost;
  const port = ctx.config.mcpHttpPort;
  const transports = new Map<string, WebStandardStreamableHTTPServerTransport>();

  const handleMcpRequest = async (request: Request): Promise<Response> => {
    const sessionId = request.headers.get('mcp-session-id') ?? undefined;
    let transport = sessionId ? transports.get(sessionId) : undefined;

    if (request.method === 'POST') {
      const body = await request.json();

      if (transport) {
        return transport.handleRequest(request, { parsedBody: body });
      }

      if (!sessionId && isInitializeRequest(body)) {
        transport = new WebStandardStreamableHTTPServerTransport({
          sessionIdGenerator: () => crypto.randomUUID(),
          onsessioninitialized: (id) => {
            if (transport) {
              transports.set(id, transport);
            }
          },
        });

        transport.onclose = () => {
          const id = transport?.sessionId;
          if (id) {
            transports.delete(id);
          }
        };

        const server = createMcpServer(ctx);
        await server.connect(transport);
        return transport.handleRequest(request, { parsedBody: body });
      }

      return jsonRpcError(400, -32000, 'Bad Request: No valid session ID provided');
    }

    if (!sessionId || !transport) {
      return new Response('Invalid or missing session ID', { status: 400 });
    }

    return transport.handleRequest(request);
  };

  const server = Bun.serve({
    hostname: host,
    port,
    fetch: async (request) => {
      const url = new URL(request.url);

      if (url.pathname !== MCP_PATH) {
        return new Response('Not Found', { status: 404 });
      }

      if (!['GET', 'POST', 'DELETE'].includes(request.method)) {
        return new Response('Method Not Allowed', {
          status: 405,
          headers: { Allow: 'GET, POST, DELETE' },
        });
      }

      try {
        return await handleMcpRequest(request);
      } catch (error) {
        console.error(
          '[olteststack] MCP HTTP error:',
          error instanceof Error ? error.message : String(error),
        );
        return jsonRpcError(500, -32603, 'Internal server error');
      }
    },
  });

  console.error(
    `[olteststack] MCP HTTP server listening on http://${host}:${server.port}${MCP_PATH}`,
  );
}

export function resolveMcpHttpEndpoint(config: ResolvedConfig): string {
  const host = config.mcpHttpHost === '0.0.0.0' ? 'localhost' : config.mcpHttpHost;
  return `http://${host}:${config.mcpHttpPort}${MCP_PATH}`;
}
