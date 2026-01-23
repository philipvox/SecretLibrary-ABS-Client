/**
 * src/shared/components/Loading.tsx
 *
 * Unified loading indicator system - single source of truth
 * for all loading states across the app.
 *
 * Usage:
 *   import { Loading } from '@/shared/components';
 *
 *   // Full screen loading (default)
 *   <Loading />
 *
 *   // Inline loading (no flex, no background)
 *   <Loading mode="inline" />
 *
 *   // Small button-sized loading
 *   <Loading mode="button" />
 *
 *   // With custom text
 *   <Loading text="Loading books..." />
 *
 *   // With custom size
 *   <Loading size={60} />
 *
 * Configuration:
 *   All loading behavior can be changed here in one place.
 *   The animated skull candle is the default indicator.
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import Svg, { Path, G } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  useDerivedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { spacing, scale, useTheme } from '../theme';

// Create animated SVG Path component for UI thread animations
const AnimatedPath = Animated.createAnimatedComponent(Path);

// =============================================================================
// CONFIGURATION - Change loading behavior app-wide here
// =============================================================================

/** Use animated skull (true) or candle animation (false) for fullScreen mode */
const USE_SKULL_ANIMATION = false;

/** Default sizes for each mode */
const DEFAULT_SIZES = {
  fullScreen: 80,
  inline: 60,
  button: 24,
  candle: 80,
};

// =============================================================================
// SKULL ANIMATION DATA
// =============================================================================

