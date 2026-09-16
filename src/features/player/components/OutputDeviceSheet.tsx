import React, { forwardRef, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
} from 'react-native';
import { FormSheet, FormSheetField } from '@/components/FormSheet';
import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { Airplay, Cast, Check, Plus, RotateCcw, Server, Smartphone } from 'lucide-react-native';
import IconActionButton from '@/components/IconActionButton';
import SpinningLoaderCircle from '@/components/SpinningLoaderCircle';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { notify } from '@/components/toast';
import { useTheme } from '@/features/theme/useTheme';
import { renderBackdrop } from '@/components/BottomSheetBackdrop';
import {
  optionSheetStyles,
  useOptionSheetBackground,
  useOptionSheetContentStyle,
} from '@/components/options/OptionSheetPrimitives';
import { selectThemeColor } from '@/features/settings/appearance/state';
import { useDlnaDiscovery, type DiscoveredDevice } from '@/features/player/useDlnaDiscovery';
import { usePlaybackSink } from '@/features/player/PlaybackSinkContext';
import { useJukeboxAvailability } from '@/features/player/useJukeboxAvailability';
import { selectActiveServer } from '@/state/redux/selectors/serversSelectors';
import { getServerProvider } from '@/providers/registry/serverConnections';
import Touchable from '@/components/Touchable';
import { iconSize, spacing, typography } from '@/constants/design';
import { useRadius } from '@/features/theme/useRadius';
import { withAlpha } from '@/features/theme/coverAccent';

const {
  AirplayButton,
  useAirplayRoutes,
// eslint-disable-next-line @typescript-eslint/no-require-imports
} = Platform.OS === 'ios' ? require('react-airplay') : { AirplayButton: null, useAirplayRoutes: () => [] };

