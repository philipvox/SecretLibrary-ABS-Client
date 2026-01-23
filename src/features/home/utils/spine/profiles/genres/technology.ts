/**
 * Technology genre profile
 * Modern digital aesthetic for tech books
 */

import { GenreProfile } from '../types';

export const TECHNOLOGY: GenreProfile = {
  id: 'technology',
  name: 'Technology',
  description: 'Modern digital aesthetic for tech books',

  title: {
    orientation: 'vertical-up',
    fontSize: 44,
    weight: '400',
    fontFamily: 'Orbitron-Regular',
    fontFamilies: ['Orbitron-Regular', 'ZenDots-Regular', 'BebasNeue-Regular'],
    case: 'uppercase',
    letterSpacing: 0.12,
    placement: 'center',
    align: 'center',
    heightPercent: 75,
    paddingHorizontal: 4,
    paddingVertical: 8,
    sizes: {
      small: { fontSize: 34, letterSpacing: 0.08, paddingHorizontal: 3, paddingVertical: 5 },
      medium: {},
      large: { orientation: 'stacked-words', fontSize: 52, letterSpacing: 0.15, paddingHorizontal: 5, paddingVertical: 10 },
    },
  },

  author: {
    orientation: 'horizontal',
    fontSize: 13,
    weight: '600',
    fontFamily: 'Oswald-Bold',
    case: 'uppercase',
    placement: 'top',
    align: 'center',
    heightPercent: 16,
    treatment: 'plain',
    paddingHorizontal: 8,
    paddingVertical: 6,
    sizes: {
      small: { placement: 'bottom', orientation: 'vertical-up', fontSize: 10, paddingHorizontal: 4, paddingVertical: 4 },
      medium: { orientation: 'stacked-words' },
      large: { placement: 'bottom', fontSize: 15, paddingHorizontal: 10, paddingVertical: 8 },
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

  usedFor: ['technology', 'programming', 'digital', 'computers'],
  preferredFor: ['technology', 'programming'],
};