const SKULL_PATHS = [
  'M155.1,153.6c-.5-4.6-1.6-9-3-13.3-.7-2.4-1.4-5-2.6-7.3-2.3-4.7-6.2-7.8-9.5-12-2.4-3.1-4.4-6.5-6.5-10,0-.2-.2-.4-.4-.6-1.8-3.7-4.3-7.6-7.4-10.7,0,0-.4-.4-.5-.5-.5-.4-.8-.7-1.2-1,0,.5-.5,1.1-.8,1.4-.5.5-1.3,1.1-2.6,1.1-2.5,0-4.8-1-7.1-1.8-4.8-1.8-7.4-2.5-10,1.4-.8,1.4-1.4,2.8-2.2,4.1-2.3,4.8-4.4,9.4-13.7,7-3.1-.8-5.8-2.5-8.3-4.2-.6-.5-1.3-.8-1.9-1.3-2.3-1.4-8.4-2.2-11.2-1.7-1.6.2-3.1,1.3-4.8,2.4-1.8,1.3-3.7,2.5-6.1,3-1.9.4-4,.4-5.9.4s-3.7,0-5.4.4c-7.2,1.7-10.3,7.2-13.6,13-2.9,5.2-6,10.6-12,13.6-1.7.8-3.1,1.2-4.3,1.2s-2.2-.4-2.9-1.1c-.7-.6-1.1-1.4-1.4-2.3-4.2,13-4,20,1.8,34.4,11.6,29,36.5,49.8,40.9,51.8,4.8,2.2,28-6,33.1-5.5,4.3.5,7.2,5.2,8.9,8.6s3,10.6,4.7,10.9c1.1,0,2.3-.2,3.5-.6.5,0,1.1-.4,1.6-.4,1.7-.5,2.9-.8,3.5-1.1-.4-1-.8-2.3-1.2-3.2-1.3-3.5-2.3-6.7-2.4-10.6,3.6-1.6,4.9,7.1,5.8,9.2.5,1.3,1,2.8,1.3,3.7,1.4-.4,3.7-1.2,6-1.9,2.3-.7,4.6-1.6,6-2-.6-1.7-1-3.4-1.7-4.9-.6-1.3-1.3-2.2-1.6-3.7,0-1-.7-6.8,1.7-5.4,1.4,1,2,3.1,2.5,4.7.5,1.7,1.2,3.2,1.7,4.9.4,1.1,1,2.6,1.3,3.5.5,0,1.2-.4,2-.5,2.2-.6,6.6-1.7,8.5-2.3,0-.7-.5-1.8-1-3.2-.7-2.2-1.2-4.3-1.6-6.6,0-.8,0-1.7.7-2.4.8-.7,4,7.2,4.3,7.8.6,1.3,1,2.9,2.4,3.1,1.9.4,3.8-1.2,5.4-1.9,1.7-.8,3.5-1.4,4.1-3.4.8-2.9-.7-5.9-2.5-8-1.9-2.4-3.5-5.2-4.6-8-1.3-3.5-4.3-18.1-4.2-19.2.7-4.6,3.5-8,7.9-10,3.5-1.6,5.4-4.7,5.6-8.6,0-1.9,0-3.8.2-5.6.4-1.7.6-3,.4-4.8h.3ZM104.3,168h0c-.5,16-18.6,28.2-32.4,13.7-8.3-8.3-9.5-24.5,1.2-31.2,13-8.4,30,2.5,31.3,17.3v.2ZM120.4,187.2c-7.1-19.9-.6-22.3,6.1-1.4,1.2,3.7-4.9,5.3-6.1,1.4ZM145.5,166.2v.2c-8,10.7-22.1,1.9-25-11.4-3.6-14,6.6-29.3,19.6-20.5,10.2,5.9,12.4,22.8,5.4,31.7Z',
  'M17,133.9c5-2.6,7.7-7.2,10.6-12.1,3.5-6.2,7.2-12.6,15.8-14.8,2.2-.5,4.2-.5,6.2-.5s3.5,0,5-.2c1.7-.4,3.1-1.4,4.8-2.5,1.9-1.3,3.8-2.6,6.1-3,3.2-.6,10.4,0,13.8,2.2.7.5,1.3.8,2,1.3,2.4,1.6,4.6,3.1,7.1,3.7,6.4,1.7,7.3-.2,9.6-5,.6-1.3,1.3-2.9,2.3-4.4,4.1-6.7,9.7-4.7,14.2-3,1.9.7,4.1,1.4,5.9,1.6v-1.7c-.4-4.6-7.8-7.7-13.8-10.2-4.2-1.8-7.4-3.2-8.8-5.2-1.2-1.8-1.4-4.4-1.8-7.3-.6-5.5-1.2-7.4-3.5-7.4h0c-1.8,0-4.2,1.1-6.6,2-1.7.7-3.4,1.3-4.8,1.7-5.3,1.3-11,2.5-16.6,3-2,0-4.6-.5-7.1-1.2-1.8-.5-4.9-1.3-5.6-1-1.6,1-1.4,2.8-1,6.4.5,3.5,1.1,7.9-2.9,10.2-11.9,6.8-22.8,18.1-29.4,30.1-1.6,2.9-2.9,5.8-4,8.6-1.7,4.4-1.7,8.4-.8,9.2.4.2,1.3.2,3.2-.7h0v.2h.1Z',
];

