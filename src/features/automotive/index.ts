/**
 * src/features/automotive/index.ts
 *
 * Automotive (CarPlay / Android Auto) feature exports
 */

export * from './types';
export { automotiveService } from './automotiveService';
export {
  useAutomotiveConnection,
  useAutomotiveActions,
  useAutomotive,
} from './useAutomotive';
export {
  updateAndroidAutoBrowseData,
  getAndroidAutoBrowseData,
  clearAndroidAutoBrowseData,
} from './androidAutoBridge';
