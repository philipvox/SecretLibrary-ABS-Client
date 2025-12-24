/**
 * src/features/automotive/automotiveService.ts
 *
 * Central service for CarPlay and Android Auto integration.
 * Provides a unified API for automotive platforms.
 *
 * NOTE: CarPlay requires:
 * 1. Apple CarPlay Audio entitlement (com.apple.developer.carplay-audio)
 * 2. react-native-carplay package installed
 * 3. Native iOS scene delegate configuration
 *
 * Android Auto requires:
 * 1. MediaBrowserService implementation in native code
 * 2. automotive_app_desc.xml configuration
 */

import { Platform } from 'react-native';
import {
  AutomotiveConnectionState,
  AutomotivePlatform,
  AutomotiveNowPlaying,
  AutomotiveAction,
  AutomotiveCallbacks,
  AutomotiveConfig,
  BrowseSection,
  BrowseItem,
  DEFAULT_AUTOMOTIVE_CONFIG,
} from './types';
import { audioLog } from '@/shared/utils/audioDebug';

const log = (...args: any[]) => audioLog.audio('[Automotive]', ...args);

/**
 * Automotive service - manages CarPlay and Android Auto connections
 */
class AutomotiveService {
  private config: AutomotiveConfig = DEFAULT_AUTOMOTIVE_CONFIG;
  private connectionState: AutomotiveConnectionState = 'disconnected';
  private connectedPlatform: AutomotivePlatform = 'none';
  private callbacks: AutomotiveCallbacks | null = null;
  private isInitialized = false;

  // CarPlay-specific state (when react-native-carplay is installed)
  private carPlayModule: any = null;
  private continueListeningTemplate: any = null;
  private downloadsTemplate: any = null;
  private libraryCacheUnsubscribe: (() => void) | null = null;

  // Deduplication for playItem to prevent double playback
  private lastPlayedItemId: string | null = null;
  private lastPlayedTime: number = 0;
  private static PLAY_DEBOUNCE_MS = 2000; // Ignore duplicate play requests within 2 seconds

  /**
   * Initialize the automotive service
   */
  async init(config?: Partial<AutomotiveConfig>): Promise<void> {
    if (this.isInitialized) {
      log('Already initialized');
      return;
    }

    if (config) {
      this.config = { ...this.config, ...config };
    }

    log('Initializing automotive service...');
    log('Config:', JSON.stringify(this.config, null, 2));

    // Try to load CarPlay module (iOS only)
    if (Platform.OS === 'ios' && this.config.enableCarPlay) {
      await this.initCarPlay();
    }

    // Try to load Android Auto module (Android only)
    if (Platform.OS === 'android' && this.config.enableAndroidAuto) {
      await this.initAndroidAuto();
    }

    this.isInitialized = true;
    log('Automotive service initialized');
  }

  /**
   * Initialize CarPlay integration
   */
  private async initCarPlay(): Promise<void> {
    try {
      // First check if the native module exists before requiring the package
      const { NativeModules } = require('react-native');
      if (!NativeModules.RNCarPlay) {
        log('CarPlay native module not linked - skipping CarPlay init');
        log('To enable CarPlay:');
        log('1. Get CarPlay entitlement from Apple');
        log('2. Install: npm install react-native-carplay');
        log('3. Run pod install and rebuild');
        return;
      }

      // Try to require react-native-carplay
      this.carPlayModule = require('react-native-carplay');
      log('CarPlay module loaded');

      // Set up connection listener
      this.carPlayModule.CarPlay.registerOnConnect(() => {
        log('CarPlay connected');
        this.connectionState = 'connected';
        this.connectedPlatform = 'carplay';
        this.callbacks?.onConnect('carplay');
        this.setupCarPlayTemplates();
      });

      this.carPlayModule.CarPlay.registerOnDisconnect(() => {
        log('CarPlay disconnected');
        this.connectionState = 'disconnected';
        this.connectedPlatform = 'none';
        this.callbacks?.onDisconnect();
      });

      // Subscribe to library cache changes to refresh lists
      this.setupLibraryCacheListener();

    } catch (error: any) {
      log('CarPlay module not available:', error.message);
      log('To enable CarPlay:');
      log('1. Get CarPlay entitlement from Apple');
      log('2. Install: npm install react-native-carplay');
      log('3. Configure iOS scene delegate');
    }
  }