const CANDLE_FRAMES = [
  'M83,44.4c.5,4.3-1.6,8.3-3.9,12.8-1.3,2-2,4.7-4.4,5.5-1.7.3-3.6-1.3-5.4-2.8-3-3-6.3-6.1-6.8-10.5-.3-4.6.5-9.8,2.7-14,1.3-2.5,2.4-5.2,4.1-7.4.9-1.1,3.3-4.7,4.9-3,.9,1.3-.5,4.3,0,5.7,1.3,3.1,4.1,5.2,6.1,8,1.4,2,2.2,3.9,2.4,5.8h.3Z',
  'M62.6,44.4c-.5,5,2.5,21.1,10.2,17.9,5.7-3.3,8.7-11.2,6.3-17.5-3-6.8-8.7-14.2-5.4-21.7.3-1.1,1.1-4.4.6-5-.9.9-1.6,2.8-2.7,3.9-4.9,6.3-9,14-9.1,22v.3h0Z',
  'M78.9,47.5c-.2,2.5-.2,5.7-1.7,8.7,0,0,0,.3-.2.5-3.1,6.9-7.4,7.7-12.1,3.5-.2-.2-.5-.5-.6-.6-7.4-11,9.9-18.9,5-31.5v-.8c-.3-1.6-.5-3.1-.3-4.7.5-4.9,6.6-12.8,12.3-11.8.2.3-.9.9-1.3,1.1-5.8,3.5-11.8,9.9-7.7,16.7,0,.3.3.5.5.8,2.8,5,6,11.3,6.3,17.9v.3h-.2Z',
  'M72.7,20c.2,2.4,0,5,.6,7.4.8,2.8,3,4.9,3.9,7.6,2.2,7.4,2.7,17-1.1,23.5-1.9,3.3-7.1,6.1-10.1,2.7-2-3.1-3.5-7.2-3.5-11,0-6.1,4.4-10.9,5.5-16.7.8-4.6,2.4-9.6,4.6-13.4h0Z M81.6,10.2c1-.9,2.2-1.6,3.4-2s3.1-.4,3.7.6c-1.7,1.1-3,1.3-5,1.6-1.9.3-3.1,2-4.9,2.4l2.7-2.5h.1Z',
  'M74.7,60.3c-4.8,3.8-9.9,3.1-11.7-2,0-.3-.2-.6-.3-.9-1.1-6.1,1.8-11.4,4.3-16.9,0-.3.3-.6.4-.9,3-5.2,0-9.9,3-14.6,1.6,6.3,9.4,11,8,18.3v.9c-.3,3.9.3,13-3.6,16.1h-.1Z',
  'M80.2,56.5c-.9,2-3.1,3.9-5.7,4.9-.3,0-.5.2-.8.3-3.8,2.2-6.9.6-8.5-.9-3.5-5.4-3.1-10.7-1.6-15.9,0-.3.2-.6.3-.9,1.3-2.2,2.2-4.3,2.8-6.5,0-.3,0-.5.2-.8,2-5.7-2.7-8.8-2.7-15.1,6.3,3.1,9.4,11,12.4,15.9,0,.3.3.5.5.8.3.5.6.9,1.1,1.4,0,.3.3.5.3.8,1.4,3,2.7,6.1,2.7,9.6v.9c0,1.7-.3,3.6-1.1,5.4v.3h0v-.2h.1Z',
  'M83.1,44.4c.5,4.3-1.6,8.3-3.9,12.8-1.3,2-2,4.7-4.4,5.5-1.7.3-3.6-1.3-5.4-2.8-2.8-2.8-6-5.8-6.8-10.1-.9-5.4,3.5-9.4,5.4-14,.8-1.9,1.9-5,3.6-6.1,2.5-1.7,3.1,2.4,4.6,4.1s3,3.1,4.4,4.9c1.4,2,2.2,3.9,2.4,5.8h.2,0Z',
  'M83.3,44.4c.5,4.3-1.6,8.3-3.9,12.8-1.3,2-2,4.7-4.4,5.5-1.7.3-3.6-1.3-5.4-2.8-2.5-2.5-5.4-5.2-6.4-8.7s-.9-7.7-.2-11.6c.6-3.8,1.6-7.5,1.8-11.4s-.2-7.9-2.4-11.1c4.7,2.2,8.6,6,11.7,10.2s3.7,5.7,5.4,8.7,1.6,3,2.4,4.6,1.4,3.8,1.2,3.8h.3Z',
  'M62.5,44.4c0,.2,0,.4,0,.7,0,1.9.2,3.8.5,5.7.7,3.7,1.9,9,5.4,11.2s2.9.9,4.4.3c4.9-2.1,7.5-9.7,6.4-14.5s-2.5-5.7-4.2-8.3c-3.3-4.9-6.8-9.9-11.6-13.3,1.1,2.8,1.2,5.9.9,8.8-.3,2.1-.7,4.1-1.3,6.1s-.4,2.2-.4,3.3Z',
  'M79.2,47.5c.2,3-.3,6-1.7,8.7,0,0,0,.3-.2.5-3.1,6.9-7.4,7.7-12.1,3.5-.2-.2-.5-.5-.6-.6-2.7-2.7-2-7.6-.7-10.7s2.1-2.8,3.1-4.3,1.7-3.5,2.1-5.5c.5-3.3,0-6.7-1.7-9.6-1.5-2.6-3.7-4.8-4.5-7.7-.7-2.6-.1-5.3.5-7.9.3,5.4,1.7,10.9,5.1,15.2,1.8,2.2,4.1,4,6,6.2,2.8,3.3,4.6,7.7,4.9,12.2Z',
  'M63.7,24.7c2.7,5,7.8,8.3,11.1,13,3.6,5.1,4.6,11.8,3,17.8-.7,2.7-2.2,4.3-4.5,5.9s-5.4,2-7.3-.2c-1.6-2.5-2.8-5.3-3.3-8.2s.2-5.8.7-8.9c1-6.7,1-13.5,0-20.2.1.3.3.5.4.8Z',
  'M74.8,60.3c-1.2,1.3-2.7,2.2-4.5,2.4s-3,.2-4.4-.7-2.7-2.3-2.7-3.6c0-.3-.2-.6-.3-.9-.6-3.1-.8-6,.4-9.1.8-2,1.8-3.8,2.6-5.8,1.7-4.7,1.4-9.9,1.1-14.9.9,4.3,4.6,7.4,7.1,11.1,1.5,2.3,2.6,5,3.2,7.7.7,3.1,1,6.4,0,9.4s-1.3,3.1-2.5,4.3Z',
  'M80.2,56.5c-.9,2-3.1,3.9-5.7,4.9-.3,0-.5.2-.8.3-3.8,2.2-6.9.6-8.5-.9-3.2-3-3.2-10.2-2-14.1s3.4-10.1,6.3-14.4c2.8-4.3,7.1-8,12.1-9.1-3.6,1.4-5.6,5.5-5.5,9.3.1,3.7,2.1,6.2,3.5,9.5s1.6,5.6,1.6,8.1v.9c0,1.7-.3,3.6-1.1,5.4v.3-.2h.1Z',
  'M83.1,44.4c.5,4.3-1.6,8.3-3.9,12.8-1.3,2-2,4.7-4.4,5.5-1.7.3-3.6-1.3-5.4-2.8-2.8-2.8-6-5.8-6.8-10.1-.9-4.7,2.5-8.5,4.6-12.2s3.9-8.9,4.6-13.6c.3-1.9.7-4.1,2.5-4.8-.6.2.4,6,.6,6.6.4,2.3,1.1,4.6,2,6.7,1.7,4.1,5.7,7.6,6.2,12h.2,0Z',
];