const OutputDeviceSheet = forwardRef<BottomSheetModal>((_, ref) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const rad = useRadius();
  const themeColor = useSelector(selectThemeColor);
  const sheetBg = useOptionSheetBackground();
  const sheetContent = useOptionSheetContentStyle();
  const { devices, isScanning, isProbing, scan, probeManual } = useDlnaDiscovery();
  const { sink, isSwitching, selectLocal, selectDlna, selectJukebox } = usePlaybackSink();
  const airplayRoutes = useAirplayRoutes();
  const airplayDevice = airplayRoutes[0] ?? null;

  // AirPlay is routed by iOS underneath us rather than being a sink we pick,
  // so it is the one row whose selected-ness the sink doesn't know about.
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const activeServer = useSelector(selectActiveServer);
  const jukeboxAvailable = useJukeboxAvailability(isSheetOpen);
  const serverName = activeServer
    ? getServerProvider(activeServer.type).label
    : '';
  const isLocal = sink.kind === 'local' && !airplayDevice;
  const activeDlna = sink.kind === 'dlna' ? sink : null;

  const handleOpen = useCallback(() => { setIsSheetOpen(true); scan(); }, [scan]);

  const [connectingDlnaUdn, setConnectingDlnaUdn] = useState<string | null>(null);

  const handleConnectDlna = useCallback(async (device: DiscoveredDevice) => {
    setConnectingDlnaUdn(device.udn);
    try {
      await selectDlna(device);
      (ref as React.RefObject<BottomSheetModal>).current?.dismiss();
    } catch {
      notify.error(t('playing.output.connectFailed'));
    } finally {
      setConnectingDlnaUdn(null);
    }
  }, [selectDlna, ref, t]);

  const handleSelectJukebox = useCallback(async () => {
    try {
      await selectJukebox(serverName);
      (ref as React.RefObject<BottomSheetModal>).current?.dismiss();
    } catch {
      notify.error(t('playing.output.jukeboxFailed'));
    }
  }, [selectJukebox, serverName, ref, t]);

  // A sheet rather than `Alert.prompt`, which exists only on iOS — on Android
  // the row did nothing.
  const [isAddingManually, setIsAddingManually] = useState(false);
  const handleManualEntry = useCallback(() => setIsAddingManually(true), []);

  return (
    <>
    {isAddingManually && (
      <ManualDeviceSheet probe={probeManual} onClose={() => setIsAddingManually(false)} />
    )}
    <BottomSheetModal
      ref={ref}
      snapPoints={['55%', '80%']}
      enableDynamicSizing={false}
      enablePanDownToClose
      stackBehavior="push"
      backdropComponent={renderBackdrop}
      backgroundStyle={[optionSheetStyles.sheetBackground, sheetBg]}
      handleIndicatorStyle={{ backgroundColor: colors.border }}
      onChange={(index) => { if (index >= 0) handleOpen(); else setIsSheetOpen(false); }}
    >
      {/* Scrolls rather than sizing to its content: the list grows as the scan
          finds devices, and a house with a dozen of them used to run off the
          bottom of a sheet that had no way to move. */}
      <BottomSheetScrollView style={sheetBg} contentContainerStyle={sheetContent}>

        {/* Title */}
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.secondary }]}>{t('playing.output.title')}</Text>
          <IconActionButton
            icon={<RotateCcw size={iconSize.inline} color={colors.subtext} />}
            onPress={scan}
            loading={isScanning}
            accessibilityLabel={t('a11y.scanForDevices')}
            size="compact"
          />
        </View>

        {/* This device — selected when no sink has taken the audio elsewhere */}
        <Touchable
          style={[styles.item, { backgroundColor: isLocal ? withAlpha(themeColor, 0.13) : 'transparent', borderRadius: rad.md }]}
          onPress={async () => {
            await selectLocal();
            (ref as React.RefObject<BottomSheetModal>).current?.dismiss();
          }}
        >
          <View style={styles.itemLeft}>
            <Smartphone size={iconSize.row} color={isLocal ? themeColor : colors.subtext} />
            <Text style={[styles.itemLabel, { color: colors.secondary }]}>{t('playing.output.thisDevice')}</Text>
          </View>
          {isLocal && <Check size={iconSize.row} color={themeColor} />}
        </Touchable>

        {/* The server's own speakers. Sits with "This device" rather than under
            DLNA because it is a known destination, not something discovered on
            the network — and it is absent entirely unless this user is allowed
            to drive it. */}
        {jukeboxAvailable && (
          <Touchable
            testID="output-jukebox"
            style={[styles.item, { backgroundColor: sink.kind === 'jukebox' ? withAlpha(themeColor, 0.13) : 'transparent', borderRadius: rad.md }]}
            onPress={handleSelectJukebox}
            disabled={isSwitching}
          >
            <View style={styles.itemLeft}>
              <Server size={iconSize.row} color={sink.kind === 'jukebox' ? themeColor : colors.subtext} />
              <Text style={[styles.itemLabel, { color: colors.secondary }]}>
                {t('playing.output.playOnServer', { server: serverName })}
              </Text>
            </View>
            {sink.kind === 'jukebox' && <Check size={iconSize.row} color={themeColor} />}
          </Touchable>
        )}

        {/* AirPlay — iOS only */}
        {Platform.OS === 'ios' && AirplayButton && (
          <View style={[styles.item, { backgroundColor: airplayDevice ? withAlpha(themeColor, 0.13) : 'transparent', borderRadius: rad.md }]}>
            <View style={styles.itemLeft}>
              <Airplay size={iconSize.row} color={airplayDevice ? themeColor : colors.subtext} />
              <Text style={[
                styles.itemLabel,
                { color: colors.secondary, fontWeight: airplayDevice ? '600' : '400' },
              ]}
              >
                {airplayDevice ? airplayDevice.portName : t('playing.output.airplay')}
              </Text>
            </View>
            {airplayDevice && <Check size={iconSize.row} color={themeColor} />}
            <AirplayButton
              style={StyleSheet.absoluteFillObject}
              tintColor="transparent"
              activeTintColor="transparent"
            />
          </View>
        )}

        {/* ── DLNA ── */}
        {(devices.length > 0 || activeDlna || isScanning) && (
          <>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <Text style={[styles.sectionLabel, { color: colors.subtext }]}>{t('playing.output.dlnaSection')}</Text>
          </>
        )}

        {/* Active DLNA device */}
        {activeDlna && (
          <Touchable
            style={[styles.item, { backgroundColor: withAlpha(themeColor, 0.13), borderRadius: rad.md }]}
            onPress={selectLocal}
          >
            <View style={styles.itemLeft}>
              <Cast size={iconSize.row} color={themeColor} />
              <Text style={[styles.itemLabel, { color: colors.secondary, fontWeight: '600' }]}>
                {activeDlna.name}
              </Text>
            </View>
            <Check size={iconSize.row} color={themeColor} />
          </Touchable>
        )}

        {/* Discovered DLNA devices */}
        {devices.map(device => {
          if (activeDlna?.id === device.udn) return null;
          return (
            <Touchable
              key={device.udn}
              style={[styles.item, { backgroundColor: 'transparent', borderRadius: rad.md }]}
              onPress={() => handleConnectDlna(device)}
              disabled={isSwitching}
            >
              <View style={styles.itemLeft}>
                <Cast size={iconSize.row} color={colors.subtext} />
                <Text style={[styles.itemLabel, { color: colors.secondary }]}>{device.name}</Text>
              </View>
              {connectingDlnaUdn === device.udn && <SpinningLoaderCircle size={iconSize.row} color={colors.subtext} />}
            </Touchable>
          );
        })}

        {/* Scanning / empty state */}
        {isScanning && devices.length === 0 && !activeDlna && (
          <View style={styles.searchingRow}>
            <SpinningLoaderCircle size={iconSize.inline} color={colors.subtext} />
            <Text style={[styles.empty, { color: colors.subtext, paddingVertical: 0 }]}>
              {t('playing.output.searching')}
            </Text>
          </View>
        )}
        {!isScanning && devices.length === 0 && !activeDlna && (
          <Text style={[styles.empty, { color: colors.subtext }]}>
            {t('playing.output.noneFound')}
          </Text>
        )}

        {/* Manual DLNA entry */}
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <Touchable
          style={[styles.item, { backgroundColor: 'transparent', borderRadius: rad.md }]}
          onPress={handleManualEntry}
          disabled={isProbing}
        >
          <View style={styles.itemLeft}>
            {isProbing
              ? <SpinningLoaderCircle size={iconSize.row} color={colors.subtext} />
              : <Plus size={iconSize.row} color={colors.subtext} />
            }
            <Text style={[styles.itemLabel, { color: colors.subtext }]}>{t('playing.output.addManually')}</Text>
          </View>
        </Touchable>

      </BottomSheetScrollView>
    </BottomSheetModal>
    </>
  );
});

OutputDeviceSheet.displayName = 'OutputDeviceSheet';
export default OutputDeviceSheet;

function ManualDeviceSheet({ probe, onClose }: {
  probe: (address: string) => Promise<DiscoveredDevice | null>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [address, setAddress] = useState('');

  return (
    <FormSheet
      title={t('playing.output.addManuallyTitle')}
      description={t('playing.output.addManuallyBody')}
      submitLabel={t('playing.output.addManuallySubmit')}
      canSubmit={address.trim().length > 0}
      onSubmit={async () => {
        const device = await probe(address.trim());
        if (!device) notify.error(t('playing.output.notFoundAtAddress'));
        return !!device;
      }}
      onClose={onClose}
    >
      <FormSheetField
        label={t('playing.output.addManuallyField')}
        value={address}
        onChangeText={setAddress}
        placeholder="192.168.1.20"
        keyboardType="decimal-pad"
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
      />
    </FormSheet>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.controlGap,
  },
  title: {
    ...typography.sheetTitle,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: spacing.xs,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.controlGap,
  },
  itemLabel: {
    ...typography.body,
  },
  empty: {
    ...typography.rowSubtitle,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  sectionLabel: {
    ...typography.caption,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.tight,
  },
  searchingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
});
