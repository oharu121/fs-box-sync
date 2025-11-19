# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.1]

### Fixed

- **Critical: Error handling now uses AxonError instead of AxiosError**
  - `axios-fluent` wraps AxiosError in AxonError, so 401 errors were not being caught
  - Updated `withRetry`, `refreshAccessToken`, and `enhanceError` to use `AxonError`
  - Token refresh and retry logic now works correctly on 401 responses
  - Uses `error.status` and `error.responseData` instead of `error.response?.status`

## [1.3.0]

### Added

- **`uploadFileThenRemove(folderId, filePath)`** - Upload file and remove locally
  - Uploads file to Box then deletes the local file
  - Returns the uploaded file ID
  - Useful for one-way sync workflows

- **`deleteAllWebhooks()`** - Delete all webhooks
  - Fetches all webhooks and deletes them sequentially
  - Returns the number of webhooks deleted
  - Sequential deletion to avoid API rate limiting

### Fixed

- **Critical: Error handling now uses AxonError instead of AxiosError**
  - `axios-fluent` wraps AxiosError in AxonError, so 401 errors were not being caught
  - Updated `withRetry`, `refreshAccessToken`, and `enhanceError` to use `AxonError`
  - Token refresh and retry logic now works correctly on 401 responses
  - Uses `error.status` and `error.responseData` instead of `error.response?.status`

## [1.2.2]

### Added

- **Global Locale Configuration**: Configure date formatting globally via `BoxConfig`
  - New `locale` option in `BoxConfig` (default: `'en-US'`)
  - Supports `'en-US'`, `'ja-JP'`, `'zh-CN'`, and other locales
  - Automatically applied to all date-based operations
  - Example: `box.configure({ locale: 'ja-JP' })`

### Changed

- **`formatDateFolders()` now uses dayjs for date formatting**
  - Replaced manual date manipulation with dayjs library
  - Cleaner, more maintainable code
  - Reduced function complexity from 43 to 24 lines
  - Required parameters: `date` and `locale` (no defaults)

- **`uploadWithYearMonthFolders()` signature simplified**
  - Before: `uploadWithYearMonthFolders(folderId, filePath, locale?)`
  - After: `uploadWithYearMonthFolders(folderId, filePath)`
  - Now uses globally configured locale from `BoxConfig`
  - Breaking change: locale parameter removed

### Dependencies

- Added `dayjs` (^1.11.19) for locale-aware date formatting

## [1.2.0]

### Breaking Changes

- **`readDir()` and `readFile()` now always sync locally**
  - Removed `ensureSync` parameter - these methods always wait for Box Drive sync
  - Methods now consistently read from local filesystem only
  - For cloud-only operations, use `api.listFolderItems()` or `api.getFileContent()` directly
  - Rationale: Method names imply local operations, so sync should be guaranteed

### Added

- **`getLocalPathSynced(id, type, strategy?)`** - Get local path with guaranteed sync
  - Returns path only after confirming file/folder exists locally
  - Accepts optional sync strategy parameter
  - Complements existing `getLocalPath()` which is fast but doesn't guarantee existence

- **`existsByNameAndSynced(parentId, name, type)`** - Check existence by name
  - Combines name lookup with sync verification
  - Returns `true` only if item exists in cloud AND is synced locally
  - Useful for workflows that need to verify items by name before processing

### Changed

- **`readDir(folderId)`** signature simplified
  - Before: `readDir(folderId, ensureSync?: boolean)`
  - After: `readDir(folderId)`
  - Always reads from synced local filesystem

- **`readFile(fileId)`** signature simplified
  - Before: `readFile(fileId, ensureSync?: boolean)`
  - After: `readFile(fileId)`
  - Always reads from synced local filesystem

## [1.1.0]

### Added

- **Access Token Support (Tier 1)**: Quick testing mode with developer tokens
  - New `accessToken` option in `BoxConfig` for immediate API access
  - Perfect for learning, POC, and experiments (~1 hour validity)
  - No OAuth flow required - just copy/paste from Box Developer Console

- **Comprehensive Error Handling**: Automatic 401 detection and retry
  - `withRetry<T>` wrapper detects and recovers from 401 errors
  - `invalidateAndRefresh()` automatically refreshes expired tokens
  - Falls back to token provider when refresh token is invalid
  - Enhanced error messages for all HTTP status codes (404, 409, 403, 500+)