const VIEWBOX_WIDTH = 162;
const VIEWBOX_HEIGHT = 236.5;
const ASPECT_RATIO = VIEWBOX_WIDTH / VIEWBOX_HEIGHT;
const FRAME_DURATION_MS = 1000 / 12; // 12fps

// =============================================================================
// CANDLE ANIMATION DATA (24fps with interpolated frames)
// =============================================================================

const CANDLE_HOLDER_PATH =
  'M69.94,87.22c-4.31-4.3-10.62-6.77-17.32-8.01-.12-7.79-.18-15.58-.22-23.37-.01-2.04.07-4.11-.05-6.15l-.2-3.52c-.04-1.19-.17-2.32-.14-3.56.08-1.06.21-2.06-.27-2.67-2.23,1.17-4.55,2.19-6.96,2.93-7.52,2.43-15.85,2.3-23.38.26-.38-.14-.83.15-.8.59.15,6.46.04,12.94.04,19.4-.01,5.93-.01,11.86-.04,17.8C7.84,84.75-.66,92.07.04,99.87c2.01,22.17,44.75,17.95,59.82,11.98,15.87-6.29,14.49-20.23,10.08-24.63ZM59.77,108.7c-13.49,5.29-54.29,10.05-56.1-9.17-.61-6.45,6.31-12.52,16.92-15.95,0,1.49,0,2.98-.01,4.47-.01,4.12-.7,8.41.63,12.41,2.25,6.8,16.8,5.16,22.11,3.93,2.54-.59,5.07-1.48,7.06-3.15.27-.23.52-.46.74-.69,1.88-1.93,2.25-4.03,1.93-6.7-.46-3.91-.32-7.95-.39-11.88v-.05c5.43,1.16,10.47,3.23,14.01,6.63,2.25,2.16,3.23,4.42,3.26,6.63.08,5.31-1.85,10.26-10.16,13.52Z';

