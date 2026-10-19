import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const cache = new Map();
// Execute the actual project modules with the project's existing TypeScript compiler.
export function load(relative, parent = path.dirname(fileURLToPath(import.meta.url))) {
  let file = path.resolve(parent, relative);
  if (!path.extname(file)) file += '.ts';
  if (cache.has(file)) return cache.get(file);
  if (file.endsWith('.json')) return JSON.parse(fs.readFileSync(file, 'utf8'));
  const exports = {};
  cache.set(file, exports);
  const { outputText } = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  });
  new Function('require', 'exports', outputText)(
    specifier => specifier.startsWith('.') ? load(specifier, path.dirname(file)) : require(specifier), exports,
  );
  return exports;
}
