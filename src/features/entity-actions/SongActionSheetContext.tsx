import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { BottomSheetModal } from '@gorhom/bottom-sheet';

import type { Song } from '@/domain/entities/Song';
import SongOptions from '@/components/options/SongOptions';
import PlaylistList from '@/components/PlaylistList';

interface SongActionSheetContextValue {
  openSongOptions: (song: Song) => void;
}

const SongActionSheetContext = createContext<SongActionSheetContextValue | null>(null);

export function SongActionSheetProvider({ children }: { children: ReactNode }) {
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [playlistSong, setPlaylistSong] = useState<Song | null>(null);
  const [pendingOptions, setPendingOptions] = useState(false);
  const optionsRef = useRef<BottomSheetModal>(null);
  const playlistRef = useRef<BottomSheetModal>(null);

  useEffect(() => {
    if (!selectedSong || !pendingOptions) return;
    setPendingOptions(false);
    requestAnimationFrame(() => optionsRef.current?.present());
  }, [pendingOptions, selectedSong]);

  const openSongOptions = useCallback((song: Song) => {
    setSelectedSong({ ...song });
    setPendingOptions(true);
  }, []);

  const openPlaylistList = useCallback(() => {
    optionsRef.current?.dismiss();
    if (!selectedSong) return;
    setPlaylistSong(selectedSong);
    requestAnimationFrame(() => playlistRef.current?.present());
  }, [selectedSong]);

  const closePlaylistList = useCallback(() => {
    playlistRef.current?.dismiss();
    setPlaylistSong(null);
  }, []);

  /*
   * Memoised because of where this sits. The provider is mounted app-wide and
   * holds three pieces of state, so opening a song's options re-renders it two
   * or three times — and a fresh value each time force-renders every consumer
   * past its own `React.memo`. The consumers are every song row in the app,
   * plus the whole Search screen model. Tapping "…" on one row was re-rendering
   * every row on every mounted tab.
   */
  const value = useMemo(() => ({ openSongOptions }), [openSongOptions]);

  return (
    <SongActionSheetContext.Provider value={value}>
      {children}
      {selectedSong && (
        <SongOptions
          ref={optionsRef}
          selectedSong={selectedSong}
          onAddToPlaylist={openPlaylistList}
        />
      )}
      {playlistSong && (
        <PlaylistList
          ref={playlistRef}
          selectedSong={playlistSong}
          onClose={closePlaylistList}
        />
      )}
    </SongActionSheetContext.Provider>
  );
}

export function useSongActionSheets() {
  const context = useContext(SongActionSheetContext);
  if (!context) {
    throw new Error('useSongActionSheets must be used within SongActionSheetProvider');
  }
  return context;
}
