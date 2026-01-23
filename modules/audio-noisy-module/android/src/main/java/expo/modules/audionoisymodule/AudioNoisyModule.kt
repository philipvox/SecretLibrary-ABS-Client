package expo.modules.audionoisymodule

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.media.AudioManager
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * AudioNoisyModule - Handles Android AUDIO_BECOMING_NOISY broadcast
 *
 * This broadcast is sent when audio is about to become "noisy" - typically when
 * headphones are unplugged. Best practice is to pause audio playback when this happens.
 *
 * iOS handles this natively through AVAudioSession's route change notification
 * with oldDeviceUnavailable reason.
 */
class AudioNoisyModule : Module() {
  private var noisyAudioReceiver: BroadcastReceiver? = null
  private var isListening = false

  override fun definition() = ModuleDefinition {
    Name("AudioNoisyModule")

    // Event that will be sent to JS when audio becomes noisy
    Events("onAudioBecomingNoisy")

    // Start listening for audio becoming noisy broadcasts
    AsyncFunction("startListening") {
      startListeningInternal()
      mapOf("success" to true)
    }

    // Stop listening for broadcasts (cleanup)
    AsyncFunction("stopListening") {
      stopListeningInternal()
      mapOf("success" to true)
    }

    // Check if currently listening
    Function("isListening") {
      isListening
    }

    // Lifecycle: Stop listening when module is destroyed
    OnDestroy {
      stopListeningInternal()
    }
  }

  private fun startListeningInternal() {
    if (isListening) return

    val context = appContext.reactContext ?: return

    noisyAudioReceiver = object : BroadcastReceiver() {
      override fun onReceive(context: Context?, intent: Intent?) {
        if (intent?.action == AudioManager.ACTION_AUDIO_BECOMING_NOISY) {
          // Send event to JS
          sendEvent("onAudioBecomingNoisy", mapOf(
            "reason" to "headphones_unplugged",
            "timestamp" to System.currentTimeMillis()
          ))
        }
      }
    }

    val filter = IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY)

    // Register receiver - use RECEIVER_NOT_EXPORTED for Android 13+
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      context.registerReceiver(noisyAudioReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
    } else {
      context.registerReceiver(noisyAudioReceiver, filter)
    }

    isListening = true
  }

  private fun stopListeningInternal() {
    if (!isListening) return

    val context = appContext.reactContext ?: return

    try {
      noisyAudioReceiver?.let {
        context.unregisterReceiver(it)
      }
    } catch (e: Exception) {
      // Receiver might not be registered, ignore
    }

    noisyAudioReceiver = null
    isListening = false
  }
}
