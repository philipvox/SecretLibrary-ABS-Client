# Playback Issues Diagnosis

**Date:** January 5, 2026
**Branch:** refactor/cdplayer-screen

---

## Executive Summary

After comprehensive analysis of the audio system, I've identified **root causes** for all 5 reported issues. The main problems are:

1. **Insufficient timeout and missing retry logic** in track transitions
2. **No "end of chapter" sleep timer mode exists** - but completion detection has edge cases
3. **Errors are silently swallowed** in play/pause operations
4. **Object-returning selectors cause re-renders** - missing `useShallow` wrapper
5. **State duplication between stores** creates sync opportunities but is manageable

---

## Issue 1: Chapter Progression Blocked

### Symptom
Book won't let user go past a specific chapter, then randomly works later with no indicator.

### Root Cause

**Primary:** `waitForTrackReady()` has a 500ms timeout that's too short for slow networks.

**Location:** `audioService.ts:1102-1112`

```typescript
private async waitForTrackReady(maxWaitMs: number = 500): Promise<void> {
  const startTime = Date.now();
  while (Date.now() - startTime < maxWaitMs) {
    if (this.player && this.player.duration > 0) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  log(`Warning: Track ready timeout after ${maxWaitMs}ms`);
  // ❌ NO RETRY LOGIC - just continues with potentially unready player
}
```

**Secondary issues:**

1. **handleTrackEnd() fallback path** (line 476-487) uses 500ms timeout:
   ```typescript
   // Fallback: load directly (may have brief gap)
   this.player.replace({ uri: nextTrack.url });
   this.player.play();
   await this.waitForTrackReady(500);  // ❌ Too short, no retry
   ```

2. **No error handling** on `player.replace()` or `player.play()` - they can fail silently

3. **trackSwitchInProgress flag** is cleared after waitForTrackReady even if track isn't ready (line 490)

### Why It "Randomly Works Later"

- User pauses/plays or seeks again, which triggers a new load attempt
- Network conditions improve
- The 1500ms fallback timeout in `startProgressUpdates()` (line 620-628) clears the stuck flag

### Proposed Fix

```typescript
// 1. Increase timeout and add retry logic
private async waitForTrackReady(maxWaitMs: number = 2000): Promise<boolean> {
  const startTime = Date.now();
  while (Date.now() - startTime < maxWaitMs) {
    if (this.player && this.player.duration > 0) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  log(`[Audio] Track ready timeout after ${maxWaitMs}ms`);
  return false; // Return success/failure instead of void
}

// 2. Add retry in handleTrackEnd
if (!await this.waitForTrackReady(2000)) {
  log('[Audio] Retrying track load...');
  this.player.replace({ uri: nextTrack.url });
  if (!await this.waitForTrackReady(3000)) {
    log('[Audio] Track load failed - notifying user');
    // Show error state to user
  }
}
```

### Files Affected
- `src/features/player/services/audioService.ts`

---

## Issue 2: Playback Pausing at Chapter Breaks

### Symptom
Audio pauses unexpectedly when transitioning between chapters.

### Root Cause

**Primary:** The `handleTrackEnd()` function pauses the player before loading next track, and there's a gap if the new track takes time to load.

**Location:** `audioService.ts:459-467` and `476-479`

```typescript
// Line 459: Old player is paused
this.player?.pause();

// Swap players or load new track...

// Gap here while track loads - audio is silent
```

**Secondary:** Stream segment completion (for single m4b files) triggers resume but doesn't verify success:

```typescript
// Line 519
this.player.play();  // ❌ No check if this succeeded
```

### Why "End of Chapter" Sleep Timer Isn't the Cause

I searched for "end of chapter" sleep timer mode but it doesn't exist in the codebase. The `sleepTimerStore.ts` only implements a countdown timer in seconds - no chapter-aware mode.

### Proposed Fix

```typescript
// 1. Add logging for track end events
private async handleTrackEnd(): Promise<void> {
  playerLogger.debug('[Audio] Track ended', {
    reason: 'didJustFinish',
    trackIndex: this.currentTrackIndex,
    tracksTotal: this.tracks.length,
    position: this.getGlobalPositionSync(),
    wasPreloaded: this.preloadedTrackIndex === this.currentTrackIndex + 1,
  });
  // ... existing logic
}

// 2. Verify playback resumed after stream segment end
if (!nearEnd) {
  this.player.play();
  // Wait and verify
  await new Promise(resolve => setTimeout(resolve, 200));
  if (!this.player.playing) {
    log('[Audio] Resume failed - retrying');
    this.player.play();
  }
}
```

