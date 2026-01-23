/**
 * Horror genre profile
 * Dark gothic lettering for supernatural tales
 */

import { GenreProfile } from '../types';

export const HORROR: GenreProfile = {
  id: 'horror',
  name: 'Horror',
  description: 'Dark gothic lettering for supernatural tales',

  title: {
    orientation: 'vertical-up',
    fontSize: 48,
    weight: '400',
    fontFamily: 'GrenzeGotisch-Regular',
    fontFamilies: ['GrenzeGotisch-Regular', 'Eater-Regular', 'PlayfairDisplay-Bold'],
    case: 'capitalize',
    letterSpacing: 0.03,
    placement: 'center',
    align: 'center',
    heightPercent: 70,
    paddingHorizontal: 4,
    paddingVertical: 8,
    sizes: {
      small: {
        fontSize: 36,
        letterSpacing: 0.02,
        paddingHorizontal: 3,
        paddingVertical: 5,
      },
      medium: {},
      large: {
        fontSize: 56,
        letterSpacing: 0.04,
        paddingHorizontal: 5,
        paddingVertical: 10,
      },
    },
  },

  author: {
    orientation: 'horizontal',
    fontSize: 13,
    weight: '600',
    fontFamily: 'PlayfairDisplay-Bold',
    fontFamilies: ['PlayfairDisplay-Bold', 'Lora-Bold'],
    case: 'capitalize',
    placement: 'bottom',
    align: 'center',
    heightPercent: 18,
    treatment: 'plain',
    paddingHorizontal: 8,
    paddingVertical: 6,
    sizes: {
      small: {
        orientation: 'vertical-up',
        fontSize: 10,
        paddingHorizontal: 4,
        paddingVertical: 4,
      },
      medium: {},
      large: {
        fontSize: 15,
        paddingHorizontal: 10,
        paddingVertical: 8,
      },
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

  usedFor: ['horror', 'supernatural', 'dark-fantasy', 'gothic'],
  preferredFor: ['horror', 'gothic'],
};
