# fs-box-sync

[![npm version](https://badge.fury.io/js/fs-box-sync.svg)](https://badge.fury.io/js/fs-box-sync)
![License](https://img.shields.io/npm/l/fs-box-sync)
![Types](https://img.shields.io/npm/types/fs-box-sync)
![NPM Downloads](https://img.shields.io/npm/dw/fs-box-sync)
![Last Commit](https://img.shields.io/github/last-commit/oharu121/fs-box-sync)
![Coverage](https://codecov.io/gh/oharu121/fs-box-sync/branch/main/graph/badge.svg)
![CI Status](https://github.com/oharu121/fs-box-sync/actions/workflows/ci.yml/badge.svg)
![GitHub Stars](https://img.shields.io/github/stars/oharu121/fs-box-sync?style=social)

Toolkit for Box REST API with automatic token management, OAuth automation support, and Box Drive integration.

## Features

- **3-Layer Architecture** - BoxAPI (raw API) → BoxDrive (sync bridge) → BoxFS (fs-like interface)
- **Token Provider Pattern** - Injectable OAuth automation (e.g., Playwright)
- **Persistent Storage** - Tokens saved across sessions
  - **Windows:** `C:\Users\{user}\AppData\Local\fs-box-sync\tokens.json`
  - **Mac/Linux:** `~/.config/fs-box-sync/tokens.json`
- **Smart Sync** - Intelligent Box Drive sync verification with multiple strategies
- **ID-based Operations** - All operations use Box IDs (no local paths in public API)
- **Chunked Uploads** - Automatic chunking for files >20MB

## Architecture

```
┌─────────────────────────────────────┐
│   BoxFS (High-level API)            │  ← Recommended
│  - readDir(id, ensureSync)          │
│  - readFile(id, ensureSync)         │
│  - uploadWithDateFolders()          │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│     BoxDrive (Sync Bridge)          │
│  - getLocalPath(id)                 │
│  - waitForSync(id, strategy)        │
│  - Smart sync verification          │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│      BoxAPI (Pure API)              │
│  - getFileInfo(id)                  │
│  - uploadFile(id, file)             │
└─────────────────────────────────────┘
```

## Installation

```bash
npm install fs-box-sync
```

## Quick Start

### Simple Singleton Usage (Recommended)

```typescript
import box from 'fs-box-sync';
import Playwright from 'bss-automation';

// Configure once at app startup
box.configure({
  clientId: process.env.BOX_CLIENT_ID,
  clientSecret: process.env.BOX_CLIENT_SECRET,
  tokenProvider: async (callback) => {
    return await Playwright.getBoxCode(callback);
  }
});

// Then use anywhere
await box.uploadFile('folder-id', './file.pdf');

// Upload with date folders - pass locale as parameter
await box.uploadWithDateFolders('folder-id', './file.pdf', new Date(), 'ja-JP');

// Read directory with sync verification
const files = await box.readDir('folder-id', true);
```

### Advanced: BoxAPI (Low-level - No Box Drive)

```typescript
import { BoxAPI } from 'fs-box-sync';

const api = new BoxAPI({
  clientId: process.env.BOX_CLIENT_ID,
  clientSecret: process.env.BOX_CLIENT_SECRET,
  refreshToken: 'your-refresh-token'
});

// Pure API - no local filesystem
const fileInfo = await api.getFileInfo('file-id');
await api.uploadFile('folder-id', './file.pdf');
```

## Configuration

```typescript
interface BoxConfig {
  // === Authentication ===
  tokenProvider?: (callback: string) => Promise<string> | string;
  refreshToken?: string;
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;  // Default: 'https://oauth.pstmn.io/v1/callback'

  // === Box Drive ===
  boxDriveRoot?: string;  // Auto-detected if not provided
  // Windows: C:/Users/{username}/Box
  // Mac: ~/Library/CloudStorage/Box-Box
  // Linux: ~/Box

  // === Box Domain ===
  domain?: string;  // Default: 'app.box.com'
  
  // === Sync Settings ===
  syncTimeout?: number;  // Default: 30000 (30 seconds)
  syncInterval?: number;  // Default: 1000 (1 second)
}
```

## Sync Strategies

BoxDrive supports 3 sync strategies:

### `poll` - Simple existence check
```typescript
// Just checks if file exists locally (fastest, least reliable)
await box.waitForSync('file-id', 'file', 'poll');
```

### `smart` - Size & modification verification (default)
```typescript
// Verifies file size matches cloud (recommended)
await box.waitForSync('file-id', 'file', 'smart');
```

### `force` - Try to trigger sync
```typescript
// Attempts to force Box Drive sync (limited capabilities)
await box.waitForSync('file-id', 'file', 'force');
```

## API Reference

### BoxFS API (High-level)

#### Filesystem Operations
- `readDir(folderId, ensureSync?)` - Read directory contents
- `readDirDetailed(folderId)` - Read with IDs and types
- `readFile(fileId, ensureSync?)` - Read file content
- `writeFile(folderId, filename, content)` - Write file
- `deleteFile(fileId)` - Delete file
- `getLocalPath(id, type)` - Get Box Drive path
- `openLocally(id, type)` - Open in Box Drive
- `existsAndSynced(id, type)` - Check sync status

#### Search & Find
- `findByName(folderId, name)` - Find by partial name
- `search(folderId, query, type?)` - Search in folder

#### Upload & Download
- `uploadFile(folderId, filePath)` - Upload file
- `downloadFile(fileId, destPath)` - Download file
- `uploadWithDateFolders(folderId, filePath, date?, locale)` - Upload with date structure (locale required, default 'en-US')
- `moveFile(fileId, toFolderId)` - Move file

#### Folder Operations
- `createFolderIfNotExists(parentId, name)` - Create if needed
- `getFileInfo(fileId)` - Get metadata
- `getFolderInfo(folderId)` - Get metadata

#### Box Drive
- `isBoxDriveRunning()` - Check if Box Drive is running
- `waitForSync(id, type, strategy?)` - Wait for sync
- `getBoxDriveRoot()` - Get Box Drive root path

#### Webhooks
- `getAllWebhooks()` - List webhooks
- `createWebhook(folderId, address)` - Create webhook
- `deleteWebhook(webhookId)` - Delete webhook

#### Utilities
- `getOfficeOnlineUrl(fileId)` - Get Office Online URL
- `getOfficeOnlineUrlByName(folderId, fileName)` - Get by search

### BoxAPI API (Low-level)

All pure Box REST API operations without Box Drive integration:
- `getFileInfo(fileId)`, `getFolderInfo(folderId)`
- `listFolderItems(folderId)`
- `uploadFile(folderId, filePath)` - With auto-chunking >20MB
- `downloadFile(fileId, destPath)`
- `createFolder(parentId, name)`
- `deleteFile(fileId)`, `moveFile(fileId, toId)`
- `searchInFolder(folderId, query, type?)`
- Webhooks, shared links, etc.

### BoxDrive API (Sync Bridge)

- `getLocalPath(id, type)` - Convert ID to local path
- `waitForSync(id, type, strategy)` - Wait for sync
- `isSynced(id, type)` - Check sync status
- `isBoxDriveRunning()` - Health check
- `openLocally(localPath)` - Open file/folder

## Development

### Build

```bash
npm run build
```

### Test

```bash
npm test
```

### Lint

```bash
npm run lint
npm run format
```

### Validate Package Exports

```bash
npm run check:exports
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Issues

If you encounter any issues, please report them [here](https://github.com/oharu121/fs-box-sync/issues).

## License

MIT © oharu121
