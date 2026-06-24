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

const findDisambiguationProperties = {
  preferRegion: {
    type: 'string',
    minLength: 1,
    description: 'Boost elements in this region hint (toolbar, filter, grid-header, grid-body)',
  },
  preferRole: {
    type: 'string',
    minLength: 1,
    description: 'Boost elements with this ARIA role',
  },
  candidateIndex: {
    type: 'integer',
    minimum: 0,
    description: 'Select the Nth ranked match (0-based) when multiple elements match',
  },
} as const;

export const pageClickQuerySchema = {
  type: 'object',
  properties: {
    pageId: { type: 'string', format: 'uuid' },
    query: { type: 'string', minLength: 1 },
    ...findDisambiguationProperties,
  },
  required: ['pageId', 'query'],
  additionalProperties: false,
} as const;

export const pageTypeQuerySchema = {
  type: 'object',
  properties: {
    pageId: { type: 'string', format: 'uuid' },
    query: { type: 'string', minLength: 1 },
    value: { type: 'string' },
    ...findDisambiguationProperties,
    append: { type: 'boolean', default: false },
    delay: { type: 'integer', minimum: 0, default: 0 },
  },
  required: ['pageId', 'query', 'value'],
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

export const pageSelectSchema = {
  type: 'object',
  properties: {
    pageId: { type: 'string', format: 'uuid' },
    elementId: { type: 'string', format: 'uuid' },
    query: { type: 'string', minLength: 1 },
    preferRegion: findDisambiguationProperties.preferRegion,
    preferRole: findDisambiguationProperties.preferRole,
    candidateIndex: findDisambiguationProperties.candidateIndex,
    value: { type: 'string', description: 'Option value attribute (when by is value)' },
    label: { type: 'string', description: 'Visible option label (when by is label)' },
    by: { type: 'string', enum: ['value', 'label'], description: 'Match by value or label (default inferred)' },
    match: {
      type: 'string',
      enum: ['equals', 'contains'],
      default: 'equals',
      description: 'Label match mode',
    },
  },
  required: ['pageId'],
  additionalProperties: false,
} as const;

export const pageUploadSchema = {
  type: 'object',
  properties: {
    pageId: { type: 'string', format: 'uuid' },
    elementId: { type: 'string', format: 'uuid' },
    query: { type: 'string', minLength: 1 },
    preferRegion: findDisambiguationProperties.preferRegion,
    preferRole: findDisambiguationProperties.preferRole,
    candidateIndex: findDisambiguationProperties.candidateIndex,
    files: {
      type: 'array',
      items: { type: 'string', minLength: 1 },
      minItems: 1,
      description: 'Server-local file paths under UPLOAD_DIR',
    },
    clear: { type: 'boolean', default: false, description: 'Clear existing file selection first' },
  },
  required: ['pageId', 'files'],
  additionalProperties: false,
} as const;

export const sessionListSchema = {
  type: 'object',
  properties: {
    page: { type: 'integer', minimum: 1, default: 1 },
    limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    status: { type: 'string', enum: ['passed', 'failed', 'error'] },
    search: { type: 'string', minLength: 1, description: 'Filter by test name substring' },
    persistence: { type: 'string', enum: ['all', 'saved', 'expiring'] },
  },
  additionalProperties: false,
} as const;

export const scriptLintSchema = {
  type: 'object',
  properties: {
    script: {
      type: 'object',
      description: 'Inline .olteststack.json script object (validated at lint time)',
      additionalProperties: true,
    },
    scriptFile: {
      type: 'string',
      description: 'Path to a .olteststack.json file on the MCP server filesystem',
    },
  },
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
    returnInline: {
      type: 'boolean',
      default: false,
      description:
        'When true and the PNG is under 1MB, also return inline image content in the MCP response.',
    },
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
      enum: ['element', 'elementHidden', 'url', 'networkIdle', 'networkRequest', 'timeout'],
    },
    query: { type: 'string' },
    value: { type: 'string' },
    match: { type: 'string', enum: ['equals', 'contains'], default: 'contains' },
    status: {
      oneOf: [
        { type: 'integer', minimum: 100, maximum: 599 },
        { type: 'string', pattern: '^[1-5]xx$' },
      ],
      description: 'Expected status for networkRequest condition (default 2xx)',
    },
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
    negate: { type: 'boolean', default: false, description: 'Assert the opposite (element absent, text/url/network not matched)' },
    soft: { type: 'boolean', default: false, description: 'Record failure without failing the call (collected in test_run softFailures)' },
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
    negate: { type: 'boolean', default: false },
    soft: { type: 'boolean', default: false },
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
    negate: { type: 'boolean', default: false },
    soft: { type: 'boolean', default: false },
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
    negate: { type: 'boolean', default: false },
    soft: { type: 'boolean', default: false },
  },
  required: ['pageId', 'url', 'status'],
  additionalProperties: false,
} as const;

