/**
 * src/features/player/components/AudioWaveform.tsx
 */

import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useAudioSampleListener, AudioPlayer } from 'expo-audio';
import { audioService } from '../services/audioService';
import { WAVEFORM_WIDTH, WAVEFORM_HEIGHT, NUM_POINTS } from '../constants';

interface AudioWaveformProps {
  color: string;
  isPlaying: boolean;
}

// Inner component that uses the hook - only rendered when player exists
function LiveWaveform({ color, player }: { color: string; player: AudioPlayer }) {
  const [points, setPoints] = useState<number[]>(() => Array(NUM_POINTS).fill(0.5));
  const pointsRef = useRef<number[]>(Array(NUM_POINTS).fill(0.5));
  const animFrameRef = useRef<number | null>(null);

  useAudioSampleListener(player, (sample) => {
    if (!sample.channels || sample.channels.length === 0) return;
    
    const frames = sample.channels[0]?.frames;
    if (!frames || frames.length === 0) return;

    const chunkSize = Math.max(1, Math.floor(frames.length / NUM_POINTS));
    const newPoints: number[] = [];
    
    for (let i = 0; i < NUM_POINTS; i++) {
      const idx = Math.floor(i * chunkSize);
      const value = frames[idx] || 0;
      const amplified = value * 3;
      newPoints.push(0.5 + Math.max(-0.45, Math.min(0.45, amplified)));
    }
    
    pointsRef.current = newPoints;
  });

  useEffect(() => {
    const animate = () => {
      setPoints(prev => prev.map((p, i) => p + (pointsRef.current[i] - p) * 0.5));
      animFrameRef.current = requestAnimationFrame(animate);
    };
    
    animFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  return <WaveformPath points={points} color={color} />;
}

// Fallback animated waveform when no player
function AnimatedWaveform({ color, isPlaying }: { color: string; isPlaying: boolean }) {
  const [points, setPoints] = useState<number[]>(() => Array(NUM_POINTS).fill(0.5));
  const pointsRef = useRef<number[]>(Array(NUM_POINTS).fill(0.5));
  const animFrameRef = useRef<number | null>(null);
  const timeRef = useRef(0);

  useEffect(() => {
    const animate = () => {
      timeRef.current += 0.04;
      
      if (isPlaying) {
        const newPoints = Array.from({ length: NUM_POINTS }, (_, i) => {
          const x = i / NUM_POINTS;
          const envelope = Math.sin(x * Math.PI);
          const wave1 = Math.sin(x * Math.PI * 3 + timeRef.current * 2.5) * 0.3;
          const wave2 = Math.sin(x * Math.PI * 5 + timeRef.current * 4) * 0.2;
          const wave3 = Math.sin(x * Math.PI * 2 + timeRef.current * 1.5) * 0.25;
          return 0.5 + (wave1 + wave2 + wave3) * envelope;
        });
        pointsRef.current = newPoints;
      } else {
        pointsRef.current = pointsRef.current.map(p => p + (0.5 - p) * 0.1);
      }
      
      setPoints(prev => prev.map((p, i) => p + (pointsRef.current[i] - p) * 0.5));
      animFrameRef.current = requestAnimationFrame(animate);
    };
    
    animFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying]);

  return <WaveformPath points={points} color={color} />;
}

// Shared SVG path renderer
function WaveformPath({ points, color }: { points: number[]; color: string }) {
  const buildPath = (): string => {
    const midY = WAVEFORM_HEIGHT / 2;
    const amplitude = WAVEFORM_HEIGHT / 2 - 4;
    
    let path = `M 0 ${midY}`;
    const allPoints = [0.5, ...points, 0.5];
    
    for (let i = 1; i < allPoints.length; i++) {
      const x = (i / (allPoints.length - 1)) * WAVEFORM_WIDTH;
      const y = midY + (allPoints[i] - 0.5) * 2 * amplitude;
      const prevX = ((i - 1) / (allPoints.length - 1)) * WAVEFORM_WIDTH;
      const prevY = midY + (allPoints[i - 1] - 0.5) * 2 * amplitude;
      const cpX = (prevX + x) / 2;
      path += ` C ${cpX} ${prevY} ${cpX} ${y} ${x} ${y}`;
    }
    
    return path;
  };

  return (
    <Svg width={WAVEFORM_WIDTH} height={WAVEFORM_HEIGHT}>
      <Path
        d={buildPath()}
        stroke={color}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Main export - picks which waveform to render
export function AudioWaveform({ color, isPlaying }: AudioWaveformProps) {
  const player = audioService.getPlayer();

  return (
    <View style={styles.container}>
      {player ? (
        <LiveWaveform color={color} player={player} />
      ) : (
        <AnimatedWaveform color={color} isPlaying={isPlaying} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: WAVEFORM_WIDTH,
    height: WAVEFORM_HEIGHT,
    alignSelf: 'center',
    marginVertical: 12,
  },
});