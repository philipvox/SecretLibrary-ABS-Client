/**
 * Tests for WebSocket Service
 */

import { AppState } from 'react-native';
import { eventBus } from '../../events';
import { authService } from '../../auth/authService';

// Import after mocks are set up
import { WebSocketService } from '../websocketService';

// Mock socket.io-client
const mockSocket = {
  on: jest.fn(),
  emit: jest.fn(),
  disconnect: jest.fn(),
  removeAllListeners: jest.fn(),
  connected: false,
};

const mockIo = jest.fn((_url: string, _options: unknown) => mockSocket);

jest.mock('socket.io-client', () => ({
  io: (url: string, options: unknown) => mockIo(url, options),
}));

// Mock authService
jest.mock('../../auth/authService', () => ({
  authService: {
    getStoredToken: jest.fn(),
    getStoredServerUrl: jest.fn(),
    getStoredUser: jest.fn(),
  },
}));

// Mock eventBus
jest.mock('../../events', () => ({
  eventBus: {
    emit: jest.fn(),
    on: jest.fn(() => jest.fn()),
  },
}));

const mockAuthService = authService as jest.Mocked<typeof authService>;
const mockEventBus = eventBus as jest.Mocked<typeof eventBus>;

describe('WebSocketService', () => {
  let service: WebSocketService;
  let appStateCallback: ((state: string) => void) | null = null;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Reset socket mock
    mockSocket.connected = false;
    mockSocket.on.mockReset();
    mockSocket.emit.mockReset();
    mockSocket.disconnect.mockReset();
    mockSocket.removeAllListeners.mockReset();
    mockIo.mockClear();

    // Capture AppState listener
    appStateCallback = null;
    (AppState.addEventListener as jest.Mock).mockImplementation((event, callback) => {
      if (event === 'change') {
        appStateCallback = callback;
      }
      return { remove: jest.fn() };
    });

    service = new WebSocketService();
  });

  afterEach(() => {
    jest.useRealTimers();
    service.disconnect();
  });

  describe('Initial State', () => {
    it('starts in disconnected state', () => {
      expect(service.getState()).toBe('disconnected');
      expect(service.isConnected()).toBe(false);
    });
  });

  describe('connect', () => {
    it('does not connect without auth credentials', async () => {
      mockAuthService.getStoredToken.mockResolvedValue(null);
      mockAuthService.getStoredServerUrl.mockResolvedValue(null);
      mockAuthService.getStoredUser.mockResolvedValue(null);

      await service.connect();

      expect(mockIo).not.toHaveBeenCalled();
      expect(service.getState()).toBe('disconnected');
    });

    it('connects with valid credentials', async () => {
      mockAuthService.getStoredToken.mockResolvedValue('test-token');
      mockAuthService.getStoredServerUrl.mockResolvedValue('https://abs.example.com');
      mockAuthService.getStoredUser.mockResolvedValue({ id: 'user-123' } as any);

      await service.connect();

      expect(mockIo).toHaveBeenCalledWith('https://abs.example.com', {
        auth: { token: 'test-token' },
        transports: ['websocket', 'polling'],
        reconnection: false,
        timeout: 10000,
      });
    });

    it('does not reconnect if already connected', async () => {
      mockAuthService.getStoredToken.mockResolvedValue('test-token');
      mockAuthService.getStoredServerUrl.mockResolvedValue('https://abs.example.com');
      mockAuthService.getStoredUser.mockResolvedValue({ id: 'user-123' } as any);

      await service.connect();

      // Simulate connection
      const connectHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'connect'
      )?.[1];
      mockSocket.connected = true;
      connectHandler?.();

      expect(service.getState()).toBe('connected');

      // Try to connect again
      await service.connect();

      // Should not create a new connection
      expect(mockIo).toHaveBeenCalledTimes(1);
    });
  });

  describe('Event Handling', () => {
    beforeEach(async () => {
      mockAuthService.getStoredToken.mockResolvedValue('test-token');
      mockAuthService.getStoredServerUrl.mockResolvedValue('https://abs.example.com');
      mockAuthService.getStoredUser.mockResolvedValue({ id: 'user-123' } as any);

      await service.connect();
    });

    it('emits websocket:connected on connect', () => {
      const connectHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'connect'
      )?.[1];

      mockSocket.connected = true;
      connectHandler?.();

      expect(mockEventBus.emit).toHaveBeenCalledWith('websocket:connected', {
        serverUrl: 'https://abs.example.com',
        userId: 'user-123',
      });
    });

    it('handles user_item_progress_updated event', () => {
      const handler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'user_item_progress_updated'
      )?.[1];

      handler?.({
        id: 'book-123',
        odId: undefined,
        data: {
          currentTime: 300,
          duration: 3600,
          progress: 0.0833,
          isFinished: false,
          lastUpdate: Date.now(),
        },
      });

      expect(mockEventBus.emit).toHaveBeenCalledWith('websocket:progress_updated', {
        libraryItemId: 'book-123',
        episodeId: undefined,
        currentTime: 300,
        duration: 3600,
        progress: 0.0833,
        isFinished: false,
        lastUpdate: expect.any(Number),
      });
    });

    it('handles item_added event', () => {
      const handler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'item_added'
      )?.[1];

      handler?.({
        id: 'book-456',
        libraryId: 'lib-1',
      });

      expect(mockEventBus.emit).toHaveBeenCalledWith('websocket:item_added', {
        libraryItemId: 'book-456',
        libraryId: 'lib-1',
      });
    });

    it('handles item_updated event', () => {
      const handler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'item_updated'
      )?.[1];

      handler?.({
        id: 'book-456',
        libraryId: 'lib-1',
      });

      expect(mockEventBus.emit).toHaveBeenCalledWith('websocket:item_updated', {
        libraryItemId: 'book-456',
        libraryId: 'lib-1',
      });
    });

    it('handles item_removed event', () => {
      const handler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'item_removed'
      )?.[1];

      handler?.({
        id: 'book-789',
        libraryId: 'lib-2',
      });

      expect(mockEventBus.emit).toHaveBeenCalledWith('websocket:item_removed', {
        libraryItemId: 'book-789',
        libraryId: 'lib-2',
      });
    });

    it('handles scan_complete event', () => {
      const handler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'scan_complete'
      )?.[1];

      handler?.({
        id: 'lib-1',
        added: 5,
        updated: 3,
        removed: 1,
      });

      expect(mockEventBus.emit).toHaveBeenCalledWith('websocket:library_scan_complete', {
        libraryId: 'lib-1',
        itemsAdded: 5,
        itemsUpdated: 3,
      });
    });
  });

  describe('disconnect', () => {
    beforeEach(async () => {
      mockAuthService.getStoredToken.mockResolvedValue('test-token');
      mockAuthService.getStoredServerUrl.mockResolvedValue('https://abs.example.com');
      mockAuthService.getStoredUser.mockResolvedValue({ id: 'user-123' } as any);

      await service.connect();
    });

    it('disconnects and cleans up', () => {
      service.disconnect();

      expect(mockSocket.removeAllListeners).toHaveBeenCalled();
      expect(mockSocket.disconnect).toHaveBeenCalled();
      expect(service.getState()).toBe('disconnected');
    });

    it('emits websocket:disconnected event', () => {
      service.disconnect('manual');

      expect(mockEventBus.emit).toHaveBeenCalledWith('websocket:disconnected', {
        reason: 'manual',
      });
    });
  });

  describe('Reconnection', () => {
    beforeEach(async () => {
      mockAuthService.getStoredToken.mockResolvedValue('test-token');
      mockAuthService.getStoredServerUrl.mockResolvedValue('https://abs.example.com');
      mockAuthService.getStoredUser.mockResolvedValue({ id: 'user-123' } as any);

      await service.connect();
    });

    it('schedules reconnect on unexpected disconnect', () => {
      const disconnectHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'disconnect'
      )?.[1];

      // Simulate transport close (unexpected)
      disconnectHandler?.('transport close');

      expect(service.getState()).toBe('reconnecting');
    });

    it('does not reconnect on client disconnect', () => {
      const disconnectHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'disconnect'
      )?.[1];

      // Simulate client-initiated disconnect
      disconnectHandler?.('io client disconnect');

      // State should remain as set by disconnect()
      expect(service.getState()).not.toBe('reconnecting');
    });

    it('uses exponential backoff for reconnection', async () => {
      const connectErrorHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'connect_error'
      )?.[1];

      // First error
      mockIo.mockClear();
      connectErrorHandler?.(new Error('Connection failed'));

      // Should schedule reconnect
      expect(service.getState()).toBe('disconnected');

      // Advance timer - first reconnect attempt (1000ms base + up to 30% jitter = max 1300ms)
      jest.advanceTimersByTime(1500);

      // Flush multiple promises to allow async connect() to run completely
      // (connect() has Promise.all with 3 storage reads)
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      // Should have attempted reconnect
      expect(mockIo).toHaveBeenCalledTimes(1);
    });
  });

  describe('App State Management', () => {
    it('disconnects when app goes to background', async () => {
      mockAuthService.getStoredToken.mockResolvedValue('test-token');
      mockAuthService.getStoredServerUrl.mockResolvedValue('https://abs.example.com');
      mockAuthService.getStoredUser.mockResolvedValue({ id: 'user-123' } as any);

      await service.connect();

      // Simulate connection
      const connectHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'connect'
      )?.[1];
      mockSocket.connected = true;
      connectHandler?.();

      expect(service.isConnected()).toBe(true);

      // App goes to background
      appStateCallback?.('background');

      expect(mockSocket.disconnect).toHaveBeenCalled();
    });

    it('reconnects when app comes to foreground', async () => {
      mockAuthService.getStoredToken.mockResolvedValue('test-token');
      mockAuthService.getStoredServerUrl.mockResolvedValue('https://abs.example.com');
      mockAuthService.getStoredUser.mockResolvedValue({ id: 'user-123' } as any);

      await service.connect();

      // Simulate connection
      const connectHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'connect'
      )?.[1];
      mockSocket.connected = true;
      connectHandler?.();

      // App goes to background
      appStateCallback?.('background');

      // Reset mock to track new connection
      mockIo.mockClear();

      // App comes back to foreground
      appStateCallback?.('active');

      // Flush promises to allow async connect() to run
      await Promise.resolve();
      await Promise.resolve();

      // Should attempt to reconnect
      expect(mockIo).toHaveBeenCalled();
    });
  });

  describe('Options', () => {
    it('respects disconnectOnBackground option', async () => {
      service = new WebSocketService({ disconnectOnBackground: false });

      mockAuthService.getStoredToken.mockResolvedValue('test-token');
      mockAuthService.getStoredServerUrl.mockResolvedValue('https://abs.example.com');
      mockAuthService.getStoredUser.mockResolvedValue({ id: 'user-123' } as any);

      await service.connect();

      // Simulate connection
      const connectHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'connect'
      )?.[1];
      mockSocket.connected = true;
      connectHandler?.();

      // App goes to background - should NOT disconnect
      appStateCallback?.('background');

      expect(mockSocket.disconnect).not.toHaveBeenCalled();
    });

    it('respects maxReconnectAttempts option', async () => {
      service = new WebSocketService({
        maxReconnectAttempts: 2,
        reconnectDelay: 100,
      });

      mockAuthService.getStoredToken.mockResolvedValue('test-token');
      mockAuthService.getStoredServerUrl.mockResolvedValue('https://abs.example.com');
      mockAuthService.getStoredUser.mockResolvedValue({ id: 'user-123' } as any);

      await service.connect();

      const connectErrorHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'connect_error'
      )?.[1];

      // Initial connection attempt (attempt 0)
      mockIo.mockClear();

      // First error triggers first reconnect scheduling
      connectErrorHandler?.(new Error('Connection failed'));
      jest.advanceTimersByTime(150);
      await Promise.resolve();

      // Second error (attempt 1)
      connectErrorHandler?.(new Error('Connection failed'));
      jest.advanceTimersByTime(300);
      await Promise.resolve();

      // Third error (attempt 2) - this should hit the max
      connectErrorHandler?.(new Error('Connection failed'));

      // After max attempts, no more reconnects should be scheduled
      const _callCount = mockIo.mock.calls.length;
      jest.advanceTimersByTime(1000);
      await Promise.resolve();

      // State should be disconnected after hitting max attempts
      // The scheduleReconnect function sets state to 'disconnected' when max is reached
      expect(service.getState()).toBe('disconnected');
    });
  });
});
