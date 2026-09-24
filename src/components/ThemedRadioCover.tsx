import React from 'react';
import { View } from 'react-native';
import { Radio } from 'lucide-react-native';

import { onDark } from '@/constants/design';
import { useRadius } from '@/features/theme/useRadius';
import { useTheme } from '@/features/theme/useTheme';

/**
 * The artwork a live stream doesn't have.
 *
 * A station has no release behind it, so there is no picture to find and no
 * backup that could ever fill one — which left the player drawing the
 * missing-artwork glyph, the universal sign for *broken*, against a stream
 * that was playing perfectly well. This says "radio" instead, in the app's
 * own accent, the same way the favourites playlist says "heart".
 *
 * Sized like `ThemedHeartCover`: given a `size` it draws that square, given
 * none it fills its parent, so the same cover works in a row, on the playing
 * bar and at full width on the player.
 */
const ThemedRadioCover = ({ size, rounded }: { size?: number; rounded?: number }) => {
  const themeColor = useTheme().colors.themeColor;
  const rad = useRadius();

  const isGrid = size === undefined;
  const borderRadius = isGrid ? rad.md : (rounded ?? rad.md);

  return (
    <View
      style={{
        width: isGrid ? '100%' : size,
        height: isGrid ? undefined : size,
        aspectRatio: isGrid ? 1 : undefined,
        backgroundColor: themeColor,
        borderRadius,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
      }}
    >
      {/* The glyph is a share of the square rather than a fixed size, so it
          reads the same on a 44pt row as it does on a full-width player. */}
      <Radio size={isGrid ? '55%' : size! * 0.55} color={onDark.text} />
    </View>
  );
};

export default ThemedRadioCover;
