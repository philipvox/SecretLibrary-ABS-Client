/**
 * Western genre profile
 * Bold frontier aesthetic with slab serif
 */

import { GenreProfile } from '../types';

export const WESTERN: GenreProfile = {
  id: 'western',
  name: 'Western',
  description: 'Bold frontier aesthetic with slab serif',

  title: {
    orientation: 'vertical-up',
    fontSize: 28,
    weight: '400',
    fontFamily: 'Notable-Regular',
    fontFamilies: ['Notable-Regular', 'AlfaSlabOne-Regular', 'GravitasOne-Regular'],
    case: 'uppercase',
    letterSpacing: 1,
    maxLines: 2,
    placement: 'center',
    align: 'center',
    heightPercent: 75,
    paddingHorizontal: 10,
    paddingVertical: 10,
    textSplitPercent: 50,
    lineHeight: 30,
    sizes: {
      small: { orientation: 'vertical-up', fontSize: 24, paddingHorizontal: 5, paddingVertical: 5 },
      medium: {},
      large: { placement: 'bottom', orientation: 'vertical-up', fontSize: 36, heightPercent: 70, paddingHorizontal: 12, paddingVertical: 20, lineHeight: 36 },
    },
  },

  author: {
    orientation: 'stacked-words',
    fontSize: 15,
    weight: '700',
    fontFamily: 'Oswald-Bold',
    case: 'uppercase',
    placement: 'bottom',
    align: 'center',
    heightPercent: 20,
    treatment: 'plain',
    paddingHorizontal: 8,
    paddingVertical: 6,
    sizes: {
      small: { orientation: 'vertical-up', fontSize: 12, paddingHorizontal: 4, paddingVertical: 4 },
      medium: {},
      large: { orientation: 'vertical-two-row', placement: 'top', fontSize: 18, heightPercent: 30, paddingHorizontal: 10, paddingVertical: 8 },
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

  usedFor: ['western', 'frontier', 'cowboy', 'americana'],
  preferredFor: ['western'],
};