export const pageFrameSchema = {
  type: 'object',
  properties: {
    pageId: { type: 'string', format: 'uuid' },
    action: { type: 'string', enum: ['list', 'enter', 'exit'] },
    frameIndex: { type: 'integer', minimum: 0, description: 'Index from list action' },
    frameQuery: { type: 'string', minLength: 1, description: 'CSS selector for iframe element on main page' },
    frameUrl: { type: 'string', minLength: 1, description: 'URL substring to match child frame' },
  },
  required: ['pageId', 'action'],
  additionalProperties: false,
} as const;

export const pageCookiesSchema = {
  type: 'object',
  properties: {
    browserId: { type: 'string', format: 'uuid' },
    op: { type: 'string', enum: ['get', 'set', 'clear'] },
    cookies: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          value: { type: 'string' },
          domain: { type: 'string' },
          path: { type: 'string' },
          expires: { type: 'number' },
          httpOnly: { type: 'boolean' },
          secure: { type: 'boolean' },
          sameSite: { type: 'string', enum: ['Strict', 'Lax', 'None'] },
        },
        required: ['name', 'value'],
      },
      description: 'Required for set',
    },
    urls: {
      type: 'array',
      items: { type: 'string', minLength: 1 },
      description: 'Optional URL filter for get/clear',
    },
  },
  required: ['browserId', 'op'],
  additionalProperties: false,
} as const;

export const pageAssertStateSchema = {
  type: 'object',
  properties: {
    pageId: { type: 'string', format: 'uuid' },
    checks: {
      type: 'object',
      properties: {
        exists: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              query: { type: 'string' },
              elementId: { type: 'string', format: 'uuid' },
              negate: { type: 'boolean' },
              soft: { type: 'boolean' },
            },
          },
        },
        text: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              contains: { type: 'string' },
              match: { type: 'string', enum: ['contains', 'equals'] },
              negate: { type: 'boolean' },
              soft: { type: 'boolean' },
            },
            required: ['contains'],
          },
        },
        url: {
          type: 'object',
          properties: {
            url: { type: 'string' },
            match: { type: 'string', enum: ['equals', 'contains'] },
            negate: { type: 'boolean' },
            soft: { type: 'boolean' },
          },
          required: ['url'],
        },
        network: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              url: { type: 'string' },
              status: {
                oneOf: [{ type: 'integer' }, { type: 'string', pattern: '^[1-5]xx$' }],
              },
              negate: { type: 'boolean' },
              soft: { type: 'boolean' },
            },
            required: ['url', 'status'],
          },
        },
        consoleErrorCount: {
          type: 'object',
          properties: {
            max: { type: 'integer', minimum: 0 },
            soft: { type: 'boolean' },
          },
          required: ['max'],
        },
      },
    },
    failFast: { type: 'boolean', default: false },
    soft: { type: 'boolean', default: false, description: 'Default soft flag for all checks' },
  },
  required: ['pageId', 'checks'],
  additionalProperties: false,
} as const;

export const sessionStatusSchema = {
  type: 'object',
  properties: {
    browserId: { type: 'string', format: 'uuid' },
  },
  required: ['browserId'],
  additionalProperties: false,
} as const;

export const sessionGetSchema = {
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
  },
  additionalProperties: false,
} as const;

export const sessionExportSchema = {
  type: 'object',
  properties: {
    browserId: {
      type: 'string',
      format: 'uuid',
      description: 'Active browser session (live in-memory buffer). Mutually exclusive with reportId/sessionId.',
    },
    reportId: {
      type: 'string',
      format: 'uuid',
      description: 'Persisted test report id (from dashboard or after browser_close). Rebuilds script from recorded_events.',
    },
    sessionId: {
      type: 'string',
      format: 'uuid',
      description: 'Alias for reportId when exporting from the database after close.',
    },
    name: {
      type: 'string',
      description: 'Optional script name. Defaults to session-<browserId prefix> or the persisted test name.',
    },
    goal: {
      type: 'string',
      description: 'Optional natural-language goal stored in the exported script.',
    },
  },
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
    scripts: {
      type: 'array',
      description: 'Inline suite of replay scripts executed sequentially.',
      items: {
        type: 'object',
        properties: {
          version: { type: 'string', enum: ['1.0'] },
          name: { type: 'string' },
          goal: { type: 'string' },
          url: { type: 'string' },
          steps: { type: 'array' },
        },
        required: ['version', 'name', 'steps'],
      },
      minItems: 1,
    },
    suiteFile: {
      type: 'string',
      description: 'Path to a JSON suite file ({ scripts: [...] } or array of scripts).',
    },
    variables: {
      type: 'object',
      description:
        'Variable map for ${VAR_NAME} substitution in step strings and url before execution.',
      additionalProperties: { type: 'string' },
    },
    headless: { type: 'boolean', default: true },
    stopOnFailure: { type: 'boolean', default: true },
    timeoutMs: { type: 'integer', minimum: 5000, default: 60000 },
  },
  required: ['goal'],
  additionalProperties: false,
} as const;
