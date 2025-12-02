import React from 'react';
import Svg, { Rect, G, Path, Defs, ClipPath } from 'react-native-svg';
import { SvgProps } from './types';

export const HomeButton: React.FC<SvgProps> = ({ size = 64, ...props }) => (
  <Svg width={size} height={size * (63/64)} viewBox="0 0 64 63" fill="none" {...props}>
    <Rect width="63.75" height="62.9" rx="31.45" fill="#262626" />
    <G clipPath="url(#clip0_home)">
      <Path
        d="M30.1748 38.5332V31.4499H34.4248V38.5332M25.9248 29.3249L32.2998 24.3666L38.6748 29.3249V37.1166C38.6748 37.4923 38.5255 37.8526 38.2599 38.1183C37.9942 38.384 37.6339 38.5332 37.2581 38.5332H27.3415C26.9657 38.5332 26.6054 38.384 26.3397 38.1183C26.0741 37.8526 25.9248 37.4923 25.9248 37.1166V29.3249Z"
        stroke="#B3B3B3"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </G>
    <Defs>
      <ClipPath id="clip0_home">
        <Rect width="17" height="17" fill="white" transform="translate(23.7998 22.95)" />
      </ClipPath>
    </Defs>
  </Svg>
);

export const HomeButtonActive: React.FC<SvgProps> = ({ size = 64, ...props }) => (
  <Svg width={size} height={size * (63/64)} viewBox="0 0 64 63" fill="none" {...props}>
    <Rect width="63.75" height="62.9" rx="31.45" fill="#34C759" />
    <G clipPath="url(#clip0_home_active)">
      <Path
        d="M30.1748 38.5332V31.4499H34.4248V38.5332M25.9248 29.3249L32.2998 24.3666L38.6748 29.3249V37.1166C38.6748 37.4923 38.5255 37.8526 38.2599 38.1183C37.9942 38.384 37.6339 38.5332 37.2581 38.5332H27.3415C26.9657 38.5332 26.6054 38.384 26.3397 38.1183C26.0741 37.8526 25.9248 37.4923 25.9248 37.1166V29.3249Z"
        stroke="#1E1E1E"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </G>
    <Defs>
      <ClipPath id="clip0_home_active">
        <Rect width="17" height="17" fill="white" transform="translate(23.7998 22.95)" />
      </ClipPath>
    </Defs>
  </Svg>
);

export const SearchButton: React.FC<SvgProps> = ({ size = 64, ...props }) => (
  <Svg width={size} height={size * (63/64)} viewBox="0 0 64 63" fill="none" {...props}>
    <Rect width="63.75" height="62.9" rx="31.45" fill="#262626" />
    <Path
      d="M39.9499 39.1L36.2524 35.4025M38.2499 30.6C38.2499 34.3556 35.2054 37.4 31.4499 37.4C27.6944 37.4 24.6499 34.3556 24.6499 30.6C24.6499 26.8445 27.6944 23.8 31.4499 23.8C35.2054 23.8 38.2499 26.8445 38.2499 30.6Z"
      stroke="#B3B3B3"
      strokeWidth="2.125"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);
