import type { ResolvedConfig } from '../core/config/load-config.js';
import { validateDatabaseConnection } from '../db/health.js';

export async function startHealthServer(config: ResolvedConfig): Promise<void> {
  const port = config.healthPort;
  if (!port) return;

  const server = Bun.serve({
    port,
    fetch: async (request) => {
      const url = new URL(request.url);

      if (url.pathname === '/health') {
        if (config.persistRecording) {
          try {
            await validateDatabaseConnection(config);
          } catch (error) {
            return Response.json(
              {
                status: 'degraded',
                error: error instanceof Error ? error.message : String(error),
              },
              { status: 503 },
            );
          }
        }

        return Response.json({ status: 'ok', service: 'olteststack' });
      }

      return new Response('Not Found', { status: 404 });
    },
  });

  console.error(`[olteststack] Health server listening on :${server.port}`);
}
