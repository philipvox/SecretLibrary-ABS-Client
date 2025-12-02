import React, { useEffect, useState } from 'react';
import Svg, {
  Path,
  G,
  Circle,
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
  Mask,
} from 'react-native-svg';
import { SvgProps } from './types';

interface LoadingDotsProps extends SvgProps {
  animating?: boolean;
}

const LoadingFrame: React.FC<{ 
  dotOpacities: [number, number, number];
  width: number;
  height: number;
}> = ({ dotOpacities, width, height }) => (
  <Svg width={width} height={height} viewBox="0 0 128 136" fill="none">
    <Mask id="path-1-inside-1_186_63" fill="white">
      <Path d="M0 5.21278C0 2.33385 2.33383 0 5.21277 0H121.979C124.858 0 127.191 2.33383 127.191 5.21277V130.319C127.191 133.198 124.858 135.532 121.979 135.532H5.21277C2.33384 135.532 0 133.198 0 130.319V5.21278Z" />
    </Mask>
    <Path d="M0 5.21278C0 2.33385 2.33383 0 5.21277 0H121.979C124.858 0 127.191 2.33383 127.191 5.21277V130.319C127.191 133.198 124.858 135.532 121.979 135.532H5.21277C2.33384 135.532 0 133.198 0 130.319V5.21278Z" fill="#262626" />
    <Path d="M0 5.21278C0 2.33385 2.33383 0 5.21277 0H121.979C124.858 0 127.191 2.33383 127.191 5.21277V130.319C127.191 133.198 124.858 135.532 121.979 135.532H5.21277C2.33384 135.532 0 133.198 0 130.319V5.21278Z" fill="url(#paint0_linear_186_63)" fillOpacity="0.5" />
    <Path d="M0 5.21278C0 2.33385 2.33383 0 5.21277 0H121.979C124.858 0 127.191 2.33383 127.191 5.21277V130.319C127.191 133.198 124.858 135.532 121.979 135.532H5.21277C2.33384 135.532 0 133.198 0 130.319V5.21278Z" fill="url(#paint1_linear_186_63)" fillOpacity="0.2" />
    <Path d="M0 5.21278C0 2.33385 2.33383 0 5.21277 0H121.979C124.858 0 127.191 2.33383 127.191 5.21277V130.319C127.191 133.198 124.858 135.532 121.979 135.532H5.21277C2.33384 135.532 0 133.198 0 130.319V5.21278Z" fill="url(#paint2_radial_186_63)" fillOpacity="0.1" />
    <Path d="M0 5.21278C0 2.33385 2.33383 0 5.21277 0H121.979C124.858 0 127.191 2.33383 127.191 5.21277V130.319C127.191 133.198 124.858 135.532 121.979 135.532H5.21277C2.33384 135.532 0 133.198 0 130.319V5.21278Z" fill="url(#paint3_radial_186_63)" fillOpacity="0.1" />
    <Path d="M5.21277 -0.35C5.21277 -0.116667 5.21277 0.116667 5.21277 0.35C13.8211 0.301803 22.4294 0.258584 31.0377 0.220343C61.3514 0.0856783 91.665 0.0127398 121.979 0.0015275C124.755 -0.0671153 127.259 2.43603 127.191 5.21277C127.191 5.23644 127.191 5.26011 127.191 5.28378C127.191 11.149 127.191 17.0143 127.191 22.8796C127.191 58.6928 126.889 94.5059 126.846 130.319C126.906 132.912 124.568 135.245 121.979 135.182C121.979 135.182 121.979 135.182 121.979 135.182C83.0567 135.182 44.1348 135.442 5.21277 135.514C2.44596 135.587 -0.0584335 133.093 0.00587083 130.319C0.00206249 126.856 0 123.393 0 119.929C0 87.5694 0.145579 55.2093 0.436736 22.8492C0.489631 16.9704 0.547329 11.0916 0.609833 5.21278C0.580698 2.75906 2.81206 0.606915 5.21277 0.7C5.21277 0.233333 5.21277 -0.233333 5.21277 -0.7C2.06019 -0.74194 -0.715723 2.11322 -0.609833 5.21278C-0.547329 11.0916 -0.489631 16.9704 -0.436736 22.8492C-0.145579 55.2093 0 87.5694 0 119.929C0 123.393 -0.00206249 126.856 -0.00587083 130.319C-0.0765921 133.098 2.42631 135.612 5.21277 135.55C44.1347 135.621 83.0567 135.882 121.979 135.882C121.979 135.882 121.979 135.882 121.979 135.882C124.943 135.954 127.612 133.28 127.536 130.319C127.494 94.5059 127.191 58.6928 127.191 22.8796C127.191 17.0143 127.191 11.149 127.191 5.28378C127.191 5.26011 127.191 5.23644 127.191 5.21277C127.259 2.43622 124.756 -0.0679101 121.979 -0.0015275C91.665 -0.0127398 61.3514 -0.0856783 31.0377 -0.220343C22.4294 -0.258584 13.8211 -0.301803 5.21277 -0.35ZM5.21277 0.35V-0.35V-0.7V0.7V0.35Z" fill="white" fillOpacity="0.5" mask="url(#path-1-inside-1_186_63)" />
    <G>
      <Circle cx="40" cy="68" r="9" fill="white" fillOpacity={dotOpacities[0]} />
      <Circle cx="64" cy="68" r="9" fill="white" fillOpacity={dotOpacities[1]} />
      <Circle cx="88" cy="68" r="9" fill="white" fillOpacity={dotOpacities[2]} />
    </G>
    <Defs>
      <LinearGradient id="paint0_linear_186_63" x1="63.5957" y1="24" x2="63.5957" y2="-6.5" gradientUnits="userSpaceOnUse">
        <Stop offset="0.480769" stopOpacity="0" />
        <Stop offset="0.65" />
      </LinearGradient>
      <LinearGradient id="paint1_linear_186_63" x1="63.5957" y1="112.5" x2="63.5957" y2="135.532" gradientUnits="userSpaceOnUse">
        <Stop offset="0.399038" stopOpacity="0" />
        <Stop offset="0.903846" stopColor="white" />
      </LinearGradient>
      <RadialGradient id="paint2_radial_186_63" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(127 136) rotate(164.83) scale(147.127 70.455)">
        <Stop stopColor="white" />
        <Stop offset="1" stopOpacity="0" />
      </RadialGradient>
      <RadialGradient id="paint3_radial_186_63" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(37 -26.5) rotate(86.0884) scale(117.273 235.111)">
        <Stop stopColor="white" />
        <Stop offset="1" stopOpacity="0" />
      </RadialGradient>
    </Defs>
  </Svg>
);

