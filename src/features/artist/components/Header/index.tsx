import { coverFade, hitSlopFor, iconSize, onDark, shade, spacing, typography } from '@/constants/design';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { View, StyleSheet, Platform } from 'react-native';
import { Text } from '@/components/Text';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft } from 'lucide-react-native';
import TurboImage from 'react-native-turbo-image';
import { MediaImage } from '@/components/MediaImage';
import { buildCover } from '@/providers/registry/covers';
import { useTheme } from '@/features/theme/useTheme';
import {
  DetailHeaderBar,
  useDetailHeaderInset,
  useDetailHeroTitleLayout,
} from '@/components/DetailHeader';
import Touchable from '@/components/Touchable';
import { useRadius } from '@/features/theme/useRadius';
import type { ArtistScreenModel } from '@/features/artist/useArtistScreenModel';
import type { CoverSource } from '@/domain/entities/Cover';
import { useResolvedCover } from '@/features/artwork/useResolvedCover';
import { SOURCES } from '@/providers/registry/sources';
import ArtistMetaRow from './ArtistMetaRow';
import ExternalActionRow from './ExternalActionRow';
import LocalActionRow from './LocalActionRow';
import ArtistOptionsButton from './ArtistOptionsButton';

const NO_COVER: CoverSource = { kind: 'none' };

type Props = {
  model: ArtistScreenModel;
  showNavigation?: boolean;
};

const ArtistHeader: React.FC<Props> = ({ model, showNavigation = true }) => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const { isDarkMode, colors } = useTheme();
  const rad = useRadius();
  // The bar floats over this art now, so the wrapper grows by exactly the room
  // it and the status bar take: the cover stays where it was against the
  // content below, and the extra strip is filled with art rather than a band.
  const barInset = useDetailHeaderInset();
  const onTitleLayout = useDetailHeroTitleLayout();

  const { artist, isLocal, counts } = model;
  const displayName = artist?.name ?? '';
  // The same rule as every tile: its own picture, the library's copy, then a
  // backup — and only a backup's picture is credited.
  const { cover: displayCover, from } = useResolvedCover(artist?.cover ?? NO_COVER);
  const enrichedArtworkSourceNameKey = from === 'own' || from === 'library' ? null : SOURCES[from].nameKey;

  const coverUri = buildCover(displayCover, 'background');

  return (
    <>
      <View style={[styles.fullBleedWrapper, { height: ARTIST_HERO_HEIGHT + barInset }]}>
        {coverUri ? (
          <TurboImage
            source={{ uri: coverUri }}
            style={[StyleSheet.absoluteFill, { left: -50, right: -50 }]}
            resizeMode="cover"
            blur={Platform.OS === 'ios' ? 20 : 10}
            fadeDuration={300}
            cachePolicy="dataCache"
          />
        ) : (
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: colors.muted },
            ]}
          />
        )}

        <LinearGradient
          colors={
            isDarkMode
              ? coverFade.onDark
              : coverFade.onLight
          }
          style={StyleSheet.absoluteFill}
        />

        <View style={[styles.centeredCoverContainer, { borderRadius: rad.pill }]}>
          <MediaImage
            cover={displayCover}
            size="detail"
            style={[styles.centeredCover, { borderRadius: rad.pill }]}
          />
        </View>

        {showNavigation && (
          <View style={styles.header}>
            <Touchable
              testID="detail-back-button"
              accessibilityRole="button"
              accessibilityLabel={t('a11y.common.back')}
              style={[styles.backButton, { borderRadius: rad.md }]}
              hitSlop={hitSlopFor(36)}
              onPress={() => navigation.goBack()}
            >
              <ChevronLeft size={iconSize.header} color={onDark.text} style={{ marginLeft: -2 }} />
            </Touchable>
            {artist ? (
              <ArtistOptionsButton artist={artist} />
            ) : (
              <View style={{ width: 36 }} />
            )}
          </View>
        )}
      </View>

      <View style={{ paddingHorizontal: spacing.lg }} onLayout={onTitleLayout}>
        <View style={styles.content}>
          <Text
            style={[styles.artistName, { color: colors.secondary }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.65}
          >
            {displayName}
          </Text>
          <ArtistMetaRow isLocal={isLocal} counts={counts} />
          {enrichedArtworkSourceNameKey && (
            <Text style={[styles.artworkSourceLine, { color: colors.subtext }]}>
              {t('artist.enrichedArtworkSource', { source: t(enrichedArtworkSourceNameKey) })}
            </Text>
          )}
        </View>
      </View>

      {artist
        ? isLocal
          ? <LocalActionRow artist={artist} />
          : <ExternalActionRow artist={artist} />
        : null}
    </>
  );
};

export const ArtistHeaderBar: React.FC<Props> = ({ model }) => {
  const displayName = model.artist?.name ?? '';
  return (
    <DetailHeaderBar
      title={displayName}
      rightAction={model.artist ? <ArtistOptionsButton artist={model.artist} /> : undefined}
    />
  );
};

export default ArtistHeader;

/** The blurred cover behind an artist's name, before the floating bar's inset. */
const ARTIST_HERO_HEIGHT = 300;

const styles = StyleSheet.create({
  fullBleedWrapper: {
    width: '100%',
    height: ARTIST_HERO_HEIGHT,
    justifyContent: 'flex-end',
    alignItems: 'center',
    overflow: 'hidden',
  },
  centeredCoverContainer: {
    position: 'absolute',
    bottom: -32,
    width: 120,
    height: 120,
    overflow: 'hidden',
    backgroundColor: onDark.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centeredCover: {
    width: '100%',
    height: '100%',
  },
  header: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 20 : 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    zIndex: 20,
  },
  backButton: {
    width: 36,
    height: 36,
    backgroundColor: shade.scrim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  artistName: {
    ...typography.display,
    fontWeight: '600',
    textAlign: 'center',
    width: '100%',
  },
  artworkSourceLine: {
    ...typography.micro,
    marginTop: spacing.xxs,
  },
});
