/**
 * JS bridge to the native CastModule (Android/iOS).
 * Provides a typed interface over NativeModules.CastModule.
 */

import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
import { logger } from '@/shared/utils/logger';

const { CastModule } = NativeModules;

type CastEventCallback = (data: any) => void;

interface CastMediaParams {
  url: string;
  title: string;
  author: string;
  coverUrl: string;
  position: number; // seconds
}

interface CastDevice {
  id: string;
  name: string;
  isConnected: boolean;
}

interface MediaStatus {
  position: number;
  duration: number;
  isPlaying: boolean;
  isPaused: boolean;
  isIdle: boolean;
}

class CastService {
  private emitter: NativeEventEmitter | null = null;
  private listeners: Map<string, CastEventCallback[]> = new Map();
  private subscriptions: any[] = [];

  /**
   * Whether the native CastModule is available.
   */
  get isAvailable(): boolean {
    return CastModule != null;
  }

  /**
   * Initialize event listeners from the native module.
   */
  initialize() {
    if (!this.isAvailable) {
      logger.warn('[Cast] Native CastModule not available');
      return;
    }

    this.emitter = new NativeEventEmitter(CastModule);

    const events = [
      'onSessionStarted',
      'onSessionEnded',
      'onSessionStartFailed',
      'onMediaStatusUpdate',
      'onDevicesDiscovered',
    ];

    for (const event of events) {
      const sub = this.emitter.addListener(event, (data) => {
        const callbacks = this.listeners.get(event) || [];
        for (const cb of callbacks) {
          cb(data);
        }
      });
      this.subscriptions.push(sub);
    }
  }

  /**
   * Clean up event subscriptions.
   */
  destroy() {
    for (const sub of this.subscriptions) {
      sub.remove();
    }
    this.subscriptions = [];
    this.listeners.clear();
  }

  /**
   * Subscribe to a native Cast event.
   */
  on(event: string, callback: CastEventCallback): () => void {
    const list = this.listeners.get(event) || [];
    list.push(callback);
    this.listeners.set(event, list);

    return () => {
      const updated = (this.listeners.get(event) || []).filter((cb) => cb !== callback);
      this.listeners.set(event, updated);
    };
  }

  async startDiscovery(): Promise<boolean> {
    if (!this.isAvailable) return false;
    return CastModule.startDiscovery();
  }

  async getAvailableDevices(): Promise<CastDevice[]> {
    if (!this.isAvailable) return [];
    return CastModule.getAvailableDevices();
  }

  async showCastPicker(): Promise<boolean> {
    if (!this.isAvailable) return false;
    return CastModule.showCastPicker();
  }

  async loadMedia(params: CastMediaParams): Promise<boolean> {
    if (!this.isAvailable) return false;
    return CastModule.loadMedia(
      params.url,
      params.title,
      params.author,
      params.coverUrl,
      params.position
    );
  }

  async play(): Promise<boolean> {
    if (!this.isAvailable) return false;
    return CastModule.play();
  }

  async pause(): Promise<boolean> {
    if (!this.isAvailable) return false;
    return CastModule.pause();
  }

  async seek(position: number): Promise<boolean> {
    if (!this.isAvailable) return false;
    return CastModule.seek(position);
  }

  async stop(): Promise<boolean> {
    if (!this.isAvailable) return false;
    return CastModule.stop();
  }

  async disconnect(): Promise<boolean> {
    if (!this.isAvailable) return false;
    return CastModule.disconnect();
  }

  async getPosition(): Promise<number> {
    if (!this.isAvailable) return -1;
    return CastModule.getPosition();
  }

  async isConnected(): Promise<boolean> {
    if (!this.isAvailable) return false;
    return CastModule.isConnected();
  }
}

export const castService = new CastService();

export type { CastDevice, CastMediaParams, MediaStatus };
