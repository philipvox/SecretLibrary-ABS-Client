# Instructions for Claude Code

## Overview
This document provides guidelines for Claude when working on this AudiobookShelf mobile app project. Following these instructions will ensure consistent, maintainable code that's easy to modify across sessions.

## Project Context
- **What**: Native mobile wrapper for AudiobookShelf server
- **Why**: Current mobile options are poor; we want better search, recommendations, and UI
- **Tech**: React Native + Expo with TypeScript
- **Architecture**: Feature-based modular structure

## Before Starting Each Session

1. **Read these files first:**
   - `docs/current-work.md` - See what's in progress
   - `docs/architecture.md` - Understand project structure
   - Relevant feature doc in `docs/features/` if working on a feature

2. **Understand the context:**
   - What stage are we in?
   - What files are being modified?
   - What's the current goal?

## During Development

### File Organization Rules

1. **File Size Limit: 400 lines maximum**
   - If a file exceeds 400 lines, split it into smaller modules
   - Each file should have a single, clear responsibility

2. **Import Rules:**
   - Features only import from `core/` and `shared/`
   - NO cross-feature imports
   - Use explicit imports: `import { X } from './file'` not `import * as`

3. **File Headers:**
   Always include a comment at the top explaining the file's purpose:
```typescript
   /**
    * src/core/api/client.ts
    * 
    * AudiobookShelf API client - single source of truth for all server communication.
    * Handles authentication, request formatting, and error handling.
    */
```

### Code Style Guidelines

1. **TypeScript:**
   - Use TypeScript for ALL files
   - Define types in `core/types/` for shared types
   - Use interfaces for object shapes, types for unions/primitives
   - No `any` types - use `unknown` if type is truly unknown

2. **Naming Conventions:**
   - Components: PascalCase (`BookCard.tsx`)
   - Files: camelCase (`authService.ts`)
   - Hooks: start with `use` (`useBookDetails.ts`)
   - Constants: UPPER_SNAKE_CASE (`API_BASE_URL`)
   - Functions: camelCase (`fetchBookDetails`)

3. **React Patterns:**
   - Functional components only
   - Use hooks for state and side effects
   - Custom hooks for reusable logic
   - Memoization when appropriate (useMemo, useCallback)

4. **Async/Await:**
   - Use async/await, not .then()
   - Always handle errors with try/catch
   - Show loading states for async operations

5. **Comments:**
   - Explain "why" not "what"
   - Complex logic needs explanation
   - API endpoints should document parameters and responses

### Error Handling
```typescript
// Always use this pattern for async operations
try {
  const result = await apiCall();
  return result;
} catch (error) {
  console.error('Descriptive error message:', error);
  // Handle error appropriately (show toast, fallback UI, etc.)
  throw error; // Re-throw if caller needs to handle
}
```

### Code Generation Format

When generating code, always:

1. **Include full file path:**
```typescript
   // src/core/api/client.ts
   export const api = {
     // ...
   };
```

2. **Show context:** If modifying existing file, show surrounding code:
```typescript
   // src/core/api/client.ts
   // ... existing code above ...
   
   // Add this new function:
   export async function newFunction() {
     // ...
   }
   
   // ... existing code below ...
```

3. **Explain changes:** After code block, briefly explain what was added/changed

## Feature Development Workflow

### Starting a New Feature

1. Create feature structure:
```
   src/features/feature-name/
   ├── components/
   ├── hooks/
   ├── screens/
   ├── services/
   └── index.ts
```

2. Create feature doc: `docs/features/feature-name.md`

3. Update `docs/current-work.md` with:
   - What feature you're building
   - Which files are involved
   - Current status

### Completing a Feature

1. Ensure index.ts exports public API
2. Add usage examples to feature doc
3. Update `docs/current-work.md`
4. Mark feature complete in architecture.md

## Specific to This Project

### AudiobookShelf API
- API documentation: https://api.audiobookshelf.org/
- Authentication: Bearer token in headers
- All responses are JSON
- Document any quirks or edge cases you find

### State Management Strategy
- **Server state**: TanStack Query (React Query)
- **UI state**: React useState/useReducer
- **Global app state**: Zustand (auth, theme, settings)
- **Cached data**: Local SQLite database

### Performance Considerations
- List virtualization for long lists (FlatList with optimization)
- Image caching for book covers
- Debounce search input (300ms)
- Lazy load features when possible

## Testing Guidelines

### What to Test
- API client functions
- Business logic in services
- Custom hooks
- Utility functions

### What NOT to Test (yet)
- UI components (manual testing sufficient for now)
- Navigation flows
- Integration tests (add later)

## After Each Session

1. **Update `docs/current-work.md`:**
   - Mark completed items
   - List what's next
   - Note any decisions made
   - Document blockers

2. **Update feature docs** if relevant

3. **Commit message format:**
```
   feat(feature-name): Brief description
   
   - Specific change 1
   - Specific change 2
   
   Files modified: list of files
```

## Common Patterns

### API Call Pattern
```typescript
// In feature service file
export async function getBookDetails(bookId: string) {
  try {
    const response = await apiClient.get(`/api/items/${bookId}`);
    return response.data;
  } catch (error) {
    console.error('Failed to fetch book details:', error);
    throw error;
  }
}

// In feature hook
export function useBookDetails(bookId: string) {
  return useQuery({
    queryKey: ['book', bookId],
    queryFn: () => getBookDetails(bookId),
  });
}

// In component
const { data: book, isLoading, error } = useBookDetails(bookId);
```

### Component Pattern
```typescript
// src/features/library/components/BookCard.tsx

import React from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { Book } from '@/core/types';

interface BookCardProps {
  book: Book;
  onPress: (bookId: string) => void;
}

export function BookCard({ book, onPress }: BookCardProps) {
  return (
    <Pressable onPress={() => onPress(book.id)}>
      <View style={styles.container}>
        <Image source={{ uri: book.coverUrl }} style={styles.cover} />
        <Text style={styles.title}>{book.title}</Text>
        <Text style={styles.author}>{book.author}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    // ...
  },
  // ...
});
```

## Questions to Ask

If you're unsure about something, ask before implementing:
- "Should this be in `core/` or `shared/`?"
- "Do we want to cache this data?"
- "Should this feature be configurable?"
- "Is this the right user flow?"

## Red Flags to Avoid

❌ Files over 400 lines
❌ Cross-feature imports
❌ Duplicated code (extract to `shared/`)
❌ Any types instead of specific types
❌ No error handling
❌ No loading states
❌ Hardcoded values (use config/)
❌ Missing TypeScript types

## Remember

- **Quality over speed**: Take time to structure code well
- **Ask questions**: Better to clarify than assume
- **Small commits**: Easier to review and debug
- **Document decisions**: Future you (and Claude) will thank you
- **Test as you go**: Don't wait until the end

## Helpful Commands
```bash
# Run the app
npm start

# Type check
npm run tsc

# Lint
npm run lint

# Format
npm run format

# Clear cache if things act weird
npm start -- --clear
```

## Success Metrics

You're doing well if:
- ✅ Files are under 400 lines
- ✅ Features are self-contained
- ✅ Types are well-defined
- ✅ Error handling is present
- ✅ Code is readable and commented
- ✅ Documentation is updated
- ✅ No linter errors
