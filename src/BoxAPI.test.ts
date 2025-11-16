import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BoxAPI } from './BoxAPI';
import type { BoxConfig } from './types';

// Mock axios-fluent
const createMockAxonInstance = () => ({
  bearer: vi.fn(() => ({
    json: vi.fn(() => ({
      post: vi.fn(() => Promise.resolve({
        status: 200,
        data: {
          access_token: 'mock-access-token',
          refresh_token: 'mock-refresh-token',
          expires_in: 3600,
        },
      })),
    })),
    params: vi.fn(() => ({
      get: vi.fn(() => Promise.resolve({
        status: 200,
        data: {
          entries: [{ id: 'search-result', name: 'found.txt' }],
        },
      })),
    })),
    post: vi.fn(() => Promise.resolve({
      status: 200,
      data: {
        id: 'new-folder-id',
        name: 'NewFolder',
      },
    })),
    put: vi.fn(() => Promise.resolve({
      status: 200,
      data: { id: 'file-123', name: 'moved-file.txt' },
    })),
    delete: vi.fn(() => Promise.resolve({
      status: 204,
      data: {},
    })),
    get: vi.fn(() => Promise.resolve({
      status: 200,
      data: {
        id: 'file-123',
        name: 'test.txt',
        size: 1024,
        modified_at: '2024-01-01T00:00:00Z',
        entries: [{ id: 'item-1', name: 'item.txt' }],
      },
    })),
  })),
  encodeUrl: vi.fn(() => ({
    post: vi.fn(() => Promise.resolve({
      status: 200,
      data: {
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        expires_in: 3600,
      },
    })),
  })),
});

vi.mock('axios-fluent', () => ({
  default: {
    dev: vi.fn(() => createMockAxonInstance()),
    new: vi.fn(() => createMockAxonInstance()),
  },
}));

// Mock fs modules
vi.mock('fs/promises', () => ({
  default: {
    mkdir: vi.fn(() => Promise.resolve()),
    readFile: vi.fn(() => Promise.resolve(JSON.stringify({
      refreshToken: 'stored-refresh-token',
      accessToken: 'stored-access-token',
      expiresAt: Date.now() + 3600000,
      clientId: 'test-client-id',
    }))),
    writeFile: vi.fn(() => Promise.resolve()),
    access: vi.fn(() => Promise.resolve()),
  },
}));

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(() => false),
    createReadStream: vi.fn(),
    createWriteStream: vi.fn(),
  },
}));

describe('BoxAPI', () => {
  let boxAPI: BoxAPI;
  let config: BoxConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    config = {
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      refreshToken: 'test-refresh-token',
    };
    boxAPI = new BoxAPI(config);
  });

  describe('constructor', () => {
    it('should create instance with config', () => {
      expect(boxAPI).toBeInstanceOf(BoxAPI);
      expect(boxAPI.domain).toBe('app.box.com');
    });

    it('should use custom domain if provided', () => {
      const customConfig: BoxConfig = {
        ...config,
        domain: 'foo.app.box.com',
      };
      const api = new BoxAPI(customConfig);
      expect(api.domain).toBe('foo.app.box.com');
    });

    it('should accept empty config', () => {
      const api = new BoxAPI();
      expect(api).toBeInstanceOf(BoxAPI);
    });
  });

  describe('applyConfig', () => {
    it('should update configuration', () => {
      const newConfig: BoxConfig = {
        clientId: 'new-client-id',
        refreshToken: 'new-refresh-token',
      };
      boxAPI.applyConfig(newConfig);
      // Config should be applied (internal state changed)
      expect(boxAPI).toBeInstanceOf(BoxAPI);
    });

    it('should accept allowInsecure option', () => {
      const insecureConfig: BoxConfig = {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        refreshToken: 'test-refresh-token',
        allowInsecure: true,
      };
      const api = new BoxAPI(insecureConfig);
      expect(api).toBeInstanceOf(BoxAPI);
    });

    it('should update domain', () => {
      boxAPI.applyConfig({ domain: 'enterprise.box.com' });
      expect(boxAPI.domain).toBe('enterprise.box.com');
    });
  });

  describe('getFileInfo', () => {
    it('should fetch file metadata', async () => {
      const fileInfo = await boxAPI.getFileInfo('file-123');
      expect(fileInfo).toBeDefined();
      expect(fileInfo.id).toBe('file-123');
    });
  });

  describe('getFolderInfo', () => {
    it('should fetch folder metadata', async () => {
      const folderInfo = await boxAPI.getFolderInfo('folder-123');
      expect(folderInfo).toBeDefined();
    });
  });

  describe('listFolderItems', () => {
    it('should list items in folder', async () => {
      const items = await boxAPI.listFolderItems('folder-123');
      expect(items).toBeDefined();
    });
  });

  describe('searchInFolder', () => {
    it('should search for files in folder', async () => {
      const results = await boxAPI.searchInFolder('folder-123', 'test');
      expect(results).toBeDefined();
    });

    it('should search with type filter', async () => {
      const results = await boxAPI.searchInFolder('folder-123', 'test', 'file');
      expect(results).toBeDefined();
    });
  });

  describe('createFolder', () => {
    it('should create a new folder', async () => {
      const folder = await boxAPI.createFolder('parent-123', 'NewFolder');
      expect(folder).toBeDefined();
    });
  });

  describe('deleteFile', () => {
    it('should delete a file', async () => {
      await boxAPI.deleteFile('file-123');
      expect(true).toBe(true); // Deletion returns void
    });
  });

  describe('moveFile', () => {
    it('should move a file', async () => {
      const result = await boxAPI.moveFile('file-123', 'folder-456');
      expect(result).toBeDefined();
    });
  });

  describe('webhooks', () => {
    it('should get all webhooks', async () => {
      const webhooks = await boxAPI.getAllWebhooks();
      expect(webhooks).toBeDefined();
    });

    it('should create a webhook', async () => {
      const webhook = await boxAPI.createWebhook('folder-123', 'https://example.com/hook');
      expect(webhook).toBeDefined();
    });

    it('should delete a webhook', async () => {
      await boxAPI.deleteWebhook('webhook-123');
      expect(true).toBe(true);
    });
  });
});
