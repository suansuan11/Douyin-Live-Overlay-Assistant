import { build } from 'esbuild';

const common = {
  bundle: true,
  platform: 'node' as const,
  target: 'node22',
  external: ['electron'],
  sourcemap: true,
  logLevel: 'info' as const
};

await Promise.all([
  build({
    ...common,
    entryPoints: ['electron/main/index.ts'],
    outfile: 'dist-electron/main/index.cjs',
    format: 'cjs'
  }),
  build({
    ...common,
    entryPoints: ['electron/preload/index.ts'],
    outfile: 'dist-electron/preload/index.cjs',
    format: 'cjs'
  })
]);
