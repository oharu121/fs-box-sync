/**
 * Configuration for Box authentication and Box Drive integration
 */
export interface BoxConfig {
  // === Authentication ===
  // Access token for quick testing (expires in ~1 hour, no auto-refresh)
  // Get from: Box Developer Console → My Apps → Your App → Configuration → Developer Token
  accessToken?: string;

  // Token provider function (e.g., Playwright.getBoxCode)
  // Will be called when refresh token is needed initially
  tokenProvider?: (callback: string) => Promise<string> | string;

  // Manual refresh token (if you already have one)
  refreshToken?: string;

  // Box API credentials
  clientId?: string;
  clientSecret?: string;

  // Redirect URI for OAuth (default: https://oauth.pstmn.io/v1/callback)
  redirectUri?: string;

  // === Box Drive Configuration ===
  // Root directory of Box Drive
  // Windows: C:/Users/{username}/Box
  // Mac: ~/Library/CloudStorage/Box-Box
  // Linux: ~/Box (if using unofficial client)
  boxDriveRoot?: string;

  // === Box Domain Configuration ===
  // Box domain for Office Online URLs (e.g., 'foo.app.box.com', 'app.box.com')
  // Default: 'app.box.com'
  domain?: string;

  // === Sync Configuration ===
  // Default timeout for sync operations (ms)
  // Default: 30000 (30 seconds)
  syncTimeout?: number;

  // Default poll interval for sync checks (ms)
  // Default: 1000 (1 second)
  syncInterval?: number;

  // === Security Configuration ===
  // Allow insecure HTTPS connections (self-signed certificates)
  // WARNING: Only use in development/testing. This disables SSL certificate verification.
  // Default: false
  allowInsecure?: boolean;
}

/**
 * Stored credentials in cross-platform storage
 */
export interface StoredCredentials {
  refreshToken: string;
  accessToken: string;
  expiresAt: number;
  clientId: string;
  // NOTE: clientSecret is NOT stored (comes from env or config)
}

/**
 * Sync strategy for ensuring Box Drive sync
 */
export type SyncStrategy = 'poll' | 'smart' | 'force';

/**
 * Sync verification result
 */
export interface SyncStatus {
  synced: boolean;
  localPath?: string;
  error?: string;
  lastModified?: Date;
  size?: number;
}
