/**
 * Espionage genre profile
 * Sleek secretive type for spy thrillers
 */

import { GenreProfile } from '../types';

export const ESPIONAGE: GenreProfile = {
  id: 'espionage',
  name: 'Espionage',
  description: 'Sleek secretive type for spy thrillers',

  title: {
    orientation: 'vertical-up',
    fontSize: 52,
    weight: '700',
    fontFamily: 'Oswald-Bold',
    fontFamilies: ['Oswald-Bold', 'BebasNeue-Regular', 'GravitasOne-Regular'],
    case: 'uppercase',
    letterSpacing: 0.10,
    placement: 'center',
    align: 'center',
    heightPercent: 74,
    paddingHorizontal: 4,
    paddingVertical: 8,
    sizes: {
      small: { fontSize: 40, letterSpacing: 0.08, paddingHorizontal: 3, paddingVertical: 5 },
      medium: {},
      large: { fontSize: 62, letterSpacing: 0.12, paddingHorizontal: 5, paddingVertical: 10 },
    },
  },

  author: {
    orientation: 'horizontal',
    fontSize: 14,
    weight: '600',
    fontFamily: 'Oswald-Regular',
    fontFamilies: ['Oswald-Regular', 'BebasNeue-Regular'],
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
    titleOrientations: ['horizontal', 'stacked-letters', 'vertical-down'],
    titleScales: ['shout', 'statement', 'balanced'],
    titleWeights: ['black', 'bold'],
    titleCases: ['uppercase'],
    authorOrientations: ['horizontal', 'oppose-title'],
    authorTreatments: ['plain', 'boxed'],
    authorScales: ['tiny', 'whisper', 'small'],
    densities: ['asymmetric', 'dense'],
    alignments: ['bottom-heavy', 'top-heavy', 'scattered'],
    lineStyles: ['thick', 'medium'],
    decorativeElements: ['partial-border', 'side-line'],
  },

  personality: {
    prefersBold: true,
    prefersMinimal: false,
    prefersClassic: false,
    prefersExperimental: true,
  },

  usedFor: ['espionage', 'spy', 'spy-thriller', 'political-thriller'],
  preferredFor: ['espionage', 'spy'],
};
