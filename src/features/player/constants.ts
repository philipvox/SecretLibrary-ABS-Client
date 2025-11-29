/**
 * src/features/player/constants.ts
 */

import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const CARD_MARGIN = 5;
export const CARD_WIDTH = SCREEN_WIDTH - CARD_MARGIN * 2;
export const BUTTON_GAP = 5;
export const BUTTON_SIZE = (CARD_WIDTH - BUTTON_GAP * 2) / 3;
export const COVER_SIZE = CARD_WIDTH - 20;
export const RADIUS = 5;
export const WAVEFORM_WIDTH = CARD_WIDTH - 20;
export const WAVEFORM_HEIGHT = 35;
export const NUM_POINTS = 10;

export const REWIND_STEP = 2; // seconds per tick
export const REWIND_INTERVAL = 80; // ms between ticks
export const FF_STEP = 5; // seconds per tick for fast forward

export { SCREEN_WIDTH, SCREEN_HEIGHT };
