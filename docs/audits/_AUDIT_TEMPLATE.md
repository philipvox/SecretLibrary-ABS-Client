# Screen Audit: [SCREEN_NAME]

## Metadata

| Property | Value |
|----------|-------|
| **File Path** | `src/features/[feature]/screens/[Screen].tsx` |
| **Size** | XX KB |
| **Lines of Code** | XXX |
| **Complexity** | Low / Medium / High / Very High |
| **Last Audited** | YYYY-MM-DD |
| **Audited By** | [Name/AI] |

---

## 1. Import Analysis

### React & React Native
```typescript
// List core imports
```

### Third-Party Libraries
```typescript
// expo-*, react-native-*, etc.
```

### Navigation
```typescript
// @react-navigation imports
```

### Feature Stores
```typescript
// Zustand stores from features
```

### Core Layer
```typescript
// @/core/* imports
```

### Shared Layer
```typescript
// @/shared/* imports
```

### Local Feature Imports
```typescript
// ../components, ../hooks, ../types
```

---

## 2. Cross-Feature Dependencies

| Feature | Import | Purpose |
|---------|--------|---------|
| `@/features/player` | `usePlayerStore` | Playback state |
| `@/features/queue` | `QueuePanel` | Queue display |

### Dependency Direction
- **Depends On**: [list features this screen imports from]
- **Depended On By**: [list screens that import from this feature]

---

## 3. Shared Components Used

| Component | Source | Props Used |
|-----------|--------|------------|
| `SectionHeader` | `@/features/home/components` | `title`, `showViewAll` |

---

## 4. Performance Audit

### Memoization

| Hook | Count | Purpose |
|------|-------|---------|
| `useMemo` | X | Data transformations |
| `useCallback` | X | Event handlers |
| `React.memo` | X | Component memoization |

### List Rendering

| List Type | Virtualized | Props Used |
|-----------|-------------|------------|
| FlatList | Yes/No | `removeClippedSubviews`, `windowSize` |
| ScrollView | N/A | N/A |

### Animation

| Animation Type | Library | Optimized |
|---------------|---------|-----------|
| Scroll | Reanimated | Yes/No |
| Gesture | RNGH | Yes/No |

### Potential Performance Issues
1. [ ] Issue description
2. [ ] Issue description

---

## 5. Accessibility Audit

### Current Implementation

| Element | Label | Role | Hint | Score |
|---------|-------|------|------|-------|
| Play button | Yes/No | Yes/No | Yes/No | X/3 |
| Book card | Yes/No | Yes/No | Yes/No | X/3 |

### Reduced Motion Support
- [ ] Uses `useReducedMotion()` hook
- [ ] Animations respect system settings
- [ ] Static fallbacks provided

### Missing Accessibility

| Element | Missing Props | Priority |
|---------|---------------|----------|
| TouchableOpacity | `accessibilityLabel` | High |

### Accessibility Score: X/100

---

## 6. Issues Found

### Critical (P0)
1. **[Issue Title]**: Description
   - Impact: [User impact]
   - Fix: [Specific fix]

### High (P1)
1. **[Issue Title]**: Description

### Medium (P2)
1. **[Issue Title]**: Description

### Low (P3)
1. **[Issue Title]**: Description

---

## 7. Recommendations

### Performance
1. [ ] Add `getItemLayout` to FlatList
2. [ ] Memoize expensive calculations

### Accessibility
1. [ ] Add `accessibilityLabel` to all interactive elements
2. [ ] Add `accessibilityHint` for complex interactions

### Code Quality
1. [ ] Extract inline styles to StyleSheet
2. [ ] Split large component into smaller pieces

---

## 8. Action Items

| Action | Priority | Effort | Status |
|--------|----------|--------|--------|
| Add accessibility to TabBar | High | Low | Pending |
| Add virtualization | High | Medium | Pending |

---

## 9. Dependencies Graph

```
[ScreenName]
├── @/features/[feature]
│   └── [specific imports]
├── @/core/[module]
│   └── [specific imports]
└── @/shared/[module]
    └── [specific imports]
```

---

## Revision History

| Date | Changes | Author |
|------|---------|--------|
| YYYY-MM-DD | Initial audit | [Name] |
