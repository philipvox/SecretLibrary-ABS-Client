/**
 * plugins/chromecast/withChromecast.js
 *
 * Expo config plugin for Google Cast (Chromecast) support.
 *
 * Steps during prebuild:
 * 1. Copies Kotlin source files (CastModule, CastPackage, CastOptionsProvider) to android/
 * 2. Adds CastOptionsProvider meta-data to AndroidManifest.xml
 * 3. Registers CastPackage in MainApplication.kt
 * 4. Adds play-services-cast-framework dependency to build.gradle
 * 5. iOS: Adds google-cast-sdk pod via build properties
 *
 * Source of truth: plugins/chromecast/src/
 */

const {
  withAndroidManifest,
  withDangerousMod,
} = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const CAST_PACKAGE = 'com.secretlibrary.app.chromecast';
const CAST_DIR = 'com/secretlibrary/app/chromecast';

/**
 * Step 1: Modify AndroidManifest.xml to add CastOptionsProvider meta-data
 */
function withCastManifest(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    const application = manifest.manifest.application?.[0];
    if (!application) return config;

    if (!application['meta-data']) {
      application['meta-data'] = [];
    }

    const hasCastMeta = application['meta-data'].some(
      (m) => m.$?.['android:name'] === 'com.google.android.gms.cast.framework.OPTIONS_PROVIDER_CLASS_NAME'
    );

    if (!hasCastMeta) {
      application['meta-data'].push({
        $: {
          'android:name': 'com.google.android.gms.cast.framework.OPTIONS_PROVIDER_CLASS_NAME',
          'android:value': `${CAST_PACKAGE}.CastOptionsProvider`,
        },
      });
    }

    return config;
  });
}

/**
 * Step 2: Copy Kotlin source files
 */
function withCastFiles(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const pluginDir = path.join(projectRoot, 'plugins', 'chromecast');
      const androidDir = path.join(projectRoot, 'android', 'app', 'src', 'main');

      const kotlinDest = path.join(androidDir, 'java', CAST_DIR);
      fs.mkdirSync(kotlinDest, { recursive: true });

      const kotlinFiles = [
        'CastModule.kt',
        'CastPackage.kt',
        'CastOptionsProvider.kt',
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
 * Step 3: Register CastPackage in MainApplication.kt
 */
function withCastPackageRegistration(config) {
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

      const importLine = `import ${CAST_PACKAGE}.CastPackage`;
      if (!content.includes(importLine)) {
        const lastImportIndex = content.lastIndexOf('import ');
        const endOfLastImport = content.indexOf('\n', lastImportIndex);
        content =
          content.slice(0, endOfLastImport + 1) +
          importLine +
          '\n' +
          content.slice(endOfLastImport + 1);
      }

      if (!content.includes('CastPackage()')) {
        const before = content;
        content = content.replace(
          /PackageList\(this\)\.packages\.apply\s*\{([^}]*)\}/,
          (match, inner) => {
            const trimmed = inner.trim();
            if (trimmed && !trimmed.startsWith('//')) {
              return `PackageList(this).packages.apply {\n              ${trimmed}\n              add(CastPackage())\n            }`;
            }
            return `PackageList(this).packages.apply {\n              add(CastPackage())\n            }`;
          }
        );
        if (content === before) {
          console.warn('[withChromecast] Could not find PackageList block in MainApplication.kt');
        }
      }

      fs.writeFileSync(mainAppPath, content, 'utf8');
      return config;
    },
  ]);
}

/**
 * Step 4: Add Cast Framework dependency to build.gradle
 */
function withCastGradleDeps(config) {
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

      if (content.includes('play-services-cast-framework')) {
        return config;
      }

      const castDeps = `
    // Google Cast (Chromecast) framework
    implementation "com.google.android.gms:play-services-cast-framework:22.0.0"
`;

      const depsMatch = content.match(/dependencies\s*\{/);
      if (depsMatch) {
        const depsStart = depsMatch.index + depsMatch[0].length;
        let braceCount = 1;
        let pos = depsStart;
        while (pos < content.length && braceCount > 0) {
          if (content[pos] === '{') braceCount++;
          if (content[pos] === '}') braceCount--;
          pos++;
        }
        const insertPos = pos - 1;
        content =
          content.slice(0, insertPos) +
          castDeps +
          content.slice(insertPos);
      }

      fs.writeFileSync(gradlePath, content, 'utf8');
      return config;
    },
  ]);
}

/**
 * Step 5: iOS - Add Google Cast SDK pod
 */
function withCastIosPod(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const podfilePath = path.join(projectRoot, 'ios', 'Podfile');

      if (!fs.existsSync(podfilePath)) return config;

      let content = fs.readFileSync(podfilePath, 'utf8');

      if (content.includes('google-cast-sdk')) {
        return config;
      }

      // Add pod before the first `end` after `target`
      content = content.replace(
        /(target\s+'[^']+'\s+do\s*\n)/,
        `$1  pod 'google-cast-sdk', '~> 4.8'\n`
      );

      fs.writeFileSync(podfilePath, content, 'utf8');
      return config;
    },
  ]);
}

/**
 * Step 6: Copy iOS Swift module
 */
function withCastIosFiles(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const pluginDir = path.join(projectRoot, 'plugins', 'chromecast', 'ios');
      const iosDir = path.join(projectRoot, 'ios', 'audiobookshelf-app');

      if (!fs.existsSync(iosDir)) {
        // Try the app slug name
        const altDir = path.join(projectRoot, 'ios', 'SecretLibrary');
        if (fs.existsSync(altDir)) {
          // Copy to alternative directory
          const src = path.join(pluginDir, 'CastModule.swift');
          if (fs.existsSync(src)) {
            fs.copyFileSync(src, path.join(altDir, 'CastModule.swift'));
          }
          const bridgeSrc = path.join(pluginDir, 'CastModule-Bridging-Header.h');
          if (fs.existsSync(bridgeSrc)) {
            fs.copyFileSync(bridgeSrc, path.join(altDir, 'CastModule-Bridging-Header.h'));
          }
        }
        return config;
      }

      const swiftSrc = path.join(pluginDir, 'CastModule.swift');
      if (fs.existsSync(swiftSrc)) {
        fs.copyFileSync(swiftSrc, path.join(iosDir, 'CastModule.swift'));
      }

      const bridgeSrc = path.join(pluginDir, 'CastModule-Bridging-Header.h');
      if (fs.existsSync(bridgeSrc)) {
        fs.copyFileSync(bridgeSrc, path.join(iosDir, 'CastModule-Bridging-Header.h'));
      }

      return config;
    },
  ]);
}

/**
 * Main plugin - composes all steps
 */
function withChromecast(config) {
  config = withCastManifest(config);
  config = withCastFiles(config);
  config = withCastPackageRegistration(config);
  config = withCastGradleDeps(config);
  config = withCastIosPod(config);
  config = withCastIosFiles(config);
  return config;
}

module.exports = withChromecast;
