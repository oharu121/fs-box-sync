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
│  - uploadWithYearMonthFolders()     │
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
pnpm add fs-box-sync
```

## Usage Guide: Choose Your Integration Level

`fs-box-sync` supports three usage patterns based on your needs:

### 🟢 Tier 1: Quick Testing (Access Token Only)

**Best for:** Learning Box API, POC, quick experiments, one-off scripts

**Get access token:** [Box Developer Console](https://app.box.com/developers/console) → My Apps → Your App → Configuration → Developer Token (Generate)

```typescript
import { BoxAPI } from 'fs-box-sync';

// Just paste the developer token - works immediately!
const api = new BoxAPI({
  accessToken: 'your-developer-token-from-console',
});

// Use right away - perfect for testing
const files = await api.listFolderItems('folder-id');
await api.uploadFile('folder-id', './test.pdf');
```

**Characteristics:**

- ✅ **Zero setup** - paste token and go
- ✅ **No OAuth flow** required
- ✅ **Perfect for learning** Box API
- ⚠️ **Expires in ~1 hour** - must regenerate manually
- ⚠️ **No auto-refresh** - you manage token lifecycle

---

### 🟡 Tier 2: Production (Refresh Token)

**Best for:** Scheduled tasks, automation scripts, long-running services (up to 60 days)

**Setup:** Perform OAuth flow once to get refresh token, then use it directly

```typescript
import box from 'fs-box-sync';

box.configure({
  clientId: process.env.BOX_CLIENT_ID,
  clientSecret: process.env.BOX_CLIENT_SECRET,
  refreshToken: 'your-refresh-token', // From initial OAuth flow
});

// Auto-refreshes access tokens for ~60 days
await box.uploadFile('folder-id', './file.pdf');
await box.uploadWithYearMonthFolders('folder-id', './file.pdf', 'ja-JP');
```

**Characteristics:**

- ✅ **Auto-refreshes** access tokens
- ✅ **Works for ~60 days**
- ✅ **Tokens persist** to disk automatically
- ✅ **Cross-platform storage** (Windows/Mac/Linux)
- ⚠️ Requires **initial OAuth** to get refresh token
- ⚠️ Needs **re-auth every ~60 days**

**Storage locations:**

- Windows: `C:\Users\{user}\AppData\Local\fs-box-sync\tokens.json`
- Mac/Linux: `~/.config/fs-box-sync\tokens.json`

---

### 🔵 Tier 3: Enterprise (Token Provider - Recommended for Automation)

**Best for:** Fully automated systems, CI/CD, unattended services, production deployments

**Setup:** Implement OAuth automation (e.g., Playwright) - works indefinitely

```typescript
// boxClient.ts - Create a wrapper module
import credentials from '@constants/credentials';
import box from 'fs-box-sync';
import Playwright from './Playwright';

box.configure({
  clientId: credentials.BOX_CLIENT_ID,
  clientSecret: credentials.BOX_CLIENT_SECRET,
  tokenProvider: async (authUrl) => {
    // Fully automate OAuth - no manual intervention needed
    return await Playwright.getBoxCode(authUrl);
  },
});

export default box;
```

Then use anywhere in your app:

```typescript
import box from './boxClient';

// Works indefinitely - auto re-authenticates when needed
await box.uploadFile('folder-id', './file.pdf');
await box.readDir('folder-id'); // Always reads from synced local filesystem
```

**Characteristics:**

- ✅ **Works indefinitely** - never expires
- ✅ **Zero manual intervention** after setup
- ✅ **Perfect for unattended** automation
- ✅ **Handles token expiration** automatically
- ⚠️ Requires **OAuth automation** setup (Playwright, Puppeteer, etc.)

---

### Comparison Table

| Feature              | Tier 1: Testing      | Tier 2: Production    | Tier 3: Enterprise  |
| -------------------- | -------------------- | --------------------- | ------------------- |
| **Setup Complexity** | Minimal (copy/paste) | Low                   | Medium              |
| **Duration**         | ~1 hour              | ~60 days              | Indefinite          |
| **Auto-Refresh**     | ❌ No                | ✅ Yes                | ✅ Yes              |
| **Manual Work**      | Regenerate hourly    | Re-auth every 60 days | None                |
| **Best For**         | Testing, Learning    | Automation Scripts    | Production Services |
| **OAuth Required**   | ❌ No                | ✅ Initial only       | ✅ Fully automated  |

---

### Quick Decision Guide

**Choose Tier 1 if you want to:**

- 🧪 Test Box API quickly
- 📚 Learn how the API works
- ⚡ Get started in 30 seconds
- 🔬 Experiment with features

**Choose Tier 2 if you have:**

- 🤖 Automated workflows
- ⏰ Scheduled tasks (cron jobs)
- 📊 Scripts that run periodically
- ✅ OK with re-auth every ~60 days

**Choose Tier 3 if you need:**

- 🏢 Production-grade automation
- 🔄 Services that run 24/7
- 🚫 Zero manual intervention
- ⚙️ CI/CD integration

---

## Best Practice: Wrapper Module Pattern (Recommended)

For **any production application**, we recommend creating a wrapper module that exports a pre-configured singleton instance. This is the **cleanest and most maintainable** approach.

### Why Use a Wrapper Module?

✅ **Single source of truth** - Configuration in one place
✅ **No duplication** - Import once, use everywhere
✅ **Type safety** - Full TypeScript support
✅ **Easy testing** - Simple to mock in tests
✅ **DI friendly** - Easy to swap implementations

### How to Set Up

**Step 1:** Create a wrapper module (e.g., `boxClient.ts` or `lib/box.ts`)

```typescript
// src/lib/boxClient.ts
import credentials from '@constants/credentials';
import box from 'fs-box-sync';
import Playwright from './Playwright';

