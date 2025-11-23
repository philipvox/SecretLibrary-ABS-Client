# Audio Player - Quick Reference

## Overview
Complete audio player with background support, progress sync, and beautiful UI.

## Quick Start

### Play a Book
```typescript
import { usePlayerStore } from '@/features/player';

const { loadBook } = usePlayerStore();

// In your component:
await loadBook(book); // Automatically starts playing
```

### Player Store API

```typescript
const {
  // State
  currentBook,      // LibraryItem | null
  isPlaying,        // boolean
  position,         // number (seconds)
  duration,         // number (seconds)
  playbackRate,     // number (0.5 - 2.0)
  isPlayerVisible,  // boolean (full player modal)
  
  // Actions
  loadBook,         // (book, startPosition?) => Promise<void>
  play,             // () => Promise<void>
  pause,            // () => Promise<void>
  seekTo,           // (position: number) => Promise<void>
  skipForward,      // (seconds?: number) => Promise<void>
  skipBackward,     // (seconds?: number) => Promise<void>
  setPlaybackRate,  // (rate: number) => Promise<void>
  jumpToChapter,    // (index: number) => Promise<void>
  togglePlayer,     // () => void
  closePlayer,      // () => void
  cleanup,          // () => Promise<void>
} = usePlayerStore();
```

## Components

### MiniPlayer
Shows at bottom of all screens when audio is playing.

```typescript
import { MiniPlayer } from '@/features/player';

// In AppNavigator:
<MiniPlayer />
```

**Features:**
- Book cover, title, author
- Play/pause button
- Progress bar (non-seekable)
- Current time
- Tap to open full player

### PlayerScreen
Full-screen modal with all controls.

```typescript
import { PlayerScreen } from '@/features/player';

// In AppNavigator:
<PlayerScreen />
```

**Features:**
- Large cover image
- Seekable progress bar
- Play/pause, skip controls
- Playback rate selector
- Chapter list
- Close button

## Progress Tracking

### Automatic Syncing
```typescript
import { progressService } from '@/features/player';

// Start auto-sync (done automatically by player)
progressService.startAutoSync();

// Stop auto-sync
progressService.stopAutoSync();
```

**Sync Schedule:**
- Local save: Every 30 seconds
- Server sync: Every 5 minutes
- Immediate sync: On pause/seek

### Manual Operations
```typescript
// Save progress
await progressService.saveProgress({
  itemId: 'book-id',
  currentTime: 120,
  duration: 3600,
  progress: 0.033,
  isFinished: false,
});

// Get local progress
const position = await progressService.getLocalProgress('book-id');

// Mark as finished
await progressService.markAsFinished('book-id', 3600);
```

## Audio Service

### Direct Audio Control
```typescript
import { audioService } from '@/features/player';

// Load audio
await audioService.loadAudio('https://server/audio.mp3', startPosition);

// Playback controls
await audioService.play();
await audioService.pause();
await audioService.stop();

// Seeking
await audioService.seekTo(120); // seconds
await audioService.skipForward(30);
await audioService.skipBackward(30);

// Playback rate
await audioService.setPlaybackRate(1.5); // 1.5x speed

// Status
const status = await audioService.getStatus();
// Returns: { isPlaying, isLoaded, position, duration, rate, isBuffering }

// Cleanup
await audioService.unloadAudio();
```

### Status Updates
```typescript
// Register callback for real-time updates
audioService.setStatusUpdateCallback((state) => {
  console.log('Position:', state.position);
  console.log('Is playing:', state.isPlaying);
});
```

## Usage Examples

### Example 1: Play from Book Detail
```typescript
import { usePlayerStore } from '@/features/player';

function BookDetailScreen() {
  const { loadBook } = usePlayerStore();
  
  const handlePlay = async () => {
    try {
      await loadBook(book);
      // Player opens automatically
    } catch (error) {
      Alert.alert('Error', 'Failed to start playback');
    }
  };
  
  return (
    <Button onPress={handlePlay}>Play</Button>
  );
}
```

### Example 2: Resume from Last Position
```typescript
// Player automatically resumes from last saved position
await loadBook(book); // Loads at saved position
```

### Example 3: Jump to Chapter
```typescript
const { jumpToChapter } = usePlayerStore();

// Jump to chapter 5
await jumpToChapter(4); // 0-indexed
```

### Example 4: Change Playback Speed
```typescript
const { setPlaybackRate } = usePlayerStore();

// 1.5x speed
await setPlaybackRate(1.5);

// Available rates: 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0
```

### Example 5: Check if Playing
```typescript
const { isPlaying, currentBook } = usePlayerStore();

if (isPlaying && currentBook) {
  console.log('Currently playing:', currentBook.media.metadata.title);
}
```