// 28 frames at 24fps (interpolated from 14 keyframes)
const CANDLE_FLAME_FRAMES = [
  'M83,44.4c.5,4.3-1.6,8.3-3.9,12.8-1.3,2-2,4.7-4.4,5.5-1.7.3-3.6-1.3-5.4-2.8-3-3-6.3-6.1-6.8-10.5-.3-4.6.5-9.8,2.7-14,1.3-2.5,2.4-5.2,4.1-7.4.9-1.1,3.3-4.7,4.9-3,.9,1.3-.5,4.3,0,5.7,1.3,3.1,4.1,5.2,6.1,8,1.4,2,2.2,3.9,2.4,5.8h.3Z',
  'M62.6,44.4c-.5,5,2.5,21.1,10.2,17.9,5.7-3.3,8.7-11.2,6.3-17.5-3-6.8-8.7-14.2-5.4-21.7.3-1.1,1.1-4.4.6-5-.9.9-1.6,2.8-2.7,3.9-4.9,6.3-9,14-9.1,22v.3h0Z',
  'M78.9,47.5c-.2,2.5-.2,5.7-1.7,8.7,0,0,0,.3-.2.5-3.1,6.9-7.4,7.7-12.1,3.5-.2-.2-.5-.5-.6-.6-7.4-11,9.9-18.9,5-31.5v-.8c-.3-1.6-.5-3.1-.3-4.7.5-4.9,6.6-12.8,12.3-11.8.2.3-.9.9-1.3,1.1-5.8,3.5-11.8,9.9-7.7,16.7,0,.3.3.5.5.8,2.8,5,6,11.3,6.3,17.9v.3h-.2Z',
  'M72.7,20c.2,2.4,0,5,.6,7.4.8,2.8,3,4.9,3.9,7.6,2.2,7.4,2.7,17-1.1,23.5-1.9,3.3-7.1,6.1-10.1,2.7-2-3.1-3.5-7.2-3.5-11,0-6.1,4.4-10.9,5.5-16.7.8-4.6,2.4-9.6,4.6-13.4h0Z',
  'M74.7,60.3c-4.8,3.8-9.9,3.1-11.7-2,0-.3-.2-.6-.3-.9-1.1-6.1,1.8-11.4,4.3-16.9,0-.3.3-.6.4-.9,3-5.2,0-9.9,3-14.6,1.6,6.3,9.4,11,8,18.3v.9c-.3,3.9.3,13-3.6,16.1h-.1Z',
  'M80.2,56.5c-.9,2-3.1,3.9-5.7,4.9-.3,0-.5.2-.8.3-3.8,2.2-6.9.6-8.5-.9-3.5-5.4-3.1-10.7-1.6-15.9,0-.3.2-.6.3-.9,1.3-2.2,2.2-4.3,2.8-6.5,0-.3,0-.5.2-.8,2-5.7-2.7-8.8-2.7-15.1,6.3,3.1,9.4,11,12.4,15.9,0,.3.3.5.5.8.3.5.6.9,1.1,1.4,0,.3.3.5.3.8,1.4,3,2.7,6.1,2.7,9.6v.9c0,1.7-.3,3.6-1.1,5.4v.3h0v-.2h.1Z',
  'M83.1,44.4c.5,4.3-1.6,8.3-3.9,12.8-1.3,2-2,4.7-4.4,5.5-1.7.3-3.6-1.3-5.4-2.8-2.8-2.8-6-5.8-6.8-10.1-.9-5.4,3.5-9.4,5.4-14,.8-1.9,1.9-5,3.6-6.1,2.5-1.7,3.1,2.4,4.6,4.1s3,3.1,4.4,4.9c1.4,2,2.2,3.9,2.4,5.8h.2,0Z',
  'M83.3,44.4c.5,4.3-1.6,8.3-3.9,12.8-1.3,2-2,4.7-4.4,5.5-1.7.3-3.6-1.3-5.4-2.8-2.5-2.5-5.4-5.2-6.4-8.7s-.9-7.7-.2-11.6c.6-3.8,1.6-7.5,1.8-11.4s-.2-7.9-2.4-11.1c4.7,2.2,8.6,6,11.7,10.2s3.7,5.7,5.4,8.7,1.6,3,2.4,4.6,1.4,3.8,1.2,3.8h.3Z',
  'M62.5,44.4c0,.2,0,.4,0,.7,0,1.9.2,3.8.5,5.7.7,3.7,1.9,9,5.4,11.2s2.9.9,4.4.3c4.9-2.1,7.5-9.7,6.4-14.5s-2.5-5.7-4.2-8.3c-3.3-4.9-6.8-9.9-11.6-13.3,1.1,2.8,1.2,5.9.9,8.8-.3,2.1-.7,4.1-1.3,6.1s-.4,2.2-.4,3.3Z',
  'M79.2,47.5c.2,3-.3,6-1.7,8.7,0,0,0,.3-.2.5-3.1,6.9-7.4,7.7-12.1,3.5-.2-.2-.5-.5-.6-.6-2.7-2.7-2-7.6-.7-10.7s2.1-2.8,3.1-4.3,1.7-3.5,2.1-5.5c.5-3.3,0-6.7-1.7-9.6-1.5-2.6-3.7-4.8-4.5-7.7-.7-2.6-.1-5.3.5-7.9.3,5.4,1.7,10.9,5.1,15.2,1.8,2.2,4.1,4,6,6.2,2.8,3.3,4.6,7.7,4.9,12.2Z',
  'M63.7,24.7c2.7,5,7.8,8.3,11.1,13,3.6,5.1,4.6,11.8,3,17.8-.7,2.7-2.2,4.3-4.5,5.9s-5.4,2-7.3-.2c-1.6-2.5-2.8-5.3-3.3-8.2s.2-5.8.7-8.9c1-6.7,1-13.5,0-20.2.1.3.3.5.4.8Z',
  'M74.8,60.3c-1.2,1.3-2.7,2.2-4.5,2.4s-3,.2-4.4-.7-2.7-2.3-2.7-3.6c0-.3-.2-.6-.3-.9-.6-3.1-.8-6,.4-9.1.8-2,1.8-3.8,2.6-5.8,1.7-4.7,1.4-9.9,1.1-14.9.9,4.3,4.6,7.4,7.1,11.1,1.5,2.3,2.6,5,3.2,7.7.7,3.1,1,6.4,0,9.4s-1.3,3.1-2.5,4.3Z',
  'M80.2,56.5c-.9,2-3.1,3.9-5.7,4.9-.3,0-.5.2-.8.3-3.8,2.2-6.9.6-8.5-.9-3.2-3-3.2-10.2-2-14.1s3.4-10.1,6.3-14.4c2.8-4.3,7.1-8,12.1-9.1-3.6,1.4-5.6,5.5-5.5,9.3.1,3.7,2.1,6.2,3.5,9.5s1.6,5.6,1.6,8.1v.9c0,1.7-.3,3.6-1.1,5.4v.3-.2h.1Z',
  'M83.1,44.4c.5,4.3-1.6,8.3-3.9,12.8-1.3,2-2,4.7-4.4,5.5-1.7.3-3.6-1.3-5.4-2.8-2.8-2.8-6-5.8-6.8-10.1-.9-4.7,2.5-8.5,4.6-12.2s3.9-8.9,4.6-13.6c.3-1.9.7-4.1,2.5-4.8-.6.2.4,6,.6,6.6.4,2.3,1.1,4.6,2,6.7,1.7,4.1,5.7,7.6,6.2,12h.2,0Z',
];

