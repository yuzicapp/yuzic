import React, { forwardRef, useMemo, useState } from 'react';
import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { useTranslation } from 'react-i18next';
import type { Album } from '@/domain/entities/Album';
import { useTheme } from '@/features/theme/useTheme';
import { useSheetRef } from '@/components/useSheetRef';
import { renderBackdrop } from '@/components/BottomSheetBackdrop';
import GetReviewSheet from '@/components/options/GetReviewSheet';
import {
  OptionSheetChipsRow,
  OptionSheetDivider,
  OptionSheetHeader,
  OptionSheetInfoRow,
  OptionSheetRow,
  OptionSheetSectionLabel,
  optionSheetStyles,
  useOptionSheetBackground,
  useOptionSheetContentStyle,
} from './OptionSheetPrimitives';
import { EntityOptionsSheet } from '@/features/entity-actions/EntityOptionsSheet';
import { dismissSheetRef } from '@/features/entity-actions/shared/sheetRef';
import { useAlbumLibraryActions, useAlbumExternalActions } from '@/features/entity-actions/hooks/useAlbumActions';

type AlbumOptionsProps = {
  album: Album | null;
  /** Hide "Go to Album" when already on the album screen (library albums only). */
  hideGoToAlbum?: boolean;
};

/**
 * True when `album` came from an external catalog (Deezer/etc) rather than
 * the user's library — read off `provenance`, the one place that
 * distinction lives now that there is a single `Album` type. Mirrors
 * `isExternalAlbum` in `components/rows/AlbumRow`.
 */
function isExternalAlbumOrigin(album: Album): boolean {
  return album.provenance.origin === 'integration';
}

const AlbumOptions = forwardRef<BottomSheetModal, AlbumOptionsProps>(
  ({ album, hideGoToAlbum }, ref) => {
    if (album && isExternalAlbumOrigin(album)) {
      return <ExternalAlbumOptionsSheet ref={ref} album={album} />;
    }
    return <LibraryAlbumOptionsSheet ref={ref} album={album} hideGoToAlbum={hideGoToAlbum} />;
  }
);

AlbumOptions.displayName = 'AlbumOptions';

export default AlbumOptions;

// ---------------------------------------------------------------------------
// Library album action set. `album` may be null while the caller resolves
// it — one component throughout (not a separate loading component) so the
// same `BottomSheetModal` instance carries across that transition; see
// `EntityOptionsSheet`'s `header: null` doc.
// ---------------------------------------------------------------------------

type LibraryAlbumOptionsProps = {
  album: Album | null;
  hideGoToAlbum?: boolean;
};

const LibraryAlbumOptionsSheet = forwardRef<BottomSheetModal, LibraryAlbumOptionsProps>(
  ({ album, hideGoToAlbum }, ref) => {
    const { t } = useTranslation();
    const snapPoints = useMemo(() => ['55%', '90%'], []);
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const close = () => dismissSheetRef(ref);

    const { actions, songs, playCount } = useAlbumLibraryActions(album, {
      hideGoToAlbum: !!hideGoToAlbum, isSheetOpen, close,
    });

    return (
      <EntityOptionsSheet
        ref={ref}
        snapPoints={snapPoints}
        onChange={index => setIsSheetOpen(index >= 0)}
        header={album ? { cover: album.cover, title: album.title, subtitle: album.artist?.name ?? '', titleLines: 2 } : null}
        actions={actions}
        infoSection={album && (
          <>
            <OptionSheetDivider />
            <OptionSheetSectionLabel label={t('albumOptions.sections.albumInfo')} />
            <OptionSheetInfoRow label={t('albumOptions.info.artist')} value={album.artist?.name ?? t('albumOptions.info.unknown')} valueLines={1} />
            <OptionSheetInfoRow label={t('albumOptions.info.year')} value={album.year ?? t('albumOptions.info.unknown')} />
            {album.genres?.length ? (
              <OptionSheetChipsRow label={t('albumOptions.info.genres')} values={album.genres} />
            ) : (
              <OptionSheetInfoRow label={t('albumOptions.info.genres')} value={t('albumOptions.info.unknown')} />
            )}
            <OptionSheetInfoRow label={t('albumOptions.info.songs')} value={songs.length} />
            <OptionSheetInfoRow label={t('albumOptions.info.plays')} value={playCount} />
          </>
        )}
      />
    );
  }
);

LibraryAlbumOptionsSheet.displayName = 'LibraryAlbumOptionsSheet';

// ---------------------------------------------------------------------------
// External album action set. Kept on the primitives directly (a
// `BottomSheetView`, not `EntityOptionsSheet`'s scrolling shell, and no
// loading state — `album` is always resolved before this branch renders) to
// preserve the original's non-scrolling layout exactly.
// ---------------------------------------------------------------------------

type ExternalAlbumOptionsSheetProps = {
  album: Album;
};

const ExternalAlbumOptionsSheet = forwardRef<BottomSheetModal, ExternalAlbumOptionsSheetProps>(
  ({ album }, ref) => {
    const { colors } = useTheme();
    // Taller than the original two rows: the sheet now also carries where to
    // go next and the two ways out of the app (see `albumExternalActions`).
    const sheetBg = useOptionSheetBackground();
    const sheetContent = useOptionSheetContentStyle();
    const close = () => dismissSheetRef(ref);
    const downloadSheetRef = useSheetRef();

    const { actions } = useAlbumExternalActions(album, { close, openGet: () => downloadSheetRef.current?.present() });

    return (
      <>
        <BottomSheetModal
          ref={ref}
          enableDynamicSizing
          enablePanDownToClose
          backdropComponent={renderBackdrop}
          handleIndicatorStyle={{ backgroundColor: colors.border }}
          backgroundStyle={[optionSheetStyles.sheetBackground, sheetBg]}
        >
          <BottomSheetView style={[sheetContent, sheetBg]}>
            <OptionSheetHeader cover={album.cover} title={album.title} subtitle={album.artist.name} />
            <OptionSheetDivider />
            {actions.map(action => (
              <OptionSheetRow
                key={action.id}
                icon={action.icon}
                label={action.label}
                onPress={action.onPress}
                disabled={action.disabled}
                dimRow={action.dimRow}
                dimLabel={action.dimLabel}
                loading={action.loading}
                labelColor={action.labelColor}
                trailing={action.trailing}
              />
            ))}
          </BottomSheetView>
        </BottomSheetModal>

        <GetReviewSheet album={album} sheetRef={downloadSheetRef} />
      </>
    );
  }
);

ExternalAlbumOptionsSheet.displayName = 'ExternalAlbumOptionsSheet';
