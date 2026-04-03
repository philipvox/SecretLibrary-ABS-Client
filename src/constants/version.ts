/**
 * src/constants/version.ts
 *
 * App version tracking for development.
 * Update this file with each significant change.
 * See CHANGELOG.md in project root for detailed change history.
 */

export const APP_VERSION = '0.9.281';
export const BUILD_NUMBER = 1281;
export const VERSION_DATE = '2026-04-02';

// iOS App Store uses a separate version scheme
export const IOS_VERSION = '1.0.4';
export const IOS_BUILD_NUMBER = 27;

// Version info for display
export const getVersionString = () => `v${APP_VERSION} (${BUILD_NUMBER})`;
export const getFullVersionInfo = () => ({
  version: APP_VERSION,
  build: BUILD_NUMBER,
  date: VERSION_DATE,
});
