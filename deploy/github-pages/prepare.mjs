// Run deliberately when following GITHUB_PAGES_WASM.md; not run on install.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
const root = new URL('../../', import.meta.url);
const view = new URL('frontend/src/components/LeafletMicroView.vue', root);
const oldImport = "import { routeToCabinetNative } from '../utils/nativeNavigation';";
const newImport = "import { routeToCabinetWasm as routeToCabinetNative } from '../utils/wasmNavigation';";
const original = await readFile(view, 'utf8');
if (!original.includes(oldImport) && !original.includes(newImport)) {
  throw new Error('网页的寻路导入语句已变动，请按教程手动切换。未写入文件。');
}
const files = [
  ['deploy/github-pages/wasmNavigation.ts', 'frontend/src/utils/wasmNavigation.ts'],
  ['deploy/github-pages/pages.yml', '.github/workflows/pages.yml'],
];
const copies = [];
for (const [source, destination] of files) {
  const content = await readFile(new URL(source, root), 'utf8');
  let existing;
  try { existing = await readFile(new URL(destination, root), 'utf8'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (existing !== undefined && existing !== content) {
    throw new Error(`${destination} 已有不同内容，请先手动核对。未写入文件。`);
  }
  copies.push([destination, content]);
}
for (const [destination, content] of copies) {
  const url = new URL(destination, root);
  await mkdir(new URL('./', url), { recursive: true });
  await writeFile(url, content);
}
await writeFile(view, original.replace(oldImport, newImport)
  .replace('无法连接寻路服务，请启动后端后重试。', '寻路模块未能载入，请刷新页面后重试。'));
console.log('已切换为 WebAssembly，并创建 Pages 工作流。尚未编译、上传或发布。');
