import React from 'react';
import { useTranslation } from 'react-i18next';
import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { buildCover } from '@/providers/registry/covers';
import { CoverSource } from '@/domain/entities/Cover';
import { useResolvedCover } from '@/features/artwork/useResolvedCover';
import Touchable from '@/components/Touchable';
import { coverFade, onDark, onDarkAlpha, spacing, typography, veil } from '@/constants/design';
import { useRadius } from '@/features/theme/useRadius';
/** The card is a fixed height; the name and text below the image keep at least this much of it. */
const CARD_HEIGHT = 280;
const TEXT_MIN_HEIGHT = 70;
const CARD_PADDING = 16;

type Props = {
  artistName: string;
  artistCover: CoverSource;
  subtext?: string;
  contentWidth: number;
  onPress?: () => void;
};

export default function AboutTheArtistCard({
  artistName,
  artistCover,
  subtext,
  contentWidth,
  onPress,
}: Props) {
  const { t } = useTranslation();
  const rad = useRadius();
  const imageHeight = CARD_HEIGHT - TEXT_MIN_HEIGHT;
  // An artist with no picture of its own gets your library's copy or a backup,
  // the same as anywhere else an artist is drawn.
  const { cover } = useResolvedCover(artistCover);
  const imageUri = buildCover(cover, 'detail');

  const card = (
    <View
      style={[styles.card, { width: contentWidth, height: CARD_HEIGHT, borderRadius: rad.panel }]}
    >
      <View style={[styles.imageContainer, { height: imageHeight }]}>
        <Image
          source={imageUri ? { uri: imageUri } : require('@assets/images/artist-placeholder.png')}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          contentPosition="top center"
        />
        <LinearGradient
          colors={coverFade.photoScrim}
          style={StyleSheet.absoluteFill}
        />
        <Text
          style={styles.header}
          numberOfLines={1}
        >
          {t('playing.aboutArtist.header')}
        </Text>
      </View>

      {/* The chip over the image already says "Artist"; repeating it under the
          name said the same word twice about the same person, and spent the
          only line that could have carried something specific. When the caller
          has nothing to put there the line is dropped rather than filled. */}
      <View style={styles.textContainer}>
        <Text
          style={styles.title}
          numberOfLines={1}
        >
          {artistName}
        </Text>
        {subtext ? (
          <Text
            style={styles.subtext}
            numberOfLines={1}
          >
            {subtext}
          </Text>
        ) : null}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <Touchable
        accessibilityRole="button"
        accessibilityLabel={t('a11y.player.aboutArtist')}
        onPress={onPress}
        style={styles.touchable}
      >
        {card}
      </Touchable>
    );
  }

  return <View style={styles.touchable}>{card}</View>;
}

const styles = StyleSheet.create({
  touchable: {
    marginTop: spacing.lg,
  },
  card: {
    backgroundColor: veil.card,
    overflow: 'hidden',
  },
  header: {
    ...typography.label,
    position: 'absolute',
    top: CARD_PADDING,
    left: CARD_PADDING,
    right: CARD_PADDING,
    color: onDark.text,
    textAlign: 'left',
  },
  imageContainer: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: onDark.surfaceElevated,
  },
  textContainer: {
    justifyContent: 'center',
    minHeight: TEXT_MIN_HEIGHT,
    paddingHorizontal: CARD_PADDING,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  title: {
    ...typography.navigationTitle,
    color: onDark.text,
  },
  subtext: {
    ...typography.rowSubtitle,
    color: onDarkAlpha.prominent,
    marginTop: spacing.xxs,
  },
});
