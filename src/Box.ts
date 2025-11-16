import { BoxFS } from './BoxFS';
import { BoxDrive } from './BoxDrive';
import { BoxConfig } from './types';

/**
 * Singleton Box class with factory method pattern
 */
class Box extends BoxFS {
  private static instance: Box;

  private constructor() {
    super();
  }

  public static getInstance(): Box {
    if (!Box.instance) {
      Box.instance = new Box();
    }
    return Box.instance;
  }

  /**
   * Configure the singleton instance
   */
  public configure(config: BoxConfig): void {
    // Apply config to internal API instance
    (this as any).api.applyConfig(config);

    // Recreate drive with new config
    (this as any).drive = new BoxDrive((this as any).api, config);
  }
}

// Export the class for custom instances
export { Box };

// Export all other classes
export { BoxFS } from './BoxFS';
export { BoxAPI } from './BoxAPI';
export { BoxDrive } from './BoxDrive';

// Export types
export type { BoxConfig, StoredCredentials, SyncStrategy, SyncStatus } from './types';

// Export utilities
export * from './utils';

// Export singleton instance
export default Box.getInstance();
