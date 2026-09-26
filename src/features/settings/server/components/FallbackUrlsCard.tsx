import { hitSlopFor, spacing, statusColor, typography } from '@/constants/design';
import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { Text } from '@/components/Text';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Plus, X } from 'lucide-react-native';

import { useTheme } from '@/features/theme/useTheme';
import { useIconSize } from '@/features/theme/useIconSize';
import { updateServer } from '@/state/redux/slices/serversSlice';
import { forgetReachable } from '@/providers/http/urlFailover';
import { useRadius } from '@/features/theme/useRadius';
import SettingsCard from '../../components/SettingsCard';
import SettingsCardHeader from '../../components/SettingsCardHeader';
import Touchable from '@/components/Touchable';
import SettingsDivider from '../../components/SettingsDivider';
import type { Server } from '@/providers/contracts/Server';

type Props = {
  server: Server;
};

const FallbackUrlsCard: React.FC<Props> = ({ server }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const icons = useIconSize();
  const rad = useRadius();
  const dispatch = useDispatch();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const urls = useMemo(() => server.fallbackUrls ?? [], [server.fallbackUrls]);

  const validateNewUrl = useCallback((raw: string): string | null => {
    const trimmed = raw.trim().replace(/\/+$/, '');
    if (!trimmed) return t('settings.server.fallbackUrls.emptyError');
    if (!/^https?:\/\/[^\s]+$/i.test(trimmed)) {
      return t('settings.server.fallbackUrls.invalidError');
    }
    const primary = server.serverUrl.trim().replace(/\/+$/, '').toLowerCase();
    if (trimmed.toLowerCase() === primary) {
      return t('settings.server.fallbackUrls.duplicatePrimaryError');
    }
    if (urls.some(u => u.trim().replace(/\/+$/, '').toLowerCase() === trimmed.toLowerCase())) {
      return t('settings.server.fallbackUrls.duplicateError');
    }
    return null;
  }, [server.serverUrl, urls, t]);

  const handleAdd = useCallback(() => {
    const err = validateNewUrl(draft);
    if (err) { setError(err); return; }
    const next = [...urls, draft.trim().replace(/\/+$/, '')];
    dispatch(updateServer({ id: server.id, patch: { fallbackUrls: next } }));
    forgetReachable(server.id);
    setDraft('');
    setError(null);
  }, [dispatch, draft, server.id, urls, validateNewUrl]);

  const handleRemove = useCallback((index: number) => {
    const next = urls.filter((_, i) => i !== index);
    dispatch(updateServer({
      id: server.id,
      patch: { fallbackUrls: next.length ? next : undefined },
    }));
    forgetReachable(server.id);
  }, [dispatch, server.id, urls]);

  return (
    <>
      <SettingsCardHeader subtle title={t('settings.server.fallbackUrls.title')} />
      <SettingsCard>
        <Text style={[styles.subtext, { color: colors.subtext }]}>
          {t('settings.server.fallbackUrls.subtext')}
        </Text>
        {urls.length > 0 && <SettingsDivider />}
        {urls.map((url, index) => (
          <React.Fragment key={`${url}-${index}`}>
            <View style={styles.urlRow}>
              <Text
                style={[styles.urlText, { color: colors.secondary }]}
                numberOfLines={1}
                ellipsizeMode="middle"
              >
                {url}
              </Text>
              <Touchable
                accessibilityRole="button"
                accessibilityLabel={t('settings.server.fallbackUrls.removeAria', { url })}
                onPress={() => handleRemove(index)}
                hitSlop={hitSlopFor(icons.row)}
              >
                <X size={icons.row} color={colors.subtext} />
              </Touchable>
            </View>
            {index < urls.length - 1 && <SettingsDivider />}
          </React.Fragment>
        ))}
        <SettingsDivider />
        <View style={styles.addRow}>
          <TextInput
            value={draft}
            onChangeText={(v) => { setDraft(v); if (error) setError(null); }}
            placeholder={t('settings.server.fallbackUrls.placeholder')}
            placeholderTextColor={colors.placeholder}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="done"
            onSubmitEditing={handleAdd}
            style={[
              styles.addInput,
              { borderColor: colors.border, backgroundColor: colors.muted, color: colors.text, borderRadius: rad.md },
            ]}
          />
          <Touchable
            accessibilityRole="button"
            accessibilityLabel={t('settings.server.fallbackUrls.addAria')}
            onPress={handleAdd}
            style={[styles.addButton, { backgroundColor: colors.muted, borderRadius: rad.md }]}
          >
            <Plus size={icons.row} color={colors.secondary} />
          </Touchable>
        </View>
        {error && (
          <Text style={[styles.error, { color: statusColor.errorText }]}>{error}</Text>
        )}
      </SettingsCard>
    </>
  );
};

export default FallbackUrlsCard;

const styles = StyleSheet.create({
  subtext: {
    ...typography.caption,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.tight,
  },
  urlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  urlText: {
    ...typography.body,
    flex: 1,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.controlGap,
  },
  addInput: {
    ...typography.body,
    flex: 1,
    borderWidth: 1,
    paddingVertical: spacing.controlGap,
    paddingHorizontal: spacing.md,
  },
  addButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    ...typography.caption,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
});