const CANDLE_VIEWBOX_WIDTH = 72.87;
const CANDLE_VIEWBOX_HEIGHT = 116.62;
const CANDLE_ASPECT_RATIO = CANDLE_VIEWBOX_WIDTH / CANDLE_VIEWBOX_HEIGHT;
const CANDLE_FRAME_DURATION_MS = 1000 / 24; // 24fps
const FLAME_COLOR = '#f1574d'; // Red flame

// =============================================================================
// TYPES
// =============================================================================

export type LoadingMode = 'fullScreen' | 'inline' | 'button' | 'candle';

export interface LoadingProps {
  /** Display mode - affects sizing and layout */
  mode?: LoadingMode;
  /** Optional text to display below the loading indicator */
  text?: string;
  /** Custom size override (height in scaled pixels) */
  size?: number;
  /** Custom color override (defaults to theme-aware color) */
  color?: string;
}

// =============================================================================
// SKULL ANIMATION COMPONENT (Internal) - Uses Reanimated for UI thread animation
// =============================================================================

interface SkullAnimationProps {
  size: number;
  color: string;
}

function SkullAnimation({ size, color }: SkullAnimationProps) {
  // Animated value that cycles through frames on UI thread
  const progress = useSharedValue(0);
  const totalFrames = CANDLE_FRAMES.length;

  useEffect(() => {
    // Total animation duration for all frames
    const totalDuration = FRAME_DURATION_MS * totalFrames;

    // Start infinite repeating animation on UI thread
    progress.value = withRepeat(
      withTiming(totalFrames, {
        duration: totalDuration,
        easing: Easing.linear,
      }),
      -1, // Infinite repeat
      false // Don't reverse
    );
  }, []);

  // Derive current frame index from progress (runs on UI thread)
  const frameIndex = useDerivedValue(() => {
    return Math.floor(progress.value) % totalFrames;
  });

  // Animated props for the flame path (runs on UI thread)
  const animatedFlameProps = useAnimatedProps(() => {
    const idx = frameIndex.value;
    return {
      d: CANDLE_FRAMES[idx] || CANDLE_FRAMES[0],
    };
  });

  const scaledHeight = scale(size);
  const scaledWidth = scaledHeight * ASPECT_RATIO;

  return (
    <Svg
      width={scaledWidth}
      height={scaledHeight}
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
    >
      <G>
        {SKULL_PATHS.map((d, i) => (
          <Path key={`skull-${i}`} d={d} fill={color} />
        ))}
      </G>
      <AnimatedPath animatedProps={animatedFlameProps} fill={color} />
    </Svg>
  );
}