### Example 6: Cleanup on Logout
```typescript
const { cleanup } = usePlayerStore();

// Before logout
await cleanup(); // Saves progress and unloads audio
```

## Configuration

### Audio Settings
```typescript
// Background audio is enabled by default
// Configure in audioService.ts:

await Audio.setAudioModeAsync({
  staysActiveInBackground: true,
  playsInSilentModeIOS: true,
  shouldDuckAndroid: true,
});
```

### Sync Intervals
```typescript
// Configure in progressService.ts:

// Local save: every 30 seconds
// Server sync: every 5 minutes
```

## File Locations

```
src/features/player/
├── services/
│   ├── audioService.ts       # Expo AV integration
│   └── progressService.ts    # Progress tracking
├── stores/
│   └── playerStore.ts        # State management
├── components/
│   ├── MiniPlayer.tsx        # Bottom bar player
│   ├── PlaybackControls.tsx # Buttons
│   └── ProgressBar.tsx       # Seekable bar
├── screens/
│   └── PlayerScreen.tsx      # Full player modal
└── index.ts                  # Exports
```

## Integration Points

### With API Client
```typescript
// Audio URL
const audioUrl = `${apiClient.getBaseURL()}/api/items/${bookId}/play`;

// Progress sync
await apiClient.updateProgress(bookId, progressData);
```

### With Navigation
```typescript
// In AppNavigator.tsx
<MiniPlayer />       {/* Bottom overlay */}
<PlayerScreen />     {/* Modal */}
```

### With Book Detail
```typescript
// In BookActions.tsx
const { loadBook } = usePlayerStore();
await loadBook(book);
```

## Troubleshooting

### Audio not playing
1. Check server URL: `apiClient.getBaseURL()`
2. Verify book has audio files
3. Check network connectivity
4. Look for errors in console

### Progress not syncing
1. Check AsyncStorage permissions
2. Verify server is reachable
3. Check authentication token
4. Look for sync errors in console

### Player not showing
1. Check `isAuthenticated` is true
2. Verify book is loaded: `currentBook !== null`
3. Check MiniPlayer/PlayerScreen are mounted
4. Look for rendering errors

### Seeking issues
1. Ensure audio is loaded: `audioService.isLoaded()`
2. Check position is within bounds: `0 <= position <= duration`
3. Verify network isn't causing buffering
4. Test with different positions

## Best Practices

### 1. Always Handle Errors
```typescript
try {
  await loadBook(book);
} catch (error) {
  Alert.alert('Error', 'Failed to start playback');
}
```

### 2. Check Audio State
```typescript
if (currentBook && isPlaying) {
  // Audio is playing
}
```

### 3. Cleanup Properly
```typescript
// Before unmounting or logging out
await cleanup();
```

### 4. Use Playback Rate Wisely
```typescript
// Don't go below 0.5x or above 2.0x
const rate = Math.max(0.5, Math.min(2.0, userInput));
await setPlaybackRate(rate);
```

### 5. Save Progress on Critical Events
```typescript
// Player does this automatically on:
// - Pause
// - Seek
// - App background
// - Every 30 seconds while playing
```

## Performance Tips

### 1. Lazy Load Audio
- Audio loads only when Play button is pressed
- Not loaded during book browsing

### 2. Efficient Progress Sync
- Local saves are fast (AsyncStorage)
- Server syncs are batched (every 5 min)
- Reduces battery drain

### 3. Memory Management
- Audio unloads when player closes
- Cleanup on logout
- No memory leaks

### 4. Network Optimization
- Streams audio (no full download)
- Progress syncs are lightweight
- Works on slow connections

## Common Patterns

### Pattern 1: Play with Custom Start
```typescript
await loadBook(book, 120); // Start at 2 minutes
```

### Pattern 2: Skip Chapters
```typescript
// Next chapter
const currentChapterIndex = getCurrentChapterIndex();
await jumpToChapter(currentChapterIndex + 1);
```

### Pattern 3: Speed Reading
```typescript
// For faster listening
await setPlaybackRate(1.5);
```

### Pattern 4: Check Progress
```typescript
const { position, duration } = usePlayerStore();
const progress = position / duration;
console.log(`${Math.round(progress * 100)}% complete`);
```

## API Reference

See full documentation in:
- `audioService.ts` - Audio playback API
- `progressService.ts` - Progress tracking API
- `playerStore.ts` - State management API

---

**Quick Links:**
- [Full Implementation](./STAGE5_COMPLETE.md)
- [Current Work](./current-work.md)
- [Architecture](./architecture.md)
