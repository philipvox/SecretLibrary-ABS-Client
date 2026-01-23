/**
 * Science genre profile
 * Clean precise type for science books
 */

import { GenreProfile } from '../types';

export const SCIENCE: GenreProfile = {
  id: 'science',
  name: 'Science',
  description: 'Clean precise type for science books',

  title: {
    orientation: 'vertical-up',
    fontSize: 46,
    weight: '600',
    fontFamily: 'Orbitron-Regular',
    fontFamilies: ['Orbitron-Regular', 'ZenDots-Regular', 'NotoSerif-Bold'],
    case: 'uppercase',
    letterSpacing: 0.08,
    placement: 'center',
    align: 'center',
    heightPercent: 72,
    paddingHorizontal: 4,
    paddingVertical: 8,
    sizes: {
      small: { fontSize: 36, letterSpacing: 0.06, paddingHorizontal: 3, paddingVertical: 5 },
      medium: {},
      large: { fontSize: 56, letterSpacing: 0.10, paddingHorizontal: 5, paddingVertical: 10 },
    },
  },

  author: {
    orientation: 'horizontal',
    fontSize: 13,
    weight: '500',
    fontFamily: 'Oswald-Regular',
    fontFamilies: ['Oswald-Regular', 'BebasNeue-Regular'],
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

  usedFor: ['science', 'physics', 'biology', 'chemistry', 'astronomy'],
  preferredFor: ['science'],
};
