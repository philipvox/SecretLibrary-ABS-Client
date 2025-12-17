#!/usr/bin/env node
/**
 * Dead Code Finder Script
 *
 * Finds unused files, components, hooks, and utilities in the codebase.
 * Usage: node docs/audits/scripts/find-dead-code.js
 *
 * What it finds:
 * - Files never imported anywhere
 * - Exported functions/components never used
 * - Entire feature folders with no external usage
 * - Orphaned test files (tests for deleted components)
 */

const fs = require('fs');
const path = require('path');

// Configuration
const SRC_DIR = path.join(__dirname, '../../../src');
const CONFIG = {
  // Directories to scan
  scanDirs: ['features', 'shared', 'core'],

  // Files to ignore (entry points, configs, etc.)
  ignoreFiles: [
    'index.ts',
    'index.tsx',
    'App.tsx',
    'app.config.ts',
    'babel.config.js',
    'metro.config.js',
    '.d.ts',
  ],

  // Directories to ignore
  ignoreDirs: [
    'node_modules',
    '__tests__',
    '__mocks__',
    '.git',
    'android',
    'ios',
  ],

  // Known entry points that won't be imported but ARE used
  entryPoints: [
    'App.tsx',
    'src/app/',
    'src/navigation/',
  ],
};

// ============================================
// FILE DISCOVERY
// ============================================

/**
 * Get all TypeScript/JavaScript files recursively
 */
function getAllFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;

  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      if (!CONFIG.ignoreDirs.includes(item)) {
        getAllFiles(fullPath, files);
      }
    } else if (/\.(tsx?|jsx?)$/.test(item)) {
      if (!CONFIG.ignoreFiles.some(ignore => item.endsWith(ignore))) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

/**
 * Extract all imports from a file
 */
function extractImports(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const imports = new Set();

  // Match various import patterns
  const patterns = [
    // import X from 'path'
    /import\s+(?:[\w*{}\s,]+)\s+from\s+['"]([^'"]+)['"]/g,
    // import 'path'
    /import\s+['"]([^'"]+)['"]/g,
    // require('path')
    /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    // dynamic import('path')
    /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      imports.add(match[1]);
    }
  }

  return Array.from(imports);
}

/**
 * Extract all exports from a file
 */
function extractExports(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const exports = [];

  // Named exports: export const X, export function X, export class X
  const namedPattern = /export\s+(?:const|let|var|function|class|type|interface|enum)\s+(\w+)/g;
  let match;
  while ((match = namedPattern.exec(content)) !== null) {
    exports.push({ name: match[1], type: 'named' });
  }

  // Export { X, Y }
  const bracketPattern = /export\s*\{([^}]+)\}/g;
  while ((match = bracketPattern.exec(content)) !== null) {
    const names = match[1].split(',').map(n => n.trim().split(/\s+as\s+/)[0].trim());
    names.forEach(name => {
      if (name && !name.startsWith('type ')) {
        exports.push({ name, type: 'named' });
      }
    });
  }

  // Default export
  if (/export\s+default/.test(content)) {
    // Try to get the name
    const defaultMatch = content.match(/export\s+default\s+(?:function|class)?\s*(\w+)/);
    exports.push({
      name: defaultMatch ? defaultMatch[1] : 'default',
      type: 'default'
    });
  }

  return exports;
}

/**
 * Resolve import path to actual file path
 */
function resolveImportPath(importPath, fromFile) {
  // Handle alias imports (@/...)
  if (importPath.startsWith('@/')) {
    return path.join(SRC_DIR, importPath.slice(2));
  }

  // Handle relative imports
  if (importPath.startsWith('.')) {
    const dir = path.dirname(fromFile);
    return path.resolve(dir, importPath);
  }

  // External package
  return null;
}

/**
 * Find actual file for an import (handles index files, extensions)
 */
