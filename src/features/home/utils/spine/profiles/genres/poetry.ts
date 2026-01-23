/**
 * Poetry genre profile
 * Elegant flowing type for poetry collections
 */

import { GenreProfile } from '../types';

export const POETRY: GenreProfile = {
  id: 'poetry',
  name: 'Poetry',
  description: 'Elegant flowing type for poetry collections',

  title: {
    orientation: 'vertical-up',
    fontSize: 40,
    weight: '400',
    fontFamily: 'Charm-Regular',
    fontFamilies: ['Charm-Regular', 'PlayfairDisplay-Regular', 'LibreBaskerville-Regular'],
    case: 'capitalize',
    letterSpacing: 0.04,
    placement: 'center',
    align: 'center',
    heightPercent: 65,
    paddingHorizontal: 4,
    paddingVertical: 8,
    sizes: {
      small: { fontSize: 30, paddingHorizontal: 3, paddingVertical: 5 },
      medium: {},
      large: { fontSize: 48, paddingHorizontal: 5, paddingVertical: 10 },
    },
  },

  author: {
    orientation: 'horizontal',
    fontSize: 14,
    weight: '400',
    fontFamily: 'PlayfairDisplay-Regular',
    fontFamilies: ['PlayfairDisplay-Regular', 'Lora-Regular'],
    case: 'capitalize',
    placement: 'bottom',
    align: 'center',
    heightPercent: 22,
    treatment: 'plain',
    paddingHorizontal: 8,
    paddingVertical: 6,
    sizes: {
      small: { orientation: 'vertical-up', fontSize: 11, paddingHorizontal: 4, paddingVertical: 4 },
      medium: {},
      large: { fontSize: 16, paddingHorizontal: 10, paddingVertical: 8 },
    },
  },

  decoration: { element: 'none', lineStyle: 'none' },

  options: {
    titleOrientations: ['vertical-up', 'horizontal'],
    titleScales: ['whisper', 'normal'],
    titleWeights: ['light', 'regular'],
    titleCases: ['lowercase', 'capitalize'],
    authorOrientations: ['match-title', 'horizontal'],
    authorTreatments: ['plain', 'prefixed'],
    authorScales: ['balanced', 'small'],
    densities: ['minimal'],
    alignments: ['centered', 'scattered'],
    lineStyles: ['thin', 'none'],
    decorativeElements: ['none', 'divider-line'],
  },

  personality: {
    prefersBold: false,
    prefersMinimal: true,
    prefersClassic: true,
    prefersExperimental: true,
  },

  usedFor: ['poetry', 'poems', 'verse'],
  preferredFor: ['poetry'],
};
