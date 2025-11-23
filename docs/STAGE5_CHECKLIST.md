# Stage 5 Installation & Testing Checklist

## Pre-Installation

- [ ] Stages 1-4 are complete and working
- [ ] Can login and browse library
- [ ] Can view book details
- [ ] Node.js and npm installed
- [ ] Project builds without errors

## Installation Steps

### 1. Install Dependencies ✅
```bash
cd /path/to/audiobookshelf-app
npm install @react-native-async-storage/async-storage
```
- [ ] Command runs without errors
- [ ] Package added to package.json
- [ ] node_modules updated

### 2. Copy Player Files ✅
Copy all files from Stage 5 implementation:

**Services (2 files):**
- [ ] src/features/player/services/audioService.ts (335 lines)
- [ ] src/features/player/services/progressService.ts (181 lines)

**Store (1 file):**
- [ ] src/features/player/stores/playerStore.ts (291 lines)

**Components (3 files):**
- [ ] src/features/player/components/MiniPlayer.tsx (168 lines)
- [ ] src/features/player/components/PlaybackControls.tsx (133 lines)
- [ ] src/features/player/components/ProgressBar.tsx (173 lines)

**Screen (1 file):**
- [ ] src/features/player/screens/PlayerScreen.tsx (382 lines)

**Index (1 file):**
- [ ] src/features/player/index.ts (9 lines)

**Updated Files (2 files):**
- [ ] src/features/book-detail/components/BookActions.tsx (134 lines)
- [ ] src/navigation/AppNavigator.tsx (78 lines)

### 3. Verify File Structure ✅
```
src/features/player/
├── services/
│   ├── audioService.ts
│   └── progressService.ts
├── stores/
│   └── playerStore.ts
├── components/
│   ├── MiniPlayer.tsx
│   ├── PlaybackControls.tsx
│   └── ProgressBar.tsx
├── screens/
│   └── PlayerScreen.tsx
└── index.ts
```
- [ ] All directories exist
- [ ] All files are present
- [ ] File sizes match

### 4. Build Project ✅
```bash
npm start
```
- [ ] TypeScript compiles
- [ ] No build errors
- [ ] Metro bundler starts
- [ ] App loads on device/simulator

## Feature Testing

### Basic Playback
- [ ] Can tap Play button on book detail
- [ ] Audio starts playing
- [ ] Can hear the audio
- [ ] MiniPlayer appears at bottom
- [ ] Book cover shows in MiniPlayer
- [ ] Title and author display correctly
- [ ] Play/pause button works in MiniPlayer

### Full Player
- [ ] Can tap MiniPlayer to open full player
- [ ] Full player modal opens
- [ ] Large cover image displays
- [ ] Title, author, narrator show
- [ ] Can close player with down arrow
- [ ] Returns to previous screen

### Playback Controls
- [ ] Play button starts playback
- [ ] Pause button pauses playback
- [ ] Skip forward (+30s) works
- [ ] Skip backward (-30s) works
- [ ] Current time updates every second
- [ ] Total duration shows correctly

### Progress Bar
- [ ] Progress bar updates in real-time
- [ ] Can drag thumb to seek
- [ ] Seeking updates position immediately
- [ ] Current time label updates
- [ ] Duration label shows correct time
- [ ] Progress bar in MiniPlayer updates

### Playback Rate
- [ ] Can tap rate button (shows "1.0x")
- [ ] Rate selector appears
- [ ] All 7 rates available (0.5x - 2.0x)
- [ ] Selecting rate changes speed
- [ ] Audio pitch stays correct
- [ ] Rate button updates with selection
- [ ] Rate persists during playback

### Chapter Navigation
- [ ] Chapter list displays
- [ ] All chapters show with numbers
- [ ] Chapter titles display
- [ ] Chapter durations show
- [ ] Can tap chapter to jump
- [ ] Playback jumps to chapter start
- [ ] Progress updates correctly
- [ ] Current chapter updates

### Progress Tracking
- [ ] Progress saves locally
- [ ] Can close app and reopen
- [ ] Resumes from last position
- [ ] Position saved on pause
- [ ] Position saved on seek
- [ ] Progress syncs to server (check after 5 min)
- [ ] Server shows correct progress

### Background Audio
- [ ] Audio continues when app backgrounded
- [ ] Audio continues when screen locks
- [ ] Can pause/resume from background
- [ ] Position updates in background
- [ ] Progress saves while in background

### Audio Interruptions
- [ ] Phone call pauses audio
- [ ] Audio resumes after call
- [ ] Notification sounds duck audio
- [ ] Other apps' audio handled correctly

