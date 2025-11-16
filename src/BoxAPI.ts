import Axon from 'axios-fluent';
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import os from 'os';
import FormData from 'form-data';
import crypto from 'crypto';
import { BoxConfig, StoredCredentials } from './types';

interface UploadPart {
  offset: number;
  part_id: string;
  sha1: string;
  size: number;
}

/**
 * Pure Box API wrapper
 * Handles authentication and raw API calls
 * No Box Drive integration or sync logic
 */
export class BoxAPI {
  private expiredAt = Date.now();
  private refreshToken: string = '';
  private accessToken: string = '';
  private tokenRefreshPromise: Promise<void> | null = null;
  private tokenProvider?: (callback: string) => Promise<string> | string;
  private clientId: string = '';
  private clientSecret: string = '';
  private redirectUri: string = 'https://oauth.pstmn.io/v1/callback';
  private storagePath: string;
  public domain: string = 'app.box.com';
  private allowInsecure: boolean = false;

  constructor(config?: BoxConfig) {
    this.storagePath = this.getDefaultStoragePath();

    if (config) {
      this.applyConfig(config);
    }

    // Auto-load from storage (async, but don't block constructor)
    this.loadFromStorage().catch(() => {
      // Silently fail - will load on first use if needed
    });
  }

  /**
   * Apply configuration
   */
  public applyConfig(config: BoxConfig): void {
    if (config.tokenProvider) {
      this.tokenProvider = config.tokenProvider;
    }

    if (config.refreshToken) {
      this.refreshToken = config.refreshToken;
    }

    if (config.clientId) {
      this.clientId = config.clientId;
    }

    if (config.clientSecret) {
      this.clientSecret = config.clientSecret;
    }

    if (config.redirectUri) {
      this.redirectUri = config.redirectUri;
    }

    if (config.domain) {
      this.domain = config.domain;
    }

    if (config.allowInsecure !== undefined) {
      this.allowInsecure = config.allowInsecure;
    }

    this.updateStoragePath();
  }

  /**
   * Get configured Axon instance with appropriate security settings
   */
  private getAxon() {
    return this.allowInsecure ? Axon.dev() : Axon.new();
  }

  /**
   * Get the storage directory based on platform
   */
  private getStorageDirectory(): string {
    const homeDir = os.homedir();

    if (process.platform === 'win32') {
      const localAppData = process.env.LOCALAPPDATA || path.join(homeDir, 'AppData', 'Local');
      return path.join(localAppData, 'fs-box-sync');
    } else {
      const configHome = process.env.XDG_CONFIG_HOME || path.join(homeDir, '.config');
      return path.join(configHome, 'fs-box-sync');
    }
  }

  /**
   * Get storage path for tokens
   */
  private getDefaultStoragePath(): string {
    const baseDir = this.getStorageDirectory();
    return path.join(baseDir, 'tokens.json');
  }

  /**
   * Update storage path based on current client
   */
  private updateStoragePath(): void {
    this.storagePath = this.getDefaultStoragePath();
  }

  /**
   * Save credentials to storage
   */
  private async saveToStorage(): Promise<void> {
    if (!this.refreshToken) {
      return;
    }

    try {
      const credentials: StoredCredentials = {
        refreshToken: this.refreshToken,
        accessToken: this.accessToken,
        expiresAt: this.expiredAt,
        clientId: this.clientId,
      };

      const dir = path.dirname(this.storagePath);
      await fsPromises.mkdir(dir, { recursive: true });

      await fsPromises.writeFile(
        this.storagePath,
        JSON.stringify(credentials, null, 2),
        'utf-8'
      );

      console.info(`Credentials saved to ${this.storagePath}`);
    } catch (error) {
      console.error('Failed to save credentials to storage:', error);
    }
  }

