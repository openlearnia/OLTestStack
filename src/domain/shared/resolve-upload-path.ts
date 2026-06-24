import { existsSync, realpathSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import type { ResolvedConfig } from '../../core/config/load-config.js';

export function resolveAllowedUploadPath(
  config: ResolvedConfig,
  filePath: string,
): { absolute: string } | { error: string } {
  const uploadRoot = resolve(config.uploadDir);
  const candidate = resolve(filePath);

  if (!existsSync(candidate)) {
    return { error: `File not found: ${filePath}` };
  }

  let realPath: string;
  try {
    realPath = realpathSync(candidate);
  } catch {
    return { error: `Cannot resolve path: ${filePath}` };
  }

  const rootReal = existsSync(uploadRoot) ? realpathSync(uploadRoot) : uploadRoot;
  if (realPath !== rootReal && !realPath.startsWith(rootReal + sep)) {
    return {
      error: `Path '${filePath}' is outside allowed upload directory '${config.uploadDir}'`,
    };
  }

  return { absolute: realPath };
}
