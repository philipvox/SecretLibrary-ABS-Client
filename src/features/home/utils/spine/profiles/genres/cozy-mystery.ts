/**
 * Cozy Mystery genre profile
 * Warm friendly type for cozy mysteries
 */

import { GenreProfile } from '../types';

export const COZY_MYSTERY: GenreProfile = {
  id: 'cozy-mystery',
  name: 'Cozy Mystery',
  description: 'Warm friendly type for cozy mysteries',

  title: {
    orientation: 'vertical-up',
    fontSize: 44,
    weight: '600',
    fontFamily: 'PlayfairDisplay-Bold',
    fontFamilies: ['PlayfairDisplay-Bold', 'Lora-Bold', 'LibreBaskerville-Bold'],
    case: 'capitalize',
    letterSpacing: 0.04,
    placement: 'center',
    align: 'center',
    heightPercent: 70,
    paddingHorizontal: 4,
    paddingVertical: 8,
    sizes: {
      small: { fontSize: 34, paddingHorizontal: 3, paddingVertical: 5 },
      medium: {},
      large: { fontSize: 54, paddingHorizontal: 5, paddingVertical: 10 },
    },
  },

  author: {
    orientation: 'horizontal',
    fontSize: 13,
    weight: '400',
    fontFamily: 'Lora-Regular',
    fontFamilies: ['Lora-Regular', 'PlayfairDisplay-Regular'],
    case: 'capitalize',
    placement: 'bottom',
    align: 'center',
    heightPercent: 18,
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

  usedFor: ['cozy-mystery', 'cozy', 'amateur-sleuth'],
  preferredFor: ['cozy-mystery'],
};
