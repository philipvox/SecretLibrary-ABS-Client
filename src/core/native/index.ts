/**
 * src/core/native/index.ts
 *
 * Native module utilities for performance optimization.
 */

// Performance monitoring
export {
  frameRateMonitor,
  memoryMonitor,
  renderTracker,
  interactionTracker,
  analyzePerformance,
  useRenderTracking,
} from './performanceMonitor';
export type {
  FrameMetrics,
  MemoryMetrics,
  RenderMetrics,
  PerformanceTip,
} from './performanceMonitor';

// Haptic feedback
export {
  haptics,
  useHaptics,
} from './haptics';
export type {
  ImpactStyle,
  NotificationType,
} from './haptics';

// Thread utilities
export {
  taskScheduler,
  processInChunks,
  processSequentially,
  debounce,
  throttle,
  createBatchCollector,
  requestIdleCallback,
  cancelIdleCallback,
} from './threadUtils';
export type {
  Priority,
  ChunkOptions,
  BatchCollector,
} from './threadUtils';

// Storage optimization
export {
  storageOptimizer,
  DIRECTORIES,
} from './storageOptimizer';
export type {
  StorageInfo,
  DirectoryInfo,
} from './storageOptimizer';
