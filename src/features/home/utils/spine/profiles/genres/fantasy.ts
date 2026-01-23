/**
 * Fantasy genre profile
 * Epic serif typography for swords, sorcery, and epic quests
 */

import { GenreProfile } from '../types';

export const FANTASY: GenreProfile = {
  id: 'fantasy',
  name: 'Fantasy',
  description: 'Epic serif typography for swords, sorcery, and epic quests',

  title: {
    orientation: 'vertical-up',
    fontSize: 54,
    weight: '700',
    fontFamily: 'PlayfairDisplay-Bold',
    fontFamilies: ['AlmendraSC-Regular', 'GravitasOne-Regular', 'PlayfairDisplay-Bold', 'Lora-Bold'],
    case: 'capitalize',
    letterSpacing: 0.1,
    placement: 'center',
    align: 'center',
    heightPercent: 72,
    paddingHorizontal: 4,
    paddingVertical: 8,
    sizes: {
      small: {
        fontSize: 42,
        letterSpacing: 0.08,
        paddingHorizontal: 3,
        paddingVertical: 5,
      },
      medium: {},
      large: {
        fontSize: 64,
        letterSpacing: 0.12,
        paddingHorizontal: 5,
        paddingVertical: 10,
      },
    },
  },

  author: {
    orientation: 'stacked-words',
    fontSize: 14,
    weight: '600',
    fontFamily: 'LibreBaskerville-Regular',
    case: 'uppercase',
    placement: 'bottom',
    align: 'center',
    heightPercent: 16,
    treatment: 'plain',
    paddingHorizontal: 8,
    paddingVertical: 6,
    sizes: {
      small: {
        orientation: 'vertical-up',
        fontSize: 11,
        paddingHorizontal: 4,
        paddingVertical: 4,
      },
      medium: {},
      large: {
        fontSize: 16,
        paddingHorizontal: 10,
        paddingVertical: 8,
      },
    },
  },

  decoration: {
    element: 'none',
    lineStyle: 'none',
  },

  options: {
    titleOrientations: ['vertical-up', 'vertical-down', 'stacked-letters'],
    titleScales: ['statement', 'shout', 'normal', 'balanced'],
    titleWeights: ['bold', 'black', 'medium'],
    titleCases: ['uppercase', 'capitalize'],
    authorOrientations: ['vertical-up', 'vertical-down', 'oppose-title'],
    authorTreatments: ['plain', 'underlined'],
    authorScales: ['tiny', 'whisper', 'small'],
    densities: ['balanced', 'dense'],
    alignments: ['centered', 'bottom-heavy'],
    lineStyles: ['thin', 'medium', 'double'],
    decorativeElements: ['divider-line', 'top-line', 'bottom-line'],
  },

  personality: {
    prefersBold: true,
    prefersMinimal: false,
    prefersClassic: true,
    prefersExperimental: true,
  },

  // DISABLED FOR NOW - let Fantasy books use their secondary genre
  usedFor: [],
  preferredFor: [],
};
