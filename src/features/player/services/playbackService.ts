/**
 * src/features/player/services/playbackService.ts
 *
 * Playback service for react-native-track-player
 * Handles remote control events (lock screen, notification controls, etc.)
 */

import TrackPlayer, { Event } from 'react-native-track-player';

/**
 * PlaybackService handles background audio events.
 * This is registered in index.js and runs in a separate JS context.
 */
export async function PlaybackService(): Promise<void> {
  // Remote play button (lock screen, notification)
  TrackPlayer.addEventListener(Event.RemotePlay, () => {
    TrackPlayer.play();
  });

  // Remote pause button
  TrackPlayer.addEventListener(Event.RemotePause, () => {
    TrackPlayer.pause();
  });

  // Remote stop button
  TrackPlayer.addEventListener(Event.RemoteStop, () => {
    TrackPlayer.stop();
  });

  // Remote seek (scrubbing on lock screen)
  TrackPlayer.addEventListener(Event.RemoteSeek, (event) => {
    TrackPlayer.seekTo(event.position);
  });

  // Skip forward (usually 30 seconds)
  TrackPlayer.addEventListener(Event.RemoteJumpForward, async (event) => {
    const progress = await TrackPlayer.getProgress();
    const newPosition = progress.position + event.interval;
    TrackPlayer.seekTo(Math.min(newPosition, progress.duration));
  });

  // Skip backward (usually 30 seconds)
  TrackPlayer.addEventListener(Event.RemoteJumpBackward, async (event) => {
    const progress = await TrackPlayer.getProgress();
    const newPosition = progress.position - event.interval;
    TrackPlayer.seekTo(Math.max(newPosition, 0));
  });

  // Handle duck (lower volume when other audio plays)
  TrackPlayer.addEventListener(Event.RemoteDuck, (event) => {
    if (event.paused) {
      // Audio was paused by system (e.g., phone call)
      TrackPlayer.pause();
    } else if (event.permanent) {
      // Audio focus lost permanently
      TrackPlayer.pause();
    } else {
      // Temporary duck - track player handles volume automatically
    }
  });
}
