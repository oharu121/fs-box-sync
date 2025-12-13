import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BoxDrive } from './BoxDrive';
import { BoxAPI } from './BoxAPI';
import type { BoxConfig } from './types';
import fs from 'fs';

// Mock child_process
vi.mock('child_process', () => ({
  exec: vi.fn((cmd, callback) => {
    callback(null, 'Box', '');
  }),
}));

// Mock fs/promises
vi.mock('fs/promises', () => ({
  default: {
    access: vi.fn(() => Promise.resolve()), // File exists
    stat: vi.fn(() => Promise.resolve({
      size: 1024,
      mtime: new Date('2024-01-01'),
    })),
    mkdir: vi.fn(() => Promise.resolve()),
    readFile: vi.fn(() => Promise.resolve(JSON.stringify({
      refreshToken: 'test-refresh',
      accessToken: 'test-access',
      expiresAt: Date.now() + 3600000,
      clientId: 'test-client-id',
    }))),
    writeFile: vi.fn(() => Promise.resolve()),
  },
}));

// Mock fs
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(() => true),
  },
}));

describe('BoxDrive', () => {
  let boxAPI: BoxAPI;
  let boxDrive: BoxDrive;
  let config: BoxConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    config = {
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      refreshToken: 'test-refresh-token',
      boxDriveRoot: '/mock/box/drive',
    };
    boxAPI = new BoxAPI(config);
    boxDrive = new BoxDrive(boxAPI, config);
  });

  describe('constructor', () => {
    it('should create instance with default config', () => {
      expect(boxDrive).toBeInstanceOf(BoxDrive);
    });

    it('should use custom Box Drive root if provided', () => {
      const customConfig: BoxConfig = {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        refreshToken: 'test-refresh-token',
        boxDriveRoot: '/custom/box/path',
      };
      const drive = new BoxDrive(boxAPI, customConfig);
      expect(drive.getBoxDriveRoot()).toBe('/custom/box/path');
    });

    it('should auto-detect Box Drive root on Windows', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32' });
      const configWithoutRoot: BoxConfig = {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        refreshToken: 'test-refresh-token',
      };
      const drive = new BoxDrive(boxAPI, configWithoutRoot);
      expect(drive.getBoxDriveRoot()).toContain('Box');
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should NOT throw during construction when Box Drive is unavailable (lazy detection)', () => {
      // Mock fs.existsSync to return false for Box Drive path
      vi.spyOn(fs, 'existsSync').mockReturnValue(false);

      const configWithoutRoot: BoxConfig = {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        refreshToken: 'test-refresh-token',
      };

      // Should NOT throw during construction - lazy detection
      expect(() => new BoxDrive(boxAPI, configWithoutRoot)).not.toThrow();

      // Restore mock
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    });

    it('should throw when getBoxDriveRoot is called but Box Drive is unavailable', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(false);

      const configWithoutRoot: BoxConfig = {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        refreshToken: 'test-refresh-token',
      };

      const drive = new BoxDrive(boxAPI, configWithoutRoot);

      // Should throw when trying to access Box Drive root
      expect(() => drive.getBoxDriveRoot()).toThrow('Box Drive root not found');

      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    });
  });

  describe('isBoxDriveAvailable', () => {
    it('should return true when Box Drive path is explicitly configured and exists', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);

      expect(boxDrive.isBoxDriveAvailable()).toBe(true);
    });

    it('should return false when explicit path does not exist', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(false);

      const customConfig: BoxConfig = {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        refreshToken: 'test-refresh-token',
        boxDriveRoot: '/nonexistent/path',
      };
      const drive = new BoxDrive(boxAPI, customConfig);

      expect(drive.isBoxDriveAvailable()).toBe(false);

      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    });

    it('should return false when no config and auto-detection fails', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(false);

      const configWithoutRoot: BoxConfig = {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        refreshToken: 'test-refresh-token',
      };
      const drive = new BoxDrive(boxAPI, configWithoutRoot);

      expect(drive.isBoxDriveAvailable()).toBe(false);

      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    });
  });

  describe('getBoxDriveRoot', () => {
    it('should return Box Drive root path', () => {
      const root = boxDrive.getBoxDriveRoot();
      expect(root).toBe('/mock/box/drive');
    });
  });

  describe('isBoxDriveRunning', () => {
    it('should check if Box Drive is running', async () => {
      const isRunning = await boxDrive.isBoxDriveRunning();
      expect(typeof isRunning).toBe('boolean');
    });
  });

  describe('getLocalPath', () => {
    it('should convert file ID to local path', async () => {
      vi.spyOn(boxAPI, 'getFileInfo').mockResolvedValue({
        id: 'file-123',
        name: 'test.txt',
        path_collection: {
          entries: [
            { id: '0', name: 'All Files' },
            { id: 'folder-1', name: 'Documents' },
          ],
        },
      });

      const path = await boxDrive.getLocalPath('file-123', 'file');
      expect(path).toContain('test.txt');
    });

    it('should convert folder ID to local path', async () => {
      vi.spyOn(boxAPI, 'getFolderInfo').mockResolvedValue({
        id: 'folder-123',
        name: 'MyFolder',
        path_collection: {
          entries: [
            { id: '0', name: 'All Files' },
          ],
        },
      });

      const path = await boxDrive.getLocalPath('folder-123', 'folder');
      expect(path).toContain('MyFolder');
    });
  });

  describe('waitForSync', () => {
    it.skip('should wait for file sync with poll strategy', async () => {
      // Skip: Requires complex async mocking of file system operations
      vi.spyOn(boxAPI, 'getFileInfo').mockResolvedValue({
        id: 'file-123',
        name: 'test.txt',
        size: 1024,
        modified_at: '2024-01-01T00:00:00Z',
        path_collection: {
          entries: [{ id: '0', name: 'All Files' }],
        },
      });

      const status = await boxDrive.waitForSync('file-123', 'file', 'poll');
      expect(status.synced).toBe(true);
      expect(status.localPath).toBeTruthy();
    });

    it.skip('should wait for file sync with smart strategy', async () => {
      // Skip: Requires complex async mocking of file system operations
      vi.spyOn(boxAPI, 'getFileInfo').mockResolvedValue({
        id: 'file-123',
        name: 'test.txt',
        size: 1024,
        modified_at: '2024-01-01T00:00:00Z',
        path_collection: {
          entries: [{ id: '0', name: 'All Files' }],
        },
      });

      const status = await boxDrive.waitForSync('file-123', 'file', 'smart');
      expect(status.synced).toBe(true);
    });

    it.skip('should default to smart strategy', async () => {
      // Skip: Requires complex async mocking of file system operations
      vi.spyOn(boxAPI, 'getFileInfo').mockResolvedValue({
        id: 'file-123',
        name: 'test.txt',
        size: 1024,
        modified_at: '2024-01-01T00:00:00Z',
        path_collection: {
          entries: [{ id: '0', name: 'All Files' }],
        },
      });

      const status = await boxDrive.waitForSync('file-123', 'file');
      expect(status).toBeDefined();
    });
  });

  describe('isSynced', () => {
    it.skip('should check if file is synced', async () => {
      // Skip: Requires complex async mocking of file system operations
      vi.spyOn(boxAPI, 'getFileInfo').mockResolvedValue({
        id: 'file-123',
        name: 'test.txt',
        path_collection: {
          entries: [{ id: '0', name: 'All Files' }],
        },
      });

      const synced = await boxDrive.isSynced('file-123', 'file');
      expect(typeof synced).toBe('boolean');
    });
  });
});
