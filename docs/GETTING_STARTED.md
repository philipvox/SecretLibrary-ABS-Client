# Getting Started

This guide covers everything you need to set up and run the AudiobookShelf mobile app for development.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Running the App](#running-the-app)
- [Development Workflow](#development-workflow)
- [Project Configuration](#project-configuration)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Software

| Software | Version | Purpose |
|----------|---------|---------|
| Node.js | 18.x or later | JavaScript runtime |
| npm | 9.x or later | Package manager |
| Watchman | Latest | File watching (macOS) |
| Xcode | 14+ | iOS development (macOS only) |
| Android Studio | Latest | Android development |

### Optional Tools

| Tool | Purpose |
|------|---------|
| Expo Go | Quick testing on physical devices |
| VS Code | Recommended IDE with React Native extensions |
| React Native Debugger | Advanced debugging |

### AudiobookShelf Server

You need access to an AudiobookShelf server instance. Options:

1. **Self-hosted**: Run your own server (see [AudiobookShelf docs](https://www.audiobookshelf.org/docs))
2. **Local development**: Run a local server on your network
3. **Remote server**: Use an existing server URL

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/audiobookshelf-app.git
cd audiobookshelf-app
```

### 2. Install Dependencies

```bash
npm install
```

This installs all required packages including:
- React Native and Expo
- Navigation libraries
- State management (Zustand, TanStack Query)
- Audio playback libraries
- UI components

### 3. iOS Setup (macOS only)

```bash
# Install CocoaPods dependencies
cd ios
pod install
cd ..
```

### 4. Android Setup

Ensure you have:
- Android Studio installed
- Android SDK configured
- An emulator set up or device connected

## Running the App

### Development Server

```bash
# Start Expo development server
npm start
```

This opens the Expo developer tools in your terminal with options to:
- Press `i` for iOS simulator
- Press `a` for Android emulator
- Scan QR code with Expo Go app

### Platform-Specific Commands

```bash
# iOS Simulator
npm run ios

# Android Emulator
npm run android

# Clear cache and restart
npm run clean
```

### Using Expo Go

1. Install Expo Go on your mobile device
2. Run `npm start` in the project directory
3. Scan the QR code with:
   - iOS: Camera app
   - Android: Expo Go app

### Development Build

For features requiring native modules (like react-native-track-player):

```bash
# Create a development build
npx expo run:ios
# or
npx expo run:android
```

## Development Workflow

### File Structure

When adding new features, follow this structure:

```
src/features/your-feature/
├── components/          # UI components
│   └── FeatureCard.tsx
├── hooks/               # Data fetching hooks
│   └── useFeatureData.ts
├── screens/             # Screen components
│   └── FeatureScreen.tsx
├── services/            # Business logic
│   └── featureService.ts
├── stores/              # Zustand stores (if needed)
│   └── featureStore.ts
├── types.ts             # TypeScript types
└── index.ts             # Public exports
```

### Adding a New Screen

1. Create the screen component in `features/your-feature/screens/`
2. Add navigation types in `navigation/types.ts`
3. Register the screen in `navigation/AppNavigator.tsx`
4. Export from the feature's `index.ts`

### Adding a New API Endpoint

1. Add the endpoint URL in `core/api/endpoints.ts`
2. Add the method in `core/api/apiClient.ts`
3. Create a hook in your feature's `hooks/` directory

### Hot Reloading

The development server supports hot reloading:
- **Fast Refresh**: Preserves component state during edits
- **Full Reload**: Shake device or press `r` in terminal

## Project Configuration

### Environment Variables

Create a `.env` file for local configuration (not committed to git):

```env
# Optional: Default server URL for development
DEFAULT_SERVER_URL=https://your-server.com
```

### TypeScript Configuration

The project uses strict TypeScript. Configuration is in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "strict": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### Path Aliases

Use `@/` to import from the `src` directory:

```typescript
// Instead of
import { Button } from '../../../shared/components';

// Use
import { Button } from '@/shared/components';
```

### ESLint Configuration

Linting rules are in `.eslintrc.js`. Run linting:

```bash
npm run lint
```

### Prettier Configuration

Code formatting rules are in `.prettierrc`:

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5"
}
```

## Troubleshooting

### Common Issues

#### Metro Bundler Cache

If you see stale code or strange errors:

```bash
npm run clean
# or
npx expo start --clear
```

#### iOS Simulator Not Starting

```bash
# Reset iOS simulator
xcrun simctl shutdown all
xcrun simctl erase all
```

#### Android Build Failures

```bash
# Clean Android build
cd android
./gradlew clean
cd ..
```

#### Node Modules Issues

```bash
# Remove and reinstall
rm -rf node_modules
rm package-lock.json
npm install
```

#### Pod Install Failures (iOS)

```bash
cd ios
rm -rf Pods
rm Podfile.lock
pod install
cd ..
```

### Debugging

#### React Native Debugger

1. Install React Native Debugger
2. Start the debugger before the app
3. Enable debugging in the app (shake device, select "Debug")

#### Console Logging

```typescript
// Use __DEV__ to log only in development
if (__DEV__) {
  console.log('Debug info:', data);
}
```

#### Network Debugging

Use Flipper or React Native Debugger to inspect:
- API requests and responses
- AsyncStorage contents
- React component tree

### Performance Issues

If the app feels slow:

1. Check for unnecessary re-renders with React DevTools
2. Ensure lists use `FlashList` or `FlatList` with proper `keyExtractor`
3. Verify images are properly sized and cached
4. Check for memory leaks in useEffect cleanup

### Build Issues

#### EAS Build Failures

```bash
# Check EAS configuration
eas build:configure

# View build logs
eas build:list
```

#### Native Module Issues

Some features require a development build:

```bash
npx expo prebuild
npx expo run:ios
```

## Next Steps

- Read the [Architecture](architecture.md) documentation
- Explore the [Component Library](COMPONENTS.md)
- Understand [State Management](STATE_MANAGEMENT.md) patterns
- Check the [API Reference](api.md)