// =============================================================================
// CANDLE ANIMATION COMPONENT (Internal) - Uses Reanimated for UI thread animation
// =============================================================================

interface CandleAnimationProps {
  size: number;
  holderColor: string;
}

function CandleAnimation({ size, holderColor }: CandleAnimationProps) {
  // Animated value that cycles through frames on UI thread
  const progress = useSharedValue(0);
  const totalFrames = CANDLE_FLAME_FRAMES.length;

  useEffect(() => {
    // Total animation duration for all frames
    const totalDuration = CANDLE_FRAME_DURATION_MS * totalFrames;

    // Start infinite repeating animation on UI thread
    progress.value = withRepeat(
      withTiming(totalFrames, {
        duration: totalDuration,
        easing: Easing.linear,
      }),
      -1, // Infinite repeat
      false // Don't reverse
    );
  }, []);

  // Derive current frame index from progress (runs on UI thread)
  const frameIndex = useDerivedValue(() => {
    return Math.floor(progress.value) % totalFrames;
  });

  // Animated props for the flame path (runs on UI thread)
  const animatedFlameProps = useAnimatedProps(() => {
    const idx = frameIndex.value;
    return {
      d: CANDLE_FLAME_FRAMES[idx] || CANDLE_FLAME_FRAMES[0],
    };
  });

  const scaledHeight = scale(size);
  const scaledWidth = scaledHeight * CANDLE_ASPECT_RATIO;

  return (
    <Svg
      width={scaledWidth}
      height={scaledHeight}
      viewBox={`0 0 ${CANDLE_VIEWBOX_WIDTH} ${CANDLE_VIEWBOX_HEIGHT}`}
    >
      {/* Flame - scaled and positioned */}
      <G transform="translate(36, 38) scale(0.825) translate(-72, -62)">
        <AnimatedPath animatedProps={animatedFlameProps} fill={FLAME_COLOR} />
      </G>
      {/* Candle holder */}
      <Path d={CANDLE_HOLDER_PATH} fill={holderColor} />
    </Svg>
  );
}