  /**
   * Set up listener for library cache changes
   */
  private async setupLibraryCacheListener(): Promise<void> {
    try {
      const { useLibraryCache } = await import('@/core/cache/libraryCache');

      // Unsubscribe from previous listener if any
      if (this.libraryCacheUnsubscribe) {
        this.libraryCacheUnsubscribe();
      }

      // Subscribe to changes - track previous items to detect changes
      let prevItems = useLibraryCache.getState().items;
      this.libraryCacheUnsubscribe = useLibraryCache.subscribe((state) => {
        if (state.items !== prevItems) {
          prevItems = state.items;
          log('Library changed, refreshing automotive data');

          // Refresh CarPlay lists when library changes
          if (this.isConnected() && this.connectedPlatform === 'carplay') {
            this.updateCarPlayLists();
          }

          // Sync Android Auto browse data
          if (Platform.OS === 'android') {
            this.syncAndroidAutoBrowseData();
          }
        }
      });
      log('Library cache listener set up');
    } catch (error) {
      log('Failed to set up library cache listener:', error);
    }
  }

  /**
   * Initialize Android Auto integration
   */
  private async initAndroidAuto(): Promise<void> {
    log('Initializing Android Auto support...');

    // Set up library cache listener for Android
    this.setupLibraryCacheListener();

    // Set up listener for play events from native Android Auto
    this.setupAndroidAutoEventListener();

    // Initial sync of browse data
    await this.syncAndroidAutoBrowseData();

    log('Android Auto initialized - browse data synced');
  }

  /**
   * Set up listener for events from native Android Auto module
   */
  private setupAndroidAutoEventListener(): void {
    if (Platform.OS !== 'android') return;

    try {
      const { NativeEventEmitter, NativeModules } = require('react-native');
      const { AndroidAutoModule } = NativeModules;

      if (!AndroidAutoModule) {
        log('AndroidAutoModule not available');
        return;
      }

      const eventEmitter = new NativeEventEmitter(AndroidAutoModule);

      // Listen for play item events from Android Auto
      eventEmitter.addListener('androidAutoPlayItem', async (event: { itemId: string }) => {
        log('Received play item event from Android Auto:', event.itemId);
        await this.playItem(event.itemId);
      });

      // Listen for connection state changes
      eventEmitter.addListener('androidAutoConnectionChanged', (event: { isConnected: boolean }) => {
        log('Android Auto connection changed:', event.isConnected);
        if (event.isConnected) {
          this.connectionState = 'connected';
          this.connectedPlatform = 'android-auto';
          this.callbacks?.onConnect('android-auto');
        } else {
          this.connectionState = 'disconnected';
          this.connectedPlatform = 'none';
          this.callbacks?.onDisconnect();
        }
      });

      log('Android Auto event listeners set up');
    } catch (error) {
      log('Failed to set up Android Auto event listeners:', error);
    }
  }

  /**
   * Sync browse data to native Android for Android Auto
   */
  private async syncAndroidAutoBrowseData(): Promise<void> {
    if (Platform.OS !== 'android') return;

    try {
      const { updateAndroidAutoBrowseData } = await import('./androidAutoBridge');
      const sections = await this.getBrowseSections();
      await updateAndroidAutoBrowseData(sections);
      log('Android Auto browse data synced');
    } catch (error) {
      log('Failed to sync Android Auto browse data:', error);
    }
  }

