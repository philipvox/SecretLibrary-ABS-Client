# Architectural Decisions

This document records important decisions made during development and the reasoning behind them.

## ADR-001: React Native with Expo

**Date**: [Today]
**Status**: Accepted

**Context**:
Needed to choose mobile development framework for iOS and Android app.

**Decision**:
Use React Native with Expo managed workflow.

**Reasoning**:
- Philip already familiar with React from Tauri work
- Single codebase for both platforms
- Expo provides excellent developer experience
- Easy access to native features (audio, file system, SQLite)
- Good performance for media applications
- Large ecosystem and community

**Alternatives Considered**:
- Flutter: Better performance but requires learning Dart
- Native (Swift/Kotlin): Maximum performance but 2x development effort
- Capacitor: Less mature ecosystem for complex media apps

---

## ADR-002: Zustand for State Management

**Date**: [Today]
**Status**: Accepted

**Context**:
Needed to choose state management solution for global app state.

**Decision**:
Use Zustand for global state, TanStack Query for server state.

**Reasoning**:
- Zustand is lightweight and simple
- Less boilerplate than Redux
- Works well with React Query for server state
- Easy to understand and debug
- Sufficient for our needs (auth, theme, settings)

**Alternatives Considered**:
- Redux Toolkit: More powerful but overkill for this project
- Context API: Too much re-rendering for global state
- MobX: More complex than needed

---

## ADR-003: Feature-Based Architecture

**Date**: [Today]
**Status**: Accepted

**Context**:
Needed project structure that works well with Claude's context limits and enables modular development.

**Decision**:
Use feature-based architecture with strict file size limits (400 lines).

**Reasoning**:
- Each feature is self-contained and easy to understand
- Claude can work on one feature at a time
- Reduces cognitive load when making changes
- Prevents large monolithic files
- Easy to test and maintain
- Clear boundaries between features

**Alternatives Considered**:
- Layer-based (components/, services/, etc.): Harder to navigate, cross-cutting concerns
- Atomic design: Too rigid for our needs

---

## ADR-004: Fuse.js for Search

**Date**: [Today]
**Status**: Accepted

**Context**:
Need fuzzy search functionality that's fast and works offline.

**Decision**:
Use Fuse.js for client-side fuzzy searching.

**Reasoning**:
- Lightweight and fast
- Configurable relevance scoring
- Works offline with cached data
- Easy to integrate
- No server-side changes required

**Alternatives Considered**:
- FlexSearch: Faster but less flexible configuration
- Server-side search: Requires internet, adds latency
- Native search: Different implementation per platform

---

## Future Decisions

[Record new decisions here as they're made]

## Decision Template
```markdown
## ADR-XXX: Title

**Date**: [Date]
**Status**: Proposed | Accepted | Deprecated | Superseded

**Context**:
[What is the issue we're seeing that is motivating this decision?]

**Decision**:
[What is the change that we're proposing/making?]

**Reasoning**:
[Why this approach over alternatives?]

**Alternatives Considered**:
- Option A: [Why not this?]
- Option B: [Why not this?]

**Consequences**:
[What becomes easier or more difficult?]
```
