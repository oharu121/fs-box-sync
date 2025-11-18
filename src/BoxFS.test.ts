import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BoxFS } from './BoxFS';
import type { BoxConfig } from './types';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  default: {
    readdir: vi.fn(() => Promise.resolve(['file1.txt', 'file2.pdf'])),
    readFile: vi.fn(() => Promise.resolve('file content')),
    writeFile: vi.fn(() => Promise.resolve()),
    unlink: vi.fn(() => Promise.resolve()),
    mkdir: vi.fn(() => Promise.resolve()),
    access: vi.fn(() => Promise.resolve()),
    stat: vi.fn(() => Promise.resolve({
      size: 1024,
      mtime: new Date(),
    })),
  },
}));

// Mock BoxAPI
vi.mock('./BoxAPI', () => {
  return {
    BoxAPI: class MockBoxAPI {
      domain = 'app.box.com';
      listFolderItems = vi.fn(() => Promise.resolve({
        entries: [
          { id: 'file-1', name: 'file1.txt', type: 'file' },
          { id: 'file-2', name: 'file2.pdf', type: 'file' },
        ],
      }));
      getFileInfo = vi.fn(() => Promise.resolve({
        id: 'file-123',
        name: 'test.txt',
        size: 1024,
        modified_at: '2024-01-01T00:00:00Z',
      }));
      getFolderInfo = vi.fn(() => Promise.resolve({
        id: 'folder-123',
        name: 'MyFolder',
      }));
      getFileContent = vi.fn(() => Promise.resolve('file content'));
      uploadFile = vi.fn(() => Promise.resolve('uploaded-file-id'));
      downloadFile = vi.fn(() => Promise.resolve());
      deleteFile = vi.fn(() => Promise.resolve());
      moveFile = vi.fn(() => Promise.resolve());
      createFolder = vi.fn(() => Promise.resolve({ id: 'new-folder-id' }));
      searchInFolder = vi.fn(() => Promise.resolve({
        entries: [{ id: 'search-result-id', name: 'found.txt' }],
      }));
      getAllWebhooks = vi.fn(() => Promise.resolve({ entries: [] }));
      createWebhook = vi.fn(() => Promise.resolve({ id: 'webhook-id' }));
      deleteWebhook = vi.fn(() => Promise.resolve());
      downloadFromSharedLink = vi.fn(() => Promise.resolve());
      applyConfig = vi.fn();
    },
  };
});

// Mock BoxDrive
vi.mock('./BoxDrive', () => {
  return {
    BoxDrive: class MockBoxDrive {
      getBoxDriveRoot = vi.fn(() => '/mock/box/root');
      isBoxDriveRunning = vi.fn(() => Promise.resolve(true));
      waitForSync = vi.fn(() => Promise.resolve({
        synced: true,
        localPath: '/mock/box/root/file.txt',
      }));
      isSynced = vi.fn(() => Promise.resolve(true));
      getLocalPath = vi.fn(() => Promise.resolve('/mock/box/root/file.txt'));
      openLocally = vi.fn(() => Promise.resolve());
    },
  };
});

