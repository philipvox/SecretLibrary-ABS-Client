/**
 * plugins/native-http/withNativeHttp.js
 *
 * Expo config plugin for the NativeHttpModule.
 *
 * Steps during prebuild:
 * 1. Copies Kotlin source files to android/
 * 2. Registers NativeHttpPackage in MainApplication.kt
 * 3. Copies iOS Swift/ObjC files to ios/
 * 4. Adds iOS files to Xcode project
 *
 * Source of truth: plugins/native-http/src/ (Android), plugins/native-http/ios/ (iOS)
 */

const {
  withDangerousMod,
  withXcodeProject,
} = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const PACKAGE = 'com.secretlibrary.app.nativehttp';
const KOTLIN_DIR = 'com/secretlibrary/app/nativehttp';

/**
 * Step 1: Copy Kotlin source files to android/
 */
function withNativeHttpFiles(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const pluginDir = path.join(projectRoot, 'plugins', 'native-http');
      const androidDir = path.join(projectRoot, 'android', 'app', 'src', 'main');
      const kotlinDest = path.join(androidDir, 'java', KOTLIN_DIR);
      fs.mkdirSync(kotlinDest, { recursive: true });

      const files = ['NativeHttpModule.kt', 'NativeHttpPackage.kt'];
      for (const file of files) {
        const src = path.join(pluginDir, 'src', file);
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, path.join(kotlinDest, file));
        }
      }

      return config;
    },
  ]);
}

/**
 * Step 2: Register NativeHttpPackage in MainApplication.kt
 */
function withNativeHttpPackageRegistration(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const mainAppPath = path.join(
        projectRoot, 'android', 'app', 'src', 'main', 'java',
        'com', 'secretlibrary', 'app', 'MainApplication.kt'
      );

      if (!fs.existsSync(mainAppPath)) return config;

      let content = fs.readFileSync(mainAppPath, 'utf8');

      const importLine = `import ${PACKAGE}.NativeHttpPackage`;
      if (!content.includes(importLine)) {
        const lastImportIndex = content.lastIndexOf('import ');
        const endOfLastImport = content.indexOf('\n', lastImportIndex);
        content =
          content.slice(0, endOfLastImport + 1) +
          importLine + '\n' +
          content.slice(endOfLastImport + 1);
      }

      if (!content.includes('NativeHttpPackage()')) {
        content = content.replace(
          /PackageList\(this\)\.packages\.apply\s*\{([^}]*)\}/,
          (match, inner) => {
            const trimmed = inner.trim();
            if (trimmed && !trimmed.startsWith('//')) {
              return `PackageList(this).packages.apply {\n              ${trimmed}\n              add(NativeHttpPackage())\n            }`;
            }
            return `PackageList(this).packages.apply {\n              add(NativeHttpPackage())\n            }`;
          }
        );
      }

      fs.writeFileSync(mainAppPath, content, 'utf8');
      return config;
    },
  ]);
}

/**
 * Step 3: Copy iOS Swift/ObjC files
 */
function withNativeHttpIosFiles(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const pluginDir = path.join(projectRoot, 'plugins', 'native-http', 'ios');

      let iosDir = path.join(projectRoot, 'ios', 'SecretLibrary');
      if (!fs.existsSync(iosDir)) {
        iosDir = path.join(projectRoot, 'ios', 'audiobookshelf-app');
      }
      if (!fs.existsSync(iosDir)) {
        console.warn('[withNativeHttp] No iOS app directory found, skipping file copy');
        return config;
      }

      const files = ['NativeHttpModule.swift', 'NativeHttpModule.m'];
      for (const file of files) {
        const src = path.join(pluginDir, file);
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, path.join(iosDir, file));
        }
      }

      return config;
    },
  ]);
}

/**
 * Step 4: Add iOS files to Xcode project
 */
function withNativeHttpXcodeProject(config) {
  return withXcodeProject(config, (config) => {
    const project = config.modResults;
    const appName = config.modRequest.projectName || 'SecretLibrary';

    const pbxGroupSection = project.hash.project.objects['PBXGroup'];
    let appGroupKey = null;
    for (const key of Object.keys(pbxGroupSection)) {
      if (key.endsWith('_comment')) continue;
      const grp = pbxGroupSection[key];
      if (grp.name === appName || grp.path === appName) {
        appGroupKey = key;
        break;
      }
    }

    if (!appGroupKey) {
      console.warn(`[withNativeHttp] Could not find PBXGroup for "${appName}"`);
      return config;
    }

    const sourceFiles = ['NativeHttpModule.swift', 'NativeHttpModule.m'];

    for (const name of sourceFiles) {
      const grp = pbxGroupSection[appGroupKey];
      const alreadyAdded = (grp.children || []).some(
        (child) => child.comment === name
      );
      if (alreadyAdded) continue;

      try {
        project.addSourceFile(
          `${appName}/${name}`,
          { target: project.getFirstTarget().uuid },
          appGroupKey
        );
      } catch (e) {
        console.warn(`[withNativeHttp] Could not add ${name}: ${e.message}`);
      }
    }

    return config;
  });
}

/**
 * Main plugin: compose all steps
 */
function withNativeHttp(config) {
  config = withNativeHttpFiles(config);
  config = withNativeHttpPackageRegistration(config);
  config = withNativeHttpIosFiles(config);
  config = withNativeHttpXcodeProject(config);
  return config;
}

module.exports = withNativeHttp;
