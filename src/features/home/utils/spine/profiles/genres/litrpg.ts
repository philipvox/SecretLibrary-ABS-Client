/**
 * LitRPG genre profile
 * Game-inspired type for LitRPG and GameLit
 */

import { GenreProfile } from '../types';

export const LITRPG: GenreProfile = {
  id: 'litrpg',
  name: 'LitRPG',
  description: 'Game-inspired type for LitRPG and GameLit',

  title: {
    orientation: 'vertical-up',
    fontSize: 48,
    weight: '700',
    fontFamily: 'Silkscreen-Regular',
    fontFamilies: ['Silkscreen-Regular', 'ZenDots-Regular', 'Orbitron-Regular'],
    case: 'uppercase',
    letterSpacing: 0.06,
    placement: 'center',
    align: 'center',
    heightPercent: 72,
    paddingHorizontal: 4,
    paddingVertical: 8,
    sizes: {
      small: { fontSize: 36, paddingHorizontal: 3, paddingVertical: 5 },
      medium: {},
      large: { fontSize: 58, paddingHorizontal: 5, paddingVertical: 10 },
    },
  },

  author: {
    orientation: 'horizontal',
    fontSize: 13,
    weight: '600',
    fontFamily: 'Oswald-Bold',
    fontFamilies: ['Oswald-Bold', 'BebasNeue-Regular'],
    case: 'uppercase',
    placement: 'bottom',
    align: 'center',
    heightPercent: 16,
    treatment: 'plain',
    paddingHorizontal: 8,
    paddingVertical: 6,
    sizes: {
      small: { orientation: 'vertical-up', fontSize: 10, paddingHorizontal: 4, paddingVertical: 4 },
      medium: {},
      large: { fontSize: 15, paddingHorizontal: 10, paddingVertical: 8 },
    },
  },

  decoration: { element: 'none', lineStyle: 'none' },

  options: {
    titleOrientations: ['horizontal', 'vertical-up', 'stacked-words'],
    titleScales: ['normal', 'statement', 'whisper', 'balanced'],
    titleWeights: ['light', 'medium', 'bold'],
    titleCases: ['uppercase', 'lowercase'],
    authorOrientations: ['horizontal', 'vertical-up'],
    authorTreatments: ['plain', 'bracketed'],
    authorScales: ['tiny', 'small', 'whisper'],
    densities: ['minimal', 'balanced', 'asymmetric'],
    alignments: ['centered', 'left-heavy', 'scattered'],
    lineStyles: ['thin', 'medium'],
    decorativeElements: ['corner-marks', 'side-line', 'none'],
  },

  personality: {
    prefersBold: false,
    prefersMinimal: true,
    prefersClassic: false,
    prefersExperimental: true,
  },

  usedFor: ['litrpg', 'gamelit', 'progression-fantasy', 'cultivation'],
  preferredFor: ['litrpg', 'gamelit'],
};
