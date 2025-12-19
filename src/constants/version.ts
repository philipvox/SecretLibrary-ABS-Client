/**
 * src/constants/version.ts
 *
 * App version tracking for development.
 * Update this file with each significant change.
 * See CHANGELOG.md in project root for detailed change history.
 */

export const APP_VERSION = '0.4.51';
export const BUILD_NUMBER = 85;
export const VERSION_DATE = '2025-12-19';

// Version info for display
export const getVersionString = () => `v${APP_VERSION} (${BUILD_NUMBER})`;
export const getFullVersionInfo = () => ({
  version: APP_VERSION,
  build: BUILD_NUMBER,
  date: VERSION_DATE,
});
