# AudiobookShelf Mobile App

A native mobile wrapper for AudiobookShelf with enhanced features including fuzzy search, intelligent recommendations, and improved UI for series, authors, and narrators.

## Features

### Core Functionality
- 📚 Browse your AudiobookShelf library
- 🎧 Audio playback with background support
- 📥 Download books for offline listening
- 🔄 Sync progress across devices
- 🔐 Secure authentication

### Enhanced Features
- 🔍 **Smart Search**: Fuzzy search across titles, authors, narrators, genres, and descriptions
- 🎯 **Recommendations**: Personalized suggestions based on your listening history
- 📖 **Enhanced Pages**: Beautiful series, author, and narrator pages with rich information
- 📋 **Smart Playlists**: Create and manage custom playlists and collections
- ⚡ **Fast & Smooth**: Native performance with offline support

## Tech Stack

- **Framework**: React Native + Expo
- **Language**: TypeScript
- **State**: Zustand + TanStack Query
- **Navigation**: React Navigation
- **Storage**: Expo SQLite
- **Search**: Fuse.js
- **Audio**: Expo AV

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Expo Go app on your mobile device (for development)

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

### Configuration

1. Open the Expo Go app on your device
2. Scan the QR code from the terminal
3. On first launch, enter your AudiobookShelf server URL and credentials

## Development

### Project Structure

See [Architecture Documentation](docs/architecture.md) for detailed information.
```
src/
├── core/          # Foundation (API, auth, storage)
├── features/      # Feature modules (library, search, player, etc.)
├── shared/        # Shared components and utilities
└── navigation/    # App navigation
```

### Development Guidelines

- Keep files under 400 lines
- Features should be self-contained
- Use TypeScript for everything
- Follow the patterns in `docs/claude-instructions.md`

### Available Scripts
```bash
npm start          # Start Expo development server
npm run tsc        # Type check
npm run lint       # Lint code
npm run format     # Format code with Prettier
```

## Documentation

- [Architecture](docs/architecture.md) - Project structure and design
- [Current Work](docs/current-work.md) - Development status and next steps
- [API Reference](docs/api-reference.md) - AudiobookShelf API documentation
- [Decisions](docs/decisions.md) - Architectural decision records
- [Claude Instructions](docs/claude-instructions.md) - Guidelines for AI-assisted development

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

## Roadmap

### Phase 1: Foundation (Current)
- [x] Project setup
- [ ] Core API client
- [ ] Authentication
- [ ] Basic navigation

### Phase 2: Core Features
- [ ] Library browsing
- [ ] Book details
- [ ] Audio player
- [ ] Progress syncing

### Phase 3: Enhanced Features
- [ ] Fuzzy search
- [ ] Recommendations
- [ ] Enhanced pages (series, author, narrator)
- [ ] Playlists and collections

### Phase 4: Polish
- [ ] Performance optimization
- [ ] Offline mode
- [ ] Settings and customization
- [ ] App store submission

## License

MIT

## Acknowledgments

- AudiobookShelf for the excellent server platform
- Expo team for the amazing development experience
- React Native community

## Support

For issues and questions:
- Create an issue in this repository
- Check AudiobookShelf documentation
- Join the AudiobookShelf Discord
