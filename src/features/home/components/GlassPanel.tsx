/**
 * src/features/home/components/GlassPanel.tsx
 * 
 * SVG glass panel background matching Rectangle_21.svg
 */

import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { 
  Path, 
  Defs, 
  LinearGradient as SvgLinearGradient, 
  RadialGradient,
  Stop,
  Rect,
} from 'react-native-svg';

interface GlassPanelProps {
  width: number;
  height: number;
  borderRadius?: number;
}

export function GlassPanel({ width, height, borderRadius = 5 }: GlassPanelProps) {
  // Scale factors based on original 339x514 SVG
  const scaleX = width / 339;
  const scaleY = height / 514;
  
  return (
    <Svg 
      width={width} 
      height={height} 
      viewBox={`0 0 ${width} ${height}`}
      style={StyleSheet.absoluteFill}
    >
      <Defs>
        {/* Top dark gradient */}
        <SvgLinearGradient id="paint0" x1="50%" y1="17.7%" x2="50%" y2="0%" gradientUnits="userSpaceOnUse">
          <Stop offset="0.48" stopOpacity="0" />
          <Stop offset="0.65" stopColor="black" />
        </SvgLinearGradient>
        
        {/* Bottom light gradient */}
        <SvgLinearGradient id="paint1" x1="50%" y1="98%" x2="50%" y2="100%" gradientUnits="userSpaceOnUse">
          <Stop offset="0.4" stopOpacity="0" />
          <Stop offset="0.9" stopColor="white" />
        </SvgLinearGradient>
        
        {/* Bottom-right radial glow */}
        <RadialGradient 
          id="paint2" 
          cx="100%" 
          cy="95%" 
          rx="160%" 
          ry="50%"
          gradientUnits="userSpaceOnUse"
        >
          <Stop stopColor="white" />
          <Stop offset="1" stopOpacity="0" />
        </RadialGradient>
        
        {/* Top-left radial glow */}
        <RadialGradient 
          id="paint3" 
          cx="4%" 
          cy="0%" 
          rx="150%" 
          ry="70%"
          gradientUnits="userSpaceOnUse"
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
        rx={borderRadius}
        fill="#262626"
      />
      
      {/* Top dark gradient overlay */}
      <Rect 
        x="0" 
        y="0" 
        width={width} 
        height={height} 
        rx={borderRadius}
        fill="url(#paint0)" 
        fillOpacity="0.2"
      />
      
      {/* Bottom light gradient overlay */}
      <Rect 
        x="0" 
        y="0" 
        width={width} 
        height={height} 
        rx={borderRadius}
        fill="url(#paint1)" 
        fillOpacity="0.2"
      />
      
      {/* Bottom-right radial */}
      <Rect 
        x="0" 
        y="0" 
        width={width} 
        height={height} 
        rx={borderRadius}
        fill="url(#paint2)" 
        fillOpacity="0.1"
      />
      
      {/* Top-left radial */}
      <Rect 
        x="0" 
        y="0" 
        width={width} 
        height={height} 
        rx={borderRadius}
        fill="url(#paint3)" 
        fillOpacity="0.1"
      />
      
      {/* Border */}
      <Rect 
        x="0.25" 
        y="0.25" 
        width={width - 0.5} 
        height={height - 0.5} 
        rx={borderRadius}
        stroke="rgba(255,255,255,0.5)" 
        strokeWidth="0.5" 
        fill="none"
      />
    </Svg>
  );
}

export default GlassPanel;