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

    } catch (error: any) {
      log('CarPlay module not available:', error.message);
      log('To enable CarPlay:');
      log('1. Get CarPlay entitlement from Apple');
      log('2. Install: npm install react-native-carplay');
      log('3. Configure iOS scene delegate');
    }
  }

  /**
   * Initialize Android Auto integration
   */
  private async initAndroidAuto(): Promise<void> {
    // Android Auto requires native MediaBrowserService implementation
    // This is primarily done in native code
    log('Android Auto support requires native MediaBrowserService');
    log('See: android/app/src/main/java/.../MediaPlaybackService.java');
  }

  /**
   * Set up CarPlay templates when connected
   */
  private setupCarPlayTemplates(): void {
    if (!this.carPlayModule) return;

    const { TabBarTemplate, ListTemplate, NowPlayingTemplate } = this.carPlayModule;

    // Create Now Playing template
    const nowPlayingTemplate = new NowPlayingTemplate({
      buttons: [
        {
          id: 'speed',
          type: 'more', // Shows "..." menu
        },
      ],
      upNextTitle: 'Up Next',
      upNextItems: [],
    });

    // Create Continue Listening tab
    const continueListeningTemplate = new ListTemplate({
      title: 'Continue',
      sections: [],
      onItemSelect: async ({ index, section }: { index: number; section: number }) => {
        const sections = await this.getBrowseSections();
        const continueSection = sections.find(s => s.id === 'continue-listening');
        if (continueSection && continueSection.items[index]) {
          this.callbacks?.onAction({
            type: 'playItem',
            itemId: continueSection.items[index].id,
          });
        }
      },
    });

    // Create Downloads tab
    const downloadsTemplate = new ListTemplate({
      title: 'Downloads',
      sections: [],
      onItemSelect: async ({ index }: { index: number }) => {
        const sections = await this.getBrowseSections();
        const downloadsSection = sections.find(s => s.id === 'downloads');
        if (downloadsSection && downloadsSection.items[index]) {
          this.callbacks?.onAction({
            type: 'playItem',
            itemId: downloadsSection.items[index].id,
          });
        }
      },
    });

    // Create Tab Bar template (root)
    const tabBarTemplate = new TabBarTemplate({
      title: this.config.appName,
      templates: [
        {
          ...continueListeningTemplate,
          tabSystemImageName: 'book.fill',
          tabTitle: 'Continue',
        },
        {
          ...downloadsTemplate,
          tabSystemImageName: 'arrow.down.circle.fill',
          tabTitle: 'Downloads',
        },
      ],
    });

    // Set root template
    this.carPlayModule.CarPlay.setRootTemplate(tabBarTemplate);

    // Update lists with data
    this.updateCarPlayLists();
  }

  /**
   * Update CarPlay list templates with current data
   */
  private async updateCarPlayLists(): Promise<void> {
    if (!this.carPlayModule || this.connectedPlatform !== 'carplay') return;

    try {
      const sections = await this.getBrowseSections();

      // Update Continue Listening
      const continueSection = sections.find(s => s.id === 'continue-listening');
      if (continueSection) {
        // Template updates would go here
        log('Updated continue listening with', continueSection.items.length, 'items');
      }

      // Update Downloads
      const downloadsSection = sections.find(s => s.id === 'downloads');
      if (downloadsSection) {
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
    // Clean up CarPlay
    if (this.carPlayModule) {
      // Unregister listeners
    }

    this.connectionState = 'disconnected';
    this.connectedPlatform = 'none';
    this.isInitialized = false;
    log('Automotive service cleaned up');
  }
}

// Export singleton
export const automotiveService = new AutomotiveService();
