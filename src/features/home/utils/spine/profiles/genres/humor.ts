/**
 * Humor genre profile
 * Light and playful typography for comedic reads
 */

import { GenreProfile } from '../types';

export const HUMOR: GenreProfile = {
  id: 'humor',
  name: 'Humor',
  description: 'Light and playful typography for comedic reads',

  title: {
    orientation: 'vertical-up',
    fontSize: 48,
    weight: '600',
    fontFamily: 'Oswald-Bold',
    fontFamilies: ['Barriecito-Regular', 'RubikBeastly-Regular', 'Oswald-Bold'],
    case: 'uppercase',
    letterSpacing: 0.05,
    placement: 'center',
    align: 'center',
    heightPercent: 70,
    paddingHorizontal: 4,
    paddingVertical: 6,
    sizes: {
      small: { fontSize: 36, letterSpacing: 0.03, paddingHorizontal: 3, paddingVertical: 4 },
      medium: { fontSize: 48 },
      large: { fontSize: 58, letterSpacing: 0.06, paddingHorizontal: 5, paddingVertical: 8 },
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
    heightPercent: 18,
    treatment: 'plain',
    paddingHorizontal: 6,
    paddingVertical: 5,
    sizes: {
      small: { orientation: 'vertical-up', fontSize: 10, paddingHorizontal: 3, paddingVertical: 3 },
      medium: { fontSize: 13 },
      large: { fontSize: 15, paddingHorizontal: 8, paddingVertical: 6 },
    },
  },

  decoration: { element: 'none', lineStyle: 'none' },

  options: {
    titleOrientations: ['horizontal', 'stacked-letters', 'stacked-words'],
    titleScales: ['statement', 'shout'],
    titleWeights: ['bold', 'black'],
    titleCases: ['uppercase', 'capitalize'],
    authorOrientations: ['horizontal', 'oppose-title'],
    authorTreatments: ['plain', 'bracketed'],
    authorScales: ['tiny', 'small'],
    densities: ['asymmetric', 'balanced'],
    alignments: ['scattered', 'centered'],
    lineStyles: ['medium', 'thick'],
    decorativeElements: ['corner-marks', 'partial-border'],
  },

  personality: {
    prefersBold: true,
    prefersMinimal: false,
    prefersClassic: false,
    prefersExperimental: true,
  },

  usedFor: ['humor', 'comedy', 'satire', 'parody', 'humorous-fiction'],
  preferredFor: ['humor', 'comedy'],
};
