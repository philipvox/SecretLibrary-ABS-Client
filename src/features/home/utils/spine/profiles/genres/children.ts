/**
 * Children genre profile
 * Playful friendly type for kids books - prioritizes readability
 */

import { GenreProfile } from '../types';

export const CHILDREN: GenreProfile = {
  id: 'children',
  name: 'Children',
  description: 'Playful friendly type for kids books - prioritizes readability',

  title: {
    orientation: 'vertical-up',
    fontSize: 44,
    weight: '700',
    fontFamily: 'Oswald-Bold',
    fontFamilies: ['Oswald-Bold', 'BebasNeue-Regular', 'Notable-Regular', 'Barriecito-Regular'],
    case: 'capitalize',
    letterSpacing: 0.04,
    placement: 'center',
    align: 'center',
    heightPercent: 70,
    paddingHorizontal: 4,
    paddingVertical: 8,
    sizes: {
      small: { fontSize: 34, paddingHorizontal: 3, paddingVertical: 5 },
      medium: {},
      large: { fontSize: 54, paddingHorizontal: 5, paddingVertical: 10 },
    },
  },

  author: {
    orientation: 'horizontal',
    fontSize: 12,
    weight: '500',
    fontFamily: 'Oswald-Regular',
    fontFamilies: ['Oswald-Regular', 'BebasNeue-Regular'],
    case: 'capitalize',
    placement: 'bottom',
    align: 'center',
    heightPercent: 18,
    treatment: 'plain',
    paddingHorizontal: 8,
    paddingVertical: 6,
    sizes: {
      small: { orientation: 'vertical-up', fontSize: 9, paddingHorizontal: 4, paddingVertical: 4 },
      medium: {},
      large: { fontSize: 14, paddingHorizontal: 10, paddingVertical: 8 },
    },
  },

  decoration: { element: 'none', lineStyle: 'none' },

  options: {
    titleOrientations: ['horizontal', 'stacked-words'],
    titleScales: ['statement', 'shout'],
    titleWeights: ['bold', 'black'],
    titleCases: ['capitalize', 'uppercase'],
    authorOrientations: ['horizontal', 'vertical-up', 'vertical-down'],
    authorTreatments: ['plain'],
    authorScales: ['small', 'tiny'],
    densities: ['balanced', 'dense'],
    alignments: ['centered', 'bottom-heavy'],
    lineStyles: ['medium', 'thick'],
    decorativeElements: ['top-line', 'bottom-line'],
  },

  personality: {
    prefersBold: true,
    prefersMinimal: false,
    prefersClassic: false,
    prefersExperimental: false,
  },

  usedFor: ['children', 'kids', 'middle-grade', 'juvenile', "children's", 'picture book', 'early readers', 'chapter books'],
  preferredFor: ['children', 'kids', "children's"],
};
