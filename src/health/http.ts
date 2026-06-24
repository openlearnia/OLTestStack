import type { AppContext } from '../core/context.js';
import { validateDatabaseConnection } from '../db/health.js';
import { shouldPersistRecording } from '../db/session-lifecycle.js';
import { handleDashboardRequest } from '../dashboard/routes.js';

export async function startHealthServer(ctx: AppContext): Promise<void> {
  const config = ctx.config;
  const port = config.healthPort;
  if (!port) return;

  const server = Bun.serve({
    port,
    fetch: async (request) => {
      const url = new URL(request.url);

      if (url.pathname === '/health') {
        if (config.databaseUrl && shouldPersistRecording(config)) {
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

      const dashboardResponse = await handleDashboardRequest(config, request, ctx);
      if (dashboardResponse) {
        return dashboardResponse;
      }

      return new Response('Not Found', { status: 404 });
    },
  });

  const dashboardHint = config.dashboardEnabled ? ` (dashboard: http://localhost:${server.port}/dashboard)` : '';
  console.error(`[olteststack] Health server listening on :${server.port}${dashboardHint}`);
}
