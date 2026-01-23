/**
 * jest.setup.js
 *
 * Jest setup file for React Native with Expo.
 * Comprehensive mocks for component and unit testing.
 */

// Define __DEV__ if not already defined
if (typeof global.__DEV__ === 'undefined') {
  global.__DEV__ = true;
}

// Mock expo's winter runtime to prevent import errors
jest.mock('expo/src/winter/runtime.native', () => ({}), { virtual: true });
jest.mock('expo/src/winter/installGlobal', () => ({}), { virtual: true });

// =============================================================================
// React Native Core Mocks
// =============================================================================

// Mock the entire react-native module for component tests
jest.mock('react-native', () => {
  const React = require('react');

  const View = ({ children, style, testID, ...props }) =>
    React.createElement('View', { style, testID, ...props }, children);
  const Text = ({ children, style, testID, ...props }) =>
    React.createElement('Text', { style, testID, ...props }, children);
  const Pressable = ({ children, onPress, style, disabled, testID, ...props }) =>
    React.createElement('Pressable', { onClick: onPress, style, disabled, testID, ...props }, children);
  const TouchableOpacity = ({ children, onPress, style, activeOpacity, testID, ...props }) =>
    React.createElement('TouchableOpacity', { onClick: onPress, style, testID, ...props }, children);
  const ScrollView = ({ children, style, testID, ...props }) =>
    React.createElement('ScrollView', { style, testID, ...props }, children);
  const FlatList = ({ data, renderItem, keyExtractor, testID, ...props }) =>
    React.createElement('FlatList', { testID, ...props },
      data?.map((item, index) => renderItem({ item, index }))
    );
  const Image = ({ source, style, testID, ...props }) =>
    React.createElement('Image', { src: source, style, testID, ...props });
  const TextInput = (props) => React.createElement('TextInput', props);
  const ActivityIndicator = (props) => React.createElement('ActivityIndicator', props);

  return {
    View,
    Text,
    Pressable,
    TouchableOpacity,
    ScrollView,
    FlatList,
    Image,
    TextInput,
    ActivityIndicator,
    StyleSheet: {
      create: (styles) => styles,
      flatten: (style) => (Array.isArray(style) ? Object.assign({}, ...style) : style),
      absoluteFill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
      absoluteFillObject: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
      hairlineWidth: 1,
    },
    Platform: {
      OS: 'ios',
      select: (obj) => obj.ios || obj.default,
      Version: '17.0',
    },
    Dimensions: {
      get: () => ({ width: 393, height: 852, scale: 3, fontScale: 1 }),
      addEventListener: jest.fn(() => ({ remove: jest.fn() })),
    },
    Animated: {
      View,
      Text,
      ScrollView,
      Image,
      Value: jest.fn(() => ({
        setValue: jest.fn(),
        interpolate: jest.fn(() => 0),
        addListener: jest.fn(),
        removeListener: jest.fn(),
        stopAnimation: jest.fn(),
        __getValue: () => 0,
      })),
      timing: jest.fn(() => ({
        start: jest.fn((cb) => cb && cb({ finished: true })),
        stop: jest.fn(),
      })),
      spring: jest.fn(() => ({
        start: jest.fn((cb) => cb && cb({ finished: true })),
        stop: jest.fn(),
      })),
      sequence: jest.fn(() => ({
        start: jest.fn((cb) => cb && cb({ finished: true })),
      })),
      parallel: jest.fn(() => ({
        start: jest.fn((cb) => cb && cb({ finished: true })),
      })),
      loop: jest.fn(() => ({
        start: jest.fn(),
        stop: jest.fn(),
      })),
      event: jest.fn(() => jest.fn()),
      createAnimatedComponent: (comp) => comp,
    },
    Easing: {
      linear: jest.fn(),
      ease: jest.fn(),
      quad: jest.fn(),
      cubic: jest.fn(),
      bezier: jest.fn(() => jest.fn()),
      inOut: jest.fn((fn) => fn),
      in: jest.fn((fn) => fn),
      out: jest.fn((fn) => fn),
    },
    StatusBar: {
      setBarStyle: jest.fn(),
      setHidden: jest.fn(),
    },
    Alert: {
      alert: jest.fn(),
    },
    Linking: {
      openURL: jest.fn(),
      canOpenURL: jest.fn().mockResolvedValue(true),
    },
    PixelRatio: {
      get: () => 3,
      getFontScale: () => 1,
      getPixelSizeForLayoutSize: (size) => size * 3,
      roundToNearestPixel: (size) => Math.round(size),
    },
    useWindowDimensions: () => ({ width: 393, height: 852 }),
    useColorScheme: () => 'dark',
    NativeModules: {},
    UIManager: {
      getViewManagerConfig: jest.fn(() => null),
    },
    RefreshControl: View,
    KeyboardAvoidingView: View,
    Modal: View,
    Keyboard: {
      dismiss: jest.fn(),
      addListener: jest.fn(() => ({ remove: jest.fn() })),
    },
    AppState: {
      currentState: 'active',
      addEventListener: jest.fn(() => ({ remove: jest.fn() })),
    },
  };
});