  /**
   * Set up CarPlay templates when connected
   */
  private async setupCarPlayTemplates(): Promise<void> {
    if (!this.carPlayModule) return;

    const { TabBarTemplate, ListTemplate, NowPlayingTemplate } = this.carPlayModule;

    // Get initial data
    const sections = await this.getBrowseSections();
    const continueSection = sections.find(s => s.id === 'continue-listening');
    const downloadsSection = sections.find(s => s.id === 'downloads');

    log('Setting up CarPlay templates with:', {
      continueItems: continueSection?.items.length || 0,
      downloadItems: downloadsSection?.items.length || 0,
    });

    // Create Continue Listening tab with data
    this.continueListeningTemplate = new ListTemplate({
      title: 'Continue',
      sections: [{
        header: 'In Progress',
        items: (continueSection?.items || []).map(item => ({
          text: item.title,
          detailText: item.subtitle,
          image: item.imageUrl,
          showsDisclosureIndicator: false,
        })),
      }],
      onItemSelect: async ({ index }: { index: number }) => {
        const currentSections = await this.getBrowseSections();
        const section = currentSections.find(s => s.id === 'continue-listening');
        if (section && section.items[index]) {
          await this.playItem(section.items[index].id);
        }
      },
    });

    // Create Downloads tab with data
    this.downloadsTemplate = new ListTemplate({
      title: 'Downloads',
      sections: [{
        header: 'Offline Books',
        items: (downloadsSection?.items || []).map(item => ({
          text: item.title,
          detailText: item.subtitle,
          image: item.imageUrl,
          showsDisclosureIndicator: false,
        })),
      }],
      onItemSelect: async ({ index }: { index: number }) => {
        const currentSections = await this.getBrowseSections();
        const section = currentSections.find(s => s.id === 'downloads');
        if (section && section.items[index]) {
          await this.playItem(section.items[index].id);
        }
      },
    });

    // Create Tab Bar template (root)
    const tabBarTemplate = new TabBarTemplate({
      title: this.config.appName,
      templates: [
        {
          ...this.continueListeningTemplate,
          tabSystemImageName: 'book.fill',
          tabTitle: 'Continue',
        },
        {
          ...this.downloadsTemplate,
          tabSystemImageName: 'arrow.down.circle.fill',
          tabTitle: 'Downloads',
        },
      ],
    });

    // Set root template
    this.carPlayModule.CarPlay.setRootTemplate(tabBarTemplate);
    log('CarPlay templates set up successfully');
  }

  /**
   * Play a library item (with deduplication to prevent double playback)
   */
  private async playItem(itemId: string): Promise<void> {
    const now = Date.now();

    // Deduplication: Skip if same item requested within debounce window
    if (
      this.lastPlayedItemId === itemId &&
      now - this.lastPlayedTime < AutomotiveService.PLAY_DEBOUNCE_MS
    ) {
      log('Ignoring duplicate play request for:', itemId, '(within debounce window)');
      return;
    }

    // Update deduplication tracking
    this.lastPlayedItemId = itemId;
    this.lastPlayedTime = now;

    log('Playing item:', itemId);

    try {
      const { useLibraryCache } = await import('@/core/cache/libraryCache');
      const { usePlayerStore } = await import('@/features/player/stores/playerStore');

      const item = useLibraryCache.getState().items.find(i => i.id === itemId);
      if (!item) {
        log('Item not found in library cache:', itemId);
        return;
      }

      await usePlayerStore.getState().loadBook(item, {
        autoPlay: true,
        showPlayer: false, // Don't show phone player when in car
      });

      log('Item started playing:', item.media?.metadata?.title);

      // Also notify callbacks if set
      this.callbacks?.onAction({
        type: 'playItem',
        itemId,
      });
    } catch (error) {
      log('Failed to play item:', error);
    }
  }

  /**
   * Update CarPlay list templates with current data
   */
  private async updateCarPlayLists(): Promise<void> {
    if (!this.carPlayModule || this.connectedPlatform !== 'carplay') return;

    try {
      const sections = await this.getBrowseSections();

      // Update Continue Listening template
      const continueSection = sections.find(s => s.id === 'continue-listening');
      if (this.continueListeningTemplate && continueSection) {
        this.continueListeningTemplate.updateSections([{
          header: 'In Progress',
          items: continueSection.items.map(item => ({
            text: item.title,
            detailText: item.subtitle,
            image: item.imageUrl,
            showsDisclosureIndicator: false,
          })),
        }]);
        log('Updated continue listening with', continueSection.items.length, 'items');
      }

      // Update Downloads template
      const downloadsSection = sections.find(s => s.id === 'downloads');
      if (this.downloadsTemplate && downloadsSection) {
        this.downloadsTemplate.updateSections([{
          header: 'Offline Books',
          items: downloadsSection.items.map(item => ({
            text: item.title,
            detailText: item.subtitle,
            image: item.imageUrl,
            showsDisclosureIndicator: false,
          })),
        }]);
        log('Updated downloads with', downloadsSection.items.length, 'items');
      }
    } catch (error) {
      log('Error updating CarPlay lists:', error);
    }
  }

