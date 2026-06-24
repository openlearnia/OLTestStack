import type { AppContext } from '../../core/context.js';
import { createError, success } from '../../core/errors/envelope.js';
import type { McpErrorResponse, McpSuccessResponse } from '../../core/types/responses.js';
import type { BrowserCookie } from '../../cdp/adapter.js';
import { mapCdpError } from '../../cdp/error-mapper.js';
import { z } from 'zod';

const cookieSchema = z
  .object({
    name: z.string().min(1),
    value: z.string(),
    domain: z.string().optional(),
    path: z.string().optional(),
    expires: z.number().optional(),
    httpOnly: z.boolean().optional(),
    secure: z.boolean().optional(),
    sameSite: z.enum(['Strict', 'Lax', 'None']).optional(),
  })
  .strict();

const pageCookiesSchema = z
  .object({
    browserId: z.string().uuid(),
    op: z.enum(['get', 'set', 'clear']),
    cookies: z.array(cookieSchema).optional(),
    urls: z.array(z.string().min(1)).optional(),
  })
  .strict()
  .refine((data) => data.op !== 'set' || (data.cookies && data.cookies.length > 0), {
    message: 'cookies array is required for set',
    path: ['cookies'],
  });

export interface PageCookiesGetResult {
  op: 'get';
  cookies: BrowserCookie[];
  count: number;
}

export interface PageCookiesSetResult {
  op: 'set';
  set: number;
}

export interface PageCookiesClearResult {
  op: 'clear';
  cleared: true;
}

export async function manageCookies(
  ctx: AppContext,
  input: unknown,
): Promise<
  McpSuccessResponse<PageCookiesGetResult | PageCookiesSetResult | PageCookiesClearResult> | McpErrorResponse
> {
  const parsed = pageCookiesSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return createError('INVALID_INPUT', issue?.message ?? 'Invalid input', {
      field: issue?.path.join('.') ?? 'input',
    });
  }

  const { browserId, op, cookies, urls } = parsed.data;
  const browser = await ctx.registry.getBrowser(browserId);
  if (!browser) {
    return createError(
      'SESSION_NOT_FOUND',
      `Browser session '${browserId}' not found. Call browser_launch first.`,
      { browserId },
    );
  }

  const cdpBrowser = { id: browserId, connected: !browser.crashed };

  try {
    if (op === 'get') {
      const result = await ctx.cdp.getCookies(cdpBrowser, urls);
      return success({ op: 'get', cookies: result, count: result.length });
    }

    if (op === 'set') {
      await ctx.cdp.setCookies(cdpBrowser, cookies!);
      return success({ op: 'set', set: cookies!.length });
    }

    await ctx.cdp.clearCookies(cdpBrowser, urls);
    return success({ op: 'clear', cleared: true });
  } catch (error) {
    const mapped = mapCdpError(error, 'page.cookies');
    return createError(mapped.code, mapped.message, { ...mapped.details, browserId, op });
  }
}

export { pageCookiesSchema };
