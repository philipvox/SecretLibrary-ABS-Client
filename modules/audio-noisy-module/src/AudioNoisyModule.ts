import { requireNativeModule, EventEmitter, Subscription } from 'expo-modules-core';
import { Platform } from 'react-native';

// Event data interface
export interface AudioNoisyEvent {
  reason: 'headphones_unplugged';
  timestamp: number;
}

interface AudioNoisyModuleInterface {
  startListening(): Promise<{ success: boolean }>;
  stopListening(): Promise<{ success: boolean }>;
  isListening(): boolean;
}

// Only available on Android - iOS handles this natively
const isAndroid = Platform.OS === 'android';

// Load native module (Android only)
const NativeAudioNoisyModule = isAndroid
  ? requireNativeModule<AudioNoisyModuleInterface>('AudioNoisyModule')
  : null;

// Event emitter for native events
const emitter = isAndroid && NativeAudioNoisyModule
  ? new EventEmitter(NativeAudioNoisyModule)
  : null;

/**
 * Start listening for audio becoming noisy events.
 * On Android, this registers a BroadcastReceiver for ACTION_AUDIO_BECOMING_NOISY.
 * On iOS, this is a no-op (expo-audio handles route changes natively).
 *
 * @returns Promise<boolean> - true if listening started successfully
 */
export async function startListening(): Promise<boolean> {
  if (!isAndroid || !NativeAudioNoisyModule) {
    // iOS handles this natively through expo-audio
    return true;
  }

  try {
    const result = await NativeAudioNoisyModule.startListening();
    return result.success;
  } catch (error) {
    console.warn('[AudioNoisyModule] Failed to start listening:', error);
    return false;
  }
}

/**
 * Stop listening for audio becoming noisy events.
 *
 * @returns Promise<boolean> - true if stopped successfully
 */
export async function stopListening(): Promise<boolean> {
  if (!isAndroid || !NativeAudioNoisyModule) {
    return true;
  }

  try {
    const result = await NativeAudioNoisyModule.stopListening();
    return result.success;
  } catch (error) {
    console.warn('[AudioNoisyModule] Failed to stop listening:', error);
    return false;
  }
}

/**
 * Check if currently listening for audio noisy events.
 *
 * @returns boolean - true if currently listening
 */
export function isListening(): boolean {
  if (!isAndroid || !NativeAudioNoisyModule) {
    return false;
  }

  try {
    return NativeAudioNoisyModule.isListening();
  } catch {
    return false;
  }
}

/**
 * Add listener for audio becoming noisy events.
 * Called when headphones are unplugged on Android.
 *
 * @param callback - Function to call when audio becomes noisy
 * @returns Subscription - Call .remove() to unsubscribe
 *
 * @example
 * ```ts
 * const subscription = addAudioNoisyListener((event) => {
 *   console.log('Headphones unplugged:', event.timestamp);
 *   // Pause audio playback
 * });
 *
 * // Later: cleanup
 * subscription.remove();
 * ```
 */
export function addAudioNoisyListener(
  callback: (event: AudioNoisyEvent) => void
): Subscription {
  if (!emitter) {
    // Return no-op subscription for iOS
    return {
      remove: () => {},
    };
  }

  return emitter.addListener('onAudioBecomingNoisy', callback);
}

export default {
  startListening,
  stopListening,
  isListening,
  addAudioNoisyListener,
};
