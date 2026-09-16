import React, { forwardRef, useMemo, useState } from 'react';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useTranslation } from 'react-i18next';
import type { Artist } from '@/domain/entities/Artist';
import { OptionSheetInfoRow, OptionSheetSectionLabel, OptionSheetDivider } from './OptionSheetPrimitives';
import { EntityOptionsSheet } from '@/features/entity-actions/EntityOptionsSheet';
import { dismissSheetRef } from '@/features/entity-actions/shared/sheetRef';
import {
  useArtistExternalActions,
  useArtistOptionsActions,
} from '@/features/entity-actions/hooks/useArtistActions';

type ArtistOptionsProps = {
  artist: Artist | null;
  /** Hide "Go to Artist" when already on the artist screen */
  hideGoToArtist?: boolean;
};

/**
 * True when `artist` came from an external catalog (Deezer/MusicBrainz)
 * rather than the user's library — read off `provenance`, the one place that
 * distinction lives now that there is a single `Artist` type. Mirrors
 * `isExternalAlbumOrigin` in `AlbumOptions`.
 */
function isExternalArtistOrigin(artist: Artist): boolean {
  return artist.provenance.origin === 'integration';
}

/**
 * `artist` may be null while the caller resolves it — one component
 * throughout (not a separate loading component) so the same
 * `BottomSheetModal` instance carries across that transition; see
 * `EntityOptionsSheet`'s `header: null` doc.
 */
const ArtistOptions = forwardRef<BottomSheetModal, ArtistOptionsProps>(
  ({ artist, hideGoToArtist }, ref) => {
    if (artist && isExternalArtistOrigin(artist)) {
      return <ExternalArtistOptionsSheet ref={ref} artist={artist} />;
    }
    return <LibraryArtistOptionsSheet ref={ref} artist={artist} hideGoToArtist={hideGoToArtist} />;
  }
);

ArtistOptions.displayName = 'ArtistOptions';

export default ArtistOptions;

const LibraryArtistOptionsSheet = forwardRef<BottomSheetModal, ArtistOptionsProps>(
  ({ artist, hideGoToArtist }, ref) => {
    const { t } = useTranslation();
    const snapPoints = useMemo(() => ['55%', '90%'], []);
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const close = () => dismissSheetRef(ref);

    const { actions, artistAlbums, playCount } = useArtistOptionsActions(artist, {
      hideGoToArtist: !!hideGoToArtist, isSheetOpen, close,
    });

    return (
      <EntityOptionsSheet
        ref={ref}
        testID="artist-options-sheet"
        snapPoints={snapPoints}
        onChange={index => setIsSheetOpen(index >= 0)}
        header={artist ? { cover: artist.cover, title: artist.name, subtitle: t('artistOptions.artistLabel'), titleLines: 2 } : null}
        actions={actions}
        infoSection={artist && (
          <>
            <OptionSheetDivider />
            <OptionSheetSectionLabel label={t('artistOptions.sections.info')} />
            <OptionSheetInfoRow label={t('artistOptions.info.albums')} value={artistAlbums.length} />
            <OptionSheetInfoRow label={t('artistOptions.info.plays')} value={playCount} />
          </>
        )}
      />
    );
  }
);

LibraryArtistOptionsSheet.displayName = 'LibraryArtistOptionsSheet';

/**
 * The browsed artist's sheet: no info section, because every number in the
 * library one (albums held, plays) is a fact about a library that does not
 * have this artist. `artist` is always resolved before this branch renders.
 */
const ExternalArtistOptionsSheet = forwardRef<BottomSheetModal, { artist: Artist }>(
  ({ artist }, ref) => {
    const { t } = useTranslation();
    const snapPoints = useMemo(() => ['30%'], []);
    const close = () => dismissSheetRef(ref);

    const { actions } = useArtistExternalActions(artist, { close });

    return (
      <EntityOptionsSheet
        ref={ref}
        testID="artist-options-sheet"
        snapPoints={snapPoints}
        header={{ cover: artist.cover, title: artist.name, subtitle: t('artistOptions.artistLabel'), titleLines: 2 }}
        actions={actions}
      />
    );
  }
);

ExternalArtistOptionsSheet.displayName = 'ExternalArtistOptionsSheet';