// =============================================================================
// MAIN LOADING COMPONENT
// =============================================================================

/**
 * Unified loading indicator component.
 * Single source of truth for all loading states in the app.
 *
 * @example
 * // Full screen loading
 * <Loading />
 *
 * // Inline loading
 * <Loading mode="inline" />
 *
 * // Button-sized loading
 * <Loading mode="button" />
 *
 * // Candle with flickering flame
 * <Loading mode="candle" />
 *
 * // With text
 * <Loading text="Loading..." />
 */
export function Loading({
  mode = 'fullScreen',
  text,
  size,
  color,
}: LoadingProps) {
  const { colors } = useTheme();

  // Determine color - use provided or theme-aware default
  const indicatorColor = color || colors.text.primary;

  // Determine size - use provided or mode default
  const indicatorSize = size ?? DEFAULT_SIZES[mode];

  // Determine which animation to use
  // Candle is used for fullScreen and candle modes, skull only if USE_SKULL_ANIMATION is true
  const useCandle = mode === 'candle' || (mode === 'fullScreen' && !USE_SKULL_ANIMATION);
  const useSkull = USE_SKULL_ANIMATION && mode !== 'button' && mode !== 'candle';

  // Container styles based on mode
  const containerStyle = [
    styles.container,
    (mode === 'fullScreen' || mode === 'candle') && styles.fullScreen,
    (mode === 'fullScreen' || mode === 'candle') && { backgroundColor: colors.background.primary },
  ];

  // Render the appropriate animation
  const renderIndicator = () => {
    if (useCandle) {
      return <CandleAnimation size={indicatorSize} holderColor={indicatorColor} />;
    }
    if (useSkull) {
      return <SkullAnimation size={indicatorSize} color={indicatorColor} />;
    }
    return (
      <ActivityIndicator
        size={mode === 'button' ? 'small' : 'large'}
        color={indicatorColor}
      />
    );
  };

  return (
    <View style={containerStyle}>
      {renderIndicator()}
      {text && (
        <Text style={[styles.text, { color: colors.text.secondary }]}>
          {text}
        </Text>
      )}
    </View>
  );
}

// =============================================================================
// CONVENIENCE EXPORTS
// =============================================================================

/**
 * Full screen loading indicator (takes entire screen)
 */
export function FullScreenLoading(props: Omit<LoadingProps, 'mode'>) {
  return <Loading mode="fullScreen" {...props} />;
}

/**
 * Inline loading indicator (no flex, no background)
 */
export function InlineLoading(props: Omit<LoadingProps, 'mode'>) {
  return <Loading mode="inline" {...props} />;
}

/**
 * Button-sized loading indicator (small ActivityIndicator)
 */
export function ButtonLoading(props: Omit<LoadingProps, 'mode'>) {
  return <Loading mode="button" {...props} />;
}

/**
 * Candle loading indicator with flickering red flame (24fps)
 */
export function CandleLoading(props: Omit<LoadingProps, 'mode'>) {
  return <Loading mode="candle" {...props} />;
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreen: {
    flex: 1,
    padding: spacing.xl,
  },
  text: {
    fontSize: 15,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});

export default Loading;
