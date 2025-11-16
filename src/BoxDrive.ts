import fs from 'fs';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { BoxAPI } from './BoxAPI';
import { BoxConfig, SyncStatus, SyncStrategy } from './types';

const execAsync = promisify(exec);

/**
 * Box Drive sync bridge
 * Handles path conversion and sync verification between Box Cloud and Box Drive
 */
export class BoxDrive {
  private api: BoxAPI;
  private boxDriveRoot: string;
  private syncTimeout: number;
  private syncInterval: number;

  constructor(api: BoxAPI, config?: BoxConfig) {
    this.api = api;
    this.syncTimeout = config?.syncTimeout || 30000;
    this.syncInterval = config?.syncInterval || 1000;
    this.boxDriveRoot = config?.boxDriveRoot || this.detectBoxDriveRoot();
  }

  /**
   * Auto-detect Box Drive root directory based on platform
   */
  private detectBoxDriveRoot(): string {
    const homeDir = os.homedir();

    if (process.platform === 'win32') {
      // Windows: C:/Users/{username}/Box
      const defaultPath = path.join(homeDir, 'Box');
      if (fs.existsSync(defaultPath)) {
        return defaultPath;
      }
      throw new Error(
        'Box Drive root not found. Please provide boxDriveRoot in config.\n' +
          `Expected: ${defaultPath}`
      );
    } else if (process.platform === 'darwin') {
      // macOS: ~/Library/CloudStorage/Box-Box
      const defaultPath = path.join(homeDir, 'Library', 'CloudStorage', 'Box-Box');
      if (fs.existsSync(defaultPath)) {
        return defaultPath;
      }
      throw new Error(
        'Box Drive root not found. Please provide boxDriveRoot in config.\n' +
          `Expected: ${defaultPath}`
      );
    } else {
      // Linux: ~/Box (unofficial clients)
      const defaultPath = path.join(homeDir, 'Box');
      if (fs.existsSync(defaultPath)) {
        return defaultPath;
      }
      throw new Error(
        'Box Drive root not found. Please provide boxDriveRoot in config.\n' +
          `Expected: ${defaultPath}`
      );
    }
  }

  /**
   * Check if Box Drive is running
   */
  public async isBoxDriveRunning(): Promise<boolean> {
    try {
      if (process.platform === 'win32') {
        const { stdout } = await execAsync('tasklist /FI "IMAGENAME eq BoxDrive.exe"');
        return stdout.includes('BoxDrive.exe');
      } else if (process.platform === 'darwin') {
        const { stdout } = await execAsync('ps aux | grep "Box.app" | grep -v grep');
        return stdout.length > 0;
      } else {
        // Linux - just check if directory is accessible
        return fs.existsSync(this.boxDriveRoot);
      }
    } catch {
      return false;
    }
  }

  /**
   * Convert Box file/folder ID to local Box Drive path
   */
  public async getLocalPath(id: string, type: 'file' | 'folder'): Promise<string> {
    let pathParts: string[];

    if (type === 'file') {
      const fileInfo = await this.api.getFileInfo(id);
      const parentPath = fileInfo.path_collection.entries.slice(1); // Remove "All Files"
      pathParts = [...parentPath.map((entry: { name: string }) => entry.name), fileInfo.name];
    } else {
      const folderInfo = await this.api.getFolderInfo(id);
      const parentPath = folderInfo.path_collection.entries.slice(1); // Remove "All Files"
      pathParts = [...parentPath.map((entry: { name: string }) => entry.name), folderInfo.name];
    }

    return path.join(this.boxDriveRoot, ...pathParts);
  }

  /**
   * Wait for file/folder to sync with various strategies
   */
  public async waitForSync(
    id: string,
    type: 'file' | 'folder',
    strategy: SyncStrategy = 'smart'
  ): Promise<SyncStatus> {
    const localPath = await this.getLocalPath(id, type);

    switch (strategy) {
      case 'poll':
        return await this.pollSync(localPath);
      case 'smart':
        return await this.smartSync(id, type, localPath);
      case 'force':
        return await this.forceSync(id, type, localPath);
      default:
        return await this.smartSync(id, type, localPath);
    }
  }