  /**
   * Load credentials from storage
   */
  private async loadFromStorage(): Promise<boolean> {
    try {
      const data = await fsPromises.readFile(this.storagePath, 'utf-8');
      const credentials: StoredCredentials = JSON.parse(data);

      this.refreshToken = credentials.refreshToken;
      this.accessToken = credentials.accessToken;
      this.expiredAt = credentials.expiresAt;
      this.clientId = credentials.clientId;

      this.updateStoragePath();

      console.info(`Credentials loaded from storage: ${this.storagePath}`);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Ensure we have required credentials
   */
  private ensureCredentials(): void {
    if (!this.clientId && process.env.BOX_CLIENT_ID) {
      this.clientId = process.env.BOX_CLIENT_ID;
    }

    if (!this.clientSecret && process.env.BOX_CLIENT_SECRET) {
      this.clientSecret = process.env.BOX_CLIENT_SECRET;
    }

    if (!this.clientId || !this.clientSecret) {
      throw new Error(
        'Missing required credentials. Please provide:\n' +
          (!this.clientId ? '  - clientId\n' : '') +
          (!this.clientSecret ? '  - clientSecret\n' : '') +
          '\nProvide via:\n' +
          '1. new BoxAPI({ clientId: "...", clientSecret: "..." })\n' +
          '2. Environment variables: BOX_CLIENT_ID, BOX_CLIENT_SECRET\n'
      );
    }
  }

  /**
   * Check and refresh token if needed
   */
  private async checkToken(): Promise<void> {
    this.ensureCredentials();

    if (this.tokenRefreshPromise) {
      await this.tokenRefreshPromise;
      if (!this.refreshToken || Date.now() < this.expiredAt) {
        return;
      }
    }

    if (!this.refreshToken || Date.now() >= this.expiredAt) {
      let refreshOperation: Promise<void>;
      if (!this.refreshToken) {
        refreshOperation = this.forgeRefreshToken();
      } else {
        refreshOperation = this.refreshAccessToken();
      }

      this.tokenRefreshPromise = refreshOperation;

      try {
        await refreshOperation;
        await this.saveToStorage();
      } finally {
        this.tokenRefreshPromise = null;
      }
    }
  }

  /**
   * Forge new refresh token via OAuth
   */
  private async forgeRefreshToken() {
    if (!this.tokenProvider) {
      throw new Error(
        'No token provider configured. Please provide one via:\n' +
          '1. new BoxAPI({ tokenProvider: async (callback) => { ... } })\n' +
          '2. Provide refreshToken directly: new BoxAPI({ refreshToken: "..." })\n' +
          '\nExample with Playwright:\n' +
          '  new BoxAPI({\n' +
          '    tokenProvider: async (callback) => await Playwright.getBoxCode(callback)\n' +
          '  })\n'
      );
    }

    const callback =
      'https://account.box.com/api/oauth2/authorize?' +
      `client_id=${this.clientId}` +
      '&response_type=code';

    const code = await this.tokenProvider(callback);

    const url = `https://api.box.com/oauth2/token`;

    const reqTokenBody = {
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code: code,
      redirect_uri: this.redirectUri,
      grant_type: 'authorization_code',
    };

    try {
      const res = await this.getAxon().encodeUrl().post(url, reqTokenBody);

      if (res.status === 200) {
        this.accessToken = res.data.access_token;
        this.expiredAt = Date.now() + res.data.expires_in * 1000;
        this.refreshToken = res.data.refresh_token;
      } else {
        console.error(`Failed to forge refresh token: ${res.status} ${res.data}`);
        throw new Error('Failed to forge refresh token');
      }
    } catch (error) {
      console.error('Error forging refresh token:', error);
      throw error;
    }
  }

  /**
   * Refresh access token
   */
  private async refreshAccessToken(): Promise<void> {
    const url = `https://api.box.com/oauth2/token`;

    const reqTokenBody = {
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: this.refreshToken,
    };

    try {
      const res = await this.getAxon().encodeUrl().post(url, reqTokenBody);

      if (res.status === 200) {
        this.accessToken = res.data.access_token;
        this.expiredAt = Date.now() + res.data.expires_in * 1000;
        this.refreshToken = res.data.refresh_token;
      } else {
        console.error(`Failed to refresh access token: ${res.status} ${res.data}`);
        throw new Error('Failed to refresh access token');
      }
    } catch (error) {
      console.error('Error refreshing access token:', error);
      throw error;
    }
  }

  // ========== WEBHOOK OPERATIONS ==========

  public async getAllWebhooks() {
    await this.checkToken();
    const url = `https://api.box.com/2.0/webhooks`;
    const res = await this.getAxon().bearer(this.accessToken).get(url);
    return res.data;
  }

  public async createWebhook(folderId: string, address: string) {
    await this.checkToken();
    const url = `https://api.box.com/2.0/webhooks`;
    const payload = {
      target: { id: folderId, type: 'folder' },
      address,
      triggers: ['FILE.UPLOADED'],
    };
    const res = await this.getAxon().bearer(this.accessToken).post(url, payload);
    return res.data;
  }

  public async deleteWebhook(webhookId: string) {
    await this.checkToken();
    const url = `https://api.box.com/2.0/webhooks/${webhookId}`;
    const res = await this.getAxon().bearer(this.accessToken).delete(url);
    return res.data;
  }

  // ========== FILE OPERATIONS ==========

  public async getFileInfo(fileId: string) {
    await this.checkToken();
    const url = `https://api.box.com/2.0/files/${fileId}`;
    const res = await this.getAxon().bearer(this.accessToken).get(url);
    return res.data;
  }

  public async getFileContent(fileId: string): Promise<string | null> {
    await this.checkToken();
    const url = `https://api.box.com/2.0/files/${fileId}/content`;

    try {
      const res = await this.getAxon().bearer(this.accessToken).responseType('arraybuffer').get(url);
      if (res.status === 200) {
        return Buffer.from(res.data).toString();
      } else {
        console.error(`Failed to get file content for ID ${fileId}. Status: ${res.status}`);
        return null;
      }
    } catch (error) {
      console.error(`Error fetching file content for ID ${fileId}:`, error);
      return null;
    }
  }

  public async downloadFile(fileId: string, destPath: string) {
    await this.checkToken();
    const url = `https://api.box.com/2.0/files/${fileId}/content`;
    const res = await this.getAxon().bearer(this.accessToken).responseType('stream').get(url);

    if (res.status === 200) {
      const writer = fs.createWriteStream(destPath);
      res.data.pipe(writer);

      return new Promise<void>((resolve, reject) => {
        writer.on('finish', () => resolve());
        writer.on('error', (err) => reject(err));
      });
    }
  }

  public async deleteFile(fileId: string) {
    await this.checkToken();
    const url = `https://api.box.com/2.0/files/${fileId}`;
    const res = await this.getAxon().bearer(this.accessToken).delete(url);
    return res.data;
  }

  public async moveFile(fileId: string, toFolderId: string) {
    await this.checkToken();
    const url = `https://api.box.com/2.0/files/${fileId}`;
    const payload = { parent: { id: toFolderId } };
    const res = await this.getAxon().bearer(this.accessToken).put(url, payload);
    return res.data;
  }

  public async uploadFile(folderId: string, filePath: string): Promise<string> {
    const fileSize = fs.statSync(filePath).size;
    const FILE_SIZE_THRESHOLD = 20 * 1024 * 1024; // 20MB

    const fileId =
      fileSize > FILE_SIZE_THRESHOLD
        ? await this.chunkedUpload(folderId, filePath, fileSize)
        : await this.normalUpload(folderId, filePath);

    return fileId;
  }

  private async normalUpload(folderId: string, filePath: string): Promise<string> {
    await this.checkToken();

    const url = `https://upload.box.com/api/2.0/files/content`;
    const name = path.basename(filePath);
    const stream = fs.createReadStream(filePath);
    const formData = new FormData();
    const attributes = {
      name: name,
      parent: { id: folderId },
    };

    formData.append('attributes', JSON.stringify(attributes));
    formData.append('file', stream, name);

    const res = await this.getAxon().bearer(this.accessToken).post(url, formData);
    return res.data.entries[0].id || '';
  }

  private async chunkedUpload(folderId: string, filePath: string, fileSize: number) {
    const { sessionId, uploadUrl, partSize } = await this.createUploadSession(
      folderId,
      filePath,
      fileSize
    );

    const { parts, fileDigest } = await this.uploadChunks(uploadUrl, partSize, filePath, fileSize);

    const fileId = await this.commitSession(sessionId, parts, fileDigest);
    return fileId;
  }

  private async createUploadSession(folderId: string, filePath: string, fileSize: number) {
    await this.checkToken();

    const url = `https://upload.box.com/api/2.0/files/upload_sessions`;
    const name = path.basename(filePath);
    const payload = {
      folder_id: folderId,
      file_name: name,
      file_size: fileSize,
    };

    const res = await this.getAxon().bearer(this.accessToken).post(url, payload);
    const sessionId = res.data.id || '';
    const uploadUrl = res.data.session_endpoints.upload_part;
    const partSize = res.data.part_size;

    return { sessionId, uploadUrl, partSize };
  }

  private async uploadChunks(
    uploadUrl: string,
    partSize: number,
    filePath: string,
    fileSize: number
  ): Promise<{ parts: UploadPart[]; fileDigest: string }> {
    const parts: UploadPart[] = [];
    let offset = 0;
    const fileHash = crypto.createHash('sha1');

    while (offset < fileSize) {
      const end = Math.min(offset + partSize, fileSize);
      const readStream = fs.createReadStream(filePath, {
        start: offset,
        end: end - 1,
      });

      const chunk = await new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = [];
        readStream.on('data', (chunk: string | Buffer) => {
          if (typeof chunk === 'string') {
            chunks.push(Buffer.from(chunk));
          } else {
            chunks.push(chunk);
          }
        });
        readStream.on('end', () => resolve(Buffer.concat(chunks)));
        readStream.on('error', (err: Error) => reject(err));
      });

      fileHash.update(chunk);

      const contentLength = end - offset;
      const digest = this.calculateSHA1(chunk);
      const res = await this.getAxon()
        .bearer(this.accessToken)
        .digest(digest)
        .octet()
        .length(contentLength)
        .range(offset, end, fileSize)
        .transformRequest([(data) => data])
        .put(uploadUrl, chunk);

      parts.push(res.data.part);
      offset = end;
    }

    const fileDigest = fileHash.digest('base64');
    return { parts, fileDigest };
  }

