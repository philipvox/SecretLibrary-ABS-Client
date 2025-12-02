# AudiobookShelf Mobile App

A React Native mobile client for AudiobookShelf with enhanced features including offline playback, smart search, and improved UI for series, authors, and narrators.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Documentation](#documentation)
- [Development](#development)
- [Building](#building)
- [Contributing](#contributing)
- [License](#license)

## Features

### Core Functionality
- Browse your AudiobookShelf library with grid/list views
- Audio playback with background support and lock screen controls
- Download books for offline listening
- Sync playback progress across devices
- Secure authentication with token management

### Library Management
- Series browsing with sequence ordering
- Author pages with biography and book listings
- Narrator pages extracted from metadata
- Collections and playlists support
- Filter and sort by multiple criteria

### Player Features
- Chapter navigation with visual timeline
- Sleep timer with multiple presets
- Playback speed control (0.5x - 3x)
- Skip forward/backward with customizable intervals
- Mini player with quick controls
- Full-screen player with cover art

### Offline Support
- Download entire audiobooks for offline listening
- Automatic progress sync when back online
- Download queue management
- Storage usage tracking

### Search
- Fuzzy search across titles, authors, narrators, and descriptions
- Search within series and collections
- Recent search history

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | React Native + Expo SDK 54 |
| Language | TypeScript (strict mode) |
| Navigation | React Navigation v7 |
| Server State | TanStack Query v5 |
| Client State | Zustand v5 |
| Local Storage | Expo SQLite + AsyncStorage |
| Audio | expo-av / react-native-track-player |
| Networking | Axios |
| Search | Fuse.js |

## Getting Started

### Prerequisites

- Node.js 18 or later
- npm or yarn
- Expo Go app (for development) or development build
- An AudiobookShelf server instance

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/audiobookshelf-app.git
cd audiobookshelf-app

# Install dependencies
npm install

# Start the development server
npm start
```

### Running the App

```bash
# Start Expo development server
npm start

# Run on iOS simulator
npm run ios

# Run on Android emulator
npm run android

# Clear cache and restart
npm run clean
```

### First Launch

1. Open the app on your device or simulator
2. Enter your AudiobookShelf server URL (e.g., https://abs.example.com)
3. Enter your username and password
4. Select your default library

## Project Structure

```
src/
├── config/                 # App configuration
│   ├── constants.ts        # API URLs, timeouts, limits
│   └── features.ts         # Feature flags
│
├── core/                   # Foundation layer
│   ├── api/                # HTTP client and endpoints
│   │   ├── baseClient.ts   # Axios configuration
│   │   ├── apiClient.ts    # API methods
│   │   ├── endpoints.ts    # URL definitions
│   │   ├── errors.ts       # Custom error classes
│   │   ├── middleware.ts   # Request/response hooks
│   │   └── endpoints/      # Domain-specific APIs
│   ├── auth/               # Authentication
│   ├── services/           # Core services
│   │   ├── sqliteCache.ts  # SQLite database
│   │   ├── syncQueue.ts    # Offline sync queue
│   │   └── downloadManager.ts
│   ├── hooks/              # Core hooks
│   │   ├── useDownloads.ts
│   │   └── useSyncStatus.ts
│   ├── types/              # TypeScript definitions
│   └── queryClient.ts      # React Query configuration
│
├── features/               # Feature modules
│   ├── author/             # Author pages
│   ├── book-detail/        # Book detail screen
│   ├── browse/             # Browse tab
│   ├── collections/        # Collections feature
│   ├── downloads/          # Download management
│   ├── library/            # Library browsing
│   ├── narrator/           # Narrator pages
│   ├── player/             # Audio player
│   ├── profile/            # User profile
│   ├── recommendations/    # Book recommendations
│   ├── search/             # Search feature
│   ├── series/             # Series pages
│   └── user/               # User features (favorites, etc.)
│
├── navigation/             # App navigation
│   ├── AppNavigator.tsx    # Root navigator
│   ├── types.ts            # Navigation types
│   └── components/         # Nav components
│
└── shared/                 # Shared utilities
    ├── components/         # Reusable UI components
    │   ├── buttons/        # Button, IconButton
    │   ├── cards/          # Card, GlassCard
    │   ├── inputs/         # TextInput, SearchInput
    │   └── feedback/       # Loading, Error, Empty states
    ├── hooks/              # Shared hooks
    ├── theme/              # Design tokens
    └── utils/              # Utility functions
```

## Documentation

| Document | Description |
|----------|-------------|
| [Getting Started](docs/GETTING_STARTED.md) | Setup and development guide |
| [Architecture](docs/architecture.md) | Project structure and design patterns |
| [API Reference](docs/api.md) | AudiobookShelf API documentation |
| [Components](docs/COMPONENTS.md) | Shared component library |
| [State Management](docs/STATE_MANAGEMENT.md) | State management patterns |
| [Progress](docs/progress.md) | Development progress tracking |

## Development

### Available Scripts

```bash
npm start              # Start Expo dev server
npm run ios            # Run on iOS
npm run android        # Run on Android
npm run clean          # Clear cache and restart
npm run lint           # Run ESLint
npm run typecheck      # Run TypeScript compiler
npm run bundle:analyze # Analyze bundle size
```

### Code Quality

```bash
# Type checking
npm run typecheck

# Linting
npm run lint

# Format code (if configured)
npm run format
```

### Development Guidelines

- Maximum 400 lines per file
- Features should be self-contained modules
- Use TypeScript strict mode
- Export via index.ts barrel files
- Follow the component hierarchy (Screen > Feature > UI)

## Building

### Development Build

```bash
# Build for all platforms
npm run build:dev

# Build preview (internal testing)
npm run build:preview
```

### Production Build

```bash
# iOS production build
npm run build:ios

# Android production build
npm run build:android

# Both platforms
npm run build:all
```

### EAS Build Configuration

The project uses Expo Application Services (EAS) for builds. Configuration is in `eas.json`:

- `development`: Development client with debugging
- `preview`: Internal testing builds
- `production`: App store builds

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes following the coding guidelines
4. Commit your changes (`git commit -m 'Add amazing feature'`)
5. Push to the branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

### Coding Standards

- Use TypeScript for all new code
- Follow existing patterns in the codebase
- Write self-documenting code with clear naming
- Keep components focused and single-purpose
- Test on both iOS and Android

## License

MIT License - see LICENSE file for details.

## Acknowledgments

- [AudiobookShelf](https://www.audiobookshelf.org/) - The server platform
- [Expo](https://expo.dev/) - React Native development framework
- [React Navigation](https://reactnavigation.org/) - Navigation library
- [TanStack Query](https://tanstack.com/query) - Data fetching library