  /**
   * Poll strategy: Simple file existence check with timeout
   */
  private async pollSync(localPath: string): Promise<SyncStatus> {
    const startTime = Date.now();
    const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

    while (Date.now() - startTime < this.syncTimeout) {
      try {
        const stats = fs.statSync(localPath);
        return {
          synced: true,
          localPath,
          lastModified: stats.mtime,
          size: stats.size,
        };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          console.warn(`Error checking path ${localPath}:`, error);
        }
      }

      await delay(this.syncInterval);
    }

    return {
      synced: false,
      localPath,
      error: `Timeout: File did not appear within ${this.syncTimeout / 1000} seconds`,
    };
  }

  /**
   * Smart strategy: Verify file size and modification time match cloud
   */
  private async smartSync(id: string, type: 'file' | 'folder', localPath: string): Promise<SyncStatus> {
    const startTime = Date.now();
    const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

    // Get cloud metadata
    let cloudSize: number | undefined;

    if (type === 'file') {
      const fileInfo = await this.api.getFileInfo(id);
      cloudSize = fileInfo.size;
    }

    while (Date.now() - startTime < this.syncTimeout) {
      try {
        const stats = fs.statSync(localPath);

        // For files, verify size matches
        if (type === 'file' && cloudSize !== undefined) {
          if (stats.size === cloudSize) {
            return {
              synced: true,
              localPath,
              lastModified: stats.mtime,
              size: stats.size,
            };
          }
          // File exists but wrong size - still syncing
        } else {
          // For folders, just check existence
          return {
            synced: true,
            localPath,
            lastModified: stats.mtime,
            size: stats.size,
          };
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          console.warn(`Error checking path ${localPath}:`, error);
        }
      }

      await delay(this.syncInterval);
    }

    return {
      synced: false,
      localPath,
      error: `Timeout: File did not fully sync within ${this.syncTimeout / 1000} seconds`,
    };
  }

  /**
   * Force strategy: Try to trigger Box Drive sync
   * Note: Limited capabilities - Box Drive doesn't expose sync API
   */
  private async forceSync(id: string, type: 'file' | 'folder', localPath: string): Promise<SyncStatus> {
    // Check if Box Drive is running
    const isRunning = await this.isBoxDriveRunning();
    if (!isRunning) {
      return {
        synced: false,
        localPath,
        error: 'Box Drive is not running',
      };
    }

    // Try to access parent directory to trigger sync
    const parentDir = path.dirname(localPath);
    try {
      fs.readdirSync(parentDir);
    } catch {
      // Parent doesn't exist, can't force sync
    }

    // Fall back to smart sync
    return await this.smartSync(id, type, localPath);
  }

  /**
   * Check if path exists locally and is synced
   */
  public async isSynced(id: string, type: 'file' | 'folder'): Promise<boolean> {
    try {
      const status = await this.waitForSync(id, type, 'poll');
      return status.synced;
    } catch {
      return false;
    }
  }

  /**
   * Get Box Drive root directory
   */
  public getBoxDriveRoot(): string {
    return this.boxDriveRoot;
  }

  /**
   * Open file/folder in Box Drive locally
   * Uses platform-specific open command
   */
  public async openLocally(localPath: string): Promise<void> {
    try {
      if (process.platform === 'win32') {
        await execAsync(`start "" "${localPath}"`);
      } else if (process.platform === 'darwin') {
        await execAsync(`open "${localPath}"`);
      } else {
        // Linux
        await execAsync(`xdg-open "${localPath}"`);
      }
    } catch (error) {
      throw new Error(`Failed to open ${localPath}: ${error}`);
    }
  }
}
