#!/usr/bin/env node
/**
 * Dependency Analyzer Script
 *
 * Analyzes cross-feature dependencies in the codebase.
 * Usage: node docs/audits/scripts/analyze-dependencies.js
 */

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '../../../src');
const FEATURES_DIR = path.join(SRC_DIR, 'features');

// Patterns to match imports
const IMPORT_PATTERNS = {
  feature: /@\/features\/(\w+)/g,
  core: /@\/core\/(\w+)/g,
  shared: /@\/shared\/(\w+)/g,
};

/**
 * Recursively get all TypeScript files in a directory
 */
function getFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;

  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      getFiles(fullPath, files);
    } else if (item.endsWith('.tsx') || item.endsWith('.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * Extract imports from a file
 */
function extractImports(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const imports = {
    features: new Set(),
    core: new Set(),
    shared: new Set(),
  };

  // Match feature imports
  let match;
  while ((match = IMPORT_PATTERNS.feature.exec(content)) !== null) {
    imports.features.add(match[1]);
  }
  IMPORT_PATTERNS.feature.lastIndex = 0;

  while ((match = IMPORT_PATTERNS.core.exec(content)) !== null) {
    imports.core.add(match[1]);
  }
  IMPORT_PATTERNS.core.lastIndex = 0;

  while ((match = IMPORT_PATTERNS.shared.exec(content)) !== null) {
    imports.shared.add(match[1]);
  }
  IMPORT_PATTERNS.shared.lastIndex = 0;

  return {
    features: Array.from(imports.features),
    core: Array.from(imports.core),
    shared: Array.from(imports.shared),
  };
}

/**
 * Get feature name from file path
 */
function getFeatureName(filePath) {
  const match = filePath.match(/features\/(\w+)/);
  return match ? match[1] : null;
}

/**
 * Analyze all features
 */
function analyzeFeatures() {
  const features = fs.readdirSync(FEATURES_DIR).filter(f => {
    const stat = fs.statSync(path.join(FEATURES_DIR, f));
    return stat.isDirectory();
  });

  const analysis = {
    features: {},
    crossFeatureDeps: {},
    circularDeps: [],
  };

  for (const feature of features) {
    const featureDir = path.join(FEATURES_DIR, feature);
    const files = getFiles(featureDir);

    const featureImports = {
      features: new Set(),
      core: new Set(),
      shared: new Set(),
      fileCount: files.length,
      loc: 0,
    };

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      featureImports.loc += content.split('\n').length;

      const imports = extractImports(file);
      imports.features.forEach(f => {
        if (f !== feature) featureImports.features.add(f);
      });
      imports.core.forEach(c => featureImports.core.add(c));
      imports.shared.forEach(s => featureImports.shared.add(s));
    }

    analysis.features[feature] = {
      dependsOn: Array.from(featureImports.features),
      core: Array.from(featureImports.core),
      shared: Array.from(featureImports.shared),
      fileCount: featureImports.fileCount,
      loc: featureImports.loc,
    };
  }

  // Build reverse dependency map
  for (const [feature, data] of Object.entries(analysis.features)) {
    for (const dep of data.dependsOn) {
      if (!analysis.crossFeatureDeps[dep]) {
        analysis.crossFeatureDeps[dep] = [];
      }
      analysis.crossFeatureDeps[dep].push(feature);
    }
  }

  // Detect circular dependencies
  for (const [feature, data] of Object.entries(analysis.features)) {
    for (const dep of data.dependsOn) {
      const depData = analysis.features[dep];
      if (depData && depData.dependsOn.includes(feature)) {
        const pair = [feature, dep].sort().join(' <-> ');
        if (!analysis.circularDeps.includes(pair)) {
          analysis.circularDeps.push(pair);
        }
      }
    }
  }

  return analysis;
}

/**
 * Format and print analysis
 */
function printAnalysis(analysis) {
  console.log('\n========================================');
  console.log('       DEPENDENCY ANALYSIS REPORT       ');
  console.log('========================================\n');

  // Summary
  const featureCount = Object.keys(analysis.features).length;
  const totalLoc = Object.values(analysis.features).reduce((sum, f) => sum + f.loc, 0);
  const totalFiles = Object.values(analysis.features).reduce((sum, f) => sum + f.fileCount, 0);

  console.log('SUMMARY');
  console.log('-------');
  console.log(`Total Features: ${featureCount}`);
  console.log(`Total Files: ${totalFiles}`);
  console.log(`Total LOC: ${totalLoc.toLocaleString()}`);
  console.log();

  // Feature Dependencies
  console.log('FEATURE DEPENDENCIES');
  console.log('--------------------');
  for (const [feature, data] of Object.entries(analysis.features).sort((a, b) => b[1].loc - a[1].loc)) {
    console.log(`\n${feature} (${data.fileCount} files, ${data.loc.toLocaleString()} LOC)`);
    if (data.dependsOn.length > 0) {
      console.log(`  Depends on: ${data.dependsOn.join(', ')}`);
    }
    if (analysis.crossFeatureDeps[feature]) {
      console.log(`  Used by: ${analysis.crossFeatureDeps[feature].join(', ')}`);
    }
  }

  // Cross-feature dependency matrix
  console.log('\n\nCROSS-FEATURE USAGE');
  console.log('-------------------');
  const sortedDeps = Object.entries(analysis.crossFeatureDeps)
    .sort((a, b) => b[1].length - a[1].length);

  for (const [feature, usedBy] of sortedDeps) {
    console.log(`${feature}: used by ${usedBy.length} features (${usedBy.join(', ')})`);
  }

  // Circular dependencies
  if (analysis.circularDeps.length > 0) {
    console.log('\n\n⚠️  CIRCULAR DEPENDENCIES DETECTED');
    console.log('-----------------------------------');
    for (const dep of analysis.circularDeps) {
      console.log(`  ${dep}`);
    }
  } else {
    console.log('\n\n✅ No circular dependencies detected');
  }

  // Most connected features
  console.log('\n\nMOST CONNECTED FEATURES');
  console.log('-----------------------');
  const connections = Object.entries(analysis.features)
    .map(([name, data]) => ({
      name,
      outgoing: data.dependsOn.length,
      incoming: (analysis.crossFeatureDeps[name] || []).length,
      total: data.dependsOn.length + (analysis.crossFeatureDeps[name] || []).length,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  for (const { name, outgoing, incoming, total } of connections) {
    console.log(`${name}: ${total} connections (${outgoing} out, ${incoming} in)`);
  }

  console.log('\n========================================\n');
}

// Run analysis
const analysis = analyzeFeatures();
printAnalysis(analysis);

// Export for use as module
module.exports = { analyzeFeatures, extractImports };
