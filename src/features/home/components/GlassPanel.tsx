/**
 * src/features/home/components/GlassPanel.tsx
 * 
 * SVG glass panel background using HomeCardBackground design
 */

import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { 
  Path, 
  Defs, 
  LinearGradient, 
  RadialGradient,
  Stop,
  Rect,
  Mask,
} from 'react-native-svg';

interface GlassPanelProps {
  width: number;
  height: number;
  borderRadius?: number;
}

export function GlassPanel({ width, height, borderRadius = 5 }: GlassPanelProps) {
  const r = borderRadius;
  
  // Create rounded rect path
  const path = `M0 ${r}C0 ${r * 0.447} ${r * 0.447} 0 ${r} 0H${width - r}C${width - r * 0.447} 0 ${width} ${r * 0.447} ${width} ${r}V${height - r}C${width} ${height - r * 0.447} ${width - r * 0.447} ${height} ${width - r} ${height}H${r}C${r * 0.447} ${height} 0 ${height - r * 0.447} 0 ${height - r}V${r}Z`;

  return (
    <Svg 
      width={width} 
      height={height} 
      viewBox={`0 0 ${width} ${height}`}
      style={StyleSheet.absoluteFill}
    >
      <Defs>
        {/* Top dark gradient - subtle shadow at top */}
        <LinearGradient id="topGrad" x1="50%" y1="17.7%" x2="50%" y2="0%">
          <Stop offset="0.48" stopOpacity="0" />
          <Stop offset="0.65" stopColor="black" stopOpacity="1" />
        </LinearGradient>
        
        {/* Bottom light gradient - subtle highlight at bottom */}
        <LinearGradient id="bottomGrad" x1="50%" y1="98.4%" x2="50%" y2="100%">
          <Stop offset="0.4" stopOpacity="0" />
          <Stop offset="0.9" stopColor="white" stopOpacity="1" />
        </LinearGradient>
        
        {/* Bottom-right radial glow */}
        <RadialGradient 
          id="brGlow" 
          cx="100%" 
          cy="95%" 
          rx="160%" 
          ry="50%"
        >
          <Stop stopColor="white" />
          <Stop offset="1" stopOpacity="0" />
        </RadialGradient>
        
        {/* Top-left radial glow */}
        <RadialGradient 
          id="tlGlow" 
          cx="4%" 
          cy="0%" 
          rx="31%" 
          ry="67%"
        >
          <Stop stopColor="white" />
          <Stop offset="1" stopOpacity="0" />
        </RadialGradient>
      </Defs>

      {/* Base fill */}
      <Rect 
        x="0" 
        y="0" 
        width={width} 
        height={height} 
        rx={r}
        fill="#262626"
      />
      
      {/* Top dark gradient overlay */}
      <Rect 
        x="0" 
        y="0" 
        width={width} 
        height={height} 
        rx={r}
        fill="url(#topGrad)" 
        fillOpacity="0.2"
      />
      
      {/* Bottom light gradient overlay */}
      <Rect 
        x="0" 
        y="0" 
        width={width} 
        height={height} 
        rx={r}
        fill="url(#bottomGrad)" 
        fillOpacity="0.2"
      />
      
      {/* Bottom-right radial */}
      <Rect 
        x="0" 
        y="0" 
        width={width} 
        height={height} 
        rx={r}
        fill="url(#brGlow)" 
        fillOpacity="0.1"
      />
      
      {/* Top-left radial */}
      <Rect 
        x="0" 
        y="0" 
        width={width} 
        height={height} 
        rx={r}
        fill="url(#tlGlow)" 
        fillOpacity="0.1"
      />
      
      {/* Border */}
      <Rect 
        x="0.35" 
        y="0.35" 
        width={width - 0.7} 
        height={height - 0.7} 
        rx={r}
        stroke="rgba(255,255,255,0.5)" 
        strokeWidth="0.7" 
        fill="none"
      />
    </Svg>
  );
}

export default GlassPanel;