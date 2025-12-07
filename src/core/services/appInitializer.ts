/**
 * src/core/services/appInitializer.ts
 *
 * Central initialization orchestrator for app startup.
 * Runs all critical initialization tasks in parallel to minimize launch time.
 * Controls native splash screen visibility.
 */

import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';
import { User } from '@/core/types';

// Prevent native splash auto-hide - we control when it hides
SplashScreen.preventAutoHideAsync().catch(() => {
  // Already called or not available
});

export interface InitResult {
  user: User | null;
  serverUrl: string | null;
  fontsLoaded: boolean;
}

class AppInitializer {
  private initPromise: Promise<InitResult> | null = null;
  private isReady = false;

  /**
   * Initialize all critical resources in parallel.
   * Returns when app is ready to render content.
   */
  async initialize(): Promise<InitResult> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._initialize();
    return this.initPromise;
  }

  private async _initialize(): Promise<InitResult> {
    const startTime = Date.now();
    console.log('[AppInitializer] Starting parallel initialization...');

    // =========================================================================
    // ONE-TIME CACHE CLEAR - Remove this block after stale data is cleared
    // =========================================================================
    try {
      console.log('[AppInitializer] 🧹 CLEARING ALL STALE DATA...');

      // 1. Clear AsyncStorage caches
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      await AsyncStorage.multiRemove([
        'library_cache_v1',
        'auto_download_manifest',
        'search_history',
        'abs_last_played_book',
        'player_state',
      ]);
      console.log('[AppInitializer] ✓ AsyncStorage cleared');

      // 2. Clear SQLite cache
      try {
        const { sqliteCache } = await import('./sqliteCache');
        await sqliteCache.clearAllCache();
        console.log('[AppInitializer] ✓ SQLite cache cleared');
      } catch (e) {
        console.warn('[AppInitializer] SQLite clear skipped:', e);
      }

      // 3. Clear downloaded files
      try {
        const { downloadManager } = await import('./downloadManager');
        await downloadManager.clearAllDownloads();
        console.log('[AppInitializer] ✓ Downloads cleared');
      } catch (e) {
        console.warn('[AppInitializer] Downloads clear skipped:', e);
      }

      console.log('[AppInitializer] 🎉 ALL STALE DATA CLEARED');
    } catch (e) {
      console.error('[AppInitializer] Cache clear failed:', e);
    }
    // =========================================================================
    // END ONE-TIME CACHE CLEAR
    // =========================================================================

    // Import auth service lazily to avoid circular dependencies
    const { authService } = await import('@/core/auth/authService');

    // PARALLEL: Run all initialization tasks concurrently
    const [fontResult, authResult] = await Promise.all([
      // Font loading
      this.loadFonts(),

      // Session restoration (optimized parallel reads)
      this.restoreSession(authService),
    ]);

    const result: InitResult = {
      user: authResult?.user || null,
      serverUrl: authResult?.serverUrl || null,
      fontsLoaded: fontResult,
    };

    const elapsed = Date.now() - startTime;
    console.log(`[AppInitializer] Ready in ${elapsed}ms`, {
      fontsLoaded: result.fontsLoaded,
      hasUser: !!result.user,
    });

    this.isReady = true;
    return result;
  }

  private async loadFonts(): Promise<boolean> {
    try {
      await Font.loadAsync({
        PixelOperator: require('@/assets/fonts/PixelOperator.ttf'),
      });
      return true;
    } catch (err) {
      console.warn('[AppInitializer] Font loading failed:', err);
      return false;
    }
  }

  private async restoreSession(authService: any): Promise<{
    user: User | null;
    serverUrl: string | null;
  }> {
    try {
      // Use optimized parallel session restore if available, otherwise fallback
      if (authService.restoreSessionOptimized) {
        return await authService.restoreSessionOptimized();
      }
      return await authService.restoreSession();
    } catch (err) {
      console.warn('[AppInitializer] Session restoration failed:', err);
      return { user: null, serverUrl: null };
    }
  }

  /**
   * Hide native splash screen.
   * Call this after animated splash is ready to take over.
   */
  async hideSplash(): Promise<void> {
    try {
      await SplashScreen.hideAsync();
    } catch (err) {
      // Already hidden or not available
    }
  }

  getIsReady(): boolean {
    return this.isReady;
  }
}

export const appInitializer = new AppInitializer();
