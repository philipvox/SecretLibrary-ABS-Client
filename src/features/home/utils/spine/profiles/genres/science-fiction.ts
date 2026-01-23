/**
 * Science Fiction genre profile
 * Futuristic geometric type for space-age stories
 */

import { GenreProfile } from '../types';

export const SCIENCE_FICTION: GenreProfile = {
  id: 'science-fiction',
  name: 'Science Fiction',
  description: 'Futuristic geometric type for space-age stories',

  title: {
    orientation: 'vertical-up',
    fontSize: 50,
    weight: '400',
    fontFamily: 'Orbitron-Regular',
    fontFamilies: ['Orbitron-Regular', 'ZenDots-Regular', 'BebasNeue-Regular'],
    case: 'uppercase',
    letterSpacing: 0.08,
    placement: 'center',
    align: 'center',
    heightPercent: 80,
    paddingHorizontal: 4,
    paddingVertical: 8,
    sizes: {
      small: {
        fontSize: 38,
        letterSpacing: 0.06,
        paddingHorizontal: 3,
        paddingVertical: 5,
      },
      medium: {},
      large: {
        fontSize: 58,
        letterSpacing: 0.10,
        paddingHorizontal: 5,
        paddingVertical: 10,
      },
    },
  },

  author: {
    orientation: 'horizontal',
    fontSize: 14,
    weight: '600',
    fontFamily: 'Oswald-Bold',
    case: 'uppercase',
    placement: 'bottom',
    align: 'center',
    heightPercent: 15,
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
      medium: {
        orientation: 'stacked-words',
      },
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
    titleOrientations: ['horizontal', 'vertical-up', 'stacked-words'],
    titleScales: ['normal', 'statement', 'whisper', 'balanced'],
    titleWeights: ['light', 'medium', 'bold'],
    titleCases: ['uppercase', 'lowercase'],
    authorOrientations: ['horizontal', 'vertical-up'],
    authorTreatments: ['plain', 'bracketed'],
    authorScales: ['tiny', 'small', 'whisper'],
    densities: ['minimal', 'balanced', 'asymmetric'],
    alignments: ['centered', 'left-heavy', 'scattered'],
    lineStyles: ['thin', 'medium'],
    decorativeElements: ['corner-marks', 'side-line', 'none'],
  },

  personality: {
    prefersBold: false,
    prefersMinimal: true,
    prefersClassic: false,
    prefersExperimental: true,
  },

  usedFor: ['science-fiction', 'scifi', 'space-opera', 'cyberpunk'],
  preferredFor: ['science-fiction', 'cyberpunk'],
};
