import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import process from 'node:process';
import { build } from 'esbuild';

const require = createRequire(import.meta.url);
const electronBinary = require('electron') as string;

await import('./build-electron');

const child = spawn(electronBinary, ['.'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    VITE_DEV_SERVER_URL: process.env.VITE_DEV_SERVER_URL ?? 'http://127.0.0.1:5173',
    NODE_ENV: 'development'
  }
});

child.on('close', (code) => {
  process.exit(code ?? 0);
});

process.on('SIGINT', () => {
  child.kill('SIGINT');
});

void build;
