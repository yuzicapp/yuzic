import React, { useCallback, useEffect, useState } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';
import { Text } from '@/components/Text';
import type { TextStyle, ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { ShieldCheck, X } from 'lucide-react-native';

import { useTheme } from '@/features/theme/useTheme';
import { useIconSize } from '@/features/theme/useIconSize';
import { hitSlopFor, spacing, typography } from '@/constants/design';
import { useRadius } from '@/features/theme/useRadius';
import SettingsCard from '../../components/SettingsCard';
import SettingsCardHeader from '../../components/SettingsCardHeader';
import SettingsDivider from '../../components/SettingsDivider';
import Touchable from '@/components/Touchable';
import {
  hasClientCertificate,
  removeClientCertificate,
  saveClientCertificate,
} from '@/features/mtls/clientCertificateStore';
import { useClientCertificate } from '@/features/mtls/useClientCertificate';
import type { Server } from '@/providers/contracts/Server';

type Props = {
  server: Server;
};

/**
 * Import the certificate a server asks the client to present.
 *
 * The password is a decryption key rather than a credential, so it is asked
 * for at import and never again — the file is inert without it, and both go to
 * the keychain together.
 *
 * The engine validates: `setClientCertificate` rejects a blob it cannot
 * decrypt, which is what makes a wrong password reportable *here*, while the
 * person is still looking at the field they typed it into, rather than later
 * as "server unreachable".
 */
const ClientCertificateCard: React.FC<Props> = ({ server }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const icons = useIconSize();
  const rad = useRadius();
  const { reapply } = useClientCertificate();

  const [installed, setInstalled] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    hasClientCertificate(server.id).then(present => {
      if (!cancelled) setInstalled(present);
    });
    return () => {
      cancelled = true;
    };
  }, [server.id]);

  const onImport = useCallback(async () => {
    setError(null);
    setBusy(true);
    // The picker call is inside the `try`, not before it. It was outside, and
    // a rejection there — the module unavailable, no view controller to
    // present from — went nowhere at all: the sheet did not open and the
    // screen said nothing, which is the failure-reported-as-nothing shape
    // this codebase has spent a lot of effort removing elsewhere.
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        // A single loose filter. iOS turns each entry into a `UTType` and a
        // MIME type it cannot map is not a filter it can apply, so naming
        // `application/x-pkcs12` here narrows nothing and risks the whole
        // call. The real check is whether the file decrypts.
        type: '*/*',
        copyToCacheDirectory: true,
      });
      if (picked.canceled || !picked.assets?.[0]) return;

      const asset = picked.assets[0];
      const pkcs12Base64 = await new File(asset.uri).base64();
      await saveClientCertificate(server.id, { pkcs12Base64, password });

      // Applied immediately, because applying it is the only thing that says
      // whether it is usable. A card that accepted the file and reported
      // nothing would be back to failing at the first request.
      const result = await reapply();
      if (!result.ok) {
        await removeClientCertificate(server.id);
        setInstalled(false);
        setError(
          result.reason === 'unsupported'
            ? t('settings.server.clientCertificate.unsupported')
            : t('settings.server.clientCertificate.rejected')
        );
        return;
      }
      setInstalled(true);
      setPassword('');
    } catch {
      setError(t('settings.server.clientCertificate.readFailed'));
    } finally {
      setBusy(false);
    }
  }, [password, reapply, server.id, t]);

  const onRemove = useCallback(async () => {
    setBusy(true);
    try {
      await removeClientCertificate(server.id);
      setInstalled(false);
      setError(null);
      await reapply();
    } finally {
      setBusy(false);
    }
  }, [reapply, server.id]);

  // Android's half is not built — the engine method is absent there rather
  // than inert. A control that cannot work is worse than no control, so the
  // card is not offered rather than being shown disabled with an excuse.
  if (Platform.OS !== 'ios') return null;

  return (
    <SettingsCard>
      <SettingsCardHeader title={t('settings.server.clientCertificate.title')} />
      <Text style={[styles.description, { color: colors.subtext }]}>
        {t('settings.server.clientCertificate.description')}
      </Text>
      <SettingsDivider />

      {installed ? (
        <View style={styles.row}>
          <ShieldCheck size={icons.row} color={colors.text} />
          <Text style={[styles.installed, { color: colors.text }]} numberOfLines={1}>
            {t('settings.server.clientCertificate.installed')}
          </Text>
          <Touchable
            onPress={onRemove}
            disabled={busy}
            hitSlop={hitSlopFor(icons.row)}
            accessibilityLabel={t('settings.server.clientCertificate.remove')}
            accessibilityRole="button"
            testID="client-certificate-remove"
          >
            <X size={icons.row} color={colors.subtext} />
          </Touchable>
        </View>
      ) : (
        <View style={styles.form}>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder={t('settings.server.clientCertificate.passwordPlaceholder')}
            placeholderTextColor={colors.subtext}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            style={[
              styles.input,
              { color: colors.text, backgroundColor: colors.muted, borderRadius: rad.md },
            ]}
            testID="client-certificate-password"
          />
          <Touchable
            onPress={onImport}
            disabled={busy}
            style={[styles.button, { backgroundColor: colors.muted, borderRadius: rad.md }]}
            accessibilityLabel={t('settings.server.clientCertificate.choose')}
            accessibilityRole="button"
            testID="client-certificate-choose"
          >
            <Text style={[styles.buttonLabel, { color: colors.text }]}>
              {t('settings.server.clientCertificate.choose')}
            </Text>
          </Touchable>
        </View>
      )}

      {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}
    </SettingsCard>
  );
};

const styles = StyleSheet.create<{
  row: ViewStyle;
  installed: TextStyle;
  description: TextStyle;
  form: ViewStyle;
  input: TextStyle;
  button: ViewStyle;
  buttonLabel: TextStyle;
  error: TextStyle;
}>({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.page,
    paddingVertical: spacing.sm,
  },
  installed: { flex: 1, ...typography.body },
  description: {
    paddingHorizontal: spacing.page,
    paddingBottom: spacing.sm,
    ...typography.caption,
  },
  form: { padding: spacing.page, gap: spacing.sm },
  input: { paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, ...typography.body },
  button: { paddingVertical: spacing.sm, alignItems: 'center' },
  buttonLabel: { ...typography.button },
  error: { paddingHorizontal: spacing.page, paddingBottom: spacing.page, ...typography.caption },
});

export default ClientCertificateCard;