  /**
   * Set callbacks for automotive events
   */
  setCallbacks(callbacks: AutomotiveCallbacks): void {
    this.callbacks = callbacks;
  }

  /**
   * Update now playing information for automotive displays
   */
  async updateNowPlaying(nowPlaying: AutomotiveNowPlaying): Promise<void> {
    if (this.connectionState !== 'connected') return;

    // CarPlay Now Playing is automatically handled by MPNowPlayingInfoCenter
    // which is already updated by our audioService/expo-media-control
    // So we don't need to do anything extra here for CarPlay

    // For Android Auto, the MediaSession is also already updated
    log('Now Playing updated for automotive');
  }

  /**
   * Get browse sections for library display
   */
  async getBrowseSections(): Promise<BrowseSection[]> {
    const sections: BrowseSection[] = [];

    try {
      // Get continue listening items
      const { useLibraryCache } = await import('@/core/cache/libraryCache');
      const { apiClient } = await import('@/core/api');

      const libraryItems = useLibraryCache.getState().items;

      // Filter for items with progress
      const continueItems = libraryItems
        .filter(item => {
          const progress = (item as any).userMediaProgress?.progress || 0;
          return progress > 0 && progress < 1;
        })
        .sort((a, b) => {
          const aTime = (a as any).userMediaProgress?.lastUpdate || 0;
          const bTime = (b as any).userMediaProgress?.lastUpdate || 0;
          return bTime - aTime;
        })
        .slice(0, this.config.maxListItems)
        .map((item): BrowseItem => {
          const metadata = item.media?.metadata as any;
          return {
            id: item.id,
            title: metadata?.title || 'Unknown Title',
            subtitle: metadata?.authorName || metadata?.authors?.[0]?.name || 'Unknown Author',
            imageUrl: apiClient.getItemCoverUrl(item.id),
            isPlayable: true,
            isBrowsable: false,
            progress: (item as any).userMediaProgress?.progress || 0,
          };
        });

      if (continueItems.length > 0) {
        sections.push({
          id: 'continue-listening',
          title: 'Continue Listening',
          items: continueItems,
        });
      }

      // Get downloaded items
      const { downloadManager } = await import('@/core/services/downloadManager');
      const allDownloads = await downloadManager.getAllDownloads();
      const completedDownloads = allDownloads.filter(d => d.status === 'complete');

      // Cross-reference with library items to get metadata
      const downloadedItems: BrowseItem[] = [];
      for (const download of completedDownloads.slice(0, this.config.maxListItems)) {
        const item = libraryItems.find(i => i.id === download.itemId);
        if (item) {
          const metadata = item.media?.metadata as any;
          downloadedItems.push({
            id: item.id,
            title: metadata?.title || 'Unknown Title',
            subtitle: metadata?.authorName || metadata?.authors?.[0]?.name || 'Unknown Author',
            imageUrl: apiClient.getItemCoverUrl(item.id),
            isPlayable: true,
            isBrowsable: false,
          });
        }
      }

      if (downloadedItems.length > 0) {
        sections.push({
          id: 'downloads',
          title: 'Downloads',
          items: downloadedItems,
        });
      }

    } catch (error) {
      log('Error getting browse sections:', error);
    }

    return sections;
  }

  /**
   * Get current connection state
   */
  getConnectionState(): AutomotiveConnectionState {
    return this.connectionState;
  }

  /**
   * Get connected platform
   */
  getConnectedPlatform(): AutomotivePlatform {
    return this.connectedPlatform;
  }

  /**
   * Check if connected to any automotive platform
   */
  isConnected(): boolean {
    return this.connectionState === 'connected';
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<AutomotiveConfig>): void {
    this.config = { ...this.config, ...config };
    log('Config updated');
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    // Unsubscribe from library cache
    if (this.libraryCacheUnsubscribe) {
      this.libraryCacheUnsubscribe();
      this.libraryCacheUnsubscribe = null;
    }

    // Clear template references
    this.continueListeningTemplate = null;
    this.downloadsTemplate = null;

    this.connectionState = 'disconnected';
    this.connectedPlatform = 'none';
    this.isInitialized = false;
    log('Automotive service cleaned up');
  }
}

// Export singleton
export const automotiveService = new AutomotiveService();
