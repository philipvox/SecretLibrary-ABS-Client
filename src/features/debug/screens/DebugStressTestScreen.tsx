/**
 * src/features/debug/screens/DebugStressTestScreen.tsx
 *
 * Automated stress test screen for runtime monitoring.
 * DEV ONLY - not included in production builds.
 *
 * Tests:
 * - Memory pressure via large allocations
 * - Render stress via rapid state updates
 * - Network resilience via concurrent requests
 * - Audio state transitions
 * - Storage operations
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, Play, Square, RotateCcw, AlertTriangle } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { scale, spacing, useTheme } from '@/shared/theme';
import {
  memoryMonitor,
  listenerMonitor,
  generateErrorReport,
} from '@/utils/runtimeMonitor';

interface TestResult {
  name: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'warning';
  duration?: number;
  details?: string;
  errors?: string[];
}

export function DebugStressTestScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const [currentTest, setCurrentTest] = useState<string | null>(null);
  const abortRef = useRef(false);
  const allocationsRef = useRef<any[]>([]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current = true;
      allocationsRef.current = [];
    };
  }, []);

  const updateResult = useCallback(
    (name: string, update: Partial<TestResult>) => {
      setResults((prev) =>
        prev.map((r) => (r.name === name ? { ...r, ...update } : r))
      );
    },
    []
  );

  // ============================================================
  // TEST DEFINITIONS
  // ============================================================

  const tests: {
    name: string;
    run: () => Promise<{ passed: boolean; details?: string; errors?: string[] }>;
  }[] = [
    {
      name: 'Memory Pressure Test',
      run: async () => {
        const errors: string[] = [];
        const initialMemory = memoryMonitor.getState().heapUsed;

        // Allocate large arrays to trigger memory pressure
        try {
          for (let i = 0; i < 10; i++) {
            if (abortRef.current) break;
            allocationsRef.current.push(new Array(1000000).fill(Math.random()));
            await new Promise((r) => setTimeout(r, 100));
          }
        } catch (e: any) {
          errors.push(`Allocation failed: ${e.message}`);
        }

        // Check memory growth
        const finalMemory = memoryMonitor.getState().heapUsed;
        const growth = finalMemory - initialMemory;

        // Cleanup
        allocationsRef.current = [];

        // Force GC if available
        if ((global as any).gc) {
          (global as any).gc();
        }

        const passed = errors.length === 0;
        return {
          passed,
          details: `Memory grew by ${(growth / 1024 / 1024).toFixed(2)} MB`,
          errors,
        };
      },
    },
    {
      name: 'Rapid Re-render Test',
      run: async () => {
        const errors: string[] = [];
        const renderCount = 100;
        const startTime = Date.now();

        // Simulate rapid state updates
        for (let i = 0; i < renderCount; i++) {
          if (abortRef.current) break;
          setCurrentTest(`Render ${i + 1}/${renderCount}`);
          await new Promise((r) => setTimeout(r, 10));
        }

        const duration = Date.now() - startTime;
        const avgRenderTime = duration / renderCount;

        const passed = avgRenderTime < 50; // 50ms per update is acceptable
        if (!passed) {
          errors.push(`Avg render time ${avgRenderTime.toFixed(2)}ms exceeds 50ms threshold`);
        }

        return {
          passed,
          details: `${renderCount} renders in ${duration}ms (avg: ${avgRenderTime.toFixed(2)}ms)`,
          errors,
        };
      },
    },
    {
      name: 'Concurrent Network Stress',
      run: async () => {
        const errors: string[] = [];
        const concurrentRequests = 20;
        const requests: Promise<any>[] = [];

        // Make concurrent requests to various endpoints
        for (let i = 0; i < concurrentRequests; i++) {
          if (abortRef.current) break;
          requests.push(
            fetch(`https://httpbin.org/delay/1?req=${i}`, {
              signal: AbortSignal.timeout(5000),
            }).catch((e) => {
              errors.push(`Request ${i} failed: ${e.message}`);
              return null;
            })
          );
        }

        const results = await Promise.allSettled(requests);
        const successful = results.filter(
          (r) => r.status === 'fulfilled' && r.value !== null
        ).length;

        const passed = successful >= concurrentRequests * 0.8; // 80% success rate
        return {
          passed,
          details: `${successful}/${concurrentRequests} requests succeeded`,
          errors,
        };
      },
    },
    {
      name: 'Storage Stress Test',
      run: async () => {
        const errors: string[] = [];
        const operations = 50;
        const startTime = Date.now();

        try {
          // Write operations
          for (let i = 0; i < operations; i++) {
            if (abortRef.current) break;
            await AsyncStorage.setItem(
              `stress_test_${i}`,
              JSON.stringify({ index: i, data: new Array(1000).fill('x').join('') })
            );
          }

          // Read operations
          for (let i = 0; i < operations; i++) {
            if (abortRef.current) break;
            await AsyncStorage.getItem(`stress_test_${i}`);
          }

          // Cleanup
          const keys = await AsyncStorage.getAllKeys();
          const testKeys = keys.filter((k) => k.startsWith('stress_test_'));
          await AsyncStorage.multiRemove(testKeys);
        } catch (e: any) {
          errors.push(`Storage operation failed: ${e.message}`);
        }

        const duration = Date.now() - startTime;
        const avgOpTime = duration / (operations * 2);

        const passed = errors.length === 0 && avgOpTime < 50;
        return {
          passed,
          details: `${operations * 2} operations in ${duration}ms (avg: ${avgOpTime.toFixed(2)}ms)`,
          errors,
        };
      },
    },
    {
      name: 'Listener Leak Detection',
      run: async () => {
        const errors: string[] = [];
        const state = listenerMonitor.getState();

        // Check for potential leaks
        Object.entries(state.listeners).forEach(([type, count]) => {
          if (count > 10) {
            errors.push(`Potential ${type} listener leak: ${count} listeners`);
          }
        });

        const passed = errors.length === 0;
        return {
          passed,
          details: `Active listeners: ${JSON.stringify(state.listeners)}`,
          errors,
        };
      },
    },
    {
      name: 'Error Store Health',
      run: async () => {
        const errors: string[] = [];
        const report = generateErrorReport();

        // Check for critical errors
        const criticalCount = report.critical?.length || 0;
        const highCount = report.high?.length || 0;

        if (criticalCount > 0) {
          errors.push(`${criticalCount} critical errors found`);
        }
        if (highCount > 5) {
          errors.push(`${highCount} high severity errors (threshold: 5)`);
        }

        const passed = criticalCount === 0 && highCount <= 5;
        return {
          passed,
          details: `Total errors: ${report.total}, Critical: ${criticalCount}, High: ${highCount}`,
          errors,
        };
      },
    },
  ];

  // ============================================================
  // TEST RUNNER
  // ============================================================

  const runAllTests = useCallback(async () => {
    abortRef.current = false;
    setIsRunning(true);

    // Initialize results
    const initialResults: TestResult[] = tests.map((t) => ({
      name: t.name,
      status: 'pending',
    }));
    setResults(initialResults);

    for (const test of tests) {
      if (abortRef.current) break;

      setCurrentTest(test.name);
      updateResult(test.name, { status: 'running' });

      const startTime = Date.now();
      try {
        const result = await test.run();
        const duration = Date.now() - startTime;

        updateResult(test.name, {
          status: result.passed ? 'passed' : result.errors?.length ? 'failed' : 'warning',
          duration,
          details: result.details,
          errors: result.errors,
        });
      } catch (e: any) {
        updateResult(test.name, {
          status: 'failed',
          duration: Date.now() - startTime,
          errors: [`Uncaught error: ${e.message}`],
        });
      }

      // Brief pause between tests
      await new Promise((r) => setTimeout(r, 500));
    }

    setCurrentTest(null);
    setIsRunning(false);
  }, [tests, updateResult]);

  const stopTests = useCallback(() => {
    abortRef.current = true;
    setIsRunning(false);
    setCurrentTest(null);
  }, []);

  const resetTests = useCallback(() => {
    abortRef.current = true;
    setIsRunning(false);
    setCurrentTest(null);
    setResults([]);
    allocationsRef.current = [];
  }, []);

  const exportReport = useCallback(async () => {
    const report = generateErrorReport();
    const fullReport = {
      timestamp: new Date().toISOString(),
      testResults: results,
      errorReport: report,
    };

    Alert.alert(
      'Error Report',
      `Total Errors: ${report.total}\nCritical: ${report.critical?.length || 0}\nHigh: ${report.high?.length || 0}\n\nFull report logged to console.`
    );

    console.log('=== FULL DEBUG REPORT ===');
    console.log(JSON.stringify(fullReport, null, 2));
  }, [results]);

  // ============================================================
  // RENDER
  // ============================================================

  const getStatusColor = (status: TestResult['status']) => {
    switch (status) {
      case 'passed':
        return '#4CAF50';
      case 'failed':
        return '#F44336';
      case 'warning':
        return '#FF9800';
      case 'running':
        return colors.accent.primary;
      default:
        return colors.text.secondary;
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background.primary }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border.default }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <ChevronLeft size={scale(24)} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text.primary }]}>Stress Tests</Text>
        <View style={styles.headerRight}>
          {isRunning ? (
            <ActivityIndicator color={colors.accent.primary} />
          ) : (
            <TouchableOpacity onPress={exportReport}>
              <AlertTriangle size={scale(22)} color={colors.text.secondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.controlButton, isRunning && styles.controlButtonDisabled]}
          onPress={runAllTests}
          disabled={isRunning}
        >
          <Play size={scale(18)} color={isRunning ? colors.text.secondary : colors.accent.primary} />
          <Text style={[styles.controlText, { color: colors.text.primary }, isRunning && styles.controlTextDisabled]}>
            Run All
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, !isRunning && styles.controlButtonDisabled]}
          onPress={stopTests}
          disabled={!isRunning}
        >
          <Square size={scale(18)} color={!isRunning ? colors.text.secondary : '#F44336'} />
          <Text style={[styles.controlText, { color: colors.text.primary }, !isRunning && styles.controlTextDisabled]}>
            Stop
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.controlButton} onPress={resetTests}>
          <RotateCcw size={scale(18)} color={colors.text.secondary} />
          <Text style={[styles.controlText, { color: colors.text.primary }]}>Reset</Text>
        </TouchableOpacity>
      </View>

      {/* Current Test Indicator */}
      {currentTest && (
        <View style={styles.currentTest}>
          <ActivityIndicator size="small" color={colors.accent.primary} />
          <Text style={[styles.currentTestText, { color: colors.accent.primary }]}>{currentTest}</Text>
        </View>
      )}

      {/* Results */}
      <ScrollView style={styles.results} contentContainerStyle={styles.resultsContent}>
        {results.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: colors.text.primary }]}>
              Press "Run All" to start stress tests
            </Text>
            <Text style={[styles.emptySubtext, { color: colors.text.secondary }]}>
              Tests will check memory, rendering, network, storage, and monitoring health
            </Text>
          </View>
        ) : (
          results.map((result) => (
            <View key={result.name} style={styles.resultCard}>
              <View style={styles.resultHeader}>
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: getStatusColor(result.status) },
                  ]}
                />
                <Text style={[styles.resultName, { color: colors.text.primary }]}>{result.name}</Text>
                {result.duration !== undefined && (
                  <Text style={[styles.resultDuration, { color: colors.text.secondary }]}>{result.duration}ms</Text>
                )}
              </View>

              {result.details && (
                <Text style={[styles.resultDetails, { color: colors.text.secondary }]}>{result.details}</Text>
              )}

              {result.errors && result.errors.length > 0 && (
                <View style={styles.errorsContainer}>
                  {result.errors.map((error, i) => (
                    <Text key={i} style={styles.errorText}>
                      • {error}
                    </Text>
                  ))}
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>

      {/* Summary */}
      {results.length > 0 && !isRunning && (
        <View style={[styles.summary, { paddingBottom: insets.bottom + spacing.md, borderTopColor: colors.border.default }]}>
          <Text style={[styles.summaryText, { color: colors.text.secondary }]}>
            Passed: {results.filter((r) => r.status === 'passed').length} |{' '}
            Failed: {results.filter((r) => r.status === 'failed').length} |{' '}
            Warning: {results.filter((r) => r.status === 'warning').length}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // backgroundColor set via themeColors in JSX
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    // borderBottomColor set via themeColors in JSX
  },
  backButton: {
    padding: spacing.xs,
    marginRight: spacing.sm,
  },
  title: {
    flex: 1,
    fontSize: scale(18),
    fontWeight: '600',
    // color set via themeColors in JSX
  },
  headerRight: {
    width: scale(40),
    alignItems: 'flex-end',
  },
  controls: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  controlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: scale(8),
    backgroundColor: 'rgba(255,255,255,0.05)',
    gap: spacing.xs,
  },
  controlButtonDisabled: {
    opacity: 0.5,
  },
  controlText: {
    fontSize: scale(14),
    // color set via themeColors in JSX
  },
  controlTextDisabled: {
    // Use inline styles via themeColors in JSX
  },
  currentTest: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: 'rgba(243,182,12,0.1)',
    gap: spacing.sm,
  },
  currentTestText: {
    fontSize: scale(13),
    // color set via themeColors in JSX
    fontWeight: '500',
  },
  results: {
    flex: 1,
  },
  resultsContent: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: scale(60),
  },
  emptyText: {
    fontSize: scale(16),
    // color set via themeColors in JSX
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: scale(13),
    // color set via themeColors in JSX
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  resultCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: scale(12),
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: scale(10),
    height: scale(10),
    borderRadius: scale(5),
    marginRight: spacing.sm,
  },
  resultName: {
    flex: 1,
    fontSize: scale(15),
    fontWeight: '500',
    // color set via themeColors in JSX
  },
  resultDuration: {
    fontSize: scale(12),
    // color set via themeColors in JSX
  },
  resultDetails: {
    fontSize: scale(13),
    // color set via themeColors in JSX
    marginTop: spacing.xs,
    marginLeft: scale(18),
  },
  errorsContainer: {
    marginTop: spacing.sm,
    marginLeft: scale(18),
    padding: spacing.sm,
    backgroundColor: 'rgba(244,67,54,0.1)',
    borderRadius: scale(6),
  },
  errorText: {
    fontSize: scale(12),
    color: '#F44336',
    lineHeight: scale(18),
  },
  summary: {
    borderTopWidth: 1,
    // borderTopColor set via themeColors in JSX
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  summaryText: {
    fontSize: scale(14),
    // color set via themeColors in JSX
    textAlign: 'center',
  },
});
