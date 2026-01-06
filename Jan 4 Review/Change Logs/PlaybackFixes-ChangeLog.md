# Playback Issues Fixes - Change Log

**Date:** January 5, 2026
**Branch:** refactor/cdplayer-screen

## Summary

Fixed 4 playback issues related to audio system reliability and performance:
1. Chapter progression blocking due to inadequate timeout/retry logic
2. Silent playback failures without user feedback
3. Stream segment resume failures without retry
4. Slow renders from object-returning selectors

---

## Changes

### 1. audioService.ts - Track Transition Improvements

**File:** `src/features/player/services/audioService.ts`

#### waitForTrackReady() - Increased timeout, return boolean
```typescript
// BEFORE: 500ms timeout, void return
private async waitForTrackReady(maxWaitMs: number = 500): Promise<void>

// AFTER: 2000ms timeout, boolean return for retry logic
private async waitForTrackReady(maxWaitMs: number = 2000): Promise<boolean>
```

#### handleTrackEnd() fallback path - Added retry logic
```typescript
// BEFORE: Single load attempt with 500ms wait
this.player.replace({ uri: nextTrack.url });
this.player.play();
await this.waitForTrackReady(500);

// AFTER: Retry on timeout with logging
let trackReady = await this.waitForTrackReady(2000);
if (!trackReady) {
  log('[Audio] Track load timeout - retrying...');
  this.player.replace({ uri: nextTrack.url });
  this.player.play();
  trackReady = await this.waitForTrackReady(3000);
  if (!trackReady) {
    audioLog.error('[Audio] Track load failed after retry');
  }
}
```

#### play() - Added verification with error propagation
```typescript
// BEFORE: Fire and forget
async play(): Promise<void> {
  this.player?.play();
  this.updateMediaControlPlaybackState(true);
}

// AFTER: Verify playback started, throw on failure
async play(): Promise<void> {
  if (!this.player) throw new Error('Player not initialized');
  try {
    this.player.play();
    // Verify within 500ms
    while (Date.now() - startTime < 500) {
      if (this.player.playing || this.player.isBuffering) {
        await this.updateMediaControlPlaybackState(true);
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    audioLog.warn('Play: Playback not started after 500ms');
  } catch (error) {
    audioLog.error('Play failed:', error.message);
    throw error;
  }
}
```

#### Stream segment resume - Added retry with verification
```typescript
// BEFORE: Single play() call with setTimeout logging
this.player.play();
setTimeout(() => { /* log only */ }, 100);

// AFTER: Verify and retry with status callback on failure
this.player.play();
await new Promise(resolve => setTimeout(resolve, 200));
if (!this.player.playing && !this.player.isBuffering) {
  audioLog.warn('[Audio] Resume failed - retrying...');
  this.player.play();
  // Second verification with error callback
}
```

---

### 2. seekingStore.ts - Added useShallow for performance

**File:** `src/features/player/stores/seekingStore.ts`

```typescript
// Added import
import { useShallow } from 'zustand/react/shallow';

// BEFORE: Object selector causes re-render on every state change
export const useSeekingState = () =>
  useSeekingStore((s) => ({ ... }));

// AFTER: useShallow prevents unnecessary re-renders
export const useSeekingState = () =>
  useSeekingStore(
    useShallow((s) => ({ ... }))
  );
```

---

### 3. sleepTimerStore.ts - Added useShallow for performance

**File:** `src/features/player/stores/sleepTimerStore.ts`

```typescript
// Added import
import { useShallow } from 'zustand/react/shallow';

// Updated useSleepTimerState with useShallow wrapper
export const useSleepTimerState = () =>
  useSleepTimerStore(
    useShallow((s) => ({ ... }))
  );
```

---

### 4. completionStore.ts - Added useShallow for performance

**File:** `src/features/player/stores/completionStore.ts`

```typescript
// Added import
import { useShallow } from 'zustand/react/shallow';

// Updated useCompletionState with useShallow wrapper
export const useCompletionState = () =>
  useCompletionStore(
    useShallow((s) => ({ ... }))
  );
```

---

## Files Modified

| File | Changes |
|------|---------|
| `src/features/player/services/audioService.ts` | Retry logic, error handling, timeouts |
| `src/features/player/stores/seekingStore.ts` | useShallow import and wrapper |
| `src/features/player/stores/sleepTimerStore.ts` | useShallow import and wrapper |
| `src/features/player/stores/completionStore.ts` | useShallow import and wrapper |

---

## Test Plan

### Track Transition (Issue 1 & 2)
1. Play multi-file audiobook
2. Let chapters auto-advance
3. Test on slow/unstable network
4. Monitor logs for retry attempts

### Silent Failures (Issue 3)
1. Start playback, disconnect network
2. Observe error logging
3. Verify status callback with `isPlaying: false`

### Performance (Issue 4)
1. Profile with React DevTools
2. Compare render counts before/after
3. Check seeking/timer updates don't cause excess renders

---

## Related Documents

- Diagnosis: `Jan 4 Review/Bugs/PlaybackIssues-Diagnosis.md`
- TypeScript Audit: `Jan 4 Review/Change Logs/TypeScript-Error-Audit.md`