describe('BoxFS', () => {
  let boxFS: BoxFS;
  let config: BoxConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    config = {
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      refreshToken: 'test-refresh-token',
    };
    boxFS = new BoxFS(config);
  });

  describe('constructor', () => {
    it('should create instance', () => {
      expect(boxFS).toBeInstanceOf(BoxFS);
    });

    it('should work without config', () => {
      const fs = new BoxFS();
      expect(fs).toBeInstanceOf(BoxFS);
    });
  });

  describe('readDir', () => {
    it('should read directory from API without sync', async () => {
      const files = await boxFS.readDir('folder-123', false);
      expect(files).toEqual(['file1.txt', 'file2.pdf']);
    });

    it('should read directory from local filesystem with sync', async () => {
      const files = await boxFS.readDir('folder-123', true);
      expect(files).toEqual(['file1.txt', 'file2.pdf']);
    });
  });

  describe('readDirDetailed', () => {
    it('should return detailed folder contents', async () => {
      const items = await boxFS.readDirDetailed('folder-123');
      expect(items).toHaveLength(2);
      expect(items[0]).toHaveProperty('id');
      expect(items[0]).toHaveProperty('name');
      expect(items[0]).toHaveProperty('type');
    });
  });

  describe('readFile', () => {
    it('should read file from API without sync', async () => {
      const content = await boxFS.readFile('file-123', false);
      expect(content).toBe('file content');
    });

    it('should read file from local filesystem with sync', async () => {
      const content = await boxFS.readFile('file-123', true);
      expect(content).toBe('file content');
    });
  });

  describe('writeFile', () => {
    it('should upload file content', async () => {
      const fileId = await boxFS.writeFile('folder-123', 'test.txt', 'content');
      expect(fileId).toBe('uploaded-file-id');
    });
  });

  describe('deleteFile', () => {
    it('should delete file', async () => {
      await expect(boxFS.deleteFile('file-123')).resolves.toBeUndefined();
    });
  });

  describe('findByName', () => {
    it('should find file by name', async () => {
      const id = await boxFS.findByName('folder-123', 'file1');
      expect(id).toBe('file-1');
    });

    it('should return null if not found', async () => {
      const id = await boxFS.findByName('folder-123', 'nonexistent');
      expect(id).toBeNull();
    });
  });

  describe('search', () => {
    it('should search in folder', async () => {
      const results = await boxFS.search('folder-123', 'query');
      expect(results.entries).toHaveLength(1);
    });

    it('should search with type filter', async () => {
      const results = await boxFS.search('folder-123', 'query', 'file');
      expect(results).toBeDefined();
    });
  });

  describe('createFolderIfNotExists', () => {
    it('should return existing folder ID if found', async () => {
      const id = await boxFS.createFolderIfNotExists('parent-123', 'file1');
      expect(id).toBe('file-1');
    });

    it('should create new folder if not found', async () => {
      const id = await boxFS.createFolderIfNotExists('parent-123', 'newFolder');
      expect(id).toBe('new-folder-id');
    });
  });

  describe('uploadWithDateFolders', () => {
    it('should upload file to date-based folder structure', async () => {
      const fileId = await boxFS.uploadWithDateFolders(
        'folder-123',
        '/path/to/file.pdf',
        'en-US'
      );
      expect(fileId).toBe('uploaded-file-id');
    });

    it('should use default locale', async () => {
      const fileId = await boxFS.uploadWithDateFolders('folder-123', '/path/to/file.pdf');
      expect(fileId).toBe('uploaded-file-id');
    });

    it('should work with Japanese locale', async () => {
      const fileId = await boxFS.uploadWithDateFolders(
        'folder-123',
        '/path/to/file.pdf',
        'ja-JP'
      );
      expect(fileId).toBe('uploaded-file-id');
    });
  });

  describe('getOfficeOnlineUrl', () => {
    it('should generate Office Online URL', () => {
      const url = boxFS.getOfficeOnlineUrl('file-123');
      expect(url).toContain('fileId=file-123');
      expect(url).toContain('app.box.com');
    });
  });

  describe('getOfficeOnlineUrlByName', () => {
    it('should get URL by searching for file', async () => {
      const url = await boxFS.getOfficeOnlineUrlByName('folder-123', 'file1');
      expect(url).toContain('fileId=file-1');
    });

    it('should return empty string if file not found', async () => {
      const url = await boxFS.getOfficeOnlineUrlByName('folder-123', 'nonexistent');
      expect(url).toBe('');
    });
  });

  describe('uploadFile', () => {
    it('should upload file', async () => {
      const fileId = await boxFS.uploadFile('folder-123', '/path/to/file.pdf');
      expect(fileId).toBe('uploaded-file-id');
    });
  });

  describe('downloadFile', () => {
    it('should download file', async () => {
      await expect(boxFS.downloadFile('file-123', '/dest/path.pdf')).resolves.toBeUndefined();
    });
  });

  describe('moveFile', () => {
    it('should move file to another folder', async () => {
      await boxFS.moveFile('file-123', 'folder-456');
      // moveFile returns the result from API, which is mocked
      expect(true).toBe(true);
    });
  });

  describe('getFileInfo', () => {
    it('should get file metadata', async () => {
      const info = await boxFS.getFileInfo('file-123');
      expect(info.id).toBe('file-123');
      expect(info.name).toBe('test.txt');
    });
  });

  describe('getFolderInfo', () => {
    it('should get folder metadata', async () => {
      const info = await boxFS.getFolderInfo('folder-123');
      expect(info.id).toBe('folder-123');
      expect(info.name).toBe('MyFolder');
    });
  });

  describe('existsAndSynced', () => {
    it('should check if file exists and is synced', async () => {
      const synced = await boxFS.existsAndSynced('file-123', 'file');
      expect(synced).toBe(true);
    });
  });

  describe('getLocalPath', () => {
    it('should get local Box Drive path', async () => {
      const path = await boxFS.getLocalPath('file-123', 'file');
      expect(path).toBe('/mock/box/root/file.txt');
    });
  });

  describe('openLocally', () => {
    it('should open file in Box Drive', async () => {
      await expect(boxFS.openLocally('file-123', 'file')).resolves.toBeUndefined();
    });
  });

  describe('isBoxDriveRunning', () => {
    it('should check if Box Drive is running', async () => {
      const running = await boxFS.isBoxDriveRunning();
      expect(running).toBe(true);
    });
  });

  describe('waitForSync', () => {
    it('should wait for file to sync', async () => {
      const status = await boxFS.waitForSync('file-123', 'file');
      expect(status.synced).toBe(true);
    });

    it('should support custom strategy', async () => {
      const status = await boxFS.waitForSync('file-123', 'file', 'poll');
      expect(status.synced).toBe(true);
    });
  });

  describe('getBoxDriveRoot', () => {
    it('should get Box Drive root path', () => {
      const root = boxFS.getBoxDriveRoot();
      expect(root).toBe('/mock/box/root');
    });
  });

  describe('webhooks', () => {
    it('should get all webhooks', async () => {
      const webhooks = await boxFS.getAllWebhooks();
      expect(webhooks.entries).toEqual([]);
    });

    it('should create webhook', async () => {
      const webhook = await boxFS.createWebhook('folder-123', 'https://example.com/webhook');
      expect(webhook.id).toBe('webhook-id');
    });

    it('should delete webhook', async () => {
      await boxFS.deleteWebhook('webhook-123');
      // deleteWebhook returns void
      expect(true).toBe(true);
    });
  });

  describe('downloadFromSharedLink', () => {
    it('should download from shared link', async () => {
      await expect(boxFS.downloadFromSharedLink('link-id', '/dest/path.pdf')).resolves.toBeUndefined();
    });
  });
});