- **Three-Tier Documentation**: Progressive complexity model in README
  - 🟢 Tier 1: Quick Testing (access token only)
  - 🟡 Tier 2: Production (refresh token with auto-refresh)
  - 🔵 Tier 3: Enterprise (token provider with full automation)
  - Comparison table and decision guide

- **Best Practice: Wrapper Module Pattern** (New dedicated section)
  - Explains why wrapper modules are recommended for production
  - Step-by-step guide for all three tiers
  - Highlights that package is designed for singleton usage
  - Shows benefits: single source of truth, type safety, easy testing

### Fixed

- **CRITICAL: Token Storage Race Condition**
  - Provider was incorrectly called even when valid tokens existed in storage
  - `loadFromStorage()` now properly awaited before token checks
  - Prevents unnecessary OAuth flows and token invalidation on startup
  - Fixes issue where "First attempt getting box code" logged before "Credentials loaded from storage"

- **uploadWithYearMonthFolders API Signature**
  - Removed unnecessary `date` parameter (always uses current date)
  - Updated from `(folderId, filePath, date?, locale?)` to `(folderId, filePath, locale?)`
  - Fixed JSDoc mismatch (was showing 3 params but had 4)
  - Updated all tests and documentation

### Changed

- **Improved TypeScript Error Handling**
  - Replaced duck-typed `error?.response?.status` with proper `instanceof AxiosError`
  - Better type safety and IDE autocomplete
  - No ESLint warnings for `@typescript-eslint/no-explicit-any`
  - Added `AxiosError` import from axios

- **Enhanced Token Refresh Logic**
  - `refreshAccessToken()` now handles 401/400 errors gracefully
  - Automatically falls back to token provider when refresh token invalid
  - Clears invalid tokens from storage
  - Better error messages and logging

- **All API Methods Now Auto-Retry on 401**
  - Webhooks: `getAllWebhooks`, `createWebhook`, `deleteWebhook`
  - Files: `getFileInfo`, `getFileContent`, `downloadFile`, `deleteFile`, `moveFile`, `uploadFile`
  - Folders: `getFolderInfo`, `listFolderItems`, `createFolder`, `searchInFolder`
  - Shared Links: `getSharedLinkFileId`, `downloadFromSharedLink`
  - Upload sessions: `createUploadSession`, `commitSession`, `normalUpload`

### Technical Improvements

- Added `storageLoadPromise` to track token storage loading state
- Added `isRetrying` flag to prevent infinite retry loops
- Error enhancement with context-aware messages
- Better separation of concerns (retry logic, error handling, token refresh)

## [1.0.0] - 2025-11-16

### Added

- Initial release with 3-layer architecture
- BoxAPI (raw API) → BoxDrive (sync bridge) → BoxFS (fs-like interface)
- Token provider pattern for OAuth automation
- Persistent token storage across sessions
- Smart Box Drive sync verification with multiple strategies
- ID-based operations (no local paths in public API)
- Automatic chunked uploads for files >20MB
- Webhooks, shared links, and Office Online integration

### Features

- **BoxFS API**: High-level filesystem-like operations
  - `readDir`, `readFile`, `writeFile`, `deleteFile`
  - `uploadFile`, `downloadFile`, `uploadWithYearMonthFolders`
  - `findByName`, `search`, `createFolderIfNotExists`
  - `getOfficeOnlineUrl`, `openLocally`

- **BoxDrive API**: Sync bridge for local filesystem
  - `getLocalPath`, `waitForSync`, `isSynced`
  - `isBoxDriveRunning`, `openLocally`
  - Multiple sync strategies: `poll`, `smart`, `force`

- **BoxAPI**: Pure REST API wrapper
  - File operations: upload, download, delete, move
  - Folder operations: create, list, search
  - Webhooks: create, list, delete
  - Shared links: download from shared links

### Cross-Platform

- Windows: `C:\Users\{user}\AppData\Local\fs-box-sync\tokens.json`
- Mac: `~/.config/fs-box-sync/tokens.json`
- Linux: `~/.config/fs-box-sync/tokens.json`

[Unreleased]: https://github.com/oharu121/fs-box-sync/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/oharu121/fs-box-sync/releases/tag/v1.0.0
