/**
 * Adventure genre profile
 * Bold explorer aesthetic with adventure spirit
 */

import { GenreProfile } from '../types';

export const ADVENTURE: GenreProfile = {
  id: 'adventure',
  name: 'Adventure',
  description: 'Bold explorer aesthetic with adventure spirit',

  title: {
    orientation: 'vertical-up',
    fontSize: 54,
    weight: '700',
    fontFamily: 'Oswald-Bold',
    fontFamilies: ['AlfaSlabOne-Regular', 'GravitasOne-Regular', 'Oswald-Bold'],
    case: 'uppercase',
    letterSpacing: 0.1,
    placement: 'center',
    align: 'center',
    heightPercent: 72,
    paddingHorizontal: 4,
    paddingVertical: 8,
    sizes: {
      small: { fontSize: 42, letterSpacing: 0.08, paddingHorizontal: 3, paddingVertical: 5 },
      medium: {},
      large: { fontSize: 64, letterSpacing: 0.12, paddingHorizontal: 5, paddingVertical: 10 },
    },
  },

  author: {
    orientation: 'horizontal',
    fontSize: 14,
    weight: '600',
    fontFamily: 'Oswald-Regular',
    case: 'uppercase',
    placement: 'bottom',
    align: 'center',
    heightPercent: 16,
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
    titleOrientations: ['vertical-up', 'horizontal', 'stacked-letters'],
    titleScales: ['statement', 'shout'],
    titleWeights: ['bold', 'black'],
    titleCases: ['uppercase', 'capitalize'],
    authorOrientations: ['horizontal', 'oppose-title'],
    authorTreatments: ['plain', 'underlined'],
    authorScales: ['tiny', 'small'],
    densities: ['balanced', 'dense'],
    alignments: ['centered', 'bottom-heavy'],
    lineStyles: ['medium', 'thick'],
    decorativeElements: ['divider-line', 'top-line'],
  },

  personality: {
    prefersBold: true,
    prefersMinimal: false,
    prefersClassic: false,
    prefersExperimental: true,
  },

  usedFor: ['adventure', 'action', 'thriller', 'exploration'],
  preferredFor: ['adventure'],
};
