#!/usr/bin/env node
/**
 * tools/sync-versions.js
 *
 * Syncs version and build number from src/constants/version.ts
 * to all platform-specific files:
 *   - app.json (Expo config)
 *   - android/app/build.gradle (Android native)
 *   - ios/SecretLibrary.xcodeproj/project.pbxproj (iOS native)
 *
 * iOS uses separate version/build (IOS_VERSION/IOS_BUILD_NUMBER) for App Store.
 * Android uses APP_VERSION/BUILD_NUMBER.
 *
 * Usage:
 *   node tools/sync-versions.js          # Sync from version.ts
 *   node tools/sync-versions.js --check  # Check if in sync (exit 1 if not)
 *
 * Run automatically via: npm run sync-versions
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// ── Read source of truth ──

const versionTsPath = path.join(ROOT, 'src/constants/version.ts');
const versionTs = fs.readFileSync(versionTsPath, 'utf8');

const versionMatch = versionTs.match(/APP_VERSION\s*=\s*'([^']+)'/);
const buildMatch = versionTs.match(/BUILD_NUMBER\s*=\s*(\d+)/);
const iosVersionMatch = versionTs.match(/IOS_VERSION\s*=\s*'([^']+)'/);
const iosBuildMatch = versionTs.match(/IOS_BUILD_NUMBER\s*=\s*(\d+)/);

if (!versionMatch || !buildMatch) {
  console.error('Could not parse version.ts');
  process.exit(1);
}

const VERSION = versionMatch[1];
const BUILD = parseInt(buildMatch[1], 10);
const IOS_VERSION = iosVersionMatch ? iosVersionMatch[1] : VERSION;
const IOS_BUILD = iosBuildMatch ? parseInt(iosBuildMatch[1], 10) : BUILD;
const checkOnly = process.argv.includes('--check');

console.log(`Android: ${VERSION} (${BUILD})`);
console.log(`iOS:     ${IOS_VERSION} (${IOS_BUILD})`);

let allInSync = true;

// ── Helper ──

function syncFile(filePath, replacements, label) {
  const fullPath = path.join(ROOT, filePath);
  if (!fs.existsSync(fullPath)) {
    console.warn(`  ⚠ ${label}: file not found (${filePath})`);
    return;
  }

  let content = fs.readFileSync(fullPath, 'utf8');
  let changed = false;

  for (const { pattern, replacement, name } of replacements) {
    const match = content.match(pattern);
    if (!match) {
      console.warn(`  ⚠ ${label}: pattern not found for ${name}`);
      continue;
    }

    const newContent = content.replace(pattern, replacement);
    if (newContent !== content) {
      changed = true;
      allInSync = false;
      if (!checkOnly) {
        content = newContent;
      }
    }
  }

  if (changed && !checkOnly) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`  ✓ ${label}: updated`);
  } else if (changed) {
    console.log(`  ✗ ${label}: out of sync`);
  } else {
    console.log(`  ✓ ${label}: already in sync`);
  }
}

// ── app.json ──

const appJsonPath = path.join(ROOT, 'app.json');
const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
const appJsonChanged =
  appJson.expo.version !== VERSION ||
  appJson.expo.ios?.buildNumber !== String(IOS_BUILD) ||
  appJson.expo.android?.versionCode !== BUILD;

if (appJsonChanged) {
  allInSync = false;
  if (!checkOnly) {
    appJson.expo.version = VERSION;
    if (appJson.expo.ios) appJson.expo.ios.buildNumber = String(IOS_BUILD);
    if (appJson.expo.android) appJson.expo.android.versionCode = BUILD;
    fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + '\n', 'utf8');
    console.log('  ✓ app.json: updated');
  } else {
    console.log(`  ✗ app.json: out of sync (${appJson.expo.version}/${appJson.expo.ios?.buildNumber})`);
  }
} else {
  console.log('  ✓ app.json: already in sync');
}

// ── android/app/build.gradle ──

syncFile('android/app/build.gradle', [
  {
    name: 'versionCode',
    pattern: /versionCode\s+\d+/,
    replacement: `versionCode ${BUILD}`,
  },
  {
    name: 'versionName',
    pattern: /versionName\s+"[^"]+"/,
    replacement: `versionName "${VERSION}"`,
  },
], 'build.gradle');

// ── ios/SecretLibrary.xcodeproj/project.pbxproj ──
// MARKETING_VERSION and CURRENT_PROJECT_VERSION appear multiple times (Debug + Release)

syncFile('ios/SecretLibrary.xcodeproj/project.pbxproj', [
  {
    name: 'MARKETING_VERSION',
    pattern: /MARKETING_VERSION = [^;]+;/g,
    replacement: `MARKETING_VERSION = ${IOS_VERSION};`,
  },
  {
    name: 'CURRENT_PROJECT_VERSION',
    pattern: /CURRENT_PROJECT_VERSION = \d+;/g,
    replacement: `CURRENT_PROJECT_VERSION = ${IOS_BUILD};`,
  },
], 'project.pbxproj');

// ── Summary ──

console.log('');
if (checkOnly) {
  if (allInSync) {
    console.log('All versions in sync.');
  } else {
    console.log('Versions out of sync! Run: npm run sync-versions');
    process.exit(1);
  }
} else {
  console.log('Done.');
}
