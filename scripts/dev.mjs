import { spawn } from 'node:child_process';
const root = new URL('../', import.meta.url);
const tsc = new URL('../node_modules/typescript/bin/tsc', import.meta.url);
const vite = new URL('../node_modules/vite/bin/vite.js', import.meta.url);
const children = [
  spawn(process.execPath, [tsc.pathname, '-b', '--watch'], { cwd: root, stdio: 'inherit' }),
  spawn(process.execPath, [tsc.pathname, '-p', 'apps/ui', '--noEmit', '--watch'], {
    cwd: root,
    stdio: 'inherit',
  }),
  spawn(process.execPath, ['--watch', 'apps/server/dist/index.js'], {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'development',
      PORT: process.env.DEV_API_PORT || '5174',
      HOST: '127.0.0.1',
      SERVE_UI: 'false',
    },
  }),
  spawn(process.execPath, [vite.pathname], {
    cwd: new URL('../apps/ui/', import.meta.url),
    stdio: 'inherit',
  }),
];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
  process.exitCode = code;
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => stop());
for (const child of children) {
  child.on('error', (error) => {
    console.error(error.message);
    stop(1);
  });
  child.on('exit', (code) => {
    if (!stopping) stop(code || 0);
  });
}