### Files Affected
- `src/features/player/services/audioService.ts`

---

## Issue 3: Playback Fails Silently (Must Tap Play Again)

### Symptom
Audio stops, no error shown, user has to manually tap play.

### Root Cause

**Critical:** Errors are silently swallowed throughout the playback chain.

**Location 1:** `playerStore.ts:1232`
```typescript
// Fire play command (don't block on it)
audioService.play().catch(() => {});  // ❌ Error swallowed!
```

**Location 2:** `playerStore.ts:1355`
```typescript
// Fire pause command (don't await - let it happen in background)
audioService.pause().catch(() => {});  // ❌ Error swallowed!
```

**Location 3:** `audioService.ts:1165-1168`
```typescript
async play(): Promise<void> {
  log('▶ Play');
  this.player?.play();  // ❌ No error handling, no Promise return
  this.updateMediaControlPlaybackState(true);  // ❌ Not awaited
}
```

**Location 4:** expo-audio doesn't have a `playbackError` event (noted at line 225-227), so errors only appear in `playbackStatusUpdate` but aren't surfaced to users.

### Why Stuck Detection Doesn't Help

There IS stuck detection in `playerStore.ts:1236-1271`, but:
- It triggers after **3 seconds** (too long for user experience)
- It only checks `audioService.getIsPlaying()` - doesn't detect buffering stuck states
- Recovery attempt also uses `.catch(() => {})` - swallows retry errors too

### Proposed Fix

```typescript
// 1. In playerStore.play() - add error handling with user feedback
play: async () => {
  if (!audioService.getIsLoaded()) return;

  set({ isPlaying: true, lastPlayedBookId: currentBook?.id || null });

  try {
    await audioService.play();
  } catch (error) {
    playerLogger.error('[Audio] Playback failed', { error });
    set({ isPlaying: false, isBuffering: false });
    // Show toast to user
    import('react-native-toast-message').then(Toast => {
      Toast.default.show({
        type: 'error',
        text1: 'Playback interrupted',
        text2: 'Tap play to resume',
        position: 'bottom',
      });
    });
    return;
  }
  // ... rest of play logic
}

// 2. In audioService.play() - actually return promise and handle errors
async play(): Promise<void> {
  log('▶ Play');
  if (!this.player) {
    throw new Error('Player not initialized');
  }

  try {
    this.player.play();

    // Verify playback started within 500ms
    await new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        if (this.player?.playing) {
          clearInterval(checkInterval);
          resolve(undefined);
        }
      }, 50);
      setTimeout(() => {
        clearInterval(checkInterval);
        if (!this.player?.playing) {
          reject(new Error('Playback failed to start'));
        } else {
          resolve(undefined);
        }
      }, 500);
    });

    await this.updateMediaControlPlaybackState(true);
  } catch (error: any) {
    audioLog.error('Play failed:', error.message);
    throw error;
  }
}
```

### Files Affected
- `src/features/player/stores/playerStore.ts`
- `src/features/player/services/audioService.ts`

---

## Issue 4: Slow Renders in Logs

### Symptom
Performance warnings about slow renders appearing in logs.

### Root Cause

**Object-returning selectors create new references every render:**

**Location 1:** `seekingStore.ts:356-362`
```typescript
export const useSeekingState = () =>
  useSeekingStore((s) => ({
    isSeeking: s.isSeeking,
    seekPosition: s.seekPosition,
    seekStartPosition: s.seekStartPosition,
    seekDirection: s.seekDirection,
  }));  // ❌ Creates new object every call = re-render every time
```

**Location 2:** `sleepTimerStore.ts:259-265`
```typescript
export const useSleepTimerState = () =>
  useSleepTimerStore((s) => ({
    sleepTimer: s.sleepTimer,
    isActive: s.sleepTimer !== null,
    shakeToExtendEnabled: s.shakeToExtendEnabled,
    isShakeDetectionActive: s.isShakeDetectionActive,
  }));  // ❌ Same problem
```

**Location 3:** `completionStore.ts:249-255` - same pattern

