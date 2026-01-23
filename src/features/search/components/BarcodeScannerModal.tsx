/**
 * src/features/search/components/BarcodeScannerModal.tsx
 *
 * Modal component for scanning ISBN barcodes to find books in the library cache.
 * Uses expo-camera for barcode scanning.
 *
 * When a book is not found by ISBN, offers to search external metadata providers
 * (Hardcover, Audible, etc.) to get the book title/author, then fuzzy search
 * the local library for similar titles.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/shared/components/Icon';
import { useSecretLibraryColors } from '@/shared/theme';
import { useLibraryCache } from '@/core/cache';
import { LibraryItem, BookMetadata } from '@/core/types';
import { apiClient } from '@/core/api';
import { createLogger } from '@/shared/utils/logger';

const log = createLogger('BarcodeScanner');

// Type for barcode scanning result (matches expo-camera)
interface BarcodeScanningResult {
  data: string;
  type: string;
  cornerPoints?: { x: number; y: number }[];
  bounds?: { origin: { x: number; y: number }; size: { width: number; height: number } };
}

// Dynamically import expo-camera to handle missing native module gracefully
let CameraView: any = null;
let useCameraPermissions: any = null;
let cameraModuleAvailable = false;

try {
  const expoCamera = require('expo-camera');
  CameraView = expoCamera.CameraView;
  useCameraPermissions = expoCamera.useCameraPermissions;
  cameraModuleAvailable = true;
} catch (e) {
  log.warn('expo-camera native module not available - barcode scanning disabled');
}

interface BarcodeScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onBookFound: (book: LibraryItem) => void;
  onISBNNotFound: (isbn: string) => void;
  /** Called when user wants to search library for similar titles based on external metadata */
  onSearchSimilar?: (searchQuery: string, isbn: string) => void;
}

/**
 * Search for a book by ISBN in the library cache
 */
function findBookByISBN(items: LibraryItem[], isbn: string): LibraryItem | null {
  // Normalize ISBN - remove hyphens and spaces
  const normalizedISBN = isbn.replace(/[-\s]/g, '');

  for (const item of items) {
    const metadata = item.media?.metadata as BookMetadata | undefined;
    if (!metadata?.isbn) continue;

    // Normalize stored ISBN for comparison
    const storedISBN = metadata.isbn.replace(/[-\s]/g, '');

    if (storedISBN === normalizedISBN) {
      return item;
    }
  }

  return null;
}

