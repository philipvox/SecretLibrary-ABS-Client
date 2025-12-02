# Component Library

This document describes the shared component library available in `src/shared/components/`.

## Table of Contents

- [Component Hierarchy](#component-hierarchy)
- [Buttons](#buttons)
- [Cards](#cards)
- [Inputs](#inputs)
- [Feedback Components](#feedback-components)
- [Skeleton Loaders](#skeleton-loaders)
- [Animation Components](#animation-components)
- [Gesture Components](#gesture-components)
- [Lazy Loading](#lazy-loading)
- [Theme System](#theme-system)

## Component Hierarchy

The app follows a three-layer component hierarchy:

```
Screen Components (src/features/*/screens/)
    |
    v
Feature Components (src/features/*/components/)
    |
    v
UI Components (src/shared/components/)
```

| Layer | Location | Responsibility | Max Lines |
|-------|----------|----------------|-----------|
| Screen | features/*/screens/ | Layout, navigation, data connection | ~200 |
| Feature | features/*/components/ | Feature-specific UI and logic | ~300 |
| UI | shared/components/ | Pure, reusable UI rendering | ~100 |

## Buttons

### Button

Standard button with variants, sizes, and states.

```typescript
import { Button } from '@/shared/components';

<Button
  title="Submit"
  onPress={handleSubmit}
  variant="primary"      // 'primary' | 'secondary' | 'ghost' | 'danger'
  size="medium"          // 'small' | 'medium' | 'large'
  disabled={false}
  loading={isSubmitting}
  fullWidth={false}
/>
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| title | string | required | Button text |
| onPress | () => void | required | Press handler |
| variant | string | 'primary' | Visual style |
| size | string | 'medium' | Button size |
| disabled | boolean | false | Disable interaction |
| loading | boolean | false | Show loading spinner |
| fullWidth | boolean | false | Take full container width |

### IconButton

Icon-only button for toolbars and actions.

```typescript
import { IconButton } from '@/shared/components';
import { Play } from 'lucide-react-native';

<IconButton
  icon={<Play size={20} color="#fff" />}
  onPress={handlePlay}
  variant="primary"
  size="medium"
  accessibilityLabel="Play audio"
/>
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| icon | ReactNode | required | Icon element |
| onPress | () => void | required | Press handler |
| variant | string | 'ghost' | Visual style |
| size | string | 'medium' | Button size (32/44/56px) |
| rounded | boolean | true | Circular shape |
| accessibilityLabel | string | required | Screen reader label |

## Cards

### Card

Container component for content sections.

```typescript
import { Card } from '@/shared/components';

<Card
  variant="elevated"     // 'elevated' | 'outlined' | 'flat'
  padding={4}            // Theme spacing key
  onPress={handlePress}  // Optional - makes card tappable
>
  <Text>Card content</Text>
</Card>
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| children | ReactNode | required | Card content |
| variant | string | 'elevated' | Visual style |
| padding | number | 4 | Padding (theme spacing) |
| onPress | () => void | undefined | Press handler (optional) |

### GlassCard

Glassmorphism card with blur effect.

```typescript
import { GlassCard } from '@/shared/components';

<GlassCard
  intensity={40}         // Blur intensity (iOS only)
  tint="dark"            // 'light' | 'dark' | 'default'
  padding={4}
>
  <Text>Blurred background content</Text>
</GlassCard>
```

Note: On Android, GlassCard falls back to a semi-transparent background.

## Inputs

### TextInput

Styled text input with label and error states.

```typescript
import { TextInput } from '@/shared/components';

<TextInput
  label="Email"
  value={email}
  onChangeText={setEmail}
  placeholder="Enter your email"
  error={emailError}
  hint="We'll never share your email"
  leftIcon={<Mail size={20} />}
/>
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| label | string | undefined | Input label |
| value | string | required | Input value |
| onChangeText | (text) => void | required | Change handler |
| error | string | undefined | Error message |
| hint | string | undefined | Helper text |
| leftIcon | ReactNode | undefined | Left icon |
| rightIcon | ReactNode | undefined | Right icon |
| onRightIconPress | () => void | undefined | Right icon press handler |

### SearchInput

Search-specific input with icon and clear button.

```typescript
import { SearchInput } from '@/shared/components';

<SearchInput
  value={query}
  onChangeText={setQuery}
  onClear={handleClear}
  onSubmit={handleSearch}
  placeholder="Search books..."
/>
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| value | string | required | Search query |
| onChangeText | (text) => void | required | Change handler |
| onClear | () => void | undefined | Clear button handler |
| onSubmit | () => void | undefined | Submit handler |
| placeholder | string | 'Search...' | Placeholder text |

## Feedback Components

### LoadingSpinner

Loading indicator with optional message.

```typescript
import { LoadingSpinner } from '@/shared/components';

// Inline spinner
<LoadingSpinner size="small" />

// Full screen loading
<LoadingSpinner size="large" text="Loading library..." />
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| size | string | 'large' | Spinner size |
| color | string | theme.primary | Spinner color |
| text | string | undefined | Loading message |

### ErrorView

Error display with retry option.

```typescript
import { ErrorView } from '@/shared/components';

<ErrorView
  message="Failed to load books"
  onRetry={refetch}
  icon="warning"
/>
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| message | string | required | Error message |
| onRetry | () => void | undefined | Retry handler |
| icon | string | 'warning' | Error icon (emoji) |

### EmptyState

Empty content state with action.

```typescript
import { EmptyState } from '@/shared/components';
import { BookOpen } from 'lucide-react-native';

<EmptyState
  title="No books found"
  description="Your library is empty. Add some audiobooks to get started."
  icon={<BookOpen size={64} color="#666" />}
  actionTitle="Browse Library"
  onAction={handleBrowse}
/>
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| title | string | required | Main message |
| description | string | undefined | Additional details |
| icon | ReactNode or string | 'books emoji' | Icon or emoji |
| actionTitle | string | undefined | Action button text |
| onAction | () => void | undefined | Action handler |
| fullScreen | boolean | true | Take full height |

### TabBar

Animated tab bar with multiple styles.

```typescript
import { TabBar } from '@/shared/components';

const TABS = ['Books', 'Podcasts', 'Downloads'] as const;
const [activeTab, setActiveTab] = useState<typeof TABS[number]>('Books');

<TabBar
  tabs={TABS}
  activeTab={activeTab}
  onTabChange={setActiveTab}
  variant="pills"        // 'pills' | 'underline'
  scrollable={false}
/>
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| tabs | readonly string[] | required | Tab labels |
| activeTab | string | required | Current tab |
| onTabChange | (tab) => void | required | Tab change handler |
| variant | string | 'pills' | Visual style |
| scrollable | boolean | false | Enable horizontal scroll |

## Skeleton Loaders

Pre-built skeleton components for loading states.

```typescript
import {
  BookCardSkeleton,
  BookGridSkeleton,
  ListItemSkeleton,
  PlayerHeaderSkeleton,
} from '@/shared/components';

// Single skeleton
<BookCardSkeleton />

// Grid of skeletons
<BookGridSkeleton count={6} />

// List skeletons
<ListSkeleton count={10} />
```

Available skeletons:
- `Shimmer` - Base shimmer animation
- `BookCardSkeleton` - Book cover card
- `SquareCardSkeleton` - Square card (authors, etc.)
- `ListItemSkeleton` - List row
- `PlayerHeaderSkeleton` - Player header
- `BookDetailSkeleton` - Full book detail screen
- `BookGridSkeleton` - Grid of book cards
- `SquareGridSkeleton` - Grid of square cards
- `ListSkeleton` - Multiple list items

## Animation Components

### FadeInUp

Fade in with upward motion.

```typescript
import { FadeInUp } from '@/shared/components';

<FadeInUp delay={100}>
  <Text>Animated content</Text>
</FadeInUp>
```

### ScaleIn

Scale animation on mount.

```typescript
import { ScaleIn } from '@/shared/components';

<ScaleIn>
  <Card>...</Card>
</ScaleIn>
```

### AnimatedNumber

Animate number changes.

```typescript
import { AnimatedNumber } from '@/shared/components';

<AnimatedNumber value={progress} format={(v) => `${v}%`} />
```

### Pulse

Pulsing animation for attention.

```typescript
import { Pulse } from '@/shared/components';

<Pulse>
  <Badge>New</Badge>
</Pulse>
```

## Gesture Components

### ScalePressable

Pressable with scale feedback.

```typescript
import { ScalePressable } from '@/shared/components';

<ScalePressable onPress={handlePress} scale={0.95}>
  <Card>...</Card>
</ScalePressable>
```

### Swipeable

Swipe-to-reveal actions.

```typescript
import { Swipeable } from '@/shared/components';

<Swipeable
  rightActions={[
    { label: 'Delete', onPress: handleDelete, color: 'red' }
  ]}
>
  <ListItem />
</Swipeable>
```

### PullToRefresh

Pull-to-refresh wrapper.

```typescript
import { PullToRefresh } from '@/shared/components';

<PullToRefresh onRefresh={refetch} refreshing={isRefetching}>
  <ScrollView>...</ScrollView>
</PullToRefresh>
```

### DoubleTapSeek

Double-tap seek for player.

```typescript
import { DoubleTapSeek } from '@/shared/components';

<DoubleTapSeek
  onSeekForward={seekForward}
  onSeekBackward={seekBackward}
  seekAmount={30}
>
  <PlayerContent />
</DoubleTapSeek>
```

## Lazy Loading

### DeferRender

Defer rendering until idle.

```typescript
import { DeferRender } from '@/shared/components';

<DeferRender>
  <ExpensiveComponent />
</DeferRender>
```

### OnVisible

Render when visible in viewport.

```typescript
import { OnVisible } from '@/shared/components';

<OnVisible>
  <Image source={{ uri: imageUrl }} />
</OnVisible>
```

### ProgressiveLoad

Progressive content loading.

```typescript
import { ProgressiveLoad } from '@/shared/components';

<ProgressiveLoad
  placeholder={<BookCardSkeleton />}
>
  <BookCard book={book} />
</ProgressiveLoad>
```

## Theme System

The theme system provides consistent design tokens.

```typescript
import { theme } from '@/shared/theme';

// Colors
theme.colors.primary[500]
theme.colors.background.primary
theme.colors.text.secondary

// Spacing (4px base)
theme.spacing[1]  // 4px
theme.spacing[2]  // 8px
theme.spacing[4]  // 16px
theme.spacing[6]  // 24px

// Typography
theme.textStyles.h1
theme.textStyles.body
theme.textStyles.caption

// Radius
theme.radius.small   // 4px
theme.radius.medium  // 8px
theme.radius.large   // 12px
theme.radius.full    // 9999px

// Elevation (shadows)
theme.elevation.small
theme.elevation.medium
theme.elevation.large
```

### Using Theme in Styles

```typescript
import { StyleSheet } from 'react-native';
import { theme } from '@/shared/theme';

const styles = StyleSheet.create({
  container: {
    padding: theme.spacing[4],
    backgroundColor: theme.colors.background.primary,
    borderRadius: theme.radius.large,
  },
  title: {
    ...theme.textStyles.h2,
    color: theme.colors.text.primary,
  },
});
```

## Import Patterns

All components are exported from the main index:

```typescript
// Import individual components
import { Button, Card, LoadingSpinner } from '@/shared/components';

// Import with types
import { Button, type SortOption } from '@/shared/components';
```

For feature-specific components, import from the feature:

```typescript
import { BookCard, BookGrid } from '@/features/library';
import { PlayerControls } from '@/features/player';
```
