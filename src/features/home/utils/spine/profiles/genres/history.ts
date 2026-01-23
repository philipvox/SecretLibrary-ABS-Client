/**
 * History genre profile
 * Authoritative serif for historical non-fiction
 */

import { GenreProfile } from '../types';

export const HISTORY: GenreProfile = {
  id: 'history',
  name: 'History',
  description: 'Authoritative serif for historical non-fiction',

  title: {
    orientation: 'vertical-up',
    fontSize: 46,
    weight: '600',
    fontFamily: 'LibreBaskerville-Bold',
    fontFamilies: ['LibreBaskerville-Bold', 'NotoSerif-Bold', 'PlayfairDisplay-Bold'],
    case: 'capitalize',
    letterSpacing: 0.05,
    placement: 'center',
    align: 'center',
    heightPercent: 74,
    paddingHorizontal: 4,
    paddingVertical: 8,
    sizes: {
      small: { fontSize: 35, paddingHorizontal: 3, paddingVertical: 5 },
      medium: {},
      large: { fontSize: 56, paddingHorizontal: 5, paddingVertical: 10 },
    },
  },

  author: {
    orientation: 'horizontal',
    fontSize: 13,
    weight: '400',
    fontFamily: 'LibreBaskerville-Regular',
    fontFamilies: ['LibreBaskerville-Regular', 'NotoSerif-Regular'],
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
    titleScales: ['normal', 'statement'],
    titleWeights: ['medium', 'bold'],
    titleCases: ['uppercase', 'capitalize'],
    authorOrientations: ['horizontal', 'vertical-up'],
    authorTreatments: ['plain', 'underlined'],
    authorScales: ['small', 'tiny'],
    densities: ['balanced', 'dense'],
    alignments: ['centered', 'bottom-heavy'],
    lineStyles: ['medium', 'thin'],
    decorativeElements: ['top-line', 'bottom-line', 'divider-line'],
  },

  personality: {
    prefersBold: false,
    prefersMinimal: false,
    prefersClassic: true,
    prefersExperimental: false,
  },

  usedFor: ['history', 'historical', 'military-history', 'ancient-history'],
  preferredFor: ['history'],
};
