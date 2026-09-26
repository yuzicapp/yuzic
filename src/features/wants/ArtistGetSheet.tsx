import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/Text';
import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { renderBackdrop } from '@/components/BottomSheetBackdrop';
import RadioMark from '@/components/options/RadioMark';
import {
  OptionSheetDivider,
  OptionSheetHeader,
  OptionSheetInfoRow,
  OptionSheetRow,
  OptionSheetSectionLabel,
  OptionSheetSwitchRow,
  optionSheetStyles,
  useOptionSheetBackground,
  useOptionSheetContentStyle,
} from '@/components/options/OptionSheetPrimitives';
import SpinningLoaderCircle from '@/components/SpinningLoaderCircle';
import Touchable from '@/components/Touchable';
import { iconSize, spacing, stateLayer, typography } from '@/constants/design';
import type { CoverSource } from '@/domain/entities/Cover';
import type { LocalId } from '@/domain/identity/LocalId';
import {
  useDownloadersForUnit,
  type ArtistMonitorPolicy,
  type QualityProfile,
} from '@/features/downloaders/registry';
import { useRadius } from '@/features/theme/useRadius';
import { useTheme } from '@/features/theme/useTheme';
import { useWantGet } from '@/features/wants/useWantGet';
import { selectActiveServer } from '@/state/redux/selectors/serversSelectors';

/**
 * Lidarr's own set, in the order someone who has used Lidarr expects — except
 * that `future` leads rather than `all`. It is what a Get meant before this
 * sheet existed and stays the default: following an artist should not, unasked,
 * become a request for everything they have ever released.
 */
const POLICIES: ArtistMonitorPolicy[] = ['future', 'all', 'missing', 'existing', 'first', 'latest', 'none'];

type Props = {
  artist: { localId: LocalId; name: string; mbid?: string; cover: CoverSource };
  sheetRef: React.RefObject<BottomSheetModal | null>;
  /** Run on confirm, before the request goes out — the artist screen saves the want here. */
  onConfirm?: () => void;
  onDismiss?: () => void;
};

/**
 * The review an artist Get goes through, as an album Get already does.
 *
 * An artist was the one acquisition in the app with no review at all: the tap
 * went straight to the downloader under a policy hard-coded in the integration,
 * which is exactly why it could never be asked to search. This sheet is what
 * makes searching safe to offer — the danger was never the search, it was a
 * search nobody agreed to.
 *
 * Monitor and Search are one decision in two halves, so they sit together.
 * Lidarr's `ArtistSearch` only looks for albums that are watched *and* missing,
 * so under `future` there is nothing to find yet; the hint says so rather than
 * leaving it to be discovered as an empty queue.
 */
