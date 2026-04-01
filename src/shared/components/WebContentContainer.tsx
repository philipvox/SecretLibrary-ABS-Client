/**
 * src/shared/components/WebContentContainer.tsx
 *
 * Wrapper that constrains content to a max-width and centers it on web.
 * On native platforms, renders children directly with no overhead.
 *
 * Variants:
 * - 'narrow': 640px — settings, profile, forms
 * - 'content': 960px — book detail, search results, list views
 * - 'wide': 1200px — browse grids, cover galleries
 * - 'full': no constraint — bookshelf, player
 */

import React from 'react';
import { View, Platform, StyleSheet, ViewStyle } from 'react-native';

const IS_WEB = Platform.OS === 'web';

type Variant = 'narrow' | 'content' | 'wide' | 'full';

const MAX_WIDTHS: Record<Variant, number | undefined> = {
  narrow: 640,
  content: 960,
  wide: 1200,
  full: undefined,
};

interface Props {
  variant?: Variant;
  children: React.ReactNode;
  style?: ViewStyle;
}

export function WebContentContainer({ variant = 'content', children, style }: Props) {
  if (!IS_WEB || variant === 'full') {
    return style ? <View style={[{ flex: 1 }, style]}>{children}</View> : <>{children}</>;
  }

  const maxWidth = MAX_WIDTHS[variant];

  return (
    <View style={[styles.container, maxWidth ? { maxWidth } : undefined, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    alignSelf: 'center',
  },
});
