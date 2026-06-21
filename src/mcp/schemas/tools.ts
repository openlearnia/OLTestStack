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
