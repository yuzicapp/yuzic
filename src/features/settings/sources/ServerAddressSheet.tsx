import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import { FormSheet, FormSheetField } from '@/components/FormSheet';
import { spacing, statusColor, typography } from '@/constants/design';
import { checkServerAddress } from '@/providers/registry/serverAddress';
import type { SourceId } from '@/providers/registry/sources';
import { selectSourceServerUrls, setSourceServerUrl } from './state';

type Props = {
  source: SourceId;
  onClose: () => void;
};

/**
 * Asks for the address of a server of your own, for a source that can use one.
 *
 * The root address is what is asked for (`http://host:5000`), the same shape
 * the Connections screens take, and an empty one goes back to the public
 * server. An address is checked before it is kept: it has to look like a web
 * address and the server has to answer, and when it does not the sheet stays
 * open with what was typed, saying which. Saving only stores it: nothing is
 * sent to the address until a use of the source is on, and the source's own
 * switches still say what is asked.
 */
export default function ServerAddressSheet({ source, onClose }: Props) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const current = useSelector(selectSourceServerUrls)[source] ?? '';
  const [draft, setDraft] = useState(current);
  const [problem, setProblem] = useState<'invalid' | 'unreachable' | null>(null);

  return (
    <FormSheet
      title={t('settings.sources.serverAddress.title')}
      description={t('settings.sources.serverAddress.description')}
      submitLabel={t('common.save')}
      canSubmit={draft.trim() !== current}
      onSubmit={async () => {
        // Empty is "use the public server": nothing to check.
        if (!draft.trim()) {
          dispatch(setSourceServerUrl({ source, url: '' }));
          return true;
        }
        setProblem(null);
        const result = await checkServerAddress(source, draft);
        if (!result.ok) {
          setProblem(result.reason);
          return false;
        }
        dispatch(setSourceServerUrl({ source, url: result.address }));
        return true;
      }}
      onClose={onClose}
    >
      <FormSheetField
        label={t('settings.sources.serverAddress.label')}
        value={draft}
        onChangeText={text => { setDraft(text); setProblem(null); }}
        placeholder={t('settings.sources.serverAddress.placeholder')}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        autoFocus
      />
      {problem && (
        <Text testID="server-address-problem" style={styles.problem}>
          {t(`settings.sources.serverAddress.${problem}`)}
        </Text>
      )}
    </FormSheet>
  );
}

const styles = StyleSheet.create({
  problem: {
    ...typography.caption,
    color: statusColor.errorText,
    marginTop: spacing.xs,
  },
});
