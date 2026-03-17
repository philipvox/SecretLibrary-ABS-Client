/**
 * plugins/exo-player/withExoPlayer.js
 *
 * Expo config plugin for ExoPlayer-based audio playback service.
 *
 * This plugin ensures ExoPlayer integration survives `npx expo prebuild --clean`
 * by performing these steps during prebuild:
 *
 * 1. Copies Kotlin source files (AudioPlaybackService, Module, Package) to android/
 * 2. Adds foreground service declaration to AndroidManifest.xml
 * 3. Registers ExoPlayerPackage in MainApplication.kt
 * 4. Adds Media3 dependencies to app/build.gradle
 *
 * Source of truth: plugins/exo-player/src/
 */

const {
  withAndroidManifest,
  withDangerousMod,
  withMainApplication,
} = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const EXOPLAYER_PACKAGE = 'com.secretlibrary.app.exoplayer';
const EXOPLAYER_DIR = 'com/secretlibrary/app/exoplayer';

/**
 * Step 1: Modify AndroidManifest.xml to add foreground service declaration
 */
function withExoPlayerManifest(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    const application = manifest.manifest.application?.[0];
    if (!application) return config;

    // --- Add AudioPlaybackService as a foreground service ---
    if (!application.service) {
      application.service = [];
    }

    const hasService = application.service.some(
      (s) => s.$?.['android:name'] === '.exoplayer.AudioPlaybackService'
    );

    if (!hasService) {
      application.service.push({
        $: {
          'android:name': '.exoplayer.AudioPlaybackService',
          'android:exported': 'false',
          'android:foregroundServiceType': 'mediaPlayback',
        },
      });
    }

    // Ensure FOREGROUND_SERVICE permission
    if (!manifest.manifest['uses-permission']) {
      manifest.manifest['uses-permission'] = [];
    }
    const perms = manifest.manifest['uses-permission'];
    const hasFgPerm = perms.some(
      (p) => p.$?.['android:name'] === 'android.permission.FOREGROUND_SERVICE'
    );
    if (!hasFgPerm) {
      perms.push({ $: { 'android:name': 'android.permission.FOREGROUND_SERVICE' } });
    }
    const hasFgMediaPerm = perms.some(
      (p) => p.$?.['android:name'] === 'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK'
    );
    if (!hasFgMediaPerm) {
      perms.push({ $: { 'android:name': 'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK' } });
    }

    return config;
  });
}

/**
 * Step 2: Copy Kotlin source files
 */
function withExoPlayerFiles(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const pluginDir = path.join(projectRoot, 'plugins', 'exo-player');
      const androidDir = path.join(projectRoot, 'android', 'app', 'src', 'main');

      // Copy Kotlin source files
      const kotlinDest = path.join(androidDir, 'java', EXOPLAYER_DIR);
      fs.mkdirSync(kotlinDest, { recursive: true });

      const kotlinFiles = [
        'AudioPlaybackService.kt',
        'ExoPlayerModule.kt',
        'ExoPlayerPackage.kt',
      ];

      for (const file of kotlinFiles) {
        const src = path.join(pluginDir, 'src', file);
        const dest = path.join(kotlinDest, file);
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, dest);
        }
      }

      return config;
    },
  ]);
}

/**
 * Step 3: Register ExoPlayerPackage in MainApplication.kt
 */
function withExoPlayerPackageRegistration(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const mainAppPath = path.join(
        projectRoot,
        'android',
        'app',
        'src',
        'main',
        'java',
        'com',
        'secretlibrary',
        'app',
        'MainApplication.kt'
      );

      if (!fs.existsSync(mainAppPath)) return config;

      let content = fs.readFileSync(mainAppPath, 'utf8');

      // Add import if missing
      const importLine = `import ${EXOPLAYER_PACKAGE}.ExoPlayerPackage`;
      if (!content.includes(importLine)) {
        // Insert after the last existing import
        const lastImportIndex = content.lastIndexOf('import ');
        const endOfLastImport = content.indexOf('\n', lastImportIndex);
        content =
          content.slice(0, endOfLastImport + 1) +
          importLine +
          '\n' +
          content.slice(endOfLastImport + 1);
      }

      // Add package registration if missing
      if (!content.includes('ExoPlayerPackage()')) {
        const before = content;
        content = content.replace(
          /PackageList\(this\)\.packages\.apply\s*\{([^}]*)\}/,
          (match, inner) => {
            const trimmed = inner.trim();
            if (trimmed && !trimmed.startsWith('//')) {
              return `PackageList(this).packages.apply {\n              ${trimmed}\n              add(ExoPlayerPackage())\n            }`;
            }
            return `PackageList(this).packages.apply {\n              add(ExoPlayerPackage())\n            }`;
          }
        );
        if (content === before) {
          console.warn('[withExoPlayer] Could not find PackageList block in MainApplication.kt — ExoPlayerPackage not registered');
        }
      }

      fs.writeFileSync(mainAppPath, content, 'utf8');
      return config;
    },
  ]);
}

/**
 * Step 4: Add Media3 dependencies to build.gradle
 */
function withExoPlayerGradleDeps(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const gradlePath = path.join(
        projectRoot,
        'android',
        'app',
        'build.gradle'
      );

      if (!fs.existsSync(gradlePath)) return config;

      let content = fs.readFileSync(gradlePath, 'utf8');

      // Check if Media3 deps already present
      if (content.includes('media3-exoplayer')) {
        return config;
      }

      // Add Media3 dependencies before the closing brace of the dependencies block
      const media3Deps = `
    // ExoPlayer (Media3) for native audio playback
    implementation "androidx.media3:media3-exoplayer:1.5.1"
    implementation "androidx.media3:media3-session:1.5.1"
    implementation "androidx.media3:media3-ui:1.5.1"
    implementation "androidx.media:media:1.7.0"
`;

      // Find the dependencies block and insert before its closing brace
      // Match the last closing brace in the dependencies block
      const depsMatch = content.match(/dependencies\s*\{/);
      if (depsMatch) {
        // Find the matching closing brace for the dependencies block
        const depsStart = depsMatch.index + depsMatch[0].length;
        let braceCount = 1;
        let pos = depsStart;
        while (pos < content.length && braceCount > 0) {
          if (content[pos] === '{') braceCount++;
          if (content[pos] === '}') braceCount--;
          pos++;
        }
        // pos is now just after the closing brace
        const insertPos = pos - 1; // Just before the closing brace
        content =
          content.slice(0, insertPos) +
          media3Deps +
          content.slice(insertPos);
      }

      fs.writeFileSync(gradlePath, content, 'utf8');
      return config;
    },
  ]);
}

/**
 * Main plugin - composes all steps
 */
function withExoPlayer(config) {
  config = withExoPlayerManifest(config);
  config = withExoPlayerFiles(config);
  config = withExoPlayerPackageRegistration(config);
  config = withExoPlayerGradleDeps(config);
  return config;
}

module.exports = withExoPlayer;