function findActualFile(basePath) {
  const extensions = ['.tsx', '.ts', '.jsx', '.js'];

  // Direct file match
  for (const ext of extensions) {
    const withExt = basePath + ext;
    if (fs.existsSync(withExt)) return withExt;
  }

  // Check if it's already a full path
  if (fs.existsSync(basePath) && fs.statSync(basePath).isFile()) {
    return basePath;
  }

  // Directory with index file
  if (fs.existsSync(basePath) && fs.statSync(basePath).isDirectory()) {
    for (const ext of extensions) {
      const indexPath = path.join(basePath, 'index' + ext);
      if (fs.existsSync(indexPath)) return indexPath;
    }
  }

  return null;
}

// ============================================
// ANALYSIS
// ============================================

/**
 * Build complete import graph
 */
function buildImportGraph(files) {
  const graph = {
    files: {},           // file -> { imports: [], exports: [], importedBy: [] }
    importCounts: {},    // file -> number of times imported
    exportUsage: {},     // file:exportName -> number of times used
  };

  // First pass: collect all files and their exports
  for (const file of files) {
    const relativePath = path.relative(SRC_DIR, file);
    graph.files[relativePath] = {
      fullPath: file,
      imports: extractImports(file),
      exports: extractExports(file),
      importedBy: [],
    };
    graph.importCounts[relativePath] = 0;
  }

  // Second pass: resolve imports and build reverse mapping
  for (const [filePath, data] of Object.entries(graph.files)) {
    const fullPath = path.join(SRC_DIR, filePath);

    for (const importPath of data.imports) {
      const resolved = resolveImportPath(importPath, fullPath);
      if (!resolved) continue; // External package

      const actualFile = findActualFile(resolved);
      if (!actualFile) continue; // Could not resolve

      const relativeDep = path.relative(SRC_DIR, actualFile);

      if (graph.files[relativeDep]) {
        graph.importCounts[relativeDep]++;
        graph.files[relativeDep].importedBy.push(filePath);
      }
    }
  }

  return graph;
}

/**
 * Find files never imported anywhere
 */
function findUnusedFiles(graph) {
  const unused = [];

  for (const [filePath, data] of Object.entries(graph.files)) {
    // Skip index files (barrel exports)
    if (filePath.endsWith('index.ts') || filePath.endsWith('index.tsx')) {
      continue;
    }

    // Skip entry points
    if (CONFIG.entryPoints.some(entry => filePath.includes(entry))) {
      continue;
    }

    // Skip screen files (they're loaded by navigation)
    if (filePath.includes('/screens/')) {
      continue;
    }

    if (graph.importCounts[filePath] === 0) {
      unused.push({
        file: filePath,
        exports: data.exports.map(e => e.name),
        size: fs.statSync(data.fullPath).size,
        lines: fs.readFileSync(data.fullPath, 'utf-8').split('\n').length,
      });
    }
  }

  return unused.sort((a, b) => b.lines - a.lines);
}

/**
 * Find files only imported by one other file (candidates for inlining)
 */
function findSingleUseFiles(graph) {
  const singleUse = [];

  for (const [filePath, data] of Object.entries(graph.files)) {
    if (filePath.endsWith('index.ts') || filePath.endsWith('index.tsx')) {
      continue;
    }

    if (graph.importCounts[filePath] === 1) {
      singleUse.push({
        file: filePath,
        usedBy: data.importedBy[0],
        exports: data.exports.map(e => e.name),
        lines: fs.readFileSync(data.fullPath, 'utf-8').split('\n').length,
      });
    }
  }

  return singleUse.sort((a, b) => a.lines - b.lines);
}

/**
 * Find features with no external usage
 */
