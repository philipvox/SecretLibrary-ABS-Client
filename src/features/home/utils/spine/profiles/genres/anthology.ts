/**
 * Anthology genre profile
 * Elegant varied type for collections
 */

import { GenreProfile } from '../types';

export const ANTHOLOGY: GenreProfile = {
  id: 'anthology',
  name: 'Anthology',
  description: 'Elegant varied type for collections',

  title: {
    orientation: 'vertical-up',
    fontSize: 42,
    weight: '400',
    fontFamily: 'PlayfairDisplay-Regular',
    fontFamilies: ['PlayfairDisplay-Regular', 'NotoSerif-Regular', 'LibreBaskerville-Regular'],
    case: 'capitalize',
    letterSpacing: 0.06,
    placement: 'center',
    align: 'center',
    heightPercent: 66,
    paddingHorizontal: 4,
    paddingVertical: 8,
    sizes: {
      small: { fontSize: 32, letterSpacing: 0.04, paddingHorizontal: 3, paddingVertical: 5 },
      medium: {},
      large: { fontSize: 50, letterSpacing: 0.08, paddingHorizontal: 5, paddingVertical: 10 },
    },
  },

  author: {
    orientation: 'horizontal',
    fontSize: 13,
    weight: '400',
    fontFamily: 'PlayfairDisplay-Regular',
    fontFamilies: ['PlayfairDisplay-Regular', 'Lora-Regular'],
    case: 'capitalize',
    placement: 'bottom',
    align: 'center',
    heightPercent: 20,
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
    titleOrientations: ['horizontal', 'vertical-up'],
    titleScales: ['normal', 'whisper', 'statement', 'balanced'],
    titleWeights: ['light', 'regular', 'medium'],
    titleCases: ['capitalize', 'lowercase', 'uppercase'],
    authorOrientations: ['horizontal', 'match-title'],
    authorTreatments: ['plain', 'prefixed', 'underlined'],
    authorScales: ['small', 'balanced', 'tiny'],
    densities: ['minimal', 'balanced'],
    alignments: ['centered', 'top-heavy', 'bottom-heavy'],
    lineStyles: ['thin', 'none'],
    decorativeElements: ['none', 'divider-line'],
  },

  personality: {
    prefersBold: false,
    prefersMinimal: true,
    prefersClassic: true,
    prefersExperimental: true,
  },

  usedFor: ['anthology', 'short-stories', 'collection', 'essays'],
  preferredFor: ['anthology', 'short-stories'],
};
