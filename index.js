/**
 * index.js
 * 
 * Entry point for the app
 * Registers the playback service for background audio
 */

import { registerRootComponent } from 'expo';
import TrackPlayer from 'react-native-track-player';

import App from './App';
import { PlaybackService } from './src/features/player/services/playbackService';

// Register the playback service for background audio
TrackPlayer.registerPlaybackService(() => PlaybackService);

// Register the main app component
registerRootComponent(App);