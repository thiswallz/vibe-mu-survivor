import { build } from '../apps/ui/build.mjs';
await build();
process.argv.push('--production');
await import('../apps/server/src/index.mjs');
