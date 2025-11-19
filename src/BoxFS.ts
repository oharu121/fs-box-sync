import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { BoxAPI } from './BoxAPI';
import { BoxDrive } from './BoxDrive';
import { BoxConfig, SyncStrategy } from './types';
import { formatDateFolders, getBoxOfficeOnlineUrl } from './utils';

/**
 * High-level Box filesystem API
 * Provides fs-like interface with automatic Box Drive sync
 */
export class BoxFS {
  private api: BoxAPI;
  private drive: BoxDrive;

  constructor(config?: BoxConfig) {
    this.api = new BoxAPI(config);
    this.drive = new BoxDrive(this.api, config);
  }

  // ========== FILESYSTEM-LIKE OPERATIONS (ID-based) ==========

  /**
   * Read directory contents from local Box Drive (waits for sync)
   * @param folderId - Box folder ID
   */
  public async readDir(folderId: string): Promise<string[]> {
    const syncStatus = await this.drive.waitForSync(folderId, 'folder');
    if (!syncStatus.synced) {
      throw new Error(`Folder ${folderId} is not synced: ${syncStatus.error}`);
    }

    // Read from local filesystem
    const localPath = syncStatus.localPath!;
    const entries = await fs.readdir(localPath);
    return entries;
  }

  /**
   * Read directory contents (detailed, with IDs)
   */
  public async listFolderItems(folderId: string) {
    const items = await this.api.listFolderItems(folderId);
    return items.entries.map((entry: { id: string; name: string; type: string }) => ({
      id: entry.id,
      name: entry.name,
      type: entry.type,
    }));
  }

  /**
   * Read file contents from local Box Drive (waits for sync)
   * @param fileId - Box file ID
   */
  public async readFile(fileId: string): Promise<string> {
    const syncStatus = await this.drive.waitForSync(fileId, 'file');
    if (!syncStatus.synced) {
      throw new Error(`File ${fileId} is not synced: ${syncStatus.error}`);
    }

    // Read from local filesystem
    const localPath = syncStatus.localPath!;
    return await fs.readFile(localPath, 'utf-8');
  }

  /**
   * Read file contents from Box Cloud
   * @param fileId - Box file ID
   */
  public async getFileContent(fileId: string): Promise<string> {
    const content = await this.api.getFileContent(fileId);
    return content || '';
  }

