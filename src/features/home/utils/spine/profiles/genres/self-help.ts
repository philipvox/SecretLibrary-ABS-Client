/**
 * Self-Help genre profile
 * Clean motivational type for personal development
 */

import { GenreProfile } from '../types';

export const SELF_HELP: GenreProfile = {
  id: 'self-help',
  name: 'Self-Help',
  description: 'Clean motivational type for personal development',

  title: {
    orientation: 'vertical-up',
    fontSize: 46,
    weight: '700',
    fontFamily: 'Oswald-Bold',
    fontFamilies: ['Oswald-Bold', 'BebasNeue-Regular', 'GravitasOne-Regular'],
    case: 'uppercase',
    letterSpacing: 0.06,
    placement: 'center',
    align: 'center',
    heightPercent: 70,
    paddingHorizontal: 4,
    paddingVertical: 8,
    sizes: {
      small: { fontSize: 36, paddingHorizontal: 3, paddingVertical: 5 },
      medium: {},
      large: { fontSize: 56, paddingHorizontal: 5, paddingVertical: 10 },
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
    titleScales: ['statement', 'normal'],
    titleWeights: ['bold', 'medium'],
    titleCases: ['uppercase', 'capitalize'],
    authorOrientations: ['horizontal', 'vertical-up', 'match-title'],
    authorTreatments: ['plain', 'boxed'],
    authorScales: ['small', 'tiny'],
    densities: ['balanced', 'dense'],
    alignments: ['centered', 'bottom-heavy'],
    lineStyles: ['medium', 'thin'],
    decorativeElements: ['divider-line', 'top-line'],
  },

  personality: {
    prefersBold: true,
    prefersMinimal: false,
    prefersClassic: false,
    prefersExperimental: false,
  },

  usedFor: ['self-help', 'personal-development', 'motivation', 'self-improvement'],
  preferredFor: ['self-help', 'personal-development'],
};
