import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs'];

function isRelativeOrAbsolute(specifier) {
  return specifier.startsWith('./') || specifier.startsWith('../') || specifier.startsWith('/');
}

function hasExtension(specifier) {
  return path.extname(specifier) !== '';
}

function resolveCandidate(specifier, parentURL) {
  const parentDir = parentURL?.startsWith('file:')
    ? path.dirname(fileURLToPath(parentURL))
    : process.cwd();
  const basePath = specifier.startsWith('/') ? specifier : path.resolve(parentDir, specifier);

  for (const extension of EXTENSIONS) {
    const candidate = `${basePath}${extension}`;
    if (existsSync(candidate)) {
      return pathToFileURL(candidate).href;
    }
  }

  for (const extension of EXTENSIONS) {
    const candidate = path.join(basePath, `index${extension}`);
    if (existsSync(candidate)) {
      return pathToFileURL(candidate).href;
    }
  }

  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (isRelativeOrAbsolute(specifier) && !hasExtension(specifier)) {
    const candidate = resolveCandidate(specifier, context.parentURL);
    if (candidate) {
      return nextResolve(candidate, context);
    }
  }

  return nextResolve(specifier, context);
}