// =============================================================================
// Expo Module Mocks
// =============================================================================

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
    Soft: 'soft',
    Rigid: 'rigid',
  },
  NotificationFeedbackType: {
    Success: 'success',
    Warning: 'warning',
    Error: 'error',
  },
}));

jest.mock('expo-file-system', () => ({
  documentDirectory: '/mock/document/directory/',
  cacheDirectory: '/mock/cache/directory/',
  getInfoAsync: jest.fn().mockResolvedValue({ exists: false }),
  readAsStringAsync: jest.fn().mockResolvedValue(''),
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
  makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
  copyAsync: jest.fn().mockResolvedValue(undefined),
  moveAsync: jest.fn().mockResolvedValue(undefined),
  downloadAsync: jest.fn().mockResolvedValue({ uri: '/mock/path' }),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-crypto', () => ({
  digestStringAsync: jest.fn().mockResolvedValue('mockhash'),
  CryptoDigestAlgorithm: {
    SHA256: 'SHA-256',
    SHA384: 'SHA-384',
    SHA512: 'SHA-512',
    MD5: 'MD5',
  },
}));

jest.mock('expo-image', () => ({
  Image: 'Image',
}));

jest.mock('expo-blur', () => ({
  BlurView: 'BlurView',
}));

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: 'LinearGradient',
}));

jest.mock('expo-audio', () => ({
  useAudioPlayer: jest.fn(() => ({
    play: jest.fn(),
    pause: jest.fn(),
    seekTo: jest.fn(),
    currentTime: 0,
    duration: 0,
    playing: false,
  })),
  AudioPlayer: jest.fn(),
}));

jest.mock('socket.io-client', () => ({
  io: jest.fn(() => ({
    on: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn(),
    removeAllListeners: jest.fn(),
    connected: false,
  })),
}));

// =============================================================================
// Navigation Mocks
// =============================================================================

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  reset: jest.fn(),
  setParams: jest.fn(),
  dispatch: jest.fn(),
  isFocused: jest.fn(() => true),
  canGoBack: jest.fn(() => true),
  addListener: jest.fn(() => jest.fn()),
  removeListener: jest.fn(),
  getParent: jest.fn(),
  getState: jest.fn(() => ({ routes: [], index: 0 })),
};

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => mockNavigation,
  useRoute: () => ({ params: {} }),
  useFocusEffect: jest.fn(),
  useIsFocused: () => true,
}));

// =============================================================================
// React Native Community Mocks
// =============================================================================

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }) => children,
  SafeAreaView: ({ children }) => children,
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  useSafeAreaFrame: () => ({ x: 0, y: 0, width: 393, height: 852 }),
}));

jest.mock('react-native-gesture-handler', () => ({
  Gesture: {
    Pan: jest.fn(() => ({
      onStart: jest.fn().mockReturnThis(),
      onUpdate: jest.fn().mockReturnThis(),
      onEnd: jest.fn().mockReturnThis(),
      enabled: jest.fn().mockReturnThis(),
    })),
    Tap: jest.fn(() => ({
      onStart: jest.fn().mockReturnThis(),
      onEnd: jest.fn().mockReturnThis(),
    })),
  },
  GestureDetector: ({ children }) => children,
  GestureHandlerRootView: ({ children }) => children,
  TouchableOpacity: 'TouchableOpacity',
  ScrollView: 'ScrollView',
  FlatList: 'FlatList',
  PanGestureHandler: 'PanGestureHandler',
  TapGestureHandler: 'TapGestureHandler',
  State: {},
  Directions: {},
}));

// =============================================================================
// Reanimated Mocks
// =============================================================================