export const LoadingDots: React.FC<LoadingDotsProps> = ({ 
  width = 128, 
  height = 136,
  animating = true,
  ...props 
}) => {
  const [frame, setFrame] = useState(0);
  
  useEffect(() => {
    if (!animating) return;
    
    const interval = setInterval(() => {
      setFrame(f => (f + 1) % 4);
    }, 300);
    
    return () => clearInterval(interval);
  }, [animating]);

  const opacityPatterns: [number, number, number][] = [
    [1, 1, 1],
    [1, 1, 0.3],
    [1, 0.3, 1],
    [0.3, 1, 1],
  ];

  return (
    <LoadingFrame 
      dotOpacities={opacityPatterns[frame]} 
      width={width as number} 
      height={height as number}
    />
  );
};

export const LoadingDotsStatic: React.FC<SvgProps & { frame?: 0 | 1 | 2 | 3 }> = ({ 
  width = 128, 
  height = 136,
  frame = 0,
  ...props 
}) => {
  const opacityPatterns: [number, number, number][] = [
    [1, 1, 1],
    [1, 1, 0.3],
    [1, 0.3, 1],
    [0.3, 1, 1],
  ];

  return (
    <LoadingFrame 
      dotOpacities={opacityPatterns[frame]} 
      width={width as number} 
      height={height as number}
    />
  );
};