export default function ArtistGetSheet({ artist, sheetRef, onConfirm, onDismiss }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const rad = useRadius();
  const activeServer = useSelector(selectActiveServer);
  const { getArtist } = useWantGet();

  const available = useDownloadersForUnit('artist').filter(d => d.isConnected);
  const [selectedId, setSelectedId] = useState(available[0]?.def.id ?? null);
  const selected = available.find(d => d.def.id === selectedId) ?? null;

  const [monitor, setMonitor] = useState<ArtistMonitorPolicy>('future');
  const [search, setSearch] = useState(true);

  const sheetBg = useOptionSheetBackground();
  const sheetContent = useOptionSheetContentStyle();

  // Offered only by a downloader that declares profiles, and fetched once one
  // is chosen — the same lazy shape the album review uses.
  const getQualityProfiles = selected?.def.getQualityProfiles;
  const [profiles, setProfiles] = useState<QualityProfile[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [qualityProfileId, setQualityProfileId] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!selected || !getQualityProfiles) {
      setProfiles([]);
      return;
    }
    let cancelled = false;
    setProfilesLoading(true);
    getQualityProfiles(selected.config)
      .then(result => { if (!cancelled) setProfiles(result); })
      .catch(() => { if (!cancelled) setProfiles([]); })
      .finally(() => { if (!cancelled) setProfilesLoading(false); });
    return () => { cancelled = true; };
  }, [selected, getQualityProfiles]);

  // A policy that watches nothing yet has nothing for a search to find. Said
  // here rather than left to be worked out from a queue that stays empty.
  const searchWillFindNothing = useMemo(
    () => search && (monitor === 'future' || monitor === 'none'),
    [search, monitor]
  );

  const handleConfirm = () => {
    // The review is over once confirmed, exactly as the album's is: the request
    // reports itself in the toasts and the sheet has no further part in it.
    sheetRef.current?.dismiss();
    onConfirm?.();
    void getArtist({
      localId: artist.localId,
      name: artist.name,
      mbid: artist.mbid,
      monitor,
      search,
      qualityProfileId,
    });
  };

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
        <OptionSheetHeader cover={artist.cover} title={artist.name} subtitle={t('wants.artistLabel')} />

        <OptionSheetDivider />

        <OptionSheetInfoRow
          label={t('externalAlbum.review.targetServer')}
          value={activeServer?.serverUrl ?? t('externalAlbum.review.noServer')}
        />

        <OptionSheetDivider />

        <OptionSheetSectionLabel label={t('externalAlbum.download.chooseService')} />
        {available.map(downloader => (
          <OptionSheetRow
            key={downloader.def.id}
            testID={`artist-get-service-${downloader.def.id}`}
            label={downloader.def.label}
            description={t(downloader.def.descriptionKey)}
            onPress={() => setSelectedId(downloader.def.id)}
            labelColor={selectedId === downloader.def.id ? colors.secondary : undefined}
            trailing={<RadioMark selected={selectedId === downloader.def.id} />}
          />
        ))}

        {getQualityProfiles && (
          <>
            <OptionSheetSectionLabel spaced label={t('externalAlbum.review.qualityProfile')} />
            {profilesLoading ? (
              <View style={styles.loading}>
                <SpinningLoaderCircle size={iconSize.row} color={colors.themeColor} />
              </View>
            ) : (
              profiles.map(profile => (
                <OptionSheetRow
                  key={profile.id}
                  label={profile.name}
                  onPress={() => setQualityProfileId(profile.id)}
                  labelColor={qualityProfileId === profile.id ? colors.secondary : undefined}
                  trailing={<RadioMark selected={qualityProfileId === profile.id} />}
                />
              ))
            )}
          </>
        )}

        <OptionSheetSectionLabel spaced label={t('wants.getSheet.monitor')} />
        {POLICIES.map(policy => (
          <OptionSheetRow
            key={policy}
            testID={`artist-get-monitor-${policy}`}
            label={t(`wants.getSheet.policy.${policy}`)}
            onPress={() => setMonitor(policy)}
            labelColor={monitor === policy ? colors.secondary : undefined}
            trailing={<RadioMark selected={monitor === policy} />}
          />
        ))}

        <OptionSheetDivider />

        <OptionSheetSwitchRow
          testID="artist-get-search"
          label={t('wants.getSheet.searchNow')}
          description={t('wants.getSheet.searchNowHint')}
          value={search}
          onValueChange={setSearch}
        />

        {searchWillFindNothing && (
          <Text style={[styles.hint, { color: colors.subtext }]}>
            {t('wants.getSheet.nothingToSearch')}
          </Text>
        )}

        <Touchable
          testID="artist-get-confirm"
          style={[
            styles.confirm,
            { backgroundColor: colors.secondary, borderRadius: rad.card },
            !selected && styles.confirmDisabled,
          ]}
          onPress={handleConfirm}
          disabled={!selected}
        >
          <Text style={[styles.confirmLabel, { color: colors.background }]}>
            {t('wants.getSheet.confirm')}
          </Text>
        </Touchable>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  loading: {
    paddingVertical: spacing.roomy,
    alignItems: 'center',
  },
  hint: {
    ...typography.caption,
    marginTop: spacing.sm,
  },
  confirm: {
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmDisabled: {
    opacity: stateLayer.mutedOpacity,
  },
  confirmLabel: {
    ...typography.rowTitle,
    fontWeight: '600',
  },
});
