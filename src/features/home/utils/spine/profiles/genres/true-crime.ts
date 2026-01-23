/**
 * True Crime genre profile
 * Dark detective aesthetic with bold type
 */

import { GenreProfile } from '../types';

export const TRUE_CRIME: GenreProfile = {
  id: 'true-crime',
  name: 'True Crime',
  description: 'Dark detective aesthetic with bold type',

  title: {
    orientation: 'vertical-two-row',
    fontSize: 62,
    weight: '900',
    fontFamily: 'Notable-Regular',
    fontFamilies: ['Notable-Regular', 'GravitasOne-Regular', 'AlfaSlabOne-Regular'],
    case: 'uppercase',
    letterSpacing: 0.04,
    placement: 'center',
    align: 'left',
    heightPercent: 80,
    paddingHorizontal: 8,
    paddingVertical: 8,
    lineHeight: 32,
    sizes: {
      small: { orientation: 'vertical-up', fontSize: 48, paddingHorizontal: 4, paddingVertical: 4 },
      medium: { fontSize: 58 },
      large: { orientation: 'vertical-two-row', fontSize: 70, paddingHorizontal: 10, paddingVertical: 10 },
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
    heightPercent: 20,
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
    titleOrientations: ['horizontal', 'vertical-down', 'stacked-letters'],
    titleScales: ['statement', 'shout'],
    titleWeights: ['bold', 'black'],
    titleCases: ['uppercase'],
    authorOrientations: ['horizontal', 'oppose-title'],
    authorTreatments: ['boxed', 'plain'],
    authorScales: ['tiny', 'small'],
    densities: ['asymmetric', 'dense'],
    alignments: ['bottom-heavy', 'scattered'],
    lineStyles: ['thick', 'medium'],
    decorativeElements: ['partial-border', 'side-line'],
  },

  personality: {
    prefersBold: true,
    prefersMinimal: false,
    prefersClassic: false,
    prefersExperimental: true,
  },

  usedFor: ['true-crime', 'crime', 'mystery', 'thriller'],
  preferredFor: ['true-crime'],
};
