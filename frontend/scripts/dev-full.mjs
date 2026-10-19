import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const frontend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.dirname(frontend);
const owned = new Set();
const stopped = new WeakSet();
function launch(command, args, cwd) {
  const child = spawn(command, args, { cwd, stdio: 'inherit', detached: process.platform !== 'win32' });
  owned.add(child);
  child.once('exit', () => { stopped.add(child); owned.delete(child); });
  return child;
}
function stop() {
  for (const child of owned) {
    try { process.platform === 'win32' ? child.kill('SIGTERM') : process.kill(-child.pid, 'SIGTERM'); }
    catch (error) { if (error.code !== 'ESRCH') console.error(error.message); }
  }
}
function completion(child) {
  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve() : reject(new Error(`启动进程退出（${code}）`)));
  });
}
async function engineStatus() {
  try {
    const response = await fetch('http://127.0.0.1:18080/api/navigation/status', { signal: AbortSignal.timeout(1000) });
    return response.ok ? await response.json() : { available: false };
  } catch { return null; }
}
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
try {
  const status = await engineStatus();
  if (status && (!status.available || status.engine !== 'native-cpp-astar')) {
    throw new Error('18080 端口的服务未加载原版 A*。请关闭该服务后重新运行 npm run dev:full。');
  }
  if (!status) {
    await completion(launch('sh', ['path_engine/build-native.sh'], root));
    const backend = launch(process.platform === 'win32' ? 'mvnw.cmd' : './mvnw',
      ['spring-boot:run', '-Dspring-boot.run.profiles=navigation'], root);
    let ready = false;
    for (let attempt = 0; attempt < 180; attempt++) {
      if (stopped.has(backend)) throw new Error('寻路后端启动失败，请检查上方日志。');
      const current = await engineStatus();
      if (current?.available && current.engine === 'native-cpp-astar') { ready = true; break; }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    if (!ready) throw new Error('寻路后端未在 180 秒内就绪，请检查上方日志。');
  }
  console.log('原版 C++ A* 已就绪，正在打开网页服务。');
  await completion(launch(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', ...process.argv.slice(2)], frontend));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally { stop(); }
