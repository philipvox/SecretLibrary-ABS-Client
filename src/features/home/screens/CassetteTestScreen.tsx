/**
 * CassetteTestScreen.tsx
 *
 * Standalone test screen for the CassettePlayer component.
 * Access via Profile > "Test Cassette" button (temporary)
 */

import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  SafeAreaView,
  TouchableOpacity,
  Image,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import CassettePlayer from '../components/CassettePlayer';
import { colors, wp, hp } from '@/shared/theme';

const SCREEN_WIDTH = wp(100);
const SCREEN_HEIGHT = hp(100);
const COLORS = { background: colors.backgroundPrimary, accent: colors.accent };

// Scale to 80% of previous size
const CASSETTE_SCALE = (SCREEN_WIDTH * 0.85 * 0.8) / 263;

// Test cover - Harry Potter and the Sorcerer's Stone
const SAMPLE_COVER = 'https://covers.openlibrary.org/b/isbn/9780590353427-L.jpg';

export function CassetteTestScreen() {
  const navigation = useNavigation();
  const [progress, setProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <View style={styles.container}>
      {/* Blurred background (like HomeScreen) */}
      <View style={styles.backgroundContainer}>
        <Image
          source={{ uri: SAMPLE_COVER }}
          style={styles.backgroundImage}
          resizeMode="cover"
          blurRadius={15}
        />
        <BlurView intensity={50} style={StyleSheet.absoluteFill} tint="dark" />
        <View style={styles.brightnessOverlay} />
        <LinearGradient
          colors={['transparent', 'transparent', COLORS.background]}
          locations={[0, 0.4, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Svg width={24} height={24} viewBox="0 0 24 24">
              <Path d="M15 18l-6-6 6-6" stroke="#fff" strokeWidth={2} fill="none" />
            </Svg>
          </TouchableOpacity>
          <Text style={styles.title}>Cassette Test</Text>
          <View style={styles.backButton} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Cassette Player - With Cover */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>With Cover Image</Text>
            <CassettePlayer
              scale={CASSETTE_SCALE}
              coverUrl={SAMPLE_COVER}
              onPlayStateChange={(playing) => console.log('Playing:', playing)}
              onProgressChange={(p) => console.log('Progress:', p.toFixed(3))}
            />
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Controlled Mode Preview */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Controlled Mode</Text>
            <Text style={styles.subtitle}>External progress: {(progress * 100).toFixed(0)}%</Text>

            {/* Mini cassette controlled externally */}
            <View style={styles.miniCassette}>
              <CassettePlayer
                scale={CASSETTE_SCALE * 0.6}
                coverUrl={SAMPLE_COVER}
                progress={progress}
                isPlaying={isPlaying}
                hideControls
              />
            </View>

            {/* External controls */}
            <View style={styles.externalControls}>
              <TouchableOpacity
                style={styles.extBtn}
                onPress={() => setProgress(Math.max(0, progress - 0.1))}
              >
                <Text style={styles.extBtnText}>- 10%</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.extBtn, isPlaying && styles.extBtnActive]}
                onPress={() => setIsPlaying(!isPlaying)}
              >
                <Text style={[styles.extBtnText, isPlaying && styles.extBtnTextActive]}>
                  {isPlaying ? 'Stop' : 'Spin'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.extBtn}
                onPress={() => setProgress(Math.min(1, progress + 0.1))}
              >
                <Text style={styles.extBtnText}>+ 10%</Text>
              </TouchableOpacity>
            </View>

            {/* Progress presets */}
            <View style={styles.presets}>
              <TouchableOpacity style={styles.presetBtn} onPress={() => setProgress(0)}>
                <Text style={styles.presetText}>0%</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.presetBtn} onPress={() => setProgress(0.25)}>
                <Text style={styles.presetText}>25%</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.presetBtn} onPress={() => setProgress(0.5)}>
                <Text style={styles.presetText}>50%</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.presetBtn} onPress={() => setProgress(0.75)}>
                <Text style={styles.presetText}>75%</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.presetBtn} onPress={() => setProgress(1)}>
                <Text style={styles.presetText}>100%</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Spacer for scroll */}
          <View style={{ height: 100 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  backgroundContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.65,
    overflow: 'hidden',
  },
  backgroundImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.65,
    transform: [{ scale: 1.1 }],
    opacity: 0.8,
  },
  brightnessOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 20,
  },
  section: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 20,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 40,
    marginHorizontal: 40,
  },
  miniCassette: {
    marginVertical: 10,
  },
  externalControls: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  extBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  extBtnActive: {
    backgroundColor: '#F4B60C',
    borderColor: '#F4B60C',
  },
  extBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  extBtnTextActive: {
    color: '#000',
  },
  presets: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  presetBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 6,
  },
  presetText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
  },
});

export default CassetteTestScreen;
