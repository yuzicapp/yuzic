import React, { memo, useCallback, useState } from 'react';

import MediaTile from './MediaTile';
import AlbumOptions from '@/components/options/AlbumOptions';
import ArtistOptions from '@/components/options/ArtistOptions';
import { useSheetRef } from '@/components/useSheetRef';
import { useSongActionSheets } from '@/features/entity-actions/SongActionSheetContext';
import type { Album } from '@/domain/entities/Album';
import type { Artist } from '@/domain/entities/Artist';
import type { Song } from '@/domain/entities/Song';
import type { CoverSource } from '@/domain/entities/Cover';

/** What the tile is showing, and therefore which options sheet it opens. */
type TileEntity =
  | { kind: 'album'; album: Album }
  | { kind: 'artist'; artist: Artist }
  | { kind: 'song'; song: Song };

type Props = {
  entity: TileEntity;
  cover: CoverSource;
  title: string;
  subtitle: string;
  size: number;
  radius: number;
  onPress?: () => void;
};

/**
 * A Home shelf tile that carries the same options its entity gets everywhere
 * else, on a long press.
 *
 * Half the shelves had them and half did not: Recently Played answered a long
 * press, and Recently Added and Most Played draw library rows that carry a
 * "…" — while Charts, Top Artists, the genre and "because you listened"
 * shelves, Continue Playing and the server's random rail answered nothing at
 * all. Same gesture, same sheets (`AlbumOptions` / `ArtistOptions` /
 * `SongOptions`), so an album found on Home can be wanted, got or shared
 * exactly as one found in search can.
 *
 * The sheet is mounted on first use rather than with the tile: a shelf is ten
 * of these, and each sheet otherwise mounts its own data hooks for something
 * nobody has pressed.
 */
function OptionsTile({ entity, cover, title, subtitle, size, radius, onPress }: Props) {
  const sheetRef = useSheetRef();
  const [optionsMounted, setOptionsMounted] = useState(false);
  // Songs go through the app-wide song sheet, the one that also carries
  // "Add to playlist" — the same route `QuickPicksSection` takes.
  const { openSongOptions } = useSongActionSheets();

  const handleLongPress = useCallback(() => {
    if (entity.kind === 'song') {
      openSongOptions(entity.song);
      return;
    }
    if (!optionsMounted) {
      setOptionsMounted(true);
      requestAnimationFrame(() => sheetRef.current?.present());
      return;
    }
    sheetRef.current?.present();
  }, [entity, openSongOptions, optionsMounted, sheetRef]);

  return (
    <>
      <MediaTile
        cover={cover}
        title={title}
        subtitle={subtitle}
        size={size}
        radius={radius}
        onPress={onPress}
        onLongPress={handleLongPress}
      />
      {optionsMounted && entity.kind === 'album' && (
        <AlbumOptions ref={sheetRef} album={entity.album} hideGoToAlbum={false} />
      )}
      {optionsMounted && entity.kind === 'artist' && (
        <ArtistOptions ref={sheetRef} artist={entity.artist} hideGoToArtist={false} />
      )}
    </>
  );
}

export default memo(OptionsTile);
