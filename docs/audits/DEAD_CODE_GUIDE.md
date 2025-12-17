# Dead Code Identification Guide
## Secret Library App - Finding & Removing Unused Code

---

## Quick Start

### Option 1: Use `knip` (Fastest)

```bash
# Install
npm install -D knip

# Add to package.json scripts
"scripts": {
  "find-unused": "knip"
}

# Run
npm run find-unused
```

**Output shows:**
- Unused files
- Unused exports
- Unused dependencies
- Unused dev dependencies

### Option 2: Custom Script (More Control)

```bash
# Copy find-dead-code.js to docs/audits/scripts/
node docs/audits/scripts/find-dead-code.js
```

---

## What Makes Code "Dead"?

| Type | Description | Risk Level |
|------|-------------|------------|
| **Unused File** | Never imported anywhere | Safe to delete |
| **Unused Export** | Exported but never imported | Safe to delete export |
| **Orphaned Feature** | Entire feature folder with no external usage | Review carefully |
| **Single-Use File** | Only imported in one place | Consider inlining |
| **Orphaned Test** | Test file for deleted component | Safe to delete |

---

## Manual Detection Patterns

### 1. Files to Check First

These are common dead code hiding spots:

```
src/
├── components/
│   └── old/              # "old" folders are red flags
├── features/
│   └── deprecated-feature/  # Check if still in navigation
├── utils/
│   └── helpers.ts        # Utility files accumulate dead code
├── hooks/
│   └── useLegacyX.ts     # "legacy" prefix = likely dead
└── types/
    └── v1/               # Versioned folders often dead
```

### 2. Naming Red Flags

Files with these patterns are often dead:

| Pattern | Example | Action |
|---------|---------|--------|
| `old`, `Old` | `OldHeader.tsx` | Check if imported |
| `legacy`, `Legacy` | `useLegacyAuth.ts` | Check if imported |
| `backup`, `Backup` | `HomeScreen.backup.tsx` | Delete if backup |
| `v1`, `v2` | `types/v1/` | Check if still used |
| `deprecated` | `deprecated/` | Review and delete |
| `temp`, `tmp` | `tempFix.ts` | Delete |
| `test`, `Test` (not in __tests__) | `TestComponent.tsx` | Delete if not test |
| `copy`, `Copy` | `ButtonCopy.tsx` | Delete |
| `.bak` | `Component.tsx.bak` | Delete |

### 3. Quick VS Code Search

Find potentially unused exports:

```
// Search for: export (const|function|class) (\w+)
// Then search for the name - if only 1 result, it's unused
```

---

## Step-by-Step Cleanup Process

### Phase 1: Safe Deletions (Low Risk)

1. **Backup everything first**
   ```bash
   git checkout -b cleanup/dead-code
   ```

2. **Delete obvious dead files**
   - Files in `old/`, `deprecated/`, `backup/` folders
   - Files with `.bak`, `.backup`, `.old` extensions
   - Commented-out component files

3. **Run tests**
   ```bash
   npm test
   npm run build
   ```

### Phase 2: Script-Identified Files (Medium Risk)

1. **Run dead code finder**
   ```bash
   node docs/audits/scripts/find-dead-code.js
   ```

2. **For each unused file, verify:**
   - [ ] Not dynamically imported (`import()`)
   - [ ] Not in navigation config
   - [ ] Not referenced in any config files
   - [ ] No string references to the file name

3. **Delete in small batches**
   ```bash
   # Delete 5-10 files
   rm src/components/UnusedA.tsx
   rm src/components/UnusedB.tsx

   # Test
   npm run build
   npm test

   # Commit
   git commit -m "Remove unused components: A, B"
   ```

### Phase 3: Feature-Level Cleanup (Higher Risk)

1. **Identify orphaned features**
   ```bash
   # Check if feature is in navigation
   grep -r "FeatureName" src/navigation/
   ```

2. **Check for dynamic references**
   ```bash
   # Screen names might be strings
   grep -r "FeatureScreen" src/
   ```

3. **Delete entire feature folder only if:**
   - [ ] Not in any navigation config
   - [ ] Not dynamically imported
   - [ ] No screens referenced as strings
   - [ ] App builds without it

