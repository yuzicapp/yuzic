import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { CloudDownload, Heart } from 'lucide-react-native';

import { DetailActionRow, DetailCircleAction, DetailPlayAction } from '@/components/DetailHeader';
import { useSheetRef } from '@/components/useSheetRef';
import { iconSize, onDark, onDarkAlpha, statusColor } from '@/constants/design';
import type { Artist } from '@/domain/entities/Artist';
import { promptConnectDownloader } from '@/features/downloaders/connectDownloaderPrompt';
import { useWantToggle } from '@/features/entity-actions/shared/wantActions';
import { useLocalFirst } from '@/features/library/useLocalFirst';
import { useTheme } from '@/features/theme/useTheme';
import { useIconSize } from '@/features/theme/useIconSize';
import ArtistGetSheet from '@/features/wants/ArtistGetSheet';
import { useWantGet } from '@/features/wants/useWantGet';

/**
 * Get and Want for an artist nobody's server has.
 *
 * The browsed artist screen had no action row at all — `⋯` was the only button
 * on it — while the browsed *album* screen has carried a Get pill all along.
 * So the two screens answered "how do I get this" differently, and the artist's
 * answer was "you cannot, from here": the Get lived on the Wants screen behind
 * a row's `⋯`, four steps and one misleading tap away from where you found
 * them.
 *
 * Getting an artist means following them — only a collection manager has any
 * concept of that, so this is Lidarr's `monitorArtist` and nothing else can
 * take it. With nothing connected the pill still answers, with the prompt that
 * says what a downloader is, rather than sitting greyed out and swallowing the
 * tap. That is the album row's rule, kept.
 *
 * Wanting is still a bookmark that starts nothing, so the two are separate
 * buttons. Getting, though, saves the want as well when there is not one
 * already: asking for an artist is a stronger statement than bookmarking one,
 * and the want is the only place the app has to show what became of the
 * request — `setWantJobRef` finds nothing to attach to otherwise, and the
 * Wants screen would never learn the artist had been asked for.
 */
export default function ExternalActionRow({ artist }: { artist: Artist }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const icons = useIconSize();
  const { canGetArtist } = useWantGet();
  const getSheetRef = useSheetRef();
  const { isWanted, toggle } = useWantToggle(artist.localId, 'artist', 'artist-page');
  const { localArtist } = useLocalFirst();

  // Already yours: there is nothing to want and nothing to fetch. The one rule
  // answers that here as everywhere else (features/library/localFirst).
  const isInLibrary = localArtist(artist) !== null;

  // An artist want carries the name in both fields: there is no separate credit
  // to record, and `arrival`/`jobStatus` both read the artist off `want.artist`.
  const wantPayload = {
    externalIds: artist.externalIds,
    title: artist.name,
    artist: artist.name,
    cover: artist.cover,
  };

  const handleGet = useCallback(() => {
    // Nothing that follows artists is connected: say what a downloader is and
    // offer the ones that could take this, rather than opening a review with
    // no service in it.
    if (!canGetArtist) {
      promptConnectDownloader('artist');
      return;
    }
    getSheetRef.current?.present();
  }, [canGetArtist, getSheetRef]);

  if (isInLibrary || !artist.localId) return null;

  return (
    <>
      <DetailActionRow>
        <DetailPlayAction onPress={handleGet} accessibilityLabel={t('a11y.detail.getArtist')}>
          <CloudDownload size={iconSize.control} color={canGetArtist ? onDark.text : onDarkAlpha.disabled} />
        </DetailPlayAction>

        <DetailCircleAction
          onPress={() => toggle(wantPayload)}
          accessibilityLabel={t(isWanted ? 'a11y.detail.wanted' : 'a11y.detail.want')}
        >
          <Heart
            size={icons.row}
            color={isWanted ? statusColor.success : colors.secondary}
            fill={isWanted ? statusColor.success : 'none'}
          />
        </DetailCircleAction>
      </DetailActionRow>

      <ArtistGetSheet
        artist={{
          localId: artist.localId,
          name: artist.name,
          mbid: artist.externalIds?.mbid,
          cover: artist.cover,
        }}
        sheetRef={getSheetRef}
        onConfirm={() => { if (!isWanted) toggle(wantPayload); }}
      />
    </>
  );
}
