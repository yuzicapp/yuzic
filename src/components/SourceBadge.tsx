import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/Text';
import { onDark, spacing, typography } from '@/constants/design';
import { useRadius } from '@/features/theme/useRadius';

/**
 * The single letter marking which outside source a shelf came from.
 *
 * Was the same twenty-pixel disc written out six times — on Home, in search
 * results, on the album and artist screens and in playlist recommendations —
 * each with its own copy of the style. Now that the text size applies while
 * the app is running, all six would have clipped their letter at the larger
 * sizes, so this is one place to size it rather than six places to get it
 * wrong.
 *
 * Sized by a minimum plus padding rather than a fixed square: the letter grows
 * with the user's text size and the disc grows with it, instead of the letter
 * being trimmed by a box that cannot move.
 */
export default function SourceBadge({ letter, color }: { letter: string; color: string }) {
  const rad = useRadius();
  return (
    <View style={[styles.badge, { backgroundColor: color, borderRadius: rad.pill }]}>
      <Text style={styles.letter}>{letter}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    minWidth: 20,
    minHeight: 20,
    paddingHorizontal: spacing.xxs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: {
    ...typography.micro,
    fontWeight: '600',
    color: onDark.text,
  },
});