jest.mock('react-native-reanimated', () => {
  const View = require('react-native').View;
  const Text = require('react-native').Text;
  const ScrollView = require('react-native').ScrollView;
  const Image = require('react-native').Image;

  return {
    default: {
      View,
      Text,
      ScrollView,
      Image,
      createAnimatedComponent: (component) => component,
    },
    View,
    Text,
    ScrollView,
    Image,
    useSharedValue: jest.fn((initial) => ({ value: initial })),
    useAnimatedStyle: jest.fn(() => ({})),
    useAnimatedProps: jest.fn(() => ({})),
    useAnimatedScrollHandler: jest.fn(() => jest.fn()),
    useDerivedValue: jest.fn((fn) => ({ value: fn() })),
    useAnimatedGestureHandler: jest.fn(() => ({})),
    withTiming: jest.fn((value) => value),
    withSpring: jest.fn((value) => value),
    withDelay: jest.fn((_, value) => value),
    withSequence: jest.fn((...values) => values[values.length - 1]),
    withRepeat: jest.fn((value) => value),
    interpolate: jest.fn((value) => value),
    Extrapolation: { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' },
    Easing: {
      linear: jest.fn(),
      ease: jest.fn(),
      quad: jest.fn(),
      cubic: jest.fn(),
      bezier: jest.fn(),
      inOut: jest.fn((easing) => easing),
      in: jest.fn((easing) => easing),
      out: jest.fn((easing) => easing),
    },
    runOnJS: jest.fn((fn) => fn),
    runOnUI: jest.fn((fn) => fn),
    useReducedMotion: jest.fn(() => false),
    useFrameCallback: jest.fn(),
    createAnimatedComponent: (component) => component,
    FadeIn: { duration: jest.fn().mockReturnThis() },
    FadeOut: { duration: jest.fn().mockReturnThis() },
    SlideInRight: { duration: jest.fn().mockReturnThis() },
    SlideOutRight: { duration: jest.fn().mockReturnThis() },
  };
});

// =============================================================================
// Other Third-Party Mocks
// =============================================================================

jest.mock('react-native-svg', () => {
  const React = require('react');
  const createMockComponent = (name) => ({ children, ...props }) =>
    React.createElement(name, props, children);

  return {
    __esModule: true,
    default: createMockComponent('Svg'),
    Svg: createMockComponent('Svg'),
    Path: createMockComponent('Path'),
    Circle: createMockComponent('Circle'),
    Rect: createMockComponent('Rect'),
    G: createMockComponent('G'),
    Defs: createMockComponent('Defs'),
    LinearGradient: createMockComponent('SvgLinearGradient'),
    RadialGradient: createMockComponent('RadialGradient'),
    Stop: createMockComponent('Stop'),
    ClipPath: createMockComponent('ClipPath'),
    Text: createMockComponent('SvgText'),
    TSpan: createMockComponent('TSpan'),
    Use: createMockComponent('Use'),
    Symbol: createMockComponent('SvgSymbol'),
    Line: createMockComponent('Line'),
    Polygon: createMockComponent('Polygon'),
    Polyline: createMockComponent('Polyline'),
    Ellipse: createMockComponent('Ellipse'),
    Mask: createMockComponent('Mask'),
    Pattern: createMockComponent('Pattern'),
    Image: createMockComponent('SvgImage'),
  };
});

jest.mock('@shopify/flash-list', () => ({
  FlashList: 'FlashList',
}));

jest.mock('zustand', () => {
  const actual = jest.requireActual('zustand');
  return {
    ...actual,
    create: (createState) => {
      const store = actual.create(createState);
      return store;
    },
  };
});

jest.mock('zustand/react/shallow', () => ({
  useShallow: (selector) => selector,
}));

jest.mock('react-native-image-colors', () => ({
  getColors: jest.fn().mockResolvedValue({
    dominant: '#000000',
    vibrant: '#000000',
    darkVibrant: '#000000',
    lightVibrant: '#000000',
    darkMuted: '#000000',
    lightMuted: '#000000',
    muted: '#000000',
    platform: 'ios',
  }),
}));

jest.mock('@react-native-masked-view/masked-view', () => 'MaskedView');

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn().mockResolvedValue({
    isConnected: true,
    isInternetReachable: true,
    type: 'wifi',
  }),
}));

// =============================================================================
// App-Specific Mocks
// =============================================================================

// Mock the haptics module
jest.mock('@/core/native/haptics', () => ({
  haptics: {
    impact: jest.fn(),
    selection: jest.fn(),
    notification: jest.fn(),
  },
}));

// Mock cover URL hook
jest.mock('@/core/cache', () => ({
  useCoverUrl: jest.fn(() => 'https://example.com/cover.jpg'),
  coverCache: {
    getCoverUrl: jest.fn(() => 'https://example.com/cover.jpg'),
    clearCache: jest.fn(),
  },
}));

// =============================================================================
// Global Test Utilities
// =============================================================================

// Silence specific console warnings during tests
const originalWarn = console.warn;
console.warn = (...args) => {
  // Filter out known React Native warnings in tests
  const message = args[0];
  if (typeof message === 'string') {
    if (message.includes('Animated: `useNativeDriver`')) return;
    if (message.includes('componentWillReceiveProps')) return;
    if (message.includes('componentWillMount')) return;
  }
  originalWarn(...args);
};

// Global test helpers
global.mockNavigate = mockNavigation.navigate;
global.mockGoBack = mockNavigation.goBack;
