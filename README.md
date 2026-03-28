<p align="center">
  <img src="builds/play-store-assets/app-icon.png" width="120" alt="Secret Library">
</p>

<h1 align="center">Secret Library</h1>

<p align="center">
  An audiobook player for <a href="https://www.audiobookshelf.org/">AudiobookShelf</a>.<br>
  iOS &middot; Android &middot; CarPlay &middot; Android Auto
</p>

<p align="center">
  <a href="https://testflight.apple.com/join/ah2XdVu6">iOS TestFlight</a> &middot;
  <a href="https://mysecretlibrary.com/downloads/secret-library.apk">Android APK</a> &middot;
  <a href="https://mysecretlibrary.com">Website</a> &middot;
  <a href="https://mysecretlibrary.com/docs.html">Docs</a>
</p>

---

## What Is This?

Secret Library is a mobile client for [AudiobookShelf](https://www.audiobookshelf.org/) — the open-source, self-hosted audiobook server. It connects to your ABS server and plays your books. Your data stays on your server. No analytics, no tracking, no third-party anything.

This was vibe coded. I'm not a professional developer — I built this with AI assistance. But it's not a one-shot prompt. This is build 1,262, iterated over months of daily use. Every feature was planned, tested, broken, and fixed.

It's opinionated. Some things are designed for how I listen, not for mass appeal. If that bothers you, fork it and make it yours.

## The Ecosystem

Secret Library is actually three things:

| Piece | What It Does |
|-------|-------------|
| **[Secret Library](https://mysecretlibrary.com)** (this repo) | Mobile audiobook player for iOS and Android |
| **[Audiobook Tagger](https://mysecretlibrary.com/tagger.html)** | Desktop tool that fixes metadata in bulk — clean genres, find covers, detect series, generate DNA tags |
| **[Secret Spines](https://spines.mysecretlibrary.com)** | Community spine image library — browse, upload, vote on book spine designs |

The app works fine on its own. The Tagger makes your library discoverable. The spines make your shelf look real.

## Screenshots

<p align="center">
  <img src="builds/play-store-assets/screenshot-home.png" width="200" alt="Home">
  <img src="builds/play-store-assets/screenshot-library-spines.png" width="200" alt="Library Spines">
  <img src="builds/play-store-assets/screenshot-player.png" width="200" alt="Player">
  <img src="builds/play-store-assets/screenshot-book-detail.png" width="200" alt="Book Detail">
</p>
<p align="center">
  <img src="builds/play-store-assets/screenshot-browse.png" width="200" alt="Browse">
  <img src="builds/play-store-assets/screenshot-search.png" width="200" alt="Search">
  <img src="builds/play-store-assets/screenshot-series.png" width="200" alt="Series">
  <img src="builds/play-store-assets/screenshot-mood-1.png" width="200" alt="Mood Browse">
</p>

## Features

### Playback
- Background audio with lock screen controls
- Per-book playback speed (0.5x–3.0x), remembered across sessions
- Chapter navigation with visual timeline
- Smart rewind — longer pause means more rewind on resume
- Sleep timer with shake-to-extend and gradual fade out
- Bookmarks with notes
- Playback queue with drag-to-reorder

### Library
- Book spines on a virtual shelf (the signature view)
- Grid, list, and shelf view modes
- Series browsing with reading order and gap detection
- Author and narrator detail pages
- Genre and collection browsing
- Mood-based discovery ("What's the Vibe")
- Recommendations powered by DNA tags
- Fuzzy search across titles, authors, narrators, descriptions

### Offline
- Download books for offline listening
- Background downloads with queue management
- Progress syncs automatically when back online
- Works in airplane mode, tunnels, dead zones

### Car
- CarPlay support (iOS)
- Android Auto with full media browser
- Browse library, resume playback, skip chapters — hands-free

### Extras
- Chromecast support
- Community spine selection per book
- Star ratings (double-tap covers)
- Curated "My Library" playlist
- Series and author favorites
- Listening statistics
- In-app bug reporting

## DNA Tags

The Audiobook Tagger generates rich metadata called DNA tags — mood, pacing, themes, tropes, comparable titles. The app reads these and uses them to power:

- **Browse by vibe** — mood chips like "Dark & Atmospheric" or "Laugh Out Loud"
- **"Because you listened to..."** — recommendations based on what you've finished
- **Discover tab** — genre sections, collections, mood-based filtering
- **Top picks** — personalized suggestions based on your taste profile

Without the Tagger the app works fine as a player. With it, your library becomes something you can explore.

## Getting Started

### Prerequisites

- An [AudiobookShelf](https://www.audiobookshelf.org/) server
- Node.js 20+
- npm

### Install

```bash
git clone https://github.com/philipvox/audiobookshelf-app.git
cd audiobookshelf-app
npm install
```

### Run

```bash
npm start              # Start Expo dev server
npm run ios            # Run on iOS simulator
npm run android        # Run on Android emulator
npx expo run:ios       # Native iOS build
npx expo run:android   # Native Android build
```

### Build

```bash
npm run build:android   # EAS production build (Android)
npm run build:ios       # EAS production build (iOS)
npm run build:all       # Both platforms
npm run build:preview   # Internal testing builds
```

Builds use [EAS](https://expo.dev/eas) with three profiles in `eas.json`: `development`, `preview`, and `production`.

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | React Native 0.81 + Expo SDK 54 |
| Language | TypeScript (strict) |
| Navigation | React Navigation v7 |
| Server State | TanStack Query v5 |
| Client State | Zustand v5 |
| Storage | Expo SQLite + AsyncStorage + SecureStore |
| Audio (iOS) | expo-av |
| Audio (Android) | ExoPlayer (Media3) via custom plugin |
| Networking | Axios + Socket.IO |
| Search | Fuse.js |
| Casting | Chromecast + react-native-carplay |

## Project Structure

```
src/
├── constants/          # Version, layout constants
├── core/               # Foundation layer
│   ├── api/            # HTTP client, endpoints, playback API
│   ├── auth/           # Authentication context + service
│   ├── cache/          # Library cache, search index, spine URLs
│   ├── hooks/          # Core hooks (downloads, bootstrap)
│   ├── services/       # SQLite, downloads, sync, websocket
│   └── types/          # TypeScript definitions
│
├── features/           # Feature modules
│   ├── player/         # Audio playback (stores, services, utils)
│   ├── queue/          # Playback queue
│   ├── home/           # Home screen + spine rendering
│   ├── library/        # My Library tab
│   ├── browse/         # Browse/discover tab
│   ├── search/         # Search
│   ├── book-detail/    # Book detail screen
│   ├── series/         # Series detail
│   ├── author/         # Author detail
│   ├── narrator/       # Narrator detail
│   ├── collections/    # Collections
│   ├── downloads/      # Download management
│   ├── profile/        # Settings + profile
│   ├── stats/          # Listening statistics
│   ├── chromecast/     # Chromecast casting
│   ├── automotive/     # CarPlay + Android Auto bridge
│   ├── recommendations/# Discovery + recommendations
│   ├── completion/     # Book completion tracking
│   └── playlists/      # Playlist management
│
├── navigation/         # React Navigation setup
│   ├── AppNavigator.tsx
│   └── components/     # MiniPlayer, global overlays
│
└── shared/             # Reusable code
    ├── components/     # ~30 UI components
    ├── hooks/          # Shared hooks
    ├── stores/         # Shared Zustand stores
    ├── theme/          # Design tokens (colors, spacing, typography)
    ├── spine/          # Spine rendering utilities
    └── utils/          # Format, search, book DNA utilities

plugins/                # Native Expo config plugins
├── android-auto/       # Android Auto media browser service
├── exo-player/         # ExoPlayer audio engine (Android)
├── chromecast/         # Chromecast sender (iOS + Android)
└── carplay/            # CarPlay support
```

Features are self-contained modules. They don't import from each other — shared code goes in `src/shared/`.

## Hidden Interactions

Some things aren't obvious by design:

| Action | What Happens |
|--------|-------------|
| Long-press the skull logo | Opens settings |
| Double-tap a book cover | Adds/removes a gold star |
| Swipe left/right on book detail | Browse series |
| Book menu > spine icon | Pick a community spine |

## Documentation

- **[Website](https://mysecretlibrary.com)** — Overview, downloads, the story
- **[Docs](https://mysecretlibrary.com/docs.html)** — Full app + tagger documentation
- **[Onboarding Guide](docs/ONBOARDING_GUIDE.md)** — Complete guide for new users (from zero to listening)
- **[Changelog](CHANGELOG.md)** — Every version documented
- **[Report a Bug](https://mysecretlibrary.com/bugs.html)** — Bug reports + feature requests

## Privacy

No data collection. No analytics. No tracking. The app talks directly to your AudiobookShelf server and nothing else. Full policy at [mysecretlibrary.com/privacy.html](https://mysecretlibrary.com/privacy.html).

## Acknowledgments

- [AudiobookShelf](https://www.audiobookshelf.org/) — The server that makes all of this possible
- [Expo](https://expo.dev/) — React Native framework
- [Claude](https://claude.ai/) — AI assistance throughout development