### Navigation
- [ ] MiniPlayer shows on library screen
- [ ] MiniPlayer shows on detail screen
- [ ] Can navigate between screens while playing
- [ ] Player state persists
- [ ] Back button doesn't close player
- [ ] Player closes with close button only

### Error Handling
- [ ] Network error shows appropriate message
- [ ] Invalid book shows error
- [ ] Missing audio file handled gracefully
- [ ] Buffering indicator shows when needed
- [ ] Loading spinner shows during load
- [ ] Can retry on error

### Edge Cases
- [ ] Works with very short audiobooks (<1 min)
- [ ] Works with very long audiobooks (>10 hours)
- [ ] Works with books without chapters
- [ ] Works with books with many chapters (>100)
- [ ] Handles seeking beyond duration
- [ ] Handles seeking to negative position
- [ ] Handles rapid play/pause toggling
- [ ] Handles rapid seeking

## Performance Testing

### Startup
- [ ] Player loads quickly (<2 seconds)
- [ ] Audio loads without delay
- [ ] UI is responsive immediately
- [ ] No lag when opening player

### During Playback
- [ ] No stuttering or skipping
- [ ] Smooth seeking
- [ ] No frame drops in UI
- [ ] Position updates smoothly
- [ ] No memory leaks (check after 30 min)

### Battery Usage
- [ ] Battery drain is reasonable
- [ ] Background playback doesn't drain excessively
- [ ] Progress sync doesn't drain battery

### Memory
- [ ] Memory usage is stable
- [ ] No memory leaks after extended use
- [ ] Cleanup releases memory
- [ ] Multiple play sessions don't accumulate

## Code Quality Checks

### TypeScript
- [ ] No TypeScript errors
- [ ] All types are defined
- [ ] No `any` types used
- [ ] Proper interfaces for all data

### File Size
- [ ] audioService.ts: 335 lines ✅
- [ ] progressService.ts: 181 lines ✅
- [ ] playerStore.ts: 291 lines ✅
- [ ] MiniPlayer.tsx: 168 lines ✅
- [ ] PlaybackControls.tsx: 133 lines ✅
- [ ] ProgressBar.tsx: 173 lines ✅
- [ ] PlayerScreen.tsx: 382 lines ✅
- [ ] All files under 400 lines ✅

### Code Style
- [ ] Consistent formatting
- [ ] JSDoc comments present
- [ ] Clear variable names
- [ ] Proper error handling
- [ ] No console.errors in production

## Documentation

- [ ] STAGE5_COMPLETE.md created
- [ ] PLAYER_REFERENCE.md created
- [ ] STAGE5_SUMMARY.md created
- [ ] player/README.md created
- [ ] current-work.md updated
- [ ] All docs are accurate

## Final Checks

### Functionality
- [ ] All features work as expected
- [ ] No critical bugs
- [ ] UI is polished
- [ ] UX is smooth

### Code
- [ ] All files created
- [ ] No missing dependencies
- [ ] TypeScript compiles
- [ ] No console errors

### Documentation
- [ ] Installation guide complete
- [ ] API reference complete
- [ ] Examples provided
- [ ] Troubleshooting guide included

### Next Steps
- [ ] Stage 5 marked complete in docs
- [ ] Ready to proceed to Stage 6
- [ ] Known limitations documented
- [ ] Future enhancements listed

## Sign-Off

Stage 5 is complete when:
- ✅ All installation steps completed
- ✅ All feature tests pass
- ✅ Performance is acceptable
- ✅ Code quality meets standards
- ✅ Documentation is complete

**Completed by:** _____________  
**Date:** _____________  
**Status:** ✅ Ready for Stage 6

---

## Troubleshooting Common Issues

### Issue: Audio not playing
**Check:**
1. Server URL is correct
2. Book has audio files
3. Network connectivity
4. Console for errors

**Fix:**
- Verify apiClient.getBaseURL()
- Test audio URL in browser
- Check firewall/network

### Issue: MiniPlayer not showing
**Check:**
1. isAuthenticated is true
2. Book is loaded in store
3. currentBook is not null
4. Component is mounted

**Fix:**
- Check auth state
- Verify loadBook was called
- Check AppNavigator includes MiniPlayer

### Issue: Progress not syncing
**Check:**
1. AsyncStorage permissions
2. Server reachability
3. Authentication token
4. Network connectivity

**Fix:**
- Check storage permissions
- Test API endpoint
- Verify token validity
- Check console for sync errors

### Issue: Seeking not working
**Check:**
1. Audio is loaded
2. Position is valid
3. Not buffering
4. No network issues

**Fix:**
- Wait for audio to load
- Check position bounds
- Improve network connection
- Check console for errors

---

**Document Version:** 1.0  
**Last Updated:** November 23, 2025  
**Stage:** 5 of 6
