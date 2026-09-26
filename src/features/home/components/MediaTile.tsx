import React, { memo } from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Text } from '@/components/Text';
import { MediaImage } from '@/components/MediaImage';
import { useTheme } from '@/features/theme/useTheme';
import Touchable from '@/components/Touchable';
import { spacing, typography } from '@/constants/design';

type Props = {
  cover: any;
  title: string;
  subtitle: string;
  size: number;
  radius: number;
  onPress?: () => void;
  onLongPress?: () => void;
};

function MediaTile({ cover, title, subtitle, size, radius, onPress, onLongPress }: Props) {
  const { colors } = useTheme();

  const Wrapper: React.ComponentType<any> = onPress || onLongPress ? Touchable : View;

  const containerStyle: StyleProp<ViewStyle> = { width: size };
  const imageStyle: StyleProp<ViewStyle> = {
    width: size,
    height: size,
    borderRadius: radius,
    overflow: 'hidden',
  };

  return (
    <Wrapper onPress={onPress} onLongPress={onLongPress} style={containerStyle}>
      <MediaImage cover={cover} size="grid" style={imageStyle} />
      <Text numberOfLines={1} style={[styles.title, { color: colors.secondary }]}>{title}</Text>
      <Text numberOfLines={1} style={[styles.subtitle, { color: colors.subtext }]}>{subtitle}</Text>
    </Wrapper>
  );
}

export default memo(MediaTile);

const styles = StyleSheet.create({
  title: {
    ...typography.compactRowTitle,
    marginTop: spacing.tight,
  },
  subtitle: {
    ...typography.caption,
    marginTop: spacing.xxs,
    // Reserved, not measured. Shelves mix items that have a second line with
    // items that don't — an artist with a description sits beside one with
    // none — and without a floor the two tiles put their titles on different
    // baselines, which reads as a broken row rather than as missing data.
    minHeight: typography.caption.lineHeight,
  },
});
