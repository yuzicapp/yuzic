import React from 'react';
import { useIconSize } from '@/features/theme/useIconSize';
import { useTranslation } from 'react-i18next';

import SettingsCard from './SettingsCard';
import SettingsDivider from './SettingsDivider';
import SettingsInputField from './SettingsInputField';
import SettingsInfoRow from './SettingsInfoRow';
import ConnectivityIndicator from './ConnectivityIndicator';
import Touchable from '@/components/Touchable';
import { hitSlopFor, spacing } from '@/constants/design';

type AuthField = {
  label: string;
  value: string | undefined;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
};

type Props = {
  fields: AuthField[];
  isAuthenticated: boolean;
  isLoading: boolean;
  connectivityLabel: string;
  onConnectivityPress?: () => void;
};

const SettingsAuthCard: React.FC<Props> = ({
  fields,
  isAuthenticated,
  isLoading,
  connectivityLabel,
  onConnectivityPress,
}) => {
  const { t } = useTranslation();
  const icons = useIconSize();
  const indicator = (
    <ConnectivityIndicator isLoading={isLoading} isConnected={isAuthenticated} />
  );

  return (
    <SettingsCard>
      {fields.map((field, index) => (
        <SettingsInputField key={index} {...field} />
      ))}
      <SettingsDivider style={{ marginTop: spacing.sm }} />
      <SettingsInfoRow
        label={connectivityLabel}
        right={
          onConnectivityPress ? (
            <Touchable
              accessibilityRole="button"
              accessibilityLabel={t('a11y.common.checkConnection')}
              onPress={onConnectivityPress}
              hitSlop={hitSlopFor(icons.badge)}
            >
              {indicator}
            </Touchable>
          ) : indicator
        }
      />
    </SettingsCard>
  );
};

export default SettingsAuthCard;