export function BarcodeScannerModal({
  visible,
  onClose,
  onBookFound,
  onISBNNotFound,
  onSearchSimilar,
}: BarcodeScannerModalProps) {
  const insets = useSafeAreaInsets();
  const colors = useSecretLibraryColors();
  const { items } = useLibraryCache();

  // Use camera permissions only if module is available
  const [permission, requestPermission] = cameraModuleAvailable && useCameraPermissions
    ? useCameraPermissions()
    : [null, () => {}];
  const [isScanning, setIsScanning] = useState(true);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<'found' | 'not_found' | 'prompt' | null>(null);
  const [isSearchingExternal, setIsSearchingExternal] = useState(false);
  const [externalBookTitle, setExternalBookTitle] = useState<string | null>(null);

  // Handle barcode scan
  const handleBarcodeScanned = useCallback((result: BarcodeScanningResult) => {
    if (!isScanning) return;

    const { data, type } = result;

    // Only process ISBN-13 (EAN-13) and ISBN-10 (EAN-10/UPC) barcodes
    // ISBN-13 starts with 978 or 979
    const isISBN = type === 'ean13' || type === 'ean8' || type === 'upc_a' || type === 'upc_e';
    const looksLikeISBN = data.startsWith('978') || data.startsWith('979') || data.length === 10;

    if (!isISBN && !looksLikeISBN) {
      log.debug('Scanned non-ISBN barcode:', type, data);
      return;
    }

    // Prevent duplicate scans
    if (data === lastScannedCode) return;

    log.info('Scanned ISBN barcode:', data);
    setIsScanning(false);
    setLastScannedCode(data);

    // Search for book in cache
    const book = findBookByISBN(items, data);

    if (book) {
      log.info('Found book:', (book.media?.metadata as BookMetadata)?.title);
      setScanResult('found');
      // Short delay to show feedback
      setTimeout(() => {
        onBookFound(book);
        onClose();
      }, 500);
    } else {
      log.info('ISBN not found in library:', data);
      // Show prompt to search for similar titles if callback provided
      if (onSearchSimilar) {
        setScanResult('prompt');
      } else {
        // Legacy behavior: just notify and close
        setScanResult('not_found');
        onISBNNotFound(data);
        setTimeout(() => {
          onClose();
        }, 2000);
      }
    }
  }, [isScanning, lastScannedCode, items, onBookFound, onISBNNotFound, onSearchSimilar, onClose]);

  // Lookup ISBN via Open Library API (free, no API key needed)
  const lookupISBN = async (isbn: string): Promise<{ title?: string; author?: string } | null> => {
    try {
      const response = await fetch(`https://openlibrary.org/isbn/${isbn}.json`);
      if (!response.ok) return null;

      const data = await response.json();
      let title = data.title;
      let author: string | undefined;

      // Get author name if available
      if (data.authors && data.authors.length > 0) {
        const authorKey = data.authors[0].key;
        if (authorKey) {
          const authorResponse = await fetch(`https://openlibrary.org${authorKey}.json`);
          if (authorResponse.ok) {
            const authorData = await authorResponse.json();
            author = authorData.name;
          }
        }
      }

      return { title, author };
    } catch (error) {
      log.error('ISBN lookup failed:', error);
      return null;
    }
  };

  // Handle user choosing to search for similar titles
  const handleSearchSimilar = useCallback(async () => {
    if (!lastScannedCode || !onSearchSimilar) return;

    setIsSearchingExternal(true);
    log.info('Looking up ISBN:', lastScannedCode);

    try {
      const result = await lookupISBN(lastScannedCode);

      if (result?.title) {
        setExternalBookTitle(result.title);
        log.info('Found:', result.title, 'by', result.author);

        const fullQuery = result.author
          ? `${result.title} ${result.author}`
          : result.title;

        onSearchSimilar(fullQuery, lastScannedCode);
        onClose();
        return;
      }

      // No results - search with ISBN
      log.info('No results, using ISBN');
      onSearchSimilar(lastScannedCode, lastScannedCode);
      onClose();
    } catch (error) {
      log.error('Lookup failed:', error);
      onSearchSimilar(lastScannedCode, lastScannedCode);
      onClose();
    } finally {
      setIsSearchingExternal(false);
    }
  }, [lastScannedCode, onSearchSimilar, onClose]);

  // Handle user declining to search
  const handleDeclineSearch = useCallback(() => {
    if (lastScannedCode) {
      onISBNNotFound(lastScannedCode);
    }
    onClose();
  }, [lastScannedCode, onISBNNotFound, onClose]);

  // Reset state when modal opens
  React.useEffect(() => {
    if (visible) {
      setIsScanning(true);
      setLastScannedCode(null);
      setScanResult(null);
      setIsSearchingExternal(false);
      setExternalBookTitle(null);
    }
  }, [visible]);

  // Camera module not available (needs native rebuild)
  if (!cameraModuleAvailable) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <View style={[styles.container, { backgroundColor: colors.black, paddingTop: insets.top }]}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Icon name="X" size={24} color={colors.white} />
            </TouchableOpacity>
          </View>
          <View style={styles.permissionContainer}>
            <Icon name="Camera" size={64} color={colors.gray} />
            <Text style={[styles.permissionTitle, { color: colors.white }]}>
              Camera Not Available
            </Text>
            <Text style={[styles.permissionText, { color: colors.gray }]}>
              The barcode scanner requires a native app rebuild. Please rebuild and reinstall the app to enable this feature.
            </Text>
            <TouchableOpacity
              style={[styles.permissionButton, { backgroundColor: colors.white }]}
              onPress={onClose}
            >
              <Text style={[styles.permissionButtonText, { color: colors.black }]}>
                Close
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  // Permission not determined yet
  if (!permission) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <View style={[styles.container, { backgroundColor: colors.black }]}>
          <ActivityIndicator size="large" color={colors.white} />
        </View>
      </Modal>
    );
  }

  // Permission denied
  if (!permission.granted) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <View style={[styles.container, { backgroundColor: colors.black, paddingTop: insets.top }]}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Icon name="X" size={24} color={colors.white} />
            </TouchableOpacity>
          </View>
          <View style={styles.permissionContainer}>
            <Icon name="Camera" size={64} color={colors.gray} />
            <Text style={[styles.permissionTitle, { color: colors.white }]}>
              Camera Permission Required
            </Text>
            <Text style={[styles.permissionText, { color: colors.gray }]}>
              To scan ISBN barcodes, please allow camera access
            </Text>
            <TouchableOpacity
              style={[styles.permissionButton, { backgroundColor: colors.white }]}
              onPress={requestPermission}
            >
              <Text style={[styles.permissionButtonText, { color: colors.black }]}>
                Grant Permission
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.black }]}>
        {/* Camera View */}
        <CameraView
          style={styles.camera}
          facing="back"
          barcodeScannerSettings={{
            barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'],
          }}
          onBarcodeScanned={isScanning ? handleBarcodeScanned : undefined}
        />

        {/* Overlay */}
        <View style={styles.overlay}>
          {/* Header */}
          <View style={[styles.header, { paddingTop: insets.top }]}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Icon name="X" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Scan ISBN Barcode</Text>
            <View style={styles.closeButton} />
          </View>

          {/* Scan Area */}
          <View style={styles.scanArea}>
            <View style={styles.scanFrame}>
              {/* Corner brackets */}
              <View style={[styles.corner, styles.cornerTopLeft]} />
              <View style={[styles.corner, styles.cornerTopRight]} />
              <View style={[styles.corner, styles.cornerBottomLeft]} />
              <View style={[styles.corner, styles.cornerBottomRight]} />
            </View>
          </View>

          {/* Instructions / Result */}
          <View style={styles.footer}>
            {scanResult === 'found' && (
              <View style={styles.resultContainer}>
                <Icon name="CheckCircle" size={32} color="#4CAF50" />
                <Text style={styles.resultText}>Book found!</Text>
              </View>
            )}
            {scanResult === 'not_found' && (
              <View style={styles.resultContainer}>
                <Icon name="XCircle" size={32} color="#FF5252" />
                <Text style={styles.resultText}>ISBN not in library</Text>
                <Text style={styles.resultSubtext}>ISBN: {lastScannedCode}</Text>
              </View>
            )}
            {scanResult === 'prompt' && (
              <View style={styles.resultContainer}>
                {isSearchingExternal ? (
                  <>
                    <ActivityIndicator size="large" color="#FFFFFF" />
                    <Text style={styles.resultText}>Looking up book info...</Text>
                    {externalBookTitle && (
                      <Text style={styles.resultSubtext}>Found: {externalBookTitle}</Text>
                    )}
                  </>
                ) : (
                  <>
                    <Icon name="Search" size={32} color="#F3B60C" />
                    <Text style={styles.resultText}>ISBN not in library</Text>
                    <Text style={styles.resultSubtext}>ISBN: {lastScannedCode}</Text>
                    <Text style={[styles.promptText, { marginTop: 16 }]}>
                      Search for similar titles?
                    </Text>
                    <View style={styles.promptButtons}>
                      <TouchableOpacity
                        style={[styles.promptButton, styles.promptButtonSecondary]}
                        onPress={handleDeclineSearch}
                      >
                        <Text style={styles.promptButtonTextSecondary}>No thanks</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.promptButton, styles.promptButtonPrimary]}
                        onPress={handleSearchSimilar}
                      >
                        <Text style={styles.promptButtonTextPrimary}>Yes, search</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            )}
            {!scanResult && (
              <Text style={styles.instructions}>
                Position the barcode inside the frame
              </Text>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  closeButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  scanArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: 280,
    height: 160,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: '#FFFFFF',
  },
  cornerTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 8,
  },
  cornerTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 8,
  },
  cornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 8,
  },
  cornerBottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 8,
  },
  footer: {
    paddingVertical: 40,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
  },
  instructions: {
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
  },
  resultContainer: {
    alignItems: 'center',
    gap: 8,
  },
  resultText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  resultSubtext: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
  },
  promptText: {
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
  },
  promptButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  promptButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  promptButtonPrimary: {
    backgroundColor: '#F3B60C',
  },
  promptButtonSecondary: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  promptButtonTextPrimary: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '600',
  },
  promptButtonTextSecondary: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 16,
  },
  permissionText: {
    fontSize: 16,
    textAlign: 'center',
  },
  permissionButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  permissionButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
