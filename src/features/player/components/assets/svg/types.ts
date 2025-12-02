import { SvgProps as RNSvgProps } from 'react-native-svg';

export interface SvgProps extends RNSvgProps {
  size?: number;
  width?: number;
  height?: number;
}

export interface ControlButtonProps extends SvgProps {
  accentColor?: string;
}
