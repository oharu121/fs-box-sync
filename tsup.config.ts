import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true, // Generate declaration files
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  // Don't bundle dependencies - let the consuming project handle them
  // This prevents CJS modules from being bundled with dynamic require() calls
  external: [
    /^node:.*/,  // External all Node.js built-ins
    /^[^./]/,    // External all node_modules dependencies
  ],
});
