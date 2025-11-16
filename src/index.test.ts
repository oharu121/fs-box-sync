import { describe, it, expect, vi, beforeAll } from 'vitest';

// Mock fs/promises before importing modules
vi.mock('fs/promises', () => ({
  default: {
    mkdir: vi.fn(() => Promise.resolve()),
    readFile: vi.fn(() => Promise.resolve('{}')),
    writeFile: vi.fn(() => Promise.resolve()),
    access: vi.fn(() => Promise.reject()), // Simulate no existing file
  },
}));

// Mock fs.existsSync
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(() => true), // Simulate Box Drive directory exists
  },
}));

import { Box, BoxFS, BoxAPI, BoxDrive } from './index';
import type { BoxConfig, SyncStrategy, SyncStatus } from './index';

describe('Package Exports', () => {
  it('should export Box class', () => {
    expect(Box).toBeDefined();
    expect(typeof Box).toBe('function');
  });

  it('should export BoxFS class', () => {
    expect(BoxFS).toBeDefined();
    expect(typeof BoxFS).toBe('function');
  });

  it('should export BoxAPI class', () => {
    expect(BoxAPI).toBeDefined();
    expect(typeof BoxAPI).toBe('function');
  });

  it('should export BoxDrive class', () => {
    expect(BoxDrive).toBeDefined();
    expect(typeof BoxDrive).toBe('function');
  });

  it('should export types', () => {
    const config: BoxConfig = {
      clientId: 'test',
    };
    expect(config).toBeDefined();

    const strategy: SyncStrategy = 'smart';
    expect(strategy).toBe('smart');

    const status: SyncStatus = {
      synced: true,
    };
    expect(status.synced).toBe(true);
  });
});
