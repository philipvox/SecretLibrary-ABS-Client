#!/usr/bin/env node
/**
 * Accessibility Checker Script
 *
 * Scans React Native components for missing accessibility props.
 * Usage: node docs/audits/scripts/check-accessibility.js [feature]
 */

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '../../../src');

// Interactive components that need accessibility
const INTERACTIVE_COMPONENTS = [
  'TouchableOpacity',
  'TouchableHighlight',
  'TouchableWithoutFeedback',
  'TouchableNativeFeedback',
  'Pressable',
  'Button',
];

// Required accessibility props for different patterns
const A11Y_REQUIREMENTS = {
  button: ['accessibilityLabel', 'accessibilityRole'],
  adjustable: ['accessibilityLabel', 'accessibilityRole', 'accessibilityValue'],
  tab: ['accessibilityLabel', 'accessibilityRole', 'accessibilityState'],
  link: ['accessibilityLabel', 'accessibilityRole'],
};

/**
 * Recursively get all TSX files in a directory
 */
function getFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;

  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (!item.startsWith('__') && item !== 'node_modules') {
        getFiles(fullPath, files);
      }
    } else if (item.endsWith('.tsx')) {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * Find interactive components without accessibility props
 */
function checkFileAccessibility(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const issues = [];
  const lines = content.split('\n');

  // Track component occurrences
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    for (const component of INTERACTIVE_COMPONENTS) {
      // Match opening tag for interactive component
      const tagPattern = new RegExp(`<${component}[\\s>]`);
      if (tagPattern.test(line)) {
        // Look for accessibilityLabel in nearby lines (component might span multiple lines)
        const contextStart = Math.max(0, i - 2);
        const contextEnd = Math.min(lines.length - 1, i + 15);
        const context = lines.slice(contextStart, contextEnd + 1).join('\n');

        // Check if this is a self-closing tag or find the closing tag
        const hasA11yLabel = /accessibilityLabel/.test(context);
        const hasA11yRole = /accessibilityRole/.test(context);
        const hasA11yHint = /accessibilityHint/.test(context);

        if (!hasA11yLabel) {
          issues.push({
            line: lineNum,
            component,
            missing: 'accessibilityLabel',
            severity: 'critical',
          });
        }

        if (!hasA11yRole) {
          issues.push({
            line: lineNum,
            component,
            missing: 'accessibilityRole',
            severity: 'high',
          });
        }
      }
    }

    // Check for TextInput without accessibility
    if (/<TextInput[\s>]/.test(line)) {
      const contextStart = Math.max(0, i - 2);
      const contextEnd = Math.min(lines.length - 1, i + 10);
      const context = lines.slice(contextStart, contextEnd + 1).join('\n');

      if (!/accessibilityLabel/.test(context)) {
        issues.push({
          line: lineNum,
          component: 'TextInput',
          missing: 'accessibilityLabel',
          severity: 'high',
        });
      }
    }

    // Check for reduced motion support in animated components
    if (/useAnimated|useSpring|withTiming|withSpring/.test(line)) {
      const fileContent = content;
      if (!/useReducedMotion/.test(fileContent)) {
        // Only report once per file
        if (!issues.some(i => i.missing === 'useReducedMotion')) {
          issues.push({
            line: lineNum,
            component: 'Animation',
            missing: 'useReducedMotion',
            severity: 'medium',
          });
        }
      }
    }
  }

  return issues;
}

/**
 * Analyze accessibility across codebase
 */
function analyzeAccessibility(targetDir = null) {
  const searchDir = targetDir || path.join(SRC_DIR, 'features');
  const files = getFiles(searchDir);

  const results = {
    totalFiles: files.length,
    filesWithIssues: 0,
    totalIssues: 0,
    issuesBySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
    issuesByComponent: {},
    fileResults: [],
  };

  for (const file of files) {
    const relativePath = path.relative(SRC_DIR, file);
    const issues = checkFileAccessibility(file);

    if (issues.length > 0) {
      results.filesWithIssues++;
      results.totalIssues += issues.length;

      for (const issue of issues) {
        results.issuesBySeverity[issue.severity]++;
        results.issuesByComponent[issue.component] =
          (results.issuesByComponent[issue.component] || 0) + 1;
      }

      results.fileResults.push({
        file: relativePath,
        issues,
      });
    }
  }

  return results;
}

/**
 * Print accessibility report
 */
function printReport(results) {
  console.log('\n========================================');
  console.log('     ACCESSIBILITY ANALYSIS REPORT      ');
  console.log('========================================\n');

  // Summary
  console.log('SUMMARY');
  console.log('-------');
  console.log(`Total Files Scanned: ${results.totalFiles}`);
  console.log(`Files with Issues: ${results.filesWithIssues}`);
  console.log(`Total Issues: ${results.totalIssues}`);
  console.log();

  // Issues by severity
  console.log('ISSUES BY SEVERITY');
  console.log('------------------');
  console.log(`🔴 Critical: ${results.issuesBySeverity.critical}`);
  console.log(`🟠 High: ${results.issuesBySeverity.high}`);
  console.log(`🟡 Medium: ${results.issuesBySeverity.medium}`);
  console.log(`🟢 Low: ${results.issuesBySeverity.low}`);
  console.log();

  // Issues by component
  console.log('ISSUES BY COMPONENT');
  console.log('-------------------');
  const sortedComponents = Object.entries(results.issuesByComponent)
    .sort((a, b) => b[1] - a[1]);
  for (const [component, count] of sortedComponents) {
    console.log(`${component}: ${count} issues`);
  }
  console.log();

  // Detailed file issues (top 10)
  if (results.fileResults.length > 0) {
    console.log('TOP FILES NEEDING ATTENTION');
    console.log('---------------------------');
    const sortedFiles = results.fileResults
      .sort((a, b) => b.issues.length - a.issues.length)
      .slice(0, 10);

    for (const { file, issues } of sortedFiles) {
      console.log(`\n${file} (${issues.length} issues)`);
      const criticalIssues = issues.filter(i => i.severity === 'critical');
      for (const issue of criticalIssues.slice(0, 3)) {
        console.log(`  Line ${issue.line}: ${issue.component} missing ${issue.missing}`);
      }
      if (criticalIssues.length > 3) {
        console.log(`  ... and ${criticalIssues.length - 3} more critical issues`);
      }
    }
  }

  // Accessibility score
  const maxScore = 100;
  const deductions = {
    critical: 5,
    high: 2,
    medium: 1,
    low: 0.5,
  };
  let score = maxScore;
  for (const [severity, count] of Object.entries(results.issuesBySeverity)) {
    score -= count * deductions[severity];
  }
  score = Math.max(0, Math.min(100, score));

  console.log('\n\nOVERALL ACCESSIBILITY SCORE');
  console.log('---------------------------');
  const emoji = score >= 90 ? '🟢' : score >= 70 ? '🟡' : score >= 50 ? '🟠' : '🔴';
  console.log(`${emoji} ${Math.round(score)}/100`);

  console.log('\n========================================\n');

  return score;
}

// Parse command line arguments
const args = process.argv.slice(2);
let targetDir = null;

if (args.length > 0) {
  // Check if it's a feature name
  const featurePath = path.join(SRC_DIR, 'features', args[0]);
  if (fs.existsSync(featurePath)) {
    targetDir = featurePath;
    console.log(`Analyzing feature: ${args[0]}`);
  } else {
    console.error(`Feature not found: ${args[0]}`);
    process.exit(1);
  }
}

// Run analysis
const results = analyzeAccessibility(targetDir);
printReport(results);

// Export for use as module
module.exports = { analyzeAccessibility, checkFileAccessibility };
