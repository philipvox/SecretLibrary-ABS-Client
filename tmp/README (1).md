# Audio Player Feature

Complete audio playback system for AudiobookShelf mobile app.

## Features

- ✅ Play audiobooks with Expo AV
- ✅ Background audio support
- ✅ Play/pause/seek controls
- ✅ Skip forward/backward 30s
- ✅ Playback rate (0.5x - 2.0x)
- ✅ Chapter navigation
- ✅ Progress tracking & sync
- ✅ Auto-resume from last position
- ✅ MiniPlayer + Full Player UI
- ✅ Real-time updates

## Quick Start

```typescript
import { usePlayerStore } from '@/features/player';

function BookDetailScreen({ book }) {
  const { loadBook } = usePlayerStore();
  
  return (
    <Button onPress={() => loadBook(book)}>
      Play
    </Button>
  );
}
```

## Components

### MiniPlayer
Bottom bar showing current playback. Always visible when playing.

### PlayerScreen
Full-screen modal with all controls. Opens on tap of MiniPlayer.

## Services

### audioService
Handles Expo AV integration, playback controls, and status updates.

### progressService
Manages progress tracking, local caching, and server sync.

## State Management

### playerStore (Zustand)
Global player state accessible throughout the app.

## File Structure

```
src/features/player/
├── services/
│   ├── audioService.ts       # Expo AV integration
│   └── progressService.ts    # Progress tracking
├── stores/
│   └── playerStore.ts        # State management
├── components/
│   ├── MiniPlayer.tsx        # Bottom player
│   ├── PlaybackControls.tsx # Buttons
│   └── ProgressBar.tsx       # Seekable bar
├── screens/
│   └── PlayerScreen.tsx      # Full modal
└── index.ts                  # Exports
```

## Documentation

- [Complete Guide](../../../docs/STAGE5_COMPLETE.md)
- [API Reference](../../../docs/PLAYER_REFERENCE.md)
- [Quick Summary](../../../docs/STAGE5_SUMMARY.md)

## Dependencies

- `expo-av` - Audio playback
- `@react-native-async-storage/async-storage` - Local progress cache
- `zustand` - State management

## Integration

Add to `AppNavigator.tsx`:

```typescript
import { MiniPlayer, PlayerScreen } from '@/features/player';

<MiniPlayer />      {/* Bottom overlay */}
<PlayerScreen />    {/* Modal */}
```

## Usage Examples

### Basic Playback
```typescript
const { loadBook, play, pause } = usePlayerStore();

await loadBook(book);
await play();
await pause();
```

### Seeking
```typescript
const { seekTo, skipForward, skipBackward } = usePlayerStore();

await seekTo(120); // 2 minutes
await skipForward(30); // +30s
await skipBackward(30); // -30s
```

### Playback Rate
```typescript
const { setPlaybackRate } = usePlayerStore();

await setPlaybackRate(1.5); // 1.5x speed
```

### Chapters
```typescript
const { jumpToChapter } = usePlayerStore();

await jumpToChapter(4); // Jump to chapter 5 (0-indexed)
```

## Progress Tracking

- Auto-saves locally every 30 seconds
- Syncs to server every 5 minutes
- Immediate sync on pause/seek
- Resumes from last position

## Background Audio

Configured for background playback:
- Continues when app is in background
- Plays even when phone is on silent (iOS)
- Handles interruptions (phone calls)

## Error Handling

All async operations wrapped in try/catch:

```typescript
try {
  await loadBook(book);
} catch (error) {
  Alert.alert('Error', 'Failed to start playback');
}
```

## Testing

```bash
npm start
# Login → Browse → Tap book → Press Play
```

## Troubleshooting

**Audio not playing:**
- Check server URL
- Verify book has audio files
- Check network connection

**Progress not syncing:**
- Check AsyncStorage permissions
- Verify server is reachable
- Check authentication token

**Player not showing:**
- Verify `isAuthenticated` is true
- Check book is loaded
- Look for console errors

## Code Quality

- ✅ TypeScript throughout
- ✅ All files under 400 lines
- ✅ Comprehensive error handling
- ✅ Loading states
- ✅ Clean separation of concerns
- ✅ Well-commented code
- ✅ JSDoc documentation

## Performance

- Lazy loading (audio loads on play)
- Efficient sync (batched every 5 min)
- Memory managed (cleanup on close)
- Network optimized (streaming)

## Future Enhancements

- [ ] Sleep timer
- [ ] Lock screen controls
- [ ] Download for offline
- [ ] Chapter transitions (fade)
- [ ] Rewind to chapter start

---

**Version:** 1.0.0  
**Stage:** 5 of 6  
**Lines:** 1,380  
**Files:** 11  
**Status:** ✅ Complete
