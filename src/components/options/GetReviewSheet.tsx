import { spacing, stateLayer, typography } from '@/constants/design';
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/Text';
import {
  BottomSheetModal,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import { useSelector, useDispatch } from 'react-redux';

import SpinningLoaderCircle from '@/components/SpinningLoaderCircle';
import { renderBackdrop } from '@/components/BottomSheetBackdrop';
import { useTheme } from '@/features/theme/useTheme';
import { useIconSize } from '@/features/theme/useIconSize';
import { useRadius } from '@/features/theme/useRadius';
import { useTranslation } from 'react-i18next';
import {
  useDownloaderStates,
  type DownloaderId,
  type DownloaderState,
  type QualityProfile,
} from '@/features/downloaders/registry';
import { useAlbumTrackLoader } from '@/features/downloaders/albumTracks';
import { runGet } from '@/features/downloaders/runGet';
import { setDefaultProvider, setDefaultQualityProfileId } from '@/state/redux/slices/downloadersSlice';
import {
  selectDefaultProviderForActiveServer,
  selectDefaultQualityProfileId,
} from '@/state/redux/selectors/downloadersSelectors';
import { selectActiveServer, selectActiveServerId } from '@/state/redux/selectors/serversSelectors';
import { selectIsWanted } from '@/state/redux/selectors/wantsSelectors';
import { setWantJobRef } from '@/state/redux/slices/wantsSlice';
import type { Album } from '@/domain/entities/Album';
import {
  OptionSheetDivider,
  OptionSheetHeader,
  OptionSheetInfoRow,
  OptionSheetRow,
  OptionSheetSectionLabel,
  optionSheetStyles,
  useOptionSheetBackground,
  useOptionSheetContentStyle,
} from './OptionSheetPrimitives';
import RadioMark from './RadioMark';
import Touchable from '@/components/Touchable';

interface Props {
  album: Album;
  /** When set, the sheet requests this single track instead of the whole album. */
  track?: { title: string; artist: string };
  /**
   * The want this Get belongs to, when the sheet was opened from one.
   *
   * Normally the sheet infers it — an album Get wires its job back to a want
   * for that album. A track Get had no way to say which want it was for, so a
   * track want's row could never show its job; naming it here is that way.
   */
  wantLocalId?: Album['localId'];
  /** Told when the sheet closes, so a caller that mounted it on demand can
   *  unmount it again rather than leaving it in the tree. */
  onDismiss?: () => void;
  sheetRef: React.RefObject<BottomSheetModal | null>;
}

/**
 * The compact acquisition review. Get always opens this, even when a saved
 * default provider exists for the unit — the confirm tap is what starts a
 * job, never a hidden default. Any provider choice made here is a
 * request-only override unless the user explicitly flips "save as default".
 */
const GetReviewSheet: React.FC<Props> = ({ album, track, wantLocalId, onDismiss, sheetRef }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const icons = useIconSize();
  const rad = useRadius();
  const dispatch = useDispatch();

  const unit: 'album' | 'track' = track ? 'track' : 'album';
  const localId = wantLocalId ?? (track ? undefined : album.localId);
  const isWanted = useSelector(localId ? selectIsWanted(localId) : () => false);
  const activeServer = useSelector(selectActiveServer);
  const activeServerId = useSelector(selectActiveServerId);
  const savedDefaults = useSelector(selectDefaultProviderForActiveServer);
  const savedDefaultId = unit === 'album' ? savedDefaults.defaultAlbumProvider : savedDefaults.defaultTrackProvider;
  const savedDefaultQualityProfileId = useSelector(selectDefaultQualityProfileId);

  const downloaders = useDownloaderStates();
  const loadAlbumTracks = useAlbumTrackLoader();
  // A downloader appears only if it can take the unit being asked for. Lidarr
  // has no way to fetch one track; a track-only downloader (SoulSync) takes an
  // album as its tracks, so every connected downloader can take an album.
  const available = downloaders.filter(
    (d) => d.isConnected && !!(track ? d.def.downloadTrack : d.def.downloadAlbum || d.def.downloadTrack)
  );

  // Preselect the saved default only if it's still available for this unit;
  // otherwise leave it unselected — "ask each time".
  const initialSelection = useMemo(
    () => (savedDefaultId && available.some((d) => d.def.id === savedDefaultId) ? savedDefaultId : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recompute only when the sheet's inputs change, not on every downloader-state tick
    [savedDefaultId, available.map((d) => d.def.id).join(',')]
  );
  const [selectedId, setSelectedId] = useState<DownloaderId | null>(initialSelection);
  // Keep the selection in step with the sheet's target unit/default when it
  // changes underneath an already-mounted sheet (e.g. reused across rows).
  const [lastInitialSelection, setLastInitialSelection] = useState(initialSelection);
  if (initialSelection !== lastInitialSelection) {
    setLastInitialSelection(initialSelection);
    setSelectedId(initialSelection);
  }

  const [saveAsDefault, setSaveAsDefault] = useState(false);

  const sheetBg = useOptionSheetBackground();
  const sheetContent = useOptionSheetContentStyle();

  const selected = available.find((d) => d.def.id === selectedId) ?? null;

  // A quality profile is offered only for an album Get, and only by a
  // downloader that declares profiles. Fetched lazily once that downloader is
  // chosen and pre-filled from the saved default; changing it here is
  // request-only unless "save as default" is checked.
  const showQualityProfile = unit === 'album' && !!selected?.def.getQualityProfiles;
  const [qualityProfiles, setQualityProfiles] = useState<QualityProfile[]>([]);
  const [qualityProfilesLoading, setQualityProfilesLoading] = useState(false);
  const [selectedQualityProfileId, setSelectedQualityProfileId] = useState<number | undefined>(
    savedDefaultQualityProfileId
  );

  useEffect(() => {
    const getQualityProfiles = selected?.def.getQualityProfiles;
    if (!showQualityProfile || !selected || !getQualityProfiles) {
      return;
    }
    setSelectedQualityProfileId(savedDefaultQualityProfileId);
    let cancelled = false;
    setQualityProfilesLoading(true);
    getQualityProfiles(selected.config)
      .then((profiles) => {
        if (!cancelled) setQualityProfiles(profiles);
      })
      .catch(() => {
        if (!cancelled) setQualityProfiles([]);
      })
      .finally(() => {
        if (!cancelled) setQualityProfilesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [showQualityProfile, selected, savedDefaultQualityProfileId]);

  const handleGet = (downloader: DownloaderState) => {
    // The review is over the moment it is confirmed. Everything after this
    // point reports through the toasts, so the sheet has no reason to stay on
    // screen for it — and every reason not to, since a track-only downloader
    // sends an album one track at a time.
    sheetRef.current?.dismiss();

    // Persist the chosen provider as the unit default only when the user
    // explicitly asked for that — a request-only override never writes here.
    if (saveAsDefault) {
      dispatch(setDefaultProvider({ serverId: activeServerId ?? '', unit, provider: downloader.def.id }));
      // The quality profile follows the same explicit toggle — a
      // bumped-for-this-Get profile only becomes the new default when the
      // user asked to keep it, same as the provider itself.
      if (showQualityProfile && activeServerId) {
        dispatch(setDefaultQualityProfileId({ serverId: activeServerId, qualityProfileId: selectedQualityProfileId }));
      }
    }

    void runGet({
      downloader,
      album,
      track,
      qualityProfileId: showQualityProfile ? selectedQualityProfileId : undefined,
      loadTracks: loadAlbumTracks,
      t,
    }).then(started => {
      // Wire the started job back to the want, if this entity is wanted — Get
      // never requires a Want, so this is a no-op otherwise.
      if (started && localId && isWanted && activeServerId) {
        dispatch(setWantJobRef({
          serverId: activeServerId,
          localId,
          jobRef: { downloader: downloader.def.id, requestedAt: Date.now() },
        }));
      }
    });
  };

  const headerTitle = track ? track.title : album.title;
  const headerSubtext = track ? track.artist : album.artist.name;
  const requestingQuery = track
    ? `${track.title} — ${track.artist}`
    : `${album.title} — ${album.artist.name}${album.externalIds?.mbid ? ` (mbid: ${album.externalIds.mbid})` : ''}`;

  return (
    <BottomSheetModal
      ref={sheetRef}
      enableDynamicSizing
      backdropComponent={renderBackdrop}
      stackBehavior="push"
      handleIndicatorStyle={{ backgroundColor: colors.border }}
      backgroundStyle={[optionSheetStyles.sheetBackground, sheetBg]}
      onDismiss={onDismiss}
    >
      <BottomSheetScrollView style={sheetBg} contentContainerStyle={sheetContent}>
        <OptionSheetHeader cover={album.cover} title={headerTitle} subtitle={headerSubtext} />

        <OptionSheetDivider />

        <OptionSheetInfoRow
          label={t('externalAlbum.review.targetServer')}
          value={activeServer?.serverUrl ?? t('externalAlbum.review.noServer')}
        />

        <OptionSheetDivider />

        <OptionSheetSectionLabel label={t('externalAlbum.download.chooseService')} />

        {available.map((downloader) => {
          const isSelected = selectedId === downloader.def.id;
          return (
            <OptionSheetRow
              key={downloader.def.id}
              label={downloader.def.label}
              description={t(downloader.def.descriptionKey)}
              onPress={() => setSelectedId(downloader.def.id)}
              labelColor={isSelected ? colors.secondary : undefined}
              trailing={<RadioMark selected={isSelected} />}
            />
          );
        })}

        {/*
         * Quality-profile override slot — request-only unless "save as
         * default" is checked below. Only rendered for an album Get with a
         * downloader that declares quality profiles.
         */}
        {showQualityProfile && (
          <>
            <OptionSheetSectionLabel label={t('externalAlbum.review.qualityProfile')} />
            {qualityProfilesLoading ? (
              <View style={styles.qualityLoading}>
                <SpinningLoaderCircle size={icons.row} color={colors.themeColor} />
              </View>
            ) : (
              qualityProfiles.map((profile) => {
                const isProfileSelected = selectedQualityProfileId === profile.id;
                return (
                  <OptionSheetRow
                    key={profile.id}
                    label={profile.name}
                    onPress={() => setSelectedQualityProfileId(profile.id)}
                    labelColor={isProfileSelected ? colors.secondary : undefined}
                    trailing={<RadioMark selected={isProfileSelected} />}
                  />
                );
              })
            )}
          </>
        )}

        <OptionSheetDivider />

        <View style={styles.requestingRow}>
          <Text style={[styles.requestingLabel, { color: colors.subtext }]}>
            {t('externalAlbum.review.requesting')}
          </Text>
          <Text style={[styles.requestingValue, { color: colors.secondary }]} numberOfLines={2}>
            {requestingQuery}
          </Text>
        </View>

        {selected && (
          <Touchable
            style={styles.saveDefaultRow}
            onPress={() => setSaveAsDefault((v) => !v)}
          >
            <View
              style={[
                styles.checkbox,
                { borderColor: colors.border, borderRadius: rad.card },
                saveAsDefault && { backgroundColor: colors.secondary, borderColor: colors.secondary },
              ]}
            />
            <Text style={[styles.saveDefaultLabel, { color: colors.subtext }]}>
              {unit === 'album'
                ? t('externalAlbum.review.saveAsDefaultAlbums')
                : t('externalAlbum.review.saveAsDefaultTracks')}
            </Text>
          </Touchable>
        )}

        <Touchable
          style={[
            styles.getButton,
            { backgroundColor: colors.secondary, borderRadius: rad.card },
            !selected && styles.getButtonDisabled,
          ]}
          onPress={() => selected && handleGet(selected)}
          disabled={!selected}
        >
          <Text style={[styles.getButtonLabel, { color: colors.background }]}>
            {t('externalAlbum.review.confirmGet')}
          </Text>
        </Touchable>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
};

export default GetReviewSheet;

const styles = StyleSheet.create({
  qualityLoading: {
    paddingVertical: spacing.roomy,
    alignItems: 'center',
  },
  requestingRow: {
    marginTop: spacing.sm,
  },
  requestingLabel: {
    ...typography.caption,
    fontWeight: '500',
    marginBottom: spacing.xxs,
  },
  requestingValue: {
    ...typography.rowSubtitle,
  },
  saveDefaultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderWidth: 2,
    marginRight: spacing.md,
  },
  saveDefaultLabel: {
    ...typography.rowSubtitle,
  },
  getButton: {
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  getButtonDisabled: {
    opacity: stateLayer.mutedOpacity,
  },
  getButtonLabel: {
    ...typography.rowTitle,
    fontWeight: '600',
  },
});
