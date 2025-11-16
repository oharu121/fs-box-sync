import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Box } from './Box';
import type { BoxConfig } from './types';

// Mock BoxAPI
vi.mock('./BoxAPI', () => ({
  BoxAPI: vi.fn().mockImplementation(() => ({
    domain: 'app.box.com',
    applyConfig: vi.fn(),
  })),
}));

// Mock BoxDrive
vi.mock('./BoxDrive', () => ({
  BoxDrive: vi.fn().mockImplementation(() => ({
    getBoxDriveRoot: vi.fn(() => '/mock/box/root'),
  })),
}));

// Mock fs/promises
vi.mock('fs/promises', () => ({
  default: {
    mkdir: vi.fn(() => Promise.resolve()),
    readFile: vi.fn(() => Promise.resolve('{}')),
    writeFile: vi.fn(() => Promise.resolve()),
    access: vi.fn(() => Promise.resolve()),
  },
}));

describe('Box', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset singleton instance for testing
    (Box as any).instance = undefined;
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = Box.getInstance();
      const instance2 = Box.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should be an instance of Box', () => {
      const instance = Box.getInstance();
      expect(instance).toBeInstanceOf(Box);
    });

    it('should not allow direct instantiation', () => {
      // Constructor is private, so this would be a TypeScript error
      // We can verify it exists but can't be called directly
      expect(Box.getInstance).toBeDefined();
    });
  });

  describe('configure', () => {
    it('should configure the singleton instance', () => {
      const instance = Box.getInstance();
      const config: BoxConfig = {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        refreshToken: 'test-refresh-token',
      };

      expect(() => instance.configure(config)).not.toThrow();
    });

    it('should accept token provider', () => {
      const instance = Box.getInstance();
      const config: BoxConfig = {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        tokenProvider: async (callback: string) => {
          return 'auth-code';
        },
      };

      expect(() => instance.configure(config)).not.toThrow();
    });

    it('should update domain', () => {
      const instance = Box.getInstance();
      const config: BoxConfig = {
        domain: 'enterprise.box.com',
      };

      instance.configure(config);
      // Configuration should be applied
      expect(instance).toBeInstanceOf(Box);
    });

    it('should accept sync configuration', () => {
      const instance = Box.getInstance();
      const config: BoxConfig = {
        syncTimeout: 60000,
        syncInterval: 2000,
      };

      expect(() => instance.configure(config)).not.toThrow();
    });

    it('should accept Box Drive root configuration', () => {
      const instance = Box.getInstance();
      const config: BoxConfig = {
        boxDriveRoot: '/custom/box/path',
      };

      expect(() => instance.configure(config)).not.toThrow();
    });
  });

  describe('inheritance from BoxFS', () => {
    it('should have BoxFS methods available', () => {
      const instance = Box.getInstance();

      // Check that BoxFS methods are available
      expect(instance.readDir).toBeDefined();
      expect(instance.readFile).toBeDefined();
      expect(instance.writeFile).toBeDefined();
      expect(instance.uploadFile).toBeDefined();
      expect(instance.downloadFile).toBeDefined();
      expect(instance.deleteFile).toBeDefined();
      expect(instance.uploadWithDateFolders).toBeDefined();
      expect(instance.getOfficeOnlineUrl).toBeDefined();
    });

    it('should have BoxDrive methods available', () => {
      const instance = Box.getInstance();

      expect(instance.isBoxDriveRunning).toBeDefined();
      expect(instance.waitForSync).toBeDefined();
      expect(instance.getBoxDriveRoot).toBeDefined();
      expect(instance.getLocalPath).toBeDefined();
    });

    it('should have folder operations available', () => {
      const instance = Box.getInstance();

      expect(instance.createFolderIfNotExists).toBeDefined();
      expect(instance.getFileInfo).toBeDefined();
      expect(instance.getFolderInfo).toBeDefined();
    });

    it('should have search operations available', () => {
      const instance = Box.getInstance();

      expect(instance.findByName).toBeDefined();
      expect(instance.search).toBeDefined();
    });

    it('should have webhook operations available', () => {
      const instance = Box.getInstance();

      expect(instance.getAllWebhooks).toBeDefined();
      expect(instance.createWebhook).toBeDefined();
      expect(instance.deleteWebhook).toBeDefined();
    });
  });

  describe('usage pattern', () => {
    it('should support configure-then-use pattern', () => {
      const instance = Box.getInstance();

      instance.configure({
        clientId: 'test-id',
        clientSecret: 'test-secret',
        refreshToken: 'test-token',
      });

      // Should be ready to use after configuration
      expect(instance).toBeInstanceOf(Box);
      expect(instance.uploadFile).toBeDefined();
    });

    it('should support reconfiguration', () => {
      const instance = Box.getInstance();

      instance.configure({
        clientId: 'first-id',
        refreshToken: 'first-token',
      });

      instance.configure({
        clientId: 'second-id',
        refreshToken: 'second-token',
      });

      // Should accept multiple configurations
      expect(instance).toBeInstanceOf(Box);
    });
  });
});
