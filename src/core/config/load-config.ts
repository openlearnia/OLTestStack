export type McpTransport = 'stdio' | 'http';

export interface FrameworkConfig {
  headless?: boolean;
  defaultTimeoutMs?: number;
  defaultNavigationTimeoutMs?: number;
  defaultWaitTimeoutMs?: number;
  screenshotDir?: string;
  chromiumExecutablePath?: string;
  databaseUrl?: string;
  persistRecording?: boolean;
  /** Hours until unsaved sessions are auto-deleted (default 24). */
  sessionTtlHours?: number;
  dbPort?: number;
  healthPort?: number;
  dashboardEnabled?: boolean;
  mcpTransport?: McpTransport;
  mcpHttpPort?: number;
  mcpHttpHost?: string;
}

export interface ResolvedConfig {
  headless: boolean;
  defaultTimeoutMs: number;
  defaultNavigationTimeoutMs: number;
  defaultWaitTimeoutMs: number;
  screenshotDir: string;
  chromiumExecutablePath?: string;
  /** PostgreSQL connection string (host port defaults to 5433 in .env.example). */
  databaseUrl?: string;
  /** When true, flush recordings and test reports to PostgreSQL. Defaults to true when DATABASE_URL is set. */
  persistRecording: boolean;
  /** TTL in hours for unsaved (ephemeral) persisted sessions. */
  sessionTtlHours: number;
  /** Documented default host port for local Docker Postgres. */
  dbPort: number;
  /** Optional HTTP health port (8081) when running in Docker. */
  healthPort?: number;
  /** Serve session dashboard and API on the health HTTP server. */
  dashboardEnabled: boolean;
  /** MCP wire transport: stdio (local IDE) or http (Docker/remote). */
  mcpTransport: McpTransport;
  /** MCP Streamable HTTP listen port (8082). */
  mcpHttpPort: number;
  /** MCP HTTP bind address (127.0.0.1 local dev, 0.0.0.0 in Docker). */
  mcpHttpHost: string;
}

export const DEFAULT_DB_PORT = 5433;
export const DEFAULT_HEALTH_PORT = 8081;
export const DEFAULT_MCP_HTTP_PORT = 8082;
export const DEFAULT_MCP_HTTP_HOST = '127.0.0.1';
export const DEFAULT_SESSION_TTL_HOURS = 24;

export const DEFAULT_CONFIG: ResolvedConfig = {
  headless: true,
  defaultTimeoutMs: 30_000,
  defaultNavigationTimeoutMs: 30_000,
  defaultWaitTimeoutMs: 30_000,
  screenshotDir: './screenshots',
  persistRecording: false,
  sessionTtlHours: DEFAULT_SESSION_TTL_HOURS,
  dbPort: DEFAULT_DB_PORT,
  dashboardEnabled: false,
  mcpTransport: 'stdio',
  mcpHttpPort: DEFAULT_MCP_HTTP_PORT,
  mcpHttpHost: DEFAULT_MCP_HTTP_HOST,
};

function parseBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  const normalized = value.toLowerCase();
  if (normalized === 'true' || normalized === '1') return true;
  if (normalized === 'false' || normalized === '0') return false;
  return undefined;
}

function parseInteger(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function loadConfig(fileConfig: FrameworkConfig = {}): ResolvedConfig {
  const envHeadless = parseBoolean(process.env.BROWSER_HEADLESS);
  const envDefaultTimeout = parseInteger(process.env.DEFAULT_TIMEOUT_MS);
  const envNavTimeout = parseInteger(process.env.DEFAULT_NAVIGATION_TIMEOUT_MS);
  const envWaitTimeout = parseInteger(process.env.DEFAULT_WAIT_TIMEOUT_MS);

  const envPersistRecording = parseBoolean(process.env.PERSIST_RECORDING);
  const envSessionTtlHours = parseInteger(process.env.SESSION_TTL_HOURS);
  const envDbPort = parseInteger(process.env.DB_PORT);
  const envHealthPort = parseInteger(process.env.HEALTH_PORT);
  const envDashboardEnabled = parseBoolean(process.env.DASHBOARD_ENABLED);
  const envMcpHttpPort = parseInteger(process.env.MCP_HTTP_PORT);

  const envMcpTransport = process.env.MCP_TRANSPORT?.toLowerCase();
  const resolvedMcpTransport: McpTransport | undefined =
    envMcpTransport === 'http' || envMcpTransport === 'stdio' ? envMcpTransport : undefined;

  return {
    headless: envHeadless ?? fileConfig.headless ?? DEFAULT_CONFIG.headless,
    defaultTimeoutMs:
      envDefaultTimeout ?? fileConfig.defaultTimeoutMs ?? DEFAULT_CONFIG.defaultTimeoutMs,
    defaultNavigationTimeoutMs:
      envNavTimeout ??
      fileConfig.defaultNavigationTimeoutMs ??
      DEFAULT_CONFIG.defaultNavigationTimeoutMs,
    defaultWaitTimeoutMs:
      envWaitTimeout ?? fileConfig.defaultWaitTimeoutMs ?? DEFAULT_CONFIG.defaultWaitTimeoutMs,
    screenshotDir:
      process.env.SCREENSHOT_DIR ?? fileConfig.screenshotDir ?? DEFAULT_CONFIG.screenshotDir,
    chromiumExecutablePath:
      process.env.CHROMIUM_EXECUTABLE_PATH ?? fileConfig.chromiumExecutablePath,
    databaseUrl: process.env.DATABASE_URL ?? fileConfig.databaseUrl,
    persistRecording:
      envPersistRecording ??
      fileConfig.persistRecording ??
      ((process.env.DATABASE_URL ?? fileConfig.databaseUrl) ? true : DEFAULT_CONFIG.persistRecording),
    sessionTtlHours:
      envSessionTtlHours ?? fileConfig.sessionTtlHours ?? DEFAULT_CONFIG.sessionTtlHours,
    dbPort: envDbPort ?? fileConfig.dbPort ?? DEFAULT_CONFIG.dbPort,
    healthPort: envHealthPort ?? fileConfig.healthPort,
    dashboardEnabled:
      envDashboardEnabled ??
      fileConfig.dashboardEnabled ??
      (envHealthPort !== undefined ||
        fileConfig.healthPort !== undefined ||
        resolvedMcpTransport === 'http' ||
        fileConfig.mcpTransport === 'http'),
    mcpTransport: resolvedMcpTransport ?? fileConfig.mcpTransport ?? DEFAULT_CONFIG.mcpTransport,
    mcpHttpPort: envMcpHttpPort ?? fileConfig.mcpHttpPort ?? DEFAULT_CONFIG.mcpHttpPort,
    mcpHttpHost:
      process.env.MCP_HTTP_HOST ?? fileConfig.mcpHttpHost ?? DEFAULT_CONFIG.mcpHttpHost,
  };
}
