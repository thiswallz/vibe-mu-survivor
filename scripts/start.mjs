import { spawn } from 'node:child_process';
const build = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], {
  stdio: 'inherit',
});
const code = await new Promise((resolve) => build.on('exit', resolve));
if (code !== 0) process.exit(code || 1);
process.argv.push('--production');
await import('../apps/server/dist/index.js');
