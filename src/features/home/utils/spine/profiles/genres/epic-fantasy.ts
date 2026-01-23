/**
 * Epic Fantasy genre profile
 * Grand sweeping type for epic fantasy sagas
 */

import { GenreProfile } from '../types';

export const EPIC_FANTASY: GenreProfile = {
  id: 'epic-fantasy',
  name: 'Epic Fantasy',
  description: 'Grand sweeping type for epic fantasy sagas',

  title: {
    orientation: 'vertical-up',
    fontSize: 58,
    weight: '700',
    fontFamily: 'AlmendraSC-Regular',
    fontFamilies: ['AlmendraSC-Regular', 'UncialAntiqua-Regular', 'GravitasOne-Regular'],
    case: 'uppercase',
    letterSpacing: 0.08,
    placement: 'center',
    align: 'center',
    heightPercent: 75,
    paddingHorizontal: 4,
    paddingVertical: 8,
    sizes: {
      small: { fontSize: 44, letterSpacing: 0.06, paddingHorizontal: 3, paddingVertical: 5 },
      medium: {},
      large: { fontSize: 68, letterSpacing: 0.10, paddingHorizontal: 5, paddingVertical: 10 },
    },
  },

  author: {
    orientation: 'horizontal',
    fontSize: 14,
    weight: '600',
    fontFamily: 'PlayfairDisplay-Bold',
    fontFamilies: ['PlayfairDisplay-Bold', 'Lora-Bold'],
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

  usedFor: ['epic-fantasy', 'high-fantasy', 'sword-and-sorcery', 'fantasy'],
  preferredFor: ['epic-fantasy', 'high-fantasy'],
};
