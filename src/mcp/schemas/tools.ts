export const browserLaunchSchema = {
  type: 'object',
  properties: {
    headless: { type: 'boolean', default: true },
    recordingEnabled: { type: 'boolean', default: true },
    viewport: {
      type: 'object',
      properties: {
        width: { type: 'integer', minimum: 320, default: 1280 },
        height: { type: 'integer', minimum: 240, default: 720 },
      },
    },
    userAgent: { type: 'string' },
  },
  additionalProperties: false,
} as const;

export const browserCloseSchema = {
  type: 'object',
  properties: {
    browserId: { type: 'string', format: 'uuid' },
    testName: { type: 'string', description: 'Optional test name for report persistence' },
  },
  required: ['browserId'],
  additionalProperties: false,
} as const;

export const pageCreateSchema = {
  type: 'object',
  properties: {
    browserId: { type: 'string', format: 'uuid' },
  },
  required: ['browserId'],
  additionalProperties: false,
} as const;

export const pageNavigateSchema = {
  type: 'object',
  properties: {
    pageId: { type: 'string', format: 'uuid' },
    url: { type: 'string', format: 'uri' },
    waitUntil: {
      type: 'string',
      enum: ['load', 'domcontentloaded', 'networkidle'],
      default: 'load',
    },
    timeoutMs: { type: 'integer', minimum: 1000, default: 30000 },
  },
  required: ['pageId', 'url'],
  additionalProperties: false,
} as const;

export const pageReloadSchema = {
  type: 'object',
  properties: {
    pageId: { type: 'string', format: 'uuid' },
    waitUntil: {
      type: 'string',
      enum: ['load', 'domcontentloaded', 'networkidle'],
      default: 'load',
    },
    timeoutMs: { type: 'integer', minimum: 1000, default: 30000 },
  },
  required: ['pageId'],
  additionalProperties: false,
} as const;

export const pageCloseSchema = {
  type: 'object',
  properties: {
    pageId: { type: 'string', format: 'uuid' },
  },
  required: ['pageId'],
  additionalProperties: false,
} as const;

export const pageElementsSchema = {
  type: 'object',
  properties: {
    pageId: { type: 'string', format: 'uuid' },
    includeHidden: { type: 'boolean', default: false },
  },
  required: ['pageId'],
  additionalProperties: false,
} as const;

export const pageFindSchema = {
  type: 'object',
  properties: {
    pageId: { type: 'string', format: 'uuid' },
    query: { type: 'string', minLength: 1 },
  },
  required: ['pageId', 'query'],
  additionalProperties: false,
} as const;

export const pageClickSchema = {
  type: 'object',
  properties: {
    pageId: { type: 'string', format: 'uuid' },
    elementId: { type: 'string', format: 'uuid' },
    query: {
      type: 'string',
      minLength: 1,
      description:
        'Optional find query for replay recording. Stored on the action event when provided; otherwise inferred from page_find.',
    },
  },
  required: ['pageId', 'elementId'],
  additionalProperties: false,
} as const;

export const pageTypeSchema = {
  type: 'object',
  properties: {
    pageId: { type: 'string', format: 'uuid' },
    elementId: { type: 'string', format: 'uuid' },
    value: { type: 'string' },
    query: {
      type: 'string',
      minLength: 1,
      description:
        'Optional find query for replay recording. Stored on the action event when provided; otherwise inferred from page_find.',
    },
    append: { type: 'boolean', default: false },
    delay: { type: 'integer', minimum: 0, default: 0 },
  },
  required: ['pageId', 'elementId', 'value'],
  additionalProperties: false,
} as const;

export const pagePressSchema = {
  type: 'object',
  properties: {
    pageId: { type: 'string', format: 'uuid' },
    key: { type: 'string', minLength: 1 },
    elementId: {
      type: 'string',
      format: 'uuid',
      description: 'Optional element to focus before pressing the key.',
    },
    query: {
      type: 'string',
      minLength: 1,
      description:
        'Optional find query for replay recording when elementId is set. Stored on the action event when provided.',
    },
  },
  required: ['pageId', 'key'],
  additionalProperties: false,
} as const;

export const pageScrollSchema = {
  type: 'object',
  properties: {
    pageId: { type: 'string', format: 'uuid' },
    direction: { type: 'string', enum: ['up', 'down', 'left', 'right'] },
    amount: { type: 'integer', minimum: 1, default: 720 },
    elementId: {
      type: 'string',
      format: 'uuid',
      description: 'Optional scrollable element. Scrolls the element viewport instead of the window.',
    },
  },
  required: ['pageId', 'direction'],
  additionalProperties: false,
} as const;

export const pageScreenshotSchema = {
  type: 'object',
  properties: {
    pageId: { type: 'string', format: 'uuid' },
    fullPage: { type: 'boolean', default: false },
  },
  required: ['pageId'],
  additionalProperties: false,
} as const;

export const pageSnapshotSchema = {
  type: 'object',
  properties: {
    pageId: { type: 'string', format: 'uuid' },
  },
  required: ['pageId'],
  additionalProperties: false,
} as const;

export const pageTextSchema = {
  type: 'object',
  properties: {
    pageId: { type: 'string', format: 'uuid' },
  },
  required: ['pageId'],
  additionalProperties: false,
} as const;

export const pageHtmlSchema = {
  type: 'object',
  properties: {
    pageId: { type: 'string', format: 'uuid' },
  },
  required: ['pageId'],
  additionalProperties: false,
} as const;

