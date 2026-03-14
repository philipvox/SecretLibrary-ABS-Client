/**
 * src/features/player/stores/playerTransition.ts
 *
 * Module-level Reanimated shared value for the mini player → full player transition.
 * Using makeMutable allows both GlobalMiniPlayer and SecretLibraryPlayerScreen
 * to share the value without React context. Readable/writable from worklets (UI thread).
 *
 * 0 = collapsed (mini player visible)
 * 1 = expanded (full player visible)
 */

import { makeMutable } from 'react-native-reanimated';

// Transition progress: 0 = mini player, 1 = full player
export const playerTransitionProgress = makeMutable(0);

// Spring config matching existing feel (tension:65, friction:11 → damping:20, stiffness:200)
export const SPRING_CONFIG = { damping: 20, stiffness: 200, mass: 0.8 };

// Below this threshold snaps to 0 (mini), above snaps to 1 (full)
export const SNAP_THRESHOLD = 0.35;

// Velocity threshold for quick swipes (overrides position threshold)
export const VELOCITY_THRESHOLD = 500;
