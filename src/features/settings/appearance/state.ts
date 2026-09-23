import { createSelector, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { DEFAULT_LANGUAGE } from '@/features/settings/appearance/languages';
import type { ListDensity, RadiusPreset } from '@/constants/design';
import { DEFAULT_THEME, normalizeTheme } from '@/features/theme/presets';
import type { Theme } from '@/features/theme/theme';
import { applyThemeEdit, type ThemeEdit } from './themeStore';


/**
 * The collections that remember their own grid/list choice.
 *
 * Mirrors `LibraryCollectionType` in features/library/librarySort, kept here as
 * its own type so this slice doesn't reach up into a screen for it.
 */
type LibraryViewKey =
  | 'playlists'
  | 'albums'
  | 'artists'
  | 'tracks'
  | 'downloaded'
  | 'wants'
  | 'radio';

/**
 * What each collection shows before the user says otherwise.
 *
 * Artwork is the thing you scan an album or artist list for, so those are
 * grids. A track is a title — the art beside it is its album's, repeated once
 * per song on the record — so tracks and the mixed downloads list are rows,
 * where the title gets the width instead of a caption under a thumbnail.
 */
const LIBRARY_VIEW_DEFAULTS: Record<LibraryViewKey, boolean> = {
  playlists: true,
  albums: true,
  artists: true,
  tracks: false,
  downloaded: false,
  // A want is a title you are waiting on, and its row carries the status of
  // the thing you actually want to know — whether it is on its way. A grid
  // caption has no room for that, so this opens as rows.
  wants: false,
  // Stations have logos now, so a grid of them says something — but only for
  // the ones a directory had a logo for, and plenty have none. Rows first,
  // where a station that fell back to the radio mark still reads fine.
  radio: false,
};

export type PlayingBarAction = 'none' | 'skip' | 'favorite' | 'randomAlbum' | 'addToPlaylist' | 'cast';
export type ThemeMode = 'light' | 'dark' | 'system';
type AppLanguage = string;

interface AppearanceSettingsState {
  themeMode: ThemeMode;
  /**
   * How the app looks: palettes, accent, corners, density, cover tint, dock.
   *
   * These used to be settings of their own here. They are the theme's now, and
   * the setters below edit it in place.
   */
  theme: Theme;
  gridColumns: number;
  isGridView: boolean;
  /**
   * Per-collection overrides for {@link isGridView}.
   *
   * One flag used to drive every collection screen, so switching Tracks to a
   * list — which is what a list of 500 songs wants, since a three-up grid
   * truncates every title and shows the same artwork nine times — also flipped
   * Albums and Artists, where the grid is the right drawing. The kinds want
   * different answers, so they get to hold different ones.
   *
   * Absent keys fall back to `LIBRARY_VIEW_DEFAULTS` and then to `isGridView`,
   * which is what keeps this additive: a user upgrading with no overrides
   * stored sees the per-kind defaults, not a reset.
   */
  libraryViewModes: Partial<Record<LibraryViewKey, boolean>>;
  playingBarAction: PlayingBarAction;
  showQualityBadge: boolean;
  showSourceHeaders: boolean;
  language: AppLanguage;
  hapticsEnabled: boolean;
  /** When true, respect the system's reduce-motion setting; when false, always animate. */
  respectReducedMotion: boolean;
}

const initialState: AppearanceSettingsState = {
  themeMode: 'system',
  theme: DEFAULT_THEME,
  gridColumns: 3,
  isGridView: true,
  libraryViewModes: {},
  playingBarAction: 'skip',
  showQualityBadge: false,
  showSourceHeaders: true,
  language: DEFAULT_LANGUAGE,
  hapticsEnabled: true,
  respectReducedMotion: true,
};

const appearanceSlice = createSlice({
  name: 'settingsAppearance',
  initialState,
  reducers: {
    setThemeMode(state, action: PayloadAction<ThemeMode>) {
      state.themeMode = action.payload;
    },
    /** Change any part of the theme. */
    editTheme(state, action: PayloadAction<ThemeEdit>) {
      state.theme = applyThemeEdit(normalizeTheme(state.theme), action.payload);
    },
    /** Put the colours back to the default, leaving the accent and everything else. */
    resetPalettes(state) {
      state.theme = { ...normalizeTheme(state.theme), palettes: DEFAULT_THEME.palettes };
    },
    setThemeColor(state, action: PayloadAction<string>) {
      state.theme = applyThemeEdit(normalizeTheme(state.theme), { accent: action.payload });
    },
    setRadiusPreset(state, action: PayloadAction<RadiusPreset>) {
      state.theme = applyThemeEdit(normalizeTheme(state.theme), { shape: { radius: action.payload } });
    },
    setListDensity(state, action: PayloadAction<ListDensity>) {
      state.theme = applyThemeEdit(normalizeTheme(state.theme), { shape: { density: action.payload } });
    },
    setCoverAccentEnabled(state, action: PayloadAction<boolean>) {
      state.theme = applyThemeEdit(normalizeTheme(state.theme), { surface: { coverTint: action.payload } });
    },
    setGridColumns(state, action: PayloadAction<number>) {
      state.gridColumns = action.payload;
    },
    setIsGridView(state, action: PayloadAction<boolean>) {
      state.isGridView = action.payload;
    },
    setLibraryViewMode(
      state,
      action: PayloadAction<{ collection: LibraryViewKey; isGridView: boolean }>
    ) {
      state.libraryViewModes = {
        ...state.libraryViewModes,
        [action.payload.collection]: action.payload.isGridView,
      };
    },
    setPlayingBarAction(state, action: PayloadAction<PlayingBarAction>) {
      state.playingBarAction = action.payload;
    },
    setShowQualityBadge(state, action: PayloadAction<boolean>) {
      state.showQualityBadge = action.payload;
    },
    setShowSourceHeaders(state, action: PayloadAction<boolean>) {
      state.showSourceHeaders = action.payload;
    },
    setTranslucentDock(state, action: PayloadAction<boolean>) {
      state.theme = applyThemeEdit(normalizeTheme(state.theme), {
        components: { dock: action.payload ? 'translucent' : 'solid' },
      });
    },
    setLanguage(state, action: PayloadAction<AppLanguage>) {
      state.language = action.payload;
    },
    setHapticsEnabled(state, action: PayloadAction<boolean>) {
      state.hapticsEnabled = action.payload;
    },
    setRespectReducedMotion(state, action: PayloadAction<boolean>) {
      state.respectReducedMotion = action.payload;
    },
  },
});

export const {
  setThemeMode,
  editTheme,
  resetPalettes,
  setThemeColor,
  setRadiusPreset,
  setListDensity,
  setCoverAccentEnabled,
  setGridColumns,
  setIsGridView,
  setLibraryViewMode,
  setPlayingBarAction,
  setShowQualityBadge,
  setShowSourceHeaders,
  setTranslucentDock,
  setLanguage,
  setHapticsEnabled,
  setRespectReducedMotion,
} = appearanceSlice.actions;

export default appearanceSlice.reducer;

/* --- selectors ------------------------------------------------------------
 * Typed against a minimal duck-typed shape rather than the full `RootState`
 * so this module never imports `@/state/redux/store` — that import would
 * cycle back here, since store.ts must import this file's reducer.
 */
interface AppearanceRootState {
  settingsAppearance: AppearanceSettingsState;
}

export const selectThemeMode = (state: AppearanceRootState): ThemeMode =>
  state.settingsAppearance.themeMode;

const selectStoredTheme = (state: AppearanceRootState) => state.settingsAppearance.theme;

/**
 * The theme the app is drawn with.
 *
 * Memoised on the stored theme, so it is the same object until the theme
 * changes. It is completed from the default: one saved before a field existed
 * must not reach a style as `undefined`.
 */
export const selectActiveTheme = createSelector(
  [selectStoredTheme],
  (theme): Theme => (theme ? normalizeTheme(theme) : DEFAULT_THEME),
);

export const selectThemeColor = (state: AppearanceRootState): string =>
  selectActiveTheme(state).accent;

export const selectRadiusPreset = (state: AppearanceRootState): RadiusPreset =>
  selectActiveTheme(state).shape.radius;

export const selectListDensity = (state: AppearanceRootState): ListDensity =>
  selectActiveTheme(state).shape.density;

export const selectCoverAccentEnabled = (state: AppearanceRootState): boolean =>
  selectActiveTheme(state).surface.coverTint;

export const selectGridColumns = (state: AppearanceRootState): number =>
  state.settingsAppearance.gridColumns;

/**
 * Grid or list for one collection.
 *
 * Two tiers, most specific first: what the user chose for *this* collection,
 * then what the kind defaults to — the old global flag is used only when no
 * collection is named at all.
 */
export const selectLibraryViewMode =
  (collection: LibraryViewKey | null) =>
  (state: AppearanceRootState): boolean => {
    if (!collection) return state.settingsAppearance.isGridView;
    return (
      state.settingsAppearance.libraryViewModes?.[collection] ??
      LIBRARY_VIEW_DEFAULTS[collection]
    );
  };

export const selectPlayingBarAction = (state: AppearanceRootState) =>
  state.settingsAppearance.playingBarAction;

export const selectShowQualityBadge = (state: AppearanceRootState): boolean =>
  state.settingsAppearance.showQualityBadge;

export const selectShowSourceHeaders = (state: AppearanceRootState): boolean =>
  state.settingsAppearance.showSourceHeaders;

export const selectTranslucentDock = (state: AppearanceRootState): boolean =>
  selectActiveTheme(state).components.dock === 'translucent';

export const selectLanguage = (state: AppearanceRootState): AppLanguage =>
  state.settingsAppearance.language;

export const selectHapticsEnabled = (state: AppearanceRootState): boolean =>
  state.settingsAppearance.hapticsEnabled;

export const selectRespectReducedMotion = (state: AppearanceRootState): boolean =>
  state.settingsAppearance.respectReducedMotion;
