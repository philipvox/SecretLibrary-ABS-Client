/**
 * Travel genre profile
 * Adventurous type for travel narratives
 */

import { GenreProfile } from '../types';

export const TRAVEL: GenreProfile = {
  id: 'travel',
  name: 'Travel',
  description: 'Adventurous type for travel narratives',

  title: {
    orientation: 'vertical-up',
    fontSize: 48,
    weight: '600',
    fontFamily: 'Federo-Regular',
    fontFamilies: ['Federo-Regular', 'Oswald-Bold', 'PlayfairDisplay-Bold'],
    case: 'uppercase',
    letterSpacing: 0.08,
    placement: 'center',
    align: 'center',
    heightPercent: 70,
    paddingHorizontal: 4,
    paddingVertical: 8,
    sizes: {
      small: { fontSize: 38, paddingHorizontal: 3, paddingVertical: 5 },
      medium: {},
      large: { fontSize: 58, paddingHorizontal: 5, paddingVertical: 10 },
    },
  },

  author: {
    orientation: 'horizontal',
    fontSize: 13,
    weight: '500',
    fontFamily: 'Oswald-Regular',
    fontFamilies: ['Oswald-Regular', 'BebasNeue-Regular'],
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

  usedFor: ['travel', 'adventure-travel', 'exploration', 'geography'],
  preferredFor: ['travel'],
};
