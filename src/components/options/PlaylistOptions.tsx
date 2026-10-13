import React, { forwardRef, useMemo, useState } from 'react';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useTranslation } from 'react-i18next';
import { formatDate } from '@/components/formatDate';
import type { Playlist } from '@/domain/entities/Playlist';
import { OptionSheetInfoRow, OptionSheetSectionLabel, OptionSheetDivider } from './OptionSheetPrimitives';
import { EntityOptionsSheet } from '@/features/entity-actions/EntityOptionsSheet';
import { dismissSheetRef } from '@/features/entity-actions/shared/sheetRef';
import { usePlaylistOptionsActions } from '@/features/entity-actions/hooks/usePlaylistActions';
import RenamePlaylistSheet from '@/features/playlist/RenamePlaylistSheet';

type PlaylistOptionsProps = {
  playlist: Playlist | null;
  /** Hide "Go to Playlist" when already on the playlist screen */
  hideGoToPlaylist?: boolean;
  /** Offers "Edit songs", which calls this — given by the playlist screen, the one place to edit on. */
  onEditSongs?: () => void;
};

/**
 * `playlist` may be null while the caller resolves it — one component
 * throughout (not a separate loading component) so the same
 * `BottomSheetModal` instance carries across that transition; see
 * `EntityOptionsSheet`'s `header: null` doc.
 */
const PlaylistOptions = forwardRef<BottomSheetModal, PlaylistOptionsProps>(
  ({ playlist, hideGoToPlaylist, onEditSongs }, ref) => {
    const { t } = useTranslation();
    const snapPoints = useMemo(() => ['55%', '90%'], []);
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const close = () => dismissSheetRef(ref);

    const { actions, songs, renaming } = usePlaylistOptionsActions(playlist, {
      hideGoToPlaylist: !!hideGoToPlaylist, isSheetOpen, close, onEditSongs,
    });

    return (
      <>
        <EntityOptionsSheet
          ref={ref}
          snapPoints={snapPoints}
          onChange={index => setIsSheetOpen(index >= 0)}
          header={playlist ? { cover: playlist.cover, title: playlist.title, subtitle: t('playlistOptions.playlistLabel'), titleLines: 2 } : null}
          actions={actions}
          infoSection={playlist && (
            <>
              <OptionSheetDivider />
              <OptionSheetSectionLabel label={t('playlistOptions.sections.info')} />
              <OptionSheetInfoRow label={t('playlistOptions.info.lastChanged')} value={formatDate(playlist.updatedAt, { short: true, fallback: '—' })} />
              <OptionSheetInfoRow label={t('playlistOptions.info.created')} value={formatDate(playlist.createdAt, { short: true, fallback: '—' })} />
              <OptionSheetInfoRow label={t('playlistOptions.info.songs')} value={songs.length} />
            </>
          )}
        />
        {renaming.isOpen && playlist && <RenamePlaylistSheet playlist={playlist} onClose={renaming.close} />}
      </>
    );
  }
);

PlaylistOptions.displayName = 'PlaylistOptions';

export default PlaylistOptions;