---

## Common False Positives

### Files That LOOK Unused But Aren't

| Pattern | Why It Looks Unused | Reality |
|---------|--------------------| --------|
| Screen files | Not imported in code | Loaded by navigation |
| `index.ts` barrel exports | Seem like pass-throughs | Needed for clean imports |
| Type definition files (`.d.ts`) | No runtime imports | TypeScript needs them |
| Config files | Not imported | Used by tools |
| Entry points (`App.tsx`) | Nothing imports them | App entry |
| Navigation screens | Not imported | Registered by name |

### How to Verify a Screen Is Used

```bash
# Check navigation config
grep -r "ScreenName" src/navigation/

# Check for navigation.navigate calls
grep -r "navigate.*ScreenName" src/

# Check stack/tab definitions
grep -r "name.*ScreenName" src/
```

---

## VS Code Extensions That Help

1. **Import Cost** - Shows import size (big unused imports stand out)
2. **TypeScript Unused Exports** - Highlights unused exports
3. **Find Unused Exports** - Dedicated unused export finder
4. **Code Spell Checker** - Catches "depricated" typos

---

## Automated CI Check

Add to your CI to prevent new dead code:

```yaml
# .github/workflows/dead-code-check.yml
name: Dead Code Check

on: [pull_request]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install
        run: npm ci

      - name: Check for unused code
        run: npx knip --no-exit-code

      - name: Fail if new unused exports
        run: |
          npx knip --reporter json > knip-report.json
          UNUSED=$(cat knip-report.json | jq '.files | length')
          if [ "$UNUSED" -gt "0" ]; then
            echo "Found $UNUSED unused files!"
            cat knip-report.json | jq '.files'
            exit 1
          fi
```

---

## Integration with Dependency Registry

Update your `_DEPENDENCY_REGISTRY.json` after cleanup:

```json
{
  "cleanup": {
    "lastRun": "2025-12-16",
    "filesDeleted": 12,
    "linesRemoved": 1847,
    "deletedFiles": [
      "src/components/OldHeader.tsx",
      "src/utils/legacyHelpers.ts"
    ]
  }
}
```

---

## Quick Reference: Safe vs Risky Deletions

### Safe to Delete
- Files in `old/`, `backup/`, `deprecated/` folders
- Files ending in `.bak`, `.backup`, `.old`
- Commented-out entire files
- Test files for deleted components
- Clearly labeled "temp" or "test" files
- Duplicate files (keep one)

### Verify Before Deleting
- Component files not in obvious imports
- Hook files (might be used dynamically)
- Utility files (check all usages)
- Type files (TypeScript may need them)

### Don't Delete Without Deep Review
- Screen files (check navigation)
- Index/barrel files
- Config files
- Entry points
- Files in `core/` (foundational)

---

## Cleanup Checklist

```markdown
## Pre-Cleanup
- [ ] Create git branch: `cleanup/dead-code-YYYY-MM-DD`
- [ ] Run dead code finder script
- [ ] Export results to `dead-code-report.json`

## Safe Deletions
- [ ] Delete files in `old/`, `deprecated/` folders
- [ ] Delete `.bak` files
- [ ] Run build: `npm run build`
- [ ] Run tests: `npm test`
- [ ] Commit: "Remove obviously dead files"

## Script-Identified Deletions
- [ ] Review each unused file
- [ ] Check for dynamic imports
- [ ] Check navigation configs
- [ ] Delete in batches of 5-10
- [ ] Build and test after each batch
- [ ] Commit with file list

## Post-Cleanup
- [ ] Update dependency registry
- [ ] Run full test suite
- [ ] Test on device/simulator
- [ ] Create PR with summary
- [ ] Document what was removed

## Metrics
- Files deleted: ___
- Lines removed: ___
- Bundle size reduction: ___ KB
```

---

## Expected Results

For a typical React Native app your size:

| Metric | Typical Range | Your Target |
|--------|---------------|-------------|
| Unused files found | 10-50 | <10 |
| Dead code lines | 500-3000 | <500 |
| Bundle reduction | 2-10% | 5%+ |

---

*Last Updated: December 2025*
