/**
 * Sports genre profile
 * Bold athletic type for sports books
 */

import { GenreProfile } from '../types';

export const SPORTS: GenreProfile = {
  id: 'sports',
  name: 'Sports',
  description: 'Bold athletic type for sports books',

  title: {
    orientation: 'vertical-up',
    fontSize: 54,
    weight: '900',
    fontFamily: 'Oswald-Bold',
    fontFamilies: ['Oswald-Bold', 'AlfaSlabOne-Regular', 'GravitasOne-Regular'],
    case: 'uppercase',
    letterSpacing: 0.06,
    placement: 'center',
    align: 'center',
    heightPercent: 72,
    paddingHorizontal: 4,
    paddingVertical: 8,
    sizes: {
      small: { fontSize: 42, paddingHorizontal: 3, paddingVertical: 5 },
      medium: {},
      large: { fontSize: 64, paddingHorizontal: 5, paddingVertical: 10 },
    },
  },

  author: {
    orientation: 'horizontal',
    fontSize: 14,
    weight: '700',
    fontFamily: 'Oswald-Bold',
    fontFamilies: ['Oswald-Bold', 'BebasNeue-Regular'],
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
    titleOrientations: ['horizontal', 'stacked-words'],
    titleScales: ['statement', 'shout'],
    titleWeights: ['bold', 'black', 'medium'],
    titleCases: ['uppercase', 'capitalize'],
    authorOrientations: ['horizontal', 'vertical-down', 'oppose-title'],
    authorTreatments: ['boxed', 'plain'],
    authorScales: ['tiny', 'small'],
    densities: ['asymmetric', 'dense'],
    alignments: ['bottom-heavy', 'centered'],
    lineStyles: ['thick', 'medium'],
    decorativeElements: ['partial-border', 'side-line'],
  },

  personality: {
    prefersBold: true,
    prefersMinimal: false,
    prefersClassic: false,
    prefersExperimental: true,
  },

  usedFor: ['sports', 'athletics', 'fitness', 'outdoor'],
  preferredFor: ['sports'],
};
