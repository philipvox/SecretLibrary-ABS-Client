/**
 * src/features/player/utils/smartRewindCalculator.ts
 *
 * Smart Rewind Calculation - Pure utility function with no dependencies.
 * Based on Ebbinghaus forgetting curve research.
 *
 * Anchor points:
 * - 3s pause → 3s rewind (echoic memory threshold)
 * - 10s pause → 5s rewind
 * - 30s pause → 10s rewind
 * - 2min pause → 15s rewind
 * - 5min pause → 20s rewind
 * - 15min pause → 25s rewind
 * - 1hr pause → 30s rewind
 * - 24hr+ pause → max rewind setting
 */

/**
 * Calculate smart rewind amount based on pause duration using logarithmic curve.
 * @param pauseDurationMs - Duration of pause in milliseconds
 * @param maxRewindSeconds - Maximum rewind amount in seconds
 * @returns Rewind amount in seconds (integer)
 */
export function calculateSmartRewindSeconds(
  pauseDurationMs: number,
  maxRewindSeconds: number
): number {
  const pauseSeconds = pauseDurationMs / 1000;

  // No rewind for very brief pauses (echoic memory intact)
  if (pauseSeconds < 3) return 0;

  let rewind: number;

  if (pauseSeconds < 10) {
    // 3-10 seconds: quick ramp from 3s to 5s
    rewind = 3 + ((pauseSeconds - 3) * 2) / 7;
  } else if (pauseSeconds < 30) {
    // 10-30 seconds: gradual increase from 5s to 10s
    rewind = 5 + ((pauseSeconds - 10) * 5) / 20;
  } else if (pauseSeconds < 120) {
    // 30s - 2min: increase from 10s to 15s
    rewind = 10 + ((pauseSeconds - 30) * 5) / 90;
  } else if (pauseSeconds < 300) {
    // 2-5 min: increase from 15s to 20s
    rewind = 15 + ((pauseSeconds - 120) * 5) / 180;
  } else if (pauseSeconds < 900) {
    // 5-15 min: increase from 20s to 25s
    rewind = 20 + ((pauseSeconds - 300) * 5) / 600;
  } else if (pauseSeconds < 3600) {
    // 15min - 1hr: increase from 25s to 30s
    rewind = 25 + ((pauseSeconds - 900) * 5) / 2700;
  } else if (pauseSeconds < 86400) {
    // 1hr - 24hr: increase from 30s to 45s
    rewind = 30 + ((pauseSeconds - 3600) * 15) / 82800;
  } else {
    // 24hr+: maximum
    rewind = maxRewindSeconds;
  }

  return Math.min(Math.round(rewind), maxRewindSeconds);
}
