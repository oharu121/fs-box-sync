import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true, // Generate declaration files
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
});
