/**
 * Urban Fantasy genre profile
 * Modern magical type for urban fantasy
 */

import { GenreProfile } from '../types';

export const URBAN_FANTASY: GenreProfile = {
  id: 'urban-fantasy',
  name: 'Urban Fantasy',
  description: 'Modern magical type for urban fantasy',

  title: {
    orientation: 'vertical-up',
    fontSize: 50,
    weight: '700',
    fontFamily: 'Oswald-Bold',
    fontFamilies: ['Oswald-Bold', 'GravitasOne-Regular', 'AlfaSlabOne-Regular'],
    case: 'uppercase',
    letterSpacing: 0.06,
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
    weight: '600',
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
    titleOrientations: ['vertical-up', 'vertical-down', 'stacked-letters'],
    titleScales: ['statement', 'shout', 'normal', 'balanced'],
    titleWeights: ['bold', 'black', 'medium'],
    titleCases: ['uppercase', 'capitalize'],
    authorOrientations: ['vertical-up', 'vertical-down', 'oppose-title'],
    authorTreatments: ['plain', 'underlined'],
    authorScales: ['tiny', 'whisper', 'small'],
    densities: ['balanced', 'dense'],
    alignments: ['centered', 'bottom-heavy'],
    lineStyles: ['thin', 'medium', 'double'],
    decorativeElements: ['divider-line', 'top-line', 'bottom-line'],
  },

  personality: {
    prefersBold: true,
    prefersMinimal: false,
    prefersClassic: true,
    prefersExperimental: true,
  },

  usedFor: ['urban-fantasy', 'contemporary-fantasy', 'paranormal'],
  preferredFor: ['urban-fantasy'],
};