function findOrphanedFeatures(graph) {
  // Group files by feature
  const features = {};

  for (const filePath of Object.keys(graph.files)) {
    const match = filePath.match(/^features\/(\w+)\//);
    if (match) {
      const feature = match[1];
      if (!features[feature]) {
        features[feature] = { files: [], externalImports: 0 };
      }
      features[feature].files.push(filePath);
    }
  }

  // Check external imports for each feature
  for (const [filePath, data] of Object.entries(graph.files)) {
    const match = filePath.match(/^features\/(\w+)\//);
    const sourceFeature = match ? match[1] : null;

    for (const importedBy of data.importedBy) {
      const importMatch = importedBy.match(/^features\/(\w+)\//);
      const importingFeature = importMatch ? importMatch[1] : 'other';

      if (sourceFeature && importingFeature !== sourceFeature) {
        features[sourceFeature].externalImports++;
      }
    }
  }

  // Find features with zero external imports
  const orphaned = [];
  for (const [name, data] of Object.entries(features)) {
    if (data.externalImports === 0 && data.files.length > 0) {
      // Check if it has screens (might be navigation entry point)
      const hasScreens = data.files.some(f => f.includes('/screens/'));
      orphaned.push({
        feature: name,
        fileCount: data.files.length,
        hasScreens,
        files: data.files,
      });
    }
  }

  return orphaned;
}

/**
 * Find orphaned test files (tests for components that no longer exist)
 */
function findOrphanedTests(files) {
  const orphaned = [];
  const testFiles = files.filter(f =>
    f.includes('__tests__') ||
    f.includes('.test.') ||
    f.includes('.spec.')
  );

  for (const testFile of testFiles) {
    // Try to find corresponding source file
    const baseName = path.basename(testFile)
      .replace('.test.tsx', '.tsx')
      .replace('.test.ts', '.ts')
      .replace('.spec.tsx', '.tsx')
      .replace('.spec.ts', '.ts');

    const testDir = path.dirname(testFile);
    const possibleSourceDirs = [
      testDir.replace('__tests__', ''),
      testDir.replace('__tests__', 'components'),
      testDir.replace('__tests__', 'hooks'),
      testDir.replace('__tests__', 'utils'),
      path.dirname(testDir),
    ];

    let found = false;
    for (const dir of possibleSourceDirs) {
      const sourcePath = path.join(dir, baseName);
      if (fs.existsSync(sourcePath)) {
        found = true;
        break;
      }
    }

    if (!found) {
      orphaned.push({
        testFile: path.relative(SRC_DIR, testFile),
        expectedSource: baseName,
      });
    }
  }

  return orphaned;
}

/**
 * Find duplicate/similar file names
 */
function findDuplicateNames(files) {
  const names = {};

  for (const file of files) {
    const baseName = path.basename(file);
    if (!names[baseName]) {
      names[baseName] = [];
    }
    names[baseName].push(path.relative(SRC_DIR, file));
  }

  const duplicates = [];
  for (const [name, paths] of Object.entries(names)) {
    if (paths.length > 1) {
      duplicates.push({ name, paths });
    }
  }

  return duplicates.sort((a, b) => b.paths.length - a.paths.length);
}

// ============================================
// REPORTING
// ============================================

function printReport(analysis) {
  console.log('\n' + '='.repeat(60));
  console.log('           DEAD CODE ANALYSIS REPORT');
  console.log('='.repeat(60) + '\n');

  // Summary
  console.log('SUMMARY');
  console.log('-'.repeat(40));
  console.log(`Total files scanned: ${analysis.totalFiles}`);
  console.log(`Unused files found: ${analysis.unusedFiles.length}`);
  console.log(`Single-use files: ${analysis.singleUseFiles.length}`);
  console.log(`Orphaned features: ${analysis.orphanedFeatures.length}`);
  console.log(`Duplicate file names: ${analysis.duplicateNames.length}`);
  console.log();

  // Unused Files (most important)
  if (analysis.unusedFiles.length > 0) {
    console.log('🔴 UNUSED FILES (never imported)');
    console.log('-'.repeat(40));

    const totalLines = analysis.unusedFiles.reduce((sum, f) => sum + f.lines, 0);
    console.log(`Total dead code: ~${totalLines} lines\n`);

    for (const file of analysis.unusedFiles.slice(0, 20)) {
      console.log(`  ${file.file}`);
      console.log(`     ${file.lines} lines, exports: ${file.exports.join(', ') || 'none'}`);
    }

    if (analysis.unusedFiles.length > 20) {
      console.log(`\n  ... and ${analysis.unusedFiles.length - 20} more unused files`);
    }
    console.log();
  }

  // Orphaned Features
  if (analysis.orphanedFeatures.length > 0) {
    console.log('🟡 ORPHANED FEATURES (no external usage)');
    console.log('-'.repeat(40));

    for (const feature of analysis.orphanedFeatures) {
      const warning = feature.hasScreens ? ' (has screens - check navigation)' : '';
      console.log(`  ${feature.feature}: ${feature.fileCount} files${warning}`);
    }
    console.log();
  }

  // Single Use Files (candidates for inlining)
  if (analysis.singleUseFiles.length > 0) {
    console.log('🟢 SINGLE-USE FILES (consider inlining if small)');
    console.log('-'.repeat(40));

    const smallFiles = analysis.singleUseFiles.filter(f => f.lines < 50);
    for (const file of smallFiles.slice(0, 10)) {
      console.log(`  ${file.file} (${file.lines} lines)`);
      console.log(`     → only used by: ${file.usedBy}`);
    }

    if (smallFiles.length > 10) {
      console.log(`\n  ... and ${smallFiles.length - 10} more small single-use files`);
    }
    console.log();
  }

  // Duplicate Names
  if (analysis.duplicateNames.length > 0) {
    console.log('⚠️  DUPLICATE FILE NAMES');
    console.log('-'.repeat(40));

    for (const dup of analysis.duplicateNames.slice(0, 10)) {
      console.log(`  ${dup.name} (${dup.paths.length} copies)`);
      for (const p of dup.paths) {
        console.log(`     - ${p}`);
      }
    }
    console.log();
  }

  // Action Items
  console.log('📋 RECOMMENDED ACTIONS');
  console.log('-'.repeat(40));
  console.log('1. Review and delete unused files (back up first!)');
  console.log('2. Check orphaned features - may be dead or navigation-only');
  console.log('3. Consider inlining small single-use components');
  console.log('4. Resolve duplicate file names for clarity');
  console.log();

  // Generate deletion script
  if (analysis.unusedFiles.length > 0) {
    console.log('🗑️  DELETION COMMANDS (review carefully first!)');
    console.log('-'.repeat(40));
    console.log('# Copy these to a script after reviewing:\n');

    for (const file of analysis.unusedFiles.slice(0, 10)) {
      console.log(`rm "src/${file.file}"`);
    }

    if (analysis.unusedFiles.length > 10) {
      console.log(`# ... and ${analysis.unusedFiles.length - 10} more`);
    }
    console.log();
  }

  console.log('='.repeat(60) + '\n');
}

/**
 * Export results to JSON for further analysis
 */
function exportResults(analysis, outputPath) {
  fs.writeFileSync(outputPath, JSON.stringify(analysis, null, 2));
  console.log(`Full results exported to: ${outputPath}`);
}

// ============================================
// MAIN
// ============================================

function main() {
  console.log('Scanning codebase for dead code...\n');

  // Get all files
  const allFiles = [];
  for (const dir of CONFIG.scanDirs) {
    const dirPath = path.join(SRC_DIR, dir);
    if (fs.existsSync(dirPath)) {
      getAllFiles(dirPath, allFiles);
    }
  }

  console.log(`Found ${allFiles.length} files to analyze`);

  // Build import graph
  console.log('Building import graph...');
  const graph = buildImportGraph(allFiles);

  // Run analysis
  console.log('Analyzing dependencies...\n');
  const analysis = {
    totalFiles: allFiles.length,
    unusedFiles: findUnusedFiles(graph),
    singleUseFiles: findSingleUseFiles(graph),
    orphanedFeatures: findOrphanedFeatures(graph),
    orphanedTests: findOrphanedTests(allFiles),
    duplicateNames: findDuplicateNames(allFiles),
    timestamp: new Date().toISOString(),
  };

  // Print report
  printReport(analysis);

  // Export detailed results
  const outputPath = path.join(__dirname, '../dead-code-report.json');
  exportResults(analysis, outputPath);

  // Return for programmatic use
  return analysis;
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { main, buildImportGraph, findUnusedFiles };
