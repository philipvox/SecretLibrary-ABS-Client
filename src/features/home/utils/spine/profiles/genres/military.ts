/**
 * Military genre profile
 * Bold commanding type for military stories
 */

import { GenreProfile } from '../types';

export const MILITARY: GenreProfile = {
  id: 'military',
  name: 'Military',
  description: 'Bold commanding type for military stories',

  title: {
    orientation: 'vertical-up',
    fontSize: 52,
    weight: '900',
    fontFamily: 'Oswald-Bold',
    fontFamilies: ['Oswald-Bold', 'AlfaSlabOne-Regular', 'GravitasOne-Regular'],
    case: 'uppercase',
    letterSpacing: 0.08,
    placement: 'center',
    align: 'center',
    heightPercent: 74,
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
    fontSize: 14,
    weight: '700',
    fontFamily: 'Oswald-Bold',
    fontFamilies: ['Oswald-Bold', 'BebasNeue-Regular'],
    case: 'uppercase',
    placement: 'bottom',
    align: 'center',
    heightPercent: 15,
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

  usedFor: ['military', 'war', 'military-fiction', 'military-history'],
  preferredFor: ['military', 'war'],
};