  private async commitSession(sessionId: string, parts: UploadPart[], fileDigest: string) {
    const url = `https://upload.box.com/api/2.0/files/upload_sessions/${sessionId}/commit`;
    const payload = { parts };
    const res = await this.getAxon().bearer(this.accessToken).digest(fileDigest).post(url, payload);
    return res.data.entries[0].id;
  }

  private calculateSHA1(buffer: Buffer): string {
    const hash = crypto.createHash('sha1');
    hash.update(buffer);
    return hash.digest('base64');
  }

  // ========== FOLDER OPERATIONS ==========

  public async getFolderInfo(folderId: string) {
    await this.checkToken();
    const url = `https://api.box.com/2.0/folders/${folderId}`;
    const res = await this.getAxon().bearer(this.accessToken).get(url);
    return res.data;
  }

  public async listFolderItems(folderId: string) {
    await this.checkToken();
    const url = `https://api.box.com/2.0/folders/${folderId}/items`;
    const res = await this.getAxon().bearer(this.accessToken).get(url);
    return res.data;
  }

  public async createFolder(parentFolderId: string, name: string) {
    await this.checkToken();
    const url = `https://api.box.com/2.0/folders`;
    const payload = {
      name: name,
      parent: { id: parentFolderId },
    };
    const res = await this.getAxon().bearer(this.accessToken).post(url, payload);
    return res.data;
  }

