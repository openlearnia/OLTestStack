import type { McpErrorResponse, McpSuccessResponse } from '../core/types/responses.js';

export type ToolHandler = (
  input: unknown,
) => Promise<McpSuccessResponse<unknown> | McpErrorResponse>;

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: ToolHandler;
}

export class ToolRegistry {
  private readonly tools = new Map<string, ToolDefinition>();

  register(tool: ToolDefinition): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Duplicate tool registration: ${tool.name}`);
    }
    this.tools.set(tool.name, tool);
  }

  /** Normalize legacy dotted names (browser.launch) to underscore (browser_launch). */
  private resolveName(name: string): string {
    return name.includes('.') ? name.replace(/\./g, '_') : name;
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(this.resolveName(name));
  }

  list(): ToolDefinition[] {
    return [...this.tools.values()];
  }

  async dispatch(
    name: string,
    input: unknown,
  ): Promise<McpSuccessResponse<unknown> | McpErrorResponse> {
    const tool = this.tools.get(this.resolveName(name));
    if (!tool) {
      return {
        ok: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: `Unknown tool '${name}'.`,
        },
      };
    }
    return tool.handler(input);
  }
}