// Configure once
box.configure({
  clientId: credentials.BOX_CLIENT_ID,
  clientSecret: credentials.BOX_CLIENT_SECRET,
  tokenProvider: async (authUrl) => {
    return await Playwright.getBoxCode(authUrl);
  },
});

// Export the pre-configured singleton
export default box;
```

**Step 2:** Use anywhere in your application

```typescript
// In any file - just import and use!
import box from '@/lib/boxClient';

// Ready to use - no configuration needed
async function uploadReport() {
  await box.uploadFile('folder-id', './report.pdf');
}

async function listFiles() {
  const files = await box.readDir('folder-id');
  return files;
}
```

### Pattern Benefits

This pattern works for **all tiers**:

**Tier 1 (Testing):**

```typescript
// boxClient.ts
import { BoxAPI } from 'fs-box-sync';

const api = new BoxAPI({
  accessToken: process.env.BOX_ACCESS_TOKEN,
});

export default api;
```

**Tier 2 (Production):**

```typescript
// boxClient.ts
import box from 'fs-box-sync';

box.configure({
  clientId: process.env.BOX_CLIENT_ID,
  clientSecret: process.env.BOX_CLIENT_SECRET,
  refreshToken: process.env.BOX_REFRESH_TOKEN,
});

export default box;
```

**Tier 3 (Enterprise):**

```typescript
// boxClient.ts
import box from 'fs-box-sync';
import Playwright from './auth/Playwright';

box.configure({
  clientId: process.env.BOX_CLIENT_ID,
  clientSecret: process.env.BOX_CLIENT_SECRET,
  tokenProvider: async (authUrl) => {
    return await Playwright.getBoxCode(authUrl);
  },
});

export default box;
```

### Why This Is the Intended Design

The package **exports a singleton by default** (`export default Box.getInstance()`), which means:

1. ✅ **Designed for global use** - One instance across your app
2. ✅ **Token storage coordination** - All calls share the same tokens
3. ✅ **Built-in singleton pattern** - You don't manage instances

The wrapper module pattern simply **organizes** the singleton configuration - it's the recommended way to use this package in production.

---

## Configuration

```typescript
interface BoxConfig {
  // === Authentication ===
  accessToken?: string; // For quick testing (Tier 1)
  tokenProvider?: (callback: string) => Promise<string> | string; // For automation (Tier 3)
  refreshToken?: string; // For production (Tier 2)
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string; // Default: 'https://oauth.pstmn.io/v1/callback'

  // === Box Drive ===
  boxDriveRoot?: string; // Auto-detected if not provided
  // Windows: C:/Users/{username}/Box
  // Mac: ~/Library/CloudStorage/Box-Box
  // Linux: ~/Box

  // === Box Domain ===
  domain?: string; // Default: 'app.box.com'

  // === Sync Settings ===
  syncTimeout?: number; // Default: 30000 (30 seconds)
  syncInterval?: number; // Default: 1000 (1 second)
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

- `readDir(folderId)` - Read directory contents (always synced locally)
- `listFolderItems(folderId)` - Read with IDs and types (from cloud API)
- `readFile(fileId)` - Read file content (always synced locally)
- `writeFile(folderId, filename, content)` - Write file
- `deleteFile(fileId)` - Delete file
- `getLocalPath(id, type)` - Get Box Drive path (fast, may not exist)
- `getLocalPathSynced(id, type, strategy?)` - Get Box Drive path (guaranteed to exist)
- `openLocally(id, type)` - Open in Box Drive
- `existsAndSynced(id, type)` - Check if ID exists and is synced
- `existsByNameAndSynced(parentId, name, type)` - Check if named item exists and is synced

#### Search & Find

- `findByName(folderId, name)` - Find by partial name
- `search(folderId, query, type?)` - Search in folder

#### Upload & Download

- `uploadFile(folderId, filePath)` - Upload file
- `downloadFile(fileId, destPath)` - Download file
- `uploadWithYearMonthFolders(folderId, filePath, locale?)` - Upload with date structure (default locale: 'en-US')
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
pnpm build
```

### Test

```bash
pnpm test
```

### Lint

```bash
pnpm lint
pnpm format
```

### Validate Package Exports

```bash
pnpm check:exports
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Issues

If you encounter any issues, please report them [here](https://github.com/oharu121/fs-box-sync/issues).

## License

MIT © oharu121
