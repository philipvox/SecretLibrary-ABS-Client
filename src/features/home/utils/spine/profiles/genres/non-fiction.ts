/**
 * Non-Fiction genre profile
 * Clean informative type for factual works
 */

import { GenreProfile } from '../types';

export const NON_FICTION: GenreProfile = {
  id: 'non-fiction',
  name: 'Non-Fiction',
  description: 'Clean informative type for factual works',

  title: {
    orientation: 'vertical-up',
    fontSize: 48,
    weight: '600',
    fontFamily: 'NotoSerif-Bold',
    fontFamilies: ['NotoSerif-Bold', 'LibreBaskerville-Bold', 'PlayfairDisplay-Bold'],
    case: 'capitalize',
    letterSpacing: 0.05,
    placement: 'center',
    align: 'center',
    heightPercent: 72,
    paddingHorizontal: 4,
    paddingVertical: 8,
    sizes: {
      small: { fontSize: 36, paddingHorizontal: 3, paddingVertical: 5 },
      medium: {},
      large: { fontSize: 58, paddingHorizontal: 5, paddingVertical: 10 },
    },
  },

  author: {
    orientation: 'horizontal',
    fontSize: 13,
    weight: '500',
    fontFamily: 'NotoSerif-Regular',
    fontFamilies: ['NotoSerif-Regular', 'Lora-Regular'],
    case: 'capitalize',
    placement: 'bottom',
    align: 'center',
    heightPercent: 16,
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
    titleScales: ['normal', 'statement'],
    titleWeights: ['medium', 'bold', 'regular'],
    titleCases: ['uppercase', 'capitalize'],
    authorOrientations: ['horizontal', 'vertical-up', 'match-title'],
    authorTreatments: ['plain', 'prefixed'],
    authorScales: ['small', 'balanced'],
    densities: ['balanced', 'minimal'],
    alignments: ['centered', 'top-heavy'],
    lineStyles: ['thin', 'medium'],
    decorativeElements: ['top-line', 'bottom-line', 'none'],
  },

  personality: {
    prefersBold: false,
    prefersMinimal: true,
    prefersClassic: true,
    prefersExperimental: false,
  },

  usedFor: ['non-fiction', 'general-non-fiction', 'informational'],
  preferredFor: ['non-fiction'],
};