  public async searchInFolder(folderId: string, query: string, type?: string) {
    await this.checkToken();
    const url = `https://api.box.com/2.0/search`;
    const params: Record<string, string | number> = {
      query: query,
      content_types: 'name',
      folder_ids: folderId,
      limit: 100,
    };

    if (type) {
      params.type = type;
    }

    const res = await this.getAxon().bearer(this.accessToken).params(params).get(url);
    return res.data.entries;
  }

  // ========== SHARED LINKS ==========

  public async getSharedLinkFileId(linkId: string) {
    await this.checkToken();
    const url = `https://api.box.com/2.0/shared_items`;
    const res = await this.getAxon()
      .bearer(this.accessToken)
      .setHeader('boxapi', `shared_link=https://app.box.com/s/${linkId}`)
      .get(url);
    return res.data.id;
  }

  public async downloadFromSharedLink(linkId: string, destPath: string) {
    await this.checkToken();
    const id = await this.getSharedLinkFileId(linkId);
    const url = `https://api.box.com/2.0/files/${id}/content`;
    const res = await this.getAxon()
      .bearer(this.accessToken)
      .setHeader('boxapi', `shared_link=https://app.box.com/s/${linkId}`)
      .responseType('stream')
      .get(url);

    if (res.status === 200) {
      const writer = fs.createWriteStream(destPath);

      return new Promise<void>((resolve, reject) => {
        res.data.pipe(writer);
        writer.on('finish', () => resolve());
        writer.on('error', (err: Error) => reject(err));
        res.data.on('error', (err: Error) => {
          writer.destroy();
          reject(err);
        });
      });
    } else {
      throw new Error(`Failed to download file. Status: ${res.status}`);
    }
  }
}