  /**
   * Write file contents by ID (upload via API)
   * Note: Box API doesn't support in-place editing, so we upload to temp location first
   */
  public async writeFile(folderId: string, filename: string, content: string): Promise<string> {
    // Create temp file
    const tempPath = path.join(os.tmpdir(), `box-upload-${Date.now()}-${filename}`);
    await fs.writeFile(tempPath, content, 'utf-8');

    try {
      // Upload to Box
      const fileId = await this.api.uploadFile(folderId, tempPath);
      return fileId;
    } finally {
      // Clean up temp file
      try {
        await fs.unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Delete file by ID
   */
  public async deleteFile(fileId: string): Promise<void> {
    await this.api.deleteFile(fileId);
  }

  /**
   * Check if file/folder exists and is synced
   */
  public async existsAndSynced(id: string, type: 'file' | 'folder'): Promise<boolean> {
    return await this.drive.isSynced(id, type);
  }

  /**
   * Check if a file/folder exists by name and is synced to Box Drive
   * @param parentFolderId - Parent folder ID to search in
   * @param name - Name of the file/folder to find
   * @param type - Type of item ('file' or 'folder')
   * @returns true if found in cloud AND synced locally
   */
  public async existsByNameAndSynced(
    parentFolderId: string,
    name: string,
    type: 'file' | 'folder'
  ): Promise<boolean> {
    const id = await this.findByName(parentFolderId, name);
    if (!id) return false;

    return await this.existsAndSynced(id, type);
  }

  /**
   * Get local Box Drive path for a Box file/folder
   */
  public async getLocalPath(id: string, type: 'file' | 'folder'): Promise<string> {
    return await this.drive.getLocalPath(id, type);
  }

  /**
   * Get local Box Drive path and ensure it's synced
   * @param id - Box file/folder ID
   * @param type - Type of item
   * @param strategy - Sync strategy (default: 'smart')
   * @returns Local filesystem path (guaranteed to exist)
   */
  public async getLocalPathSynced(
    id: string,
    type: 'file' | 'folder',
    strategy?: SyncStrategy
  ): Promise<string> {
    const syncStatus = await this.drive.waitForSync(id, type, strategy);
    if (!syncStatus.synced) {
      throw new Error(`Cannot get local path: ${syncStatus.error}`);
    }
    return syncStatus.localPath!;
  }

  /**
   * Open file/folder locally in Box Drive
   */
  public async openLocally(id: string, type: 'file' | 'folder'): Promise<void> {
    const syncStatus = await this.drive.waitForSync(id, type);
    if (!syncStatus.synced) {
      throw new Error(`Cannot open: ${syncStatus.error}`);
    }

    await this.drive.openLocally(syncStatus.localPath!);
  }

  // ========== HIGHER-LEVEL OPERATIONS ==========

  /**
   * Find file/folder by name in a folder
   * @param folderId - Parent folder ID
   * @param name - Name to search for (partial match)
   * @returns File/folder ID or null if not found
   */
  public async findByName(folderId: string, name: string): Promise<string | null> {
    const items = await this.api.listFolderItems(folderId);
    const entry = items.entries.find((item: { name: string; id: string }) =>
      item.name.includes(name)
    );
    return entry ? entry.id : null;
  }

  /**
   * Search for files/folders in a folder
   */
  public async search(folderId: string, query: string, type?: 'file' | 'folder') {
    return await this.api.searchInFolder(folderId, query, type);
  }

  /**
   * Create folder if it doesn't exist
   */
  public async createFolderIfNotExists(parentFolderId: string, name: string): Promise<string> {
    // Check if exists
    const existingId = await this.findByName(parentFolderId, name);
    if (existingId) {
      return existingId;
    }

    // Create new folder
    const folder = await this.api.createFolder(parentFolderId, name);
    return folder.id;
  }

  /**
   * Upload file with automatic date-based folder structure
   * Creates year/month folders and uploads the file
   * Uses the global locale configured in BoxConfig
   *
   * @param folderId - Base folder ID where date folders will be created
   * @param filePath - Local file path to upload
   * @returns Uploaded file ID
   *
   * @example
   * // Configure locale first
   * box.configure({ locale: 'ja-JP' });
   *
   * // Uploads to: folderId/2024年/3月/file.pdf
   * await boxFS.uploadWithYearMonthFolders('123', './file.pdf')
   */
  public async uploadWithYearMonthFolders(folderId: string, filePath: string): Promise<string> {
    const date = new Date();
    const { year, month } = formatDateFolders(date, this.api.locale);

    // Create year folder
    const yearFolderId = await this.createFolderIfNotExists(folderId, year);

    // Create month folder
    const monthFolderId = await this.createFolderIfNotExists(yearFolderId, month);

    // Upload file
    const fileId = await this.api.uploadFile(monthFolderId, filePath);

    // Delete local file after upload
    try {
      await fs.unlink(filePath);
    } catch {
      // Ignore if can't delete
    }

    return fileId;
  }

  /**
   * Get Box Office Online editable URL for a file
   * @param fileId - Box file ID
   * @returns Office Online URL
   */
  public getOfficeOnlineUrl(fileId: string): string {
    return getBoxOfficeOnlineUrl(fileId, this.api.domain);
  }

  /**
   * Get Box Office Online URL by searching for file in folder
   * @param folderId - Folder to search in
   * @param fileName - File name to search for
   */
  public async getOfficeOnlineUrlByName(folderId: string, fileName: string): Promise<string> {
    const fileId = await this.findByName(folderId, fileName);
    if (!fileId) {
      return '';
    }
    return this.getOfficeOnlineUrl(fileId);
  }

  /**
   * Upload file to Box
   */
  public async uploadFile(folderId: string, filePath: string): Promise<string> {
    return await this.api.uploadFile(folderId, filePath);
  }

  /**
   * Upload file to Box and remove it locally
   * @param folderId - Target folder ID in Box
   * @param filePath - Local file path to upload
   * @returns Uploaded file ID
   */
  public async uploadFileThenRemove(folderId: string, filePath: string): Promise<string> {
    const fileId = await this.api.uploadFile(folderId, filePath);
    await fs.unlink(filePath);
    return fileId;
  }

  /**
   * Download file by ID
   */
  public async downloadFile(fileId: string, destPath: string): Promise<void> {
    await this.api.downloadFile(fileId, destPath);
  }

  /**
   * Move file to another folder
   */
  public async moveFile(fileId: string, toFolderId: string) {
    return await this.api.moveFile(fileId, toFolderId);
  }

  /**
   * Get file metadata
   */
  public async getFileInfo(fileId: string) {
    return await this.api.getFileInfo(fileId);
  }

  /**
   * Get folder metadata
   */
  public async getFolderInfo(folderId: string) {
    return await this.api.getFolderInfo(folderId);
  }

  // ========== WEBHOOK OPERATIONS ==========

  public async getAllWebhooks() {
    return await this.api.getAllWebhooks();
  }

  public async createWebhook(folderId: string, address: string) {
    return await this.api.createWebhook(folderId, address);
  }

  public async deleteWebhook(webhookId: string) {
    return await this.api.deleteWebhook(webhookId);
  }

  /**
   * Delete all webhooks
   * @returns Number of webhooks deleted
   */
  public async deleteAllWebhooks(): Promise<number> {
    const webhooks = await this.api.getAllWebhooks();
    for (const webhook of webhooks.entries) {
      await this.api.deleteWebhook(webhook.id);
    }
    return webhooks.entries.length;
  }

  // ========== SHARED LINKS ==========

  public async downloadFromSharedLink(linkId: string, destPath: string) {
    return await this.api.downloadFromSharedLink(linkId, destPath);
  }

  // ========== BOX DRIVE OPERATIONS ==========

  /**
   * Check if Box Drive is running
   */
  public async isBoxDriveRunning(): Promise<boolean> {
    return await this.drive.isBoxDriveRunning();
  }

  /**
   * Wait for sync with custom strategy
   */
  public async waitForSync(id: string, type: 'file' | 'folder', strategy?: SyncStrategy) {
    return await this.drive.waitForSync(id, type, strategy);
  }

  /**
   * Get Box Drive root directory
   */
  public getBoxDriveRoot(): string {
    return this.drive.getBoxDriveRoot();
  }
}
