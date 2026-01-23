/**
 * Dystopian genre profile
 * Dark stark type for dystopian fiction
 */

import { GenreProfile } from '../types';

export const DYSTOPIAN: GenreProfile = {
  id: 'dystopian',
  name: 'Dystopian',
  description: 'Dark stark type for dystopian fiction',

  title: {
    orientation: 'vertical-up',
    fontSize: 50,
    weight: '700',
    fontFamily: 'Oswald-Bold',
    fontFamilies: ['Oswald-Bold', 'ZenDots-Regular', 'Orbitron-Regular'],
    case: 'uppercase',
    letterSpacing: 0.10,
    placement: 'center',
    align: 'center',
    heightPercent: 74,
    paddingHorizontal: 4,
    paddingVertical: 8,
    sizes: {
      small: { fontSize: 38, letterSpacing: 0.08, paddingHorizontal: 3, paddingVertical: 5 },
      medium: {},
      large: { fontSize: 60, letterSpacing: 0.12, paddingHorizontal: 5, paddingVertical: 10 },
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
    heightPercent: 15,
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
    titleOrientations: ['stacked-letters', 'vertical-down', 'horizontal'],
    titleScales: ['shout', 'statement', 'whisper', 'balanced'],
    titleWeights: ['black', 'bold', 'hairline'],
    titleCases: ['uppercase', 'lowercase'],
    authorOrientations: ['horizontal', 'oppose-title', 'vertical-down'],
    authorTreatments: ['plain', 'bracketed'],
    authorScales: ['tiny', 'small', 'whisper'],
    densities: ['asymmetric', 'minimal', 'dense'],
    alignments: ['scattered', 'bottom-heavy', 'top-heavy'],
    lineStyles: ['thick', 'thin', 'none'],
    decorativeElements: ['partial-border', 'side-line', 'none'],
  },

  personality: {
    prefersBold: true,
    prefersMinimal: false,
    prefersClassic: false,
    prefersExperimental: true,
  },

  usedFor: ['dystopian', 'post-apocalyptic', 'apocalyptic', 'speculative'],
  preferredFor: ['dystopian', 'post-apocalyptic'],
};
