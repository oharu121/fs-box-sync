# Plan: Fix Next.js Turbopack compatibility by externalizing dependencies

**Status:** Completed
**Date:** 2026-02-07

## Goal

Fix compatibility issues with Next.js Turbopack by preventing CJS dependencies from being bundled with dynamic `require()` calls that fail in strict ESM environments.

## Summary of Changes

- Modified tsup build configuration to externalize all dependencies
- Prevented bundling of CJS modules (form-data, combined-stream, delayed-stream) from axios-fluent
- Eliminated dynamic `require()` polyfills (`__require`) in ESM output
- Reduced bundle size from 313 KB to 40 KB
- Package now properly loads dependencies through consuming project's module resolution

## Files Modified

- [tsup.config.ts](tsup.config.ts) - Added `external` configuration to prevent dependency bundling
  - Added regex pattern to externalize all Node.js built-ins (`/^node:.*/`)
  - Added regex pattern to externalize all node_modules dependencies (`/^[^./]/`)

## Breaking Changes

None

## Deprecations

None
