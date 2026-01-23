/**
 * Business genre profile
 * Clean modern type for business books
 */

import { GenreProfile } from '../types';

export const BUSINESS: GenreProfile = {
  id: 'business',
  name: 'Business',
  description: 'Clean modern type for business books',

  title: {
    orientation: 'vertical-up',
    fontSize: 48,
    weight: '400',
    fontFamily: 'Orbitron-Regular',
    fontFamilies: ['Orbitron-Regular', 'ZenDots-Regular', 'GravitasOne-Regular'],
    case: 'uppercase',
    letterSpacing: 0.06,
    placement: 'center',
    align: 'center',
    heightPercent: 68,
    paddingHorizontal: 4,
    paddingVertical: 8,
    sizes: {
      small: { fontSize: 36, letterSpacing: 0.05, paddingHorizontal: 3, paddingVertical: 5 },
      medium: {},
      large: { fontSize: 56, letterSpacing: 0.08, paddingHorizontal: 5, paddingVertical: 10 },
    },
  },

  author: {
    orientation: 'horizontal',
    fontSize: 13,
    weight: '600',
    fontFamily: 'Oswald-Bold',
    fontFamilies: ['Oswald-Bold', 'BebasNeue-Regular'],
    case: 'uppercase',
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

  usedFor: ['business', 'technology', 'economics', 'education'],
  preferredFor: ['business', 'economics'],
};
