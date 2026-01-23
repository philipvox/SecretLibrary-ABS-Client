/**
 * Mystery genre profile
 * Intriguing type for whodunits and detective stories
 */

import { GenreProfile } from '../types';

export const MYSTERY: GenreProfile = {
  id: 'mystery',
  name: 'Mystery',
  description: 'Intriguing type for whodunits and detective stories',

  title: {
    orientation: 'vertical-up',
    fontSize: 50,
    weight: '700',
    fontFamily: 'PlayfairDisplay-Bold',
    fontFamilies: ['PlayfairDisplay-Bold', 'NotoSerif-Bold', 'LibreBaskerville-Bold'],
    case: 'capitalize',
    letterSpacing: 0.04,
    placement: 'center',
    align: 'center',
    heightPercent: 72,
    paddingHorizontal: 4,
    paddingVertical: 8,
    sizes: {
      small: { fontSize: 38, paddingHorizontal: 3, paddingVertical: 5 },
      medium: {},
      large: { fontSize: 60, paddingHorizontal: 5, paddingVertical: 10 },
    },
  },

  author: {
    orientation: 'horizontal',
    fontSize: 13,
    weight: '500',
    fontFamily: 'Lora-Regular',
    fontFamilies: ['Lora-Regular', 'PlayfairDisplay-Regular'],
    case: 'capitalize',
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
    titleOrientations: ['vertical-up', 'horizontal'],
    titleScales: ['normal', 'statement', 'balanced'],
    titleWeights: ['medium', 'bold'],
    titleCases: ['uppercase', 'capitalize'],
    authorOrientations: ['horizontal', 'oppose-title'],
    authorTreatments: ['plain', 'boxed', 'underlined'],
    authorScales: ['small', 'tiny', 'whisper'],
    densities: ['balanced', 'dense'],
    alignments: ['centered', 'bottom-heavy'],
    lineStyles: ['medium', 'double'],
    decorativeElements: ['divider-line', 'partial-border'],
  },

  personality: {
    prefersBold: true,
    prefersMinimal: false,
    prefersClassic: true,
    prefersExperimental: false,
  },

  usedFor: ['mystery', 'detective', 'cozy-mystery', 'whodunit'],
  preferredFor: ['mystery', 'detective'],
};