export const pageNetworkSchema = {
  type: 'object',
  properties: {
    pageId: { type: 'string', format: 'uuid' },
    filter: { type: 'string' },
    since: { type: 'string', format: 'date-time' },
  },
  required: ['pageId'],
  additionalProperties: false,
} as const;

export const pageConsoleSchema = {
  type: 'object',
  properties: {
    pageId: { type: 'string', format: 'uuid' },
    level: {
      type: 'string',
      enum: ['all', 'error', 'warn', 'log', 'info', 'debug'],
      default: 'all',
    },
  },
  required: ['pageId'],
  additionalProperties: false,
} as const;

export const pageWaitSchema = {
  type: 'object',
  properties: {
    pageId: { type: 'string', format: 'uuid' },
    condition: {
      type: 'string',
      enum: ['element', 'url', 'networkIdle', 'timeout'],
    },
    query: { type: 'string' },
    value: { type: 'string' },
    match: { type: 'string', enum: ['equals', 'contains'], default: 'contains' },
    durationMs: { type: 'integer', minimum: 100 },
    timeoutMs: { type: 'integer', minimum: 1000, default: 30000 },
  },
  required: ['pageId', 'condition'],
  additionalProperties: false,
} as const;

export const assertExistsSchema = {
  type: 'object',
  properties: {
    pageId: { type: 'string', format: 'uuid' },
    query: { type: 'string', minLength: 1 },
    elementId: { type: 'string', format: 'uuid' },
  },
  required: ['pageId'],
  additionalProperties: false,
} as const;

export const assertTextSchema = {
  type: 'object',
  properties: {
    pageId: { type: 'string', format: 'uuid' },
    contains: { type: 'string', minLength: 1 },
    match: {
      type: 'string',
      enum: ['contains', 'equals'],
      default: 'contains',
    },
  },
  required: ['pageId', 'contains'],
  additionalProperties: false,
} as const;

export const assertUrlSchema = {
  type: 'object',
  properties: {
    pageId: { type: 'string', format: 'uuid' },
    url: { type: 'string', minLength: 1 },
    match: {
      type: 'string',
      enum: ['equals', 'contains'],
      default: 'contains',
    },
  },
  required: ['pageId', 'url'],
  additionalProperties: false,
} as const;

export const assertNetworkSchema = {
  type: 'object',
  properties: {
    pageId: { type: 'string', format: 'uuid' },
    url: { type: 'string', minLength: 1, description: 'URL substring to match' },
    status: {
      oneOf: [
        { type: 'integer', minimum: 100, maximum: 599 },
        { type: 'string', pattern: '^[1-5]xx$' },
      ],
      description: 'Exact status code (200) or range (2xx)',
    },
  },
  required: ['pageId', 'url', 'status'],
  additionalProperties: false,
} as const;

export const sessionExportSchema = {
  type: 'object',
  properties: {
    browserId: { type: 'string', format: 'uuid' },
    name: {
      type: 'string',
      description: 'Optional script name. Defaults to session-<browserId prefix>.',
    },
    goal: {
      type: 'string',
      description: 'Optional natural-language goal stored in the exported script.',
    },
  },
  required: ['browserId'],
  additionalProperties: false,
} as const;

export const sendReportSchema = {
  type: 'object',
  properties: {
    browserId: { type: 'string', format: 'uuid' },
    includeScreenshots: {
      type: 'boolean',
      default: false,
      description: 'Capture fresh PNG screenshots for each open page and attach paths to the report.',
    },
    note: {
      type: 'string',
      description: 'Optional user context included in the debug report.',
    },
  },
  required: ['browserId'],
  additionalProperties: false,
} as const;

export const saveSessionSchema = {
  type: 'object',
  properties: {
    reportId: {
      type: 'string',
      format: 'uuid',
      description: 'Persisted test report id (from dashboard or after browser_close)',
    },
    sessionId: {
      type: 'string',
      format: 'uuid',
      description: 'Alias for reportId',
    },
    name: {
      type: 'string',
      description: 'Optional new display name when promoting to saved',
    },
  },
  additionalProperties: false,
} as const;

export const testRunSchema = {
  type: 'object',
  properties: {
    goal: {
      type: 'string',
      minLength: 1,
      description: 'Natural language description of the test objective.',
    },
    name: {
      type: 'string',
      description: 'Optional test name for the report. Defaults to goal.',
    },
    url: {
      type: 'string',
      format: 'uri',
      description: 'Starting URL to navigate to.',
    },
    steps: {
      type: 'array',
      description:
        'Optional explicit step sequence. If omitted, returns agent-driven guidance unless script or scriptFile is provided.',
      items: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: [
              'navigate',
              'click',
              'type',
              'press',
              'scroll',
              'wait',
              'screenshot',
              'assert.exists',
              'assert.text',
              'assert.url',
              'assert.network',
            ],
          },
        },
        required: ['action'],
      },
    },
    script: {
      type: 'object',
      description: 'Inline replay script (.olteststack.json shape) with ordered steps.',
      properties: {
        version: { type: 'string', enum: ['1.0'] },
        name: { type: 'string' },
        goal: { type: 'string' },
        url: { type: 'string' },
        steps: { type: 'array' },
      },
      required: ['version', 'name', 'steps'],
    },
    scriptFile: {
      type: 'string',
      description: 'Path to a .olteststack.json replay script on the MCP server filesystem.',
    },
    headless: { type: 'boolean', default: true },
    stopOnFailure: { type: 'boolean', default: true },
    timeoutMs: { type: 'integer', minimum: 5000, default: 60000 },
  },
  required: ['goal'],
  additionalProperties: false,
} as const;
