# Settings Pages — UX Research & Implementation Specification

**App:** Secret Library (AudiobookShelf React Native Client)
**Date:** 2026-03-15
**Status:** Research & gap analysis (no code changes)

---

## Table of Contents

1. [Research Findings](#1-research-findings)
2. [Competitor Patterns](#2-competitor-patterns)
3. [Current State Analysis](#3-current-state-analysis)
4. [Research-Backed Recommendations](#4-research-backed-recommendations)
5. [Implementation Specs](#5-implementation-specs)
6. [Effort Estimates](#6-effort-estimates)

---

## 1. Research Findings

### 1.1 The "Less Than 5%" Rule

Jared Spool's foundational research found:

> "Less than 5% of the users we surveyed had changed any settings at all" — surveying hundreds of Microsoft Word users across 150+ settings.

When interviewed, users explained: *"Microsoft must know what they are doing."* The ironic finding: Word's autosave shipped disabled because a programmer initialized the config file with zeros as a placeholder, and nobody ever changed it.

Key exception: **"Programmers and designers altered 40-80% of available options"** — technical users are not representative.

**Applied:** Defaults matter more than the number of settings. Invest in choosing perfect defaults. The app's current defaults (1.0x speed, 30s forward skip, 15s back skip, haptics on) are solid industry-standard choices.

Source: [Do Users Change Their Settings? — UIE/Spool](https://archive.uie.com/brainsparks/2011/09/14/do-users-change-their-settings/)

### 1.2 Progressive Disclosure in Settings

From [NNGroup's Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/):

> "Resolves the tension between user desires for both power and simplicity by showing only essential options initially."

Two critical requirements:
1. The split between initial and secondary features — disclose what users frequently need upfront
2. Make the progression mechanics obvious with clear labeling

NNGroup warns: **"Avoid exceeding two disclosure levels; beyond that, usability typically declines."**

**Applied:** The current structure (ProfileScreen → sub-screens) is correctly two levels. But some sub-screens (DataStorageSettings) themselves have nested modals and flows, effectively creating a third level.

### 1.3 Toggle Switch Guidelines

From [NNGroup's Toggle Switch Guidelines](https://www.nngroup.com/articles/toggle-switch-guidelines/):

> Toggles must "deliver immediate results — no Save or Submit buttons."

Rules:
- Only for **two opposing states** (on/off)
- Labels should be **short, direct, and positive** (describe the "on" state)
- Avoid "neutral, ambiguous, or question-based language"
- **Consistency**: If you use toggles in one settings section, use them in all equivalent sections
- Test: "Say the label aloud with 'on/off' appended" to check clarity

**Applied:** Current toggle usage is mostly correct. "Shake to Extend" → on/off works. "Smart Rewind" → on/off works. But chapter cleaning "level" (Off/Light/Standard/Aggressive) should NOT be a toggle — it's multi-option and correctly uses radio buttons.

### 1.4 Smart Defaults

From [NNGroup's The Power of Defaults](https://www.nngroup.com/articles/the-power-of-defaults/):

> Users exhibit "a strong bias in favor of" accepting defaults without extensive evaluation.

Guidelines for defaults:
- Pre-populate with the **most statistically common value**
- Defaults should be **"neutral and pose minimal risk"**
- **"Minimize battery/mobile data consumption"**
- **"Only interrupt when important"**

### 1.5 Contextual Settings vs. Global Settings

The research consensus across all competitors (Kindle, Pocket Casts, Overcast, Apple Books):

- **Contextual settings** (in-player): Frequently changed, content-dependent preferences (speed, sleep timer, chapter nav)
- **Global settings page**: Rarely changed, system-level preferences (skip intervals, haptics, downloads, account)
- **Global + per-content override**: The gold standard for media apps

From [Apple HIG — Settings](https://developer.apple.com/design/human-interface-guidelines/settings):

> "The Settings app is a central location for making configuration changes throughout the system, but people must leave your app to get there. It's far more convenient to adjust settings directly within your app."

**Applied:** The app correctly puts speed and sleep timer in the player (contextual). Skip intervals live in global settings (correct — rarely changed). Per-book speed memory (`bookSpeedMap`) follows the override pattern perfectly.

### 1.6 Material Design Settings Guidelines

From [Android Settings Design Guide](https://developer.android.com/design/ui/mobile/guides/patterns/settings):

**When to include a setting:**
- Settings "should capture user preferences that either affect most users or provide critical support to a minority"

**When NOT to include:**
- Frequently accessed actions (use toolbar/contextual instead)
- App information (use Help screens)
- Account management (place in main app flow)

**Organization:**
- "Display important or frequently-used settings prominently at the top"
- "Group related settings into subscreens" when you have 15+ settings
- Use a single label: "Settings" — do not use synonyms like "Options" or "Preferences"
- "Use divider lines to cluster related settings; apply section titles (avoiding vague labels like 'Other')"

**Labeling:**
- "Start with the most important text"
- "Use neutral terms ('Block' not 'Don't allow')"
- Show **current setting state** in secondary text rather than explaining functionality
- Do NOT use: "Set, Change, Edit, Modify, Manage, Use, Select, Choose"

### 1.7 Choice Overload in Settings

> "When users encounter too many options, they typically spend 47% more time on simple tasks and are 30% more likely to leave the app without completing their intended action."

> "Two-thirds of smartphone owners never change their notification settings, usually defaulted to 'on'."

Source: [Choice Paralysis — Glance](https://thisisglance.com/blog/choice-paralysis-when-too-many-options-kill-your-apps-success)

---

## 2. Competitor Patterns

### 2.1 Competitor Settings Organization

| Category | Audible | Spotify | Pocket Casts | Overcast | Apple Books | **Your App** |
|----------|---------|---------|-------------|----------|-------------|-------------|
| **Top-level items** | 7 | 11+ | 5 | 6 | 3 (system) | **5** |
| Playback | Yes | Yes | Yes | Yes | Yes (contextual) | **Yes** |
| Downloads/Storage | Yes | Yes (split) | Yes | Yes | No | **Yes** |
| Appearance/Display | No | No | Yes | No | No | **Yes** |
| Notifications | Yes | Yes | Yes | Yes | No | **No** |
| Audio Quality | Yes (3 tiers) | Yes (5 tiers) | No | No | No | **No** |
| Haptics | No | No | No | Minimal | No | **Yes (8 categories!)** |
| Per-content settings | No | No | **Yes** | **Yes** | Speed only | **Speed only** |
| Sleep Timer Config | In player | In player | In player | In player | In player | **In player** |
| Account/Server | Yes | Yes | Yes | No | System | **In profile header** |

### 2.2 Pocket Casts — The Gold Standard

Pocket Casts is consistently cited as having the best settings UX in the audio space. Its key pattern:

**"Custom for this podcast" toggle:** When off, the podcast inherits global defaults. When on, a full set of overridable options appears:
- Playback speed
- Trim Silence level
- Volume Boost
- Skip intro/outro (custom seconds)
- Auto-download behavior
- Notification preference
- Episode sort order

> "No podcasts are the same. The way you listen to them shouldn't have to be 'one-size fits all'."

**Applied:** Your app already has `bookSpeedMap` (per-book speed). The Pocket Casts pattern suggests expanding this to a full "Custom for this book" model.

### 2.3 Overcast — Smart Audio Processing

Overcast's differentiating features:
- **Smart Speed**: Dynamically shortens silences (varies per moment, not constant)
- **Smart Resume**: Rewinds slightly after pausing; adjusts seeks to fall between words
- **Voice Boost**: Broadcast-quality volume normalization

> "Smart Resume rewinds slightly after pausing and even slightly adjusts seeks to fall between words."

**Applied:** Your app has Smart Rewind (auto-rewind after pause, configurable max). Overcast's graduated version (longer pause = longer rewind) is a potential enhancement.

### 2.4 Audible Settings

**Sleep Timer:** 10, 15, 30, 45, 60, 90 minutes + "End of Chapter" + custom slider (up to 24 hours). "Shake to Extend" on iOS adds time when shaken within 30 seconds of expiry.

**Download Quality:** Standard / High / Maximum — three tiers. Wi-Fi-only toggle.

**Power user complaints:** No per-book speed memory, no custom skip intervals, limited audio processing, no volume normalization across titles.

**Applied:** Your app already exceeds Audible in per-book speed memory and custom skip intervals. The download quality gap is notable.

### 2.5 Sleep Timer Patterns (Cross-App)

| App | Presets | Custom | End of Chapter | Shake to Extend | Timer Memory |
|-----|---------|--------|----------------|-----------------|-------------|
| Audible | 10-90 min | Slider (24h) | Yes | Yes (iOS) | No |
| Libby | Preset + fine-tune slider | Yes (5-120 min) | Yes | No | **Yes** |
| Apple Books | Multiple | No | Yes | No | No |
| Pocket Casts | Multiple | Yes | Yes | No | No |
| Overcast | Multiple | Yes | No | No | No |
| **Your App** | Multiple | Yes | Yes | **Yes** | **No** |

**Missing industry pattern:** Libby remembers the last-used sleep timer duration. Users tend to reuse the same timer repeatedly — this is a small but appreciated convenience.

---

## 3. Current State Analysis

### 3.1 Profile Screen Architecture

```
ProfileScreen (5 links)
├── Playback Settings
│   ├── Default Speed (picker: 0.5x-3.0x)
│   ├── Skip Forward (picker: 10-60s)
│   ├── Skip Back (picker: 5-45s)
│   ├── Time Display (toggle: time left / time played)
│   ├── Sleep Timer — Shake to Extend (toggle)
│   ├── Bluetooth Auto-Resume (toggle)
│   ├── Smart Rewind (toggle + max seconds picker)
│   ├── Completion Prompt (toggle)
│   └── Auto-Mark Finished (toggle)
├── Haptics
│   ├── Master Toggle
│   └── 8 category toggles (playback, scrubbing, speed, sleep,
│       downloads, bookmarks, completions, UI)
├── Display Settings
│   ├── Edit View Settings → PlaylistSettingsScreen
│   ├── Server Spines (toggle)
│   ├── Hide Single-Book Series (toggle)
│   └── Chapter Cleaning → ChapterCleaningSettingsScreen
│       ├── Cleaning Level (radio: off/light/standard/aggressive)
│       └── Show Original Names (toggle)
├── Data & Storage
│   ├── Downloads section
│   │   ├── Download Only on WiFi (toggle)
│   │   └── View Downloaded Books → Downloads screen
│   ├── Cloud Sync section
│   │   ├── Sync Status (display)
│   │   ├── Sync Now (button)
│   │   ├── Enable/Disable Sync (toggle)
│   │   ├── Synced My Library (playlist picker modal)
│   │   └── Synced My Series (playlist picker modal)
│   └── Troubleshooting section
│       ├── Reload Library from Server (button)
│       ├── Refresh Spines (button)
│       ├── Reset from Server (button)
│       ├── Clear Temporary Files (button)
│       ├── Remove All Downloads (button)
│       └── Empty My Library (button)
└── About
    └── Version info
```

**Additional settings screens not on the main list (accessed from elsewhere):**

| Screen | Access Point | Purpose |
|--------|-------------|---------|
| JoystickSeekSettings | Player screen | Joystick seek speed curve, deadzone, haptics |
| StorageSettings | Legacy/alternate | Image cache, library cache (overlaps DataStorage) |
| AppearanceSettings | Legacy/alternate | Server spines, hide single series (duplicates Display) |
| HiddenItemsScreen | Browse/recommendations | Restore dismissed book recommendations |
| DeveloperSettings | 5-tap version text (__DEV__ only) | Reset cache prompt, spine playground, stress test |
| PlaylistSettings | Display Settings link | Reorder/toggle library views |

### 3.2 Store Inventory

| Store | Persistence | Settings Count | Has UI |
|-------|------------|----------------|--------|
| `playerStore` | Zustand (partial) | 7 | Yes (PlaybackSettings) |
| `playerSettingsStore` | AsyncStorage | 2 | Yes (PlaybackSettings) |
| `hapticSettingsStore` | AsyncStorage | 9 | Yes (HapticSettings) |
| `chapterCleaningStore` | AsyncStorage | 2 | Yes (ChapterCleaning) |
| `joystickSeekStore` | AsyncStorage | 7 | Yes (JoystickSeekSettings) |
| `contentFilterStore` | AsyncStorage | 6 | Yes (Browse TagFilterSheet) |
| `spineCache` (settings) | AsyncStorage | 3 | Partial (1 toggle in Display) |
| `myLibraryStore` (prefs) | AsyncStorage | 2 | Partial (1 toggle in Display) |
| `playlistSettingsStore` | AsyncStorage | 3 | Yes (PlaylistSettings) |
| `speedStore` | AsyncStorage | 1 | No (set via player) |
| `sleepTimerStore` | Zustand | 3 | Partial (1 toggle in Playback) |
| `preferencesStore` | AsyncStorage | 7 | No (set via onboarding wizard) |
| `networkMonitor` | AsyncStorage | 2 | Partial (1 toggle in DataStorage) |
| `librarySyncStore` | AsyncStorage | 3 | Yes (DataStorage) |
| `completionSheetStore` | AsyncStorage | 2 | Yes (PlaybackSettings) |
| `feelingChipStore` | Zustand (ephemeral) | 1 | No (contextual in Browse) |
| `dismissedItemsStore` | AsyncStorage | 1 | Yes (HiddenItems) |
| `imageCacheService` | AsyncStorage | 2 | Yes (StorageSettings only) |

**Total unique settings: ~78**
**Settings with UI: ~52**
**Settings with NO dedicated UI: ~26**

### 3.3 Strengths

| Strength | Research Backing |
|----------|-----------------|
| **Two-level hierarchy** (Profile → sub-screen) | NNGroup: "Avoid exceeding two disclosure levels" |
| **Toggles for binary settings** | NNGroup: toggles for "two opposing states" with immediate effect |
| **Contextual player settings** (speed, sleep in player) | Apple HIG: "far more convenient to adjust settings directly within your app" |
| **Per-book speed memory** | Pocket Casts/Overcast pattern — the gold standard |
| **Smart subtitle previews** ("1.25x · 30s/15s") | Material Design: "show current setting state rather than explain functionality" |
| **Granular haptic categories** (8 independent toggles) | Unique differentiator — no competitor offers this |
| **Joystick seek with curve presets** | Power user feature — no competitor has this |

### 3.4 Gaps Identified

#### A. Missing Settings That Competitors Have

These are settings every major audiobook/podcast competitor offers that this app does not have at all:

| Missing Setting | What It Does | Who Has It | Priority |
|----------------|-------------|-----------|----------|
| **Auto sleep timer** | Automatically start a sleep timer every time playback begins — no manual activation needed | [ABS GitHub issue #260](https://github.com/advplyr/audiobookshelf-app/issues/260); common community request | **High** |
| **Sleep timer memory** | Remember the last-used timer duration so users don't re-select every session | Libby remembers last-used timer | **High** |
| **Keep screen awake** | Prevent screen from dimming during playback (for bedside clock use, following along with physical book) | Pocket Casts, Overcast, most podcast apps | **High** |
| **Volume normalization / boost** | Normalize audio levels across different narrators and publishers — prevents jarring volume changes when switching books | Pocket Casts "Volume Boost", Overcast "Voice Boost" | **Medium** |
| **Trim silence** | Dynamically shorten pauses in narration without changing pitch — saves time without feeling rushed | Pocket Casts (off/mild/medium/max), Overcast "Smart Speed" | **Medium** |
| **Download quality / bitrate** | Choose between audio quality tiers (Standard/High/Maximum) to trade off storage space vs. fidelity | Audible (3 tiers), Spotify (5 tiers), Netflix (4 tiers) | **Medium** |
| **Notification preferences** | Control which notifications the app sends (download complete, new books added, playback reminders) | Audible, Spotify, Pocket Casts — every major competitor | **Medium** |
| **Per-book settings** (beyond speed) | Full "Custom for this book" override: sleep timer default, skip intervals, volume boost per title | Pocket Casts, Overcast — the gold standard pattern | **Low** (speed-only is fine for MVP) |
| **Graduated smart rewind** | Longer pause = longer auto-rewind (5 min pause → 5s rewind, 1 hour → 15s, 1 day → 30s) instead of fixed max | Overcast "Smart Resume" — most praised feature | **Low** |
| **Seek acceleration** | Repeated forward-skip taps go progressively faster (1st tap: 30s, 2nd: 60s, 3rd: 120s) | Overcast | **Low** |

#### B. Organizational Issues

| Issue | Research Evidence |
|-------|-------------------|
| **Duplicate/legacy screens** — StorageSettings and AppearanceSettings overlap with DataStorageSettings and DisplaySettings | Material Design: settings hierarchy should be clean; no duplicates |
| **JoystickSeek not linked from ProfileScreen** | Users must discover it from the player — fine for contextual access, but power users may want to find it in settings |
| **Image cache settings orphaned** on legacy StorageSettingsScreen | Users cannot manage image cache from the active DataStorage screen |
| **6 destructive actions** in DataStorage with no visual hierarchy | Material Design: group related settings; distinguish routine from destructive |

#### C. Design Consistency Issues

| Issue | Research Evidence |
|-------|-------------------|
| **No section grouping on ProfileScreen** — all 5 links in a flat list | Material Design: "Use divider lines to cluster related settings; apply section titles" |
| **Inconsistent picker patterns** — speed uses modal picker, skip intervals use modal picker, smart rewind max uses pill buttons | NNGroup: "Implement toggles consistently across the entire application" (applies to all controls) |
| **No search** across 78 settings | Material Design: "Add search functionality for deep hierarchies" |

#### D. Missing Per-Book Settings (Pocket Casts "Custom for this book" Pattern)

Currently only **speed** is per-book. Potential per-book settings:

| Per-Book Setting | Value | Current State |
|-----------------|-------|---------------|
| Playback speed | Number | **Yes** (`bookSpeedMap`) |
| Sleep timer default | Duration | No |
| Skip intervals | Forward/back seconds | No |
| Auto-bookmark on pause | Boolean | No |
| Volume boost | Boolean | No |

---

## 4. Research-Backed Recommendations

### 4.1 Consolidate Image Cache into DataStorageSettings

**Research:** Material Design warns against scattering settings across duplicate screens. Image cache management currently exists only on the orphaned `StorageSettingsScreen`.

**Therefore:** Move image cache controls (Cache All Images, Auto-Cache New Books, Clear Image Cache, cache size display) into DataStorageSettings under a new "Image Cache" section.

### 4.2 Add Sleep Timer Memory

**Research:** Libby remembers the last-used sleep timer duration. Users tend to reuse the same timer repeatedly (behavioral consistency pattern). NNGroup's defaults research: "Pre-populate with the most statistically common value."

**Therefore:** Add `lastSleepTimerDuration` to `sleepTimerStore` (persisted). When opening the sleep timer sheet, pre-select the last-used duration instead of always starting from scratch.

### 4.3 Add Keep Screen Awake Setting

**Research:** Pocket Casts, Overcast, and multiple podcast apps offer this. It's a frequently requested feature for audiobook apps — users who listen while following along with a physical book or who use the player as a bedside clock.

**Therefore:** Add "Keep Screen Awake During Playback" toggle to Playback Settings. Use `expo-keep-awake` API. Default: off (to preserve battery — Material Design: "Minimize battery consumption").

### 4.4 Group ProfileScreen Settings with Section Headers

**Research:** Material Design: "Use divider lines to cluster related settings; apply section titles." Current ProfileScreen has 5 flat links with no grouping.

**Therefore:** Group into two sections:

```
APP
  Playback Settings
  Display Settings
  Haptics

SYSTEM
  Data & Storage
  About
```

### 4.5 Add Joystick Seek Link to Playback Settings

**Research:** Material Design: "Display important or frequently-used settings prominently." NNGroup on findability: "users looking for a specific setting need to locate it quickly." Currently JoystickSeek is only accessible from the player screen.

**Therefore:** Add a "Joystick Seek" link at the bottom of PlaybackSettingsScreen (below Smart Rewind, with subtitle showing "On · Custom curve" or similar). This provides a second discovery path — the player remains the primary access point.

### 4.6 Remove Duplicate/Legacy Settings Screens

**Research:** Material Design: settings hierarchy should be clean with no duplicates. Having both `StorageSettingsScreen` and `DataStorageSettingsScreen`, or both `AppearanceSettingsScreen` and `DisplaySettingsScreen`, creates confusion.

**Therefore:**
- Merge `StorageSettingsScreen` image cache features into `DataStorageSettingsScreen`
- Remove `StorageSettingsScreen` and `AppearanceSettingsScreen` from navigation
- Ensure no dead links remain

### 4.7 Separate Destructive Actions Visually

**Research:** Material Design uses a "Danger Zone" pattern. NNGroup: progressive disclosure should prevent errors. Currently 6 destructive buttons (Reload, Refresh, Reset, Clear, Remove, Empty) sit in the same visual hierarchy as routine settings.

**Therefore:** Group destructive actions under a "Danger Zone" section header at the very bottom of DataStorageSettings with a different visual treatment (red text, extra spacing, confirmation dialogs — which already exist).

### 4.8 Standardize Control Patterns

**Research:** NNGroup: "Implement toggles consistently across the entire application. Inconsistency forces users to slow down and question functionality."

**Therefore:**
- **Binary on/off**: Toggle switch (already correct for most)
- **One-of-many discrete values**: Segmented control or radio (speed, skip intervals, cleaning level)
- **Range value**: Slider (joystick seek already does this)
- **Avoid**: Modal picker for small option sets (5-9 options) — segmented control or pill buttons are faster

Currently skip interval uses a modal picker for 5 options. Pill buttons (like Smart Rewind max uses) would be more consistent and require fewer taps.

---

## 5. Implementation Specs

### 5.1 Revised ProfileScreen Layout

```
┌──────────────────────────────────────────────────┐
│  💀 Settings                philip · server.org  │
│                                       [Log out]  │
├──────────────────────────────────────────────────┤
│                                                  │
│  APP                                             │
│  ┌──────────────────────────────────────────────┐│
│  │ ▶  Playback Settings           1.25x·30s/15s││
│  │ 🎨 Display Settings    Server spines·Standard││
│  │ 📳 Haptics                        On · 8 of 8││
│  └──────────────────────────────────────────────┘│
│                                                  │
│  SYSTEM                                          │
│  ┌──────────────────────────────────────────────┐│
│  │ 📁 Data & Storage       3 books · 1.2 GB     ││
│  │ ℹ  About                           v0.9.212  ││
│  └──────────────────────────────────────────────┘│
│                                                  │
│              💀                                   │
│     Secret Library · v0.9.212                    │
│                                                  │
└──────────────────────────────────────────────────┘
```

Changes from current:
- Added section headers ("APP" / "SYSTEM")
- No other structural changes

### 5.2 Revised PlaybackSettingsScreen

```
┌──────────────────────────────────────────────────┐
│  ← Playback Settings                            │
├──────────────────────────────────────────────────┤
│                                                  │
│  SPEED & NAVIGATION                              │
│  ┌──────────────────────────────────────────────┐│
│  │ Default Speed                          1.25x ││
│  │ Skip Forward                        30 secs  ││
│  │ Skip Back                           15 secs  ││
│  │ Time Display               Show time played  ││
│  └──────────────────────────────────────────────┘│
│                                                  │
│  SLEEP TIMER                                     │
│  ┌──────────────────────────────────────────────┐│
│  │ Shake to Extend                         [ON] ││
│  │   Adds 15 min when shaking near expiry       ││
│  │ Fade on Expiry                          [ON] ││ ← NEW
│  │   Gradually lower volume before stopping     ││
│  └──────────────────────────────────────────────┘│
│                                                  │
│  SMART FEATURES                                  │
│  ┌──────────────────────────────────────────────┐│
│  │ Bluetooth Auto-Resume                   [OFF]││
│  │ Smart Rewind                            [ON] ││
│  │   Max rewind   [15] [30] [45] [60] [90]     ││
│  │ Keep Screen Awake                       [OFF]││ ← NEW
│  │   Prevent sleep during playback              ││
│  └──────────────────────────────────────────────┘│
│                                                  │
│  COMPLETION                                      │
│  ┌──────────────────────────────────────────────┐│
│  │ Completion Prompt                       [ON] ││
│  │ Auto-Mark Finished                      [OFF]││
│  └──────────────────────────────────────────────┘│
│                                                  │
│  ADVANCED                                        │
│  ┌──────────────────────────────────────────────┐│
│  │ Joystick Seek            On · Custom curve › ││ ← NEW link
│  └──────────────────────────────────────────────┘│
│                                                  │
└──────────────────────────────────────────────────┘
```

Changes:
- Added section grouping headers
- Added "Fade on Expiry" toggle (already in `sleepTimerStore` as `fadeOnExpiry` but no UI)
- Added "Keep Screen Awake" toggle (new)
- Added "Joystick Seek" navigation link (new discovery path)

### 5.3 Revised DataStorageSettingsScreen

```
┌──────────────────────────────────────────────────┐
│  ← Data & Storage                                │
├──────────────────────────────────────────────────┤
│                                                  │
│  DOWNLOADS                                       │
│  ┌──────────────────────────────────────────────┐│
│  │ Downloaded Books              3 books · 1.2GB││
│  │ Download Only on WiFi                   [OFF]││
│  └──────────────────────────────────────────────┘│
│                                                  │
│  IMAGE CACHE                                     │ ← NEW section (from StorageSettings)
│  ┌──────────────────────────────────────────────┐│
│  │ Cache Status                      148 MB used││
│  │ Auto-Cache New Books                    [ON] ││
│  │ Cache All Images                     [button]││
│  │ Clear Image Cache                    [button]││
│  └──────────────────────────────────────────────┘│
│                                                  │
│  CLOUD SYNC                                      │
│  ┌──────────────────────────────────────────────┐│
│  │ Cloud Sync                              [ON] ││
│  │   Last synced: 2 min ago                     ││
│  │ Sync Now                             [button]││
│  │ Synced My Library              My Library ›  ││
│  │ Synced My Series                My Series ›  ││
│  └──────────────────────────────────────────────┘│
│                                                  │
│  TROUBLESHOOTING                                 │
│  ┌──────────────────────────────────────────────┐│
│  │ Reload Library from Server           [button]││
│  │ Refresh Spines                       [button]││
│  │ Clear Temporary Files                [button]││
│  └──────────────────────────────────────────────┘│
│                                                  │
│  DANGER ZONE                                     │ ← NEW section grouping
│  ┌──────────────────────────────────────────────┐│
│  │ ⚠ Reset from Server                 [button] ││
│  │ ⚠ Remove All Downloads              [button] ││
│  │ ⚠ Empty My Library                  [button] ││
│  └──────────────────────────────────────────────┘│
│                                                  │
└──────────────────────────────────────────────────┘
```

Changes:
- Added Image Cache section (migrated from legacy StorageSettings)
- Added section headers throughout
- Separated "Danger Zone" destructive actions with visual distinction
- Moved non-destructive troubleshooting into its own section

### 5.4 Sleep Timer Memory

**Store change** (`sleepTimerStore.ts`):

```typescript
// Add to sleepTimerStore state
lastTimerDuration: number | null;  // Persisted, seconds
lastTimerType: 'duration' | 'endOfChapter' | null;

// Set when timer starts
setLastTimer: (duration: number, type: 'duration' | 'endOfChapter') => void;
```

**UI change** (sleep timer sheet in player):
- When opening the timer sheet, pre-highlight `lastTimerDuration` if set
- Add subtle "(last used)" label next to the pre-selected option
- If no previous timer, default to no selection (current behavior)

### 5.5 Keep Screen Awake

**New toggle** in PlaybackSettingsScreen:

```typescript
// Add to playerSettingsStore
keepScreenAwake: boolean;  // Default: false

// In player component, when playback is active:
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

useEffect(() => {
  if (isPlaying && keepScreenAwake) {
    activateKeepAwakeAsync();
  } else {
    deactivateKeepAwake();
  }
  return () => deactivateKeepAwake();
}, [isPlaying, keepScreenAwake]);
```

### 5.6 Settings with No UI That Should Stay Hidden

Some settings correctly have no dedicated settings UI because they're set contextually:

| Setting | Set Via | Should Stay Hidden |
|---------|---------|-------------------|
| `bookSpeedMap` | Player speed control | Yes — set per-book in context |
| `activeChip` (feeling) | Browse mood chips | Yes — ephemeral, in context |
| `seekPosition` / `isSeeking` | Player scrubber | Yes — runtime state |
| `favoriteSeriesNames` | Series detail screen | Yes — set in context |
| `preferencesStore` fields | Onboarding wizard / Browse | Yes — set in context |
| `contentFilterStore` fields | Browse TagFilterSheet | Yes — set in context |

---

## 6. Effort Estimates

### Phase 1: Quick Wins (4-6 hours)

| Task | Hours | Dependencies |
|------|-------|-------------|
| Add section headers to ProfileScreen ("APP" / "SYSTEM") | 0.5 | None |
| Add Joystick Seek link to PlaybackSettingsScreen | 1 | Navigation route already exists |
| Surface `fadeOnExpiry` toggle in PlaybackSettingsScreen (store field already exists) | 0.5 | None — `sleepTimerStore.fadeOnExpiry` exists |
| Separate Danger Zone in DataStorageSettings | 0.5 | Visual-only change |
| Add section headers to PlaybackSettings and DataStorage | 0.5 | None |

**Subtotal: ~3 hours**

### Phase 2: Consolidation (6-10 hours)

| Task | Hours | Dependencies |
|------|-------|-------------|
| Migrate image cache controls from StorageSettings to DataStorageSettings | 3 | Import `imageCacheService`, replicate UI |
| Remove/deprecate `StorageSettingsScreen` and `AppearanceSettingsScreen` | 2 | Verify no live navigation routes point to them |
| Add sleep timer memory (`lastTimerDuration`) to `sleepTimerStore` + UI | 2 | Modify sleep timer sheet in player |
| Add Keep Screen Awake toggle | 2 | `expo-keep-awake`, add to `playerSettingsStore` |

**Subtotal: ~9 hours**

### Phase 3: Future Enhancements (10-20+ hours each)

These are larger features identified through competitor analysis. Not immediate priorities but worth tracking:

| Feature | Hours | Research Backing |
|---------|-------|-----------------|
| Download quality selector (Standard/High/Maximum) | 8-12 | Audible, Spotify, Netflix all offer this |
| Volume normalization / boost | 15-20 | Overcast "Voice Boost", Pocket Casts "Volume Boost" |
| Trim silence | 15-20 | Pocket Casts (off/mild/medium/max), Overcast "Smart Speed" |
| Auto sleep timer (start on every playback) | 4-6 | [ABS issue #260](https://github.com/advplyr/audiobookshelf-app/issues/260) |
| Notification preferences screen | 6-8 | Every major competitor has this |
| Per-book settings expansion ("Custom for this book") | 10-15 | Pocket Casts/Overcast pattern |
| Settings search | 4-6 | Material Design recommends for 15+ settings |

### Testing Checklist

- [ ] **ProfileScreen** — All links navigate to correct screens; section headers render correctly
- [ ] **PlaybackSettings** — All toggles save immediately and persist across app restarts; new toggles (fade, keep awake, joystick link) work
- [ ] **DataStorageSettings** — Image cache section shows correct size; destructive actions still show confirmation dialogs
- [ ] **Sleep timer memory** — Last-used duration pre-selected on reopen; "End of Chapter" remembered separately; first-ever open shows no pre-selection
- [ ] **Keep screen awake** — Screen stays on during playback when enabled; screen dims when disabled; battery impact acceptable
- [ ] **Legacy screen removal** — No navigation routes point to removed screens; deep links (if any) redirect correctly
- [ ] **Consistency** — All toggles use same component; all section headers use same style; all destructive buttons use same red treatment
- [ ] **Edge cases** — Settings persist after force quit; settings work offline

---

## Sources

### NNGroup
- [Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/)
- [Toggle-Switch Guidelines](https://www.nngroup.com/articles/toggle-switch-guidelines/)
- [The Power of Defaults](https://www.nngroup.com/articles/the-power-of-defaults/)
- [Customization vs. Personalization](https://www.nngroup.com/articles/customization-personalization/)
- [Personalization is Over-Rated](https://www.nngroup.com/articles/personalization-is-over-rated/)
- [Low Findability and Discoverability](https://www.nngroup.com/articles/navigation-ia-tests/)

### Platform Guidelines
- [Apple HIG — Settings](https://developer.apple.com/design/human-interface-guidelines/settings)
- [Android Settings Design Guide](https://developer.android.com/design/ui/mobile/guides/patterns/settings)
- [Material Design Settings Pattern](https://m1.material.io/patterns/settings.html)

### Competitor Analysis
- [Audible App Settings](https://help.audible.com/s/topic/0TO4z000000SoIsGAK/app-settings)
- [Audible Download Quality](https://help.audible.com/s/article/manage-download-settings)
- [Spotify iOS Settings — Mobbin](https://mobbin.com/explore/screens/e7bc25f7-6795-4288-be5b-927f3a2b0fd1)
- [Apple Podcasts Download Settings](https://support.apple.com/guide/iphone/change-download-settings-iph2ae70a294/ios)
- [Pocket Casts Playback Effects](https://support.pocketcasts.com/knowledge-base/playback-effects/)
- [Pocket Casts General Settings](https://support.pocketcasts.com/knowledge-base/general-settings/)
- [Pocket Casts Design Critique](https://ixd.prattsi.org/2022/02/design-critique-pocket-casts-ios/)
- [Overcast Walkthrough](https://www.podfeet.com/blog/2024/07/overcast-new-version/)
- [Overcast 3 Design — Marco.org](https://marco.org/2017/02/20/overcast3)
- [Netflix Data Usage Settings](https://help.netflix.com/en/node/87)
- [Kindle Sync Settings](https://www.amazon.com/gp/help/customer/display.html?nodeId=GGFEXXS8Z7DPJSTN)
- [Apple Books Audiobook Controls](https://support.apple.com/guide/iphone/listen-to-audiobooks-iphac1971248/ios)
- [Libby Sleep Timer](https://help.libbyapp.com/en-us/6049.htm)

### Behavioral Research
- [Do Users Change Their Settings? — UIE/Spool](https://archive.uie.com/brainsparks/2011/09/14/do-users-change-their-settings/)
- [Choice Paralysis — Glance](https://thisisglance.com/blog/choice-paralysis-when-too-many-options-kill-your-apps-success)
- [Default Settings — The Marketing Society](https://www.marketingsociety.com/the-gym/default-settings-most-powerful-tool-behavioural-scientist)

### Settings Design
- [Settings Screen UI Design — LogRocket](https://blog.logrocket.com/ux-design/designing-settings-screen-ui/)
- [Google Offline UX Design](https://design.google/library/offline-design)
- [Dark Patterns — Wikipedia](https://en.wikipedia.org/wiki/Dark_pattern)