**Note:** `playerStore.ts:2148-2156` correctly uses `useShallow`:
```typescript
export function useSleepTimerState() {
  return usePlayerStore(
    useShallow((s) => ({  // ✅ Correct
      sleepTimer: s.sleepTimer,
      // ...
    }))
  );
}
```

### Position Updates (Not a Problem)

Position updates at 100ms (10/sec) is appropriate for smooth scrubber UI. The issue is components re-rendering unnecessarily due to object selectors.

### Proposed Fix

```typescript
// Add useShallow to all object-returning selectors

// seekingStore.ts
import { useShallow } from 'zustand/react/shallow';

export const useSeekingState = () =>
  useSeekingStore(
    useShallow((s) => ({
      isSeeking: s.isSeeking,
      seekPosition: s.seekPosition,
      seekStartPosition: s.seekStartPosition,
      seekDirection: s.seekDirection,
    }))
  );

// Same pattern for sleepTimerStore and completionStore
```

### Alternative: Multiple Primitive Selectors

```typescript
// Even better - use multiple primitive selectors
const isSeeking = useSeekingStore(s => s.isSeeking);
const seekPosition = useSeekingStore(s => s.seekPosition);
// Each only re-renders when that specific value changes
```

### Files Affected
- `src/features/player/stores/seekingStore.ts`
- `src/features/player/stores/sleepTimerStore.ts`
- `src/features/player/stores/completionStore.ts`

---

## Issue 5: Cross-Store Race Conditions (Post-Refactor)

### Symptom
State seems out of sync, actions don't work until retry.

### Analysis

The refactored stores use a delegation pattern where `playerStore` calls methods on specialized stores then syncs state back:

```typescript
// playerStore.ts:1388-1400
startSeeking: (direction?: SeekDirection) => {
  const { position } = get();
  // Delegate to seekingStore
  useSeekingStore.getState().startSeeking(position, direction);
  // Sync to local state for backward compatibility
  const seekState = useSeekingStore.getState();
  set({
    isSeeking: seekState.isSeeking,
    seekPosition: seekState.seekPosition,
    seekStartPosition: seekState.seekStartPosition,
    seekDirection: seekState.seekDirection,
  });
}
```

### Root Cause

**The pattern is actually correct** - `getState()` returns the current snapshot synchronously after the action completes. The real issues are:

1. **State duplication** - `playerStore` maintains copies of state from other stores, creating two sources of truth

2. **Inconsistent consumers** - Some components read from `playerStore`, others from specialized stores

3. **Missing await on async cross-store calls** in some places

### Evidence of Correct Pattern

```typescript
// seekingStore getState() is synchronous
useSeekingStore.getState().startSeeking(position, direction);
// This line runs AFTER startSeeking completes (synchronous)
const seekState = useSeekingStore.getState();  // Gets updated state
```

### Proposed Fix

Rather than fix a non-issue, **document the pattern** and ensure consistency:

1. Components should read from **specialized stores** for their specific data
2. `playerStore` maintains copies only for **backward compatibility**
3. Add comment blocks explaining the pattern

### Files Affected
- `src/features/player/stores/playerStore.ts` (documentation)

---

## Summary of Fixes

| Issue | Severity | Fix Type | Est. Time |
|-------|----------|----------|-----------|
| 1: Chapter Blocked | **High** | Code fix | 30 min |
| 2: Chapter Break Pause | Medium | Code fix + logging | 20 min |
| 3: Silent Failures | **High** | Code fix + UI feedback | 45 min |
| 4: Slow Renders | Medium | Add useShallow | 15 min |
| 5: Race Conditions | Low | Documentation | 10 min |

---

## Test Plan

### Issue 1 & 2
1. Play a multi-file audiobook (multiple mp3s)
2. Let book play through chapter transition naturally
3. Seek to chapter boundaries and across chapters
4. Test on slow network (Network Link Conditioner)

### Issue 3
1. Start playback, then disable network
2. Let book buffer, then lose connection
3. Test audio focus interruption (phone call)
4. Test Bluetooth disconnect/reconnect

### Issue 4
1. Open React DevTools Profiler
2. Play book and observe render counts
3. Compare before/after adding useShallow

### Issue 5
1. Rapid chapter seeking while playing
2. Set sleep timer while seeking
3. Multiple operations in quick succession
