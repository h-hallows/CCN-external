/**
 * Walking the module graph from a set of entry points, stopping at package boundaries.
 *
 * Two different gates need this and neither is about types, so neither tsc nor a unit
 * test catches what they catch:
 *
 *   tests/request.test.ts   which modules reachable from app/(client) may touch the
 *                           statutory tables (W6).
 *   tests/clientPortal.test.ts  that no 'use client' component drags server-only code
 *                           into the browser bundle.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('..', import.meta.url));

/**
 * Source with comments stripped, so a comment explaining a rule is not read as
 * breaking it. A `//` inside a string (a URL) takes the rest of that line with it,
 * which only ever narrows what is searched — acceptable for assertions that are all
 * negative.
 */
export function code(file: string): string {
  return readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

export function imports(src: string): string[] {
  const specs = /(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g;
  return [...src.matchAll(specs)].map((m) => m[1]!);
}

/** Resolves a specifier to a file in this repo, or null for a package. */
export function resolveImport(spec: string, from: string): string | null {
  let base: string;
  if (spec.startsWith('@/')) base = path.join(ROOT, spec.slice(2));
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(from), spec);
  else return null;

  for (const candidate of [
    base, `${base}.ts`, `${base}.tsx`,
    path.join(base, 'index.ts'), path.join(base, 'index.tsx'),
  ]) {
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch { /* next candidate */ }
  }
  return null;
}

export function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

/**
 * Every module reachable from `entries`, transitively, stopping at packages.
 *
 * `stopAt` marks a module the walk may include but must not descend through. That is
 * what a `'use server'` file is: Next replaces the import with a network call, so what
 * it imports stays on the server and is not part of the caller's bundle. Filtering
 * such files out of the finished set does not work — by then the walk has already
 * pulled in everything behind them.
 */
export function reachableFrom(
  entries: string[],
  stopAt: (file: string) => boolean = () => false,
): string[] {
  const seen = new Set<string>();
  const queue = [...entries];
  while (queue.length > 0) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    if (!entries.includes(file) && stopAt(file)) continue;
    for (const spec of imports(code(file))) {
      const next = resolveImport(spec, file);
      if (next && !seen.has(next)) queue.push(next);
    }
  }
  return [...seen];
}

/** True for a module Next turns into a server boundary. */
export function isServerBoundary(file: string): boolean {
  return /^\s*(['"])use server\1/m.test(readFileSync(file, 'utf8'));
}

export const rel = (file: string): string => path.relative(ROOT, file);
