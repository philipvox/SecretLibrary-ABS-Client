/**
 * Paranormal Romance genre profile
 * Dark romantic type for supernatural love stories
 */

import { GenreProfile } from '../types';

export const PARANORMAL_ROMANCE: GenreProfile = {
  id: 'paranormal-romance',
  name: 'Paranormal Romance',
  description: 'Dark romantic type for supernatural love stories',

  title: {
    orientation: 'vertical-up',
    fontSize: 46,
    weight: '600',
    fontFamily: 'GrenzeGotisch-Regular',
    fontFamilies: ['GrenzeGotisch-Regular', 'Charm-Regular', 'PlayfairDisplay-Bold'],
    case: 'capitalize',
    letterSpacing: 0.04,
    placement: 'center',
    align: 'center',
    heightPercent: 68,
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
    fontSize: 14,
    weight: '400',
    fontFamily: 'PlayfairDisplay-Regular',
    fontFamilies: ['PlayfairDisplay-Regular', 'Lora-Regular'],
    case: 'capitalize',
    placement: 'bottom',
    align: 'center',
    heightPercent: 18,
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
    titleOrientations: ['horizontal', 'vertical-up'],
    titleScales: ['normal', 'statement', 'balanced', 'shout'],
    titleWeights: ['light', 'regular', 'medium'],
    titleCases: ['capitalize', 'uppercase'],
    authorOrientations: ['horizontal', 'match-title'],
    authorTreatments: ['plain', 'prefixed', 'underlined'],
    authorScales: ['small', 'balanced', 'tiny'],
    densities: ['balanced', 'minimal'],
    alignments: ['centered', 'top-heavy'],
    lineStyles: ['thin', 'double'],
    decorativeElements: ['divider-line', 'top-line', 'bottom-line'],
  },

  personality: {
    prefersBold: false,
    prefersMinimal: false,
    prefersClassic: true,
    prefersExperimental: false,
  },

  usedFor: ['paranormal-romance', 'vampire-romance', 'supernatural-romance'],
  preferredFor: ['paranormal-romance'],
};
