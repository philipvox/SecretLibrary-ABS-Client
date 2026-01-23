/**
 * Young Adult genre profile
 * Bold modern type for YA fiction
 */

import { GenreProfile } from '../types';

export const YOUNG_ADULT: GenreProfile = {
  id: 'young-adult',
  name: 'Young Adult',
  description: 'Bold modern type for YA fiction',

  title: {
    orientation: 'vertical-up',
    fontSize: 52,
    weight: '700',
    fontFamily: 'Oswald-Bold',
    fontFamilies: ['Oswald-Bold', 'AlfaSlabOne-Regular', 'GravitasOne-Regular'],
    case: 'uppercase',
    letterSpacing: 0.05,
    placement: 'center',
    align: 'center',
    heightPercent: 72,
    paddingHorizontal: 4,
    paddingVertical: 8,
    sizes: {
      small: { fontSize: 40, paddingHorizontal: 3, paddingVertical: 5 },
      medium: {},
      large: { fontSize: 62, paddingHorizontal: 5, paddingVertical: 10 },
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
    titleOrientations: ['horizontal', 'vertical-up', 'stacked-letters'],
    titleScales: ['statement', 'normal'],
    titleWeights: ['bold', 'medium'],
    titleCases: ['capitalize', 'uppercase'],
    authorOrientations: ['horizontal', 'match-title'],
    authorTreatments: ['plain', 'underlined'],
    authorScales: ['small', 'tiny'],
    densities: ['balanced', 'asymmetric'],
    alignments: ['centered', 'bottom-heavy'],
    lineStyles: ['thin', 'medium'],
    decorativeElements: ['divider-line', 'side-line'],
  },

  personality: {
    prefersBold: true,
    prefersMinimal: false,
    prefersClassic: false,
    prefersExperimental: true,
  },

  usedFor: ['young-adult', 'ya', 'teen', 'coming-of-age'],
  preferredFor: ['young-adult', 'ya'],
};
