import React, { forwardRef, useMemo } from 'react';
import { Languages } from 'lucide-react-native';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useTranslation } from 'react-i18next';
import { AVAILABLE_LANGUAGES } from '@/features/settings/appearance/languages';
import SingleSelectBottomSheet, { type SingleSelectOption } from '@/components/SingleSelectBottomSheet';

interface LanguageBottomSheetProps { selected: string; onSelect: (code: string) => void; }
const LanguageBottomSheet = forwardRef<BottomSheetModal, LanguageBottomSheetProps>(({ selected, onSelect }, ref) => {
  const { t } = useTranslation();
  const options = useMemo<SingleSelectOption[]>(() => AVAILABLE_LANGUAGES.map(lang => ({ value: lang.code, label: t(lang.translationKey), Icon: Languages })), [t]);
  return (
    <SingleSelectBottomSheet
      ref={ref}
      testID="language-sheet"
      selected={selected}
      options={options}
      title={t('settings.appearance.language.title')}
      onSelect={onSelect}
    />
  );
});
LanguageBottomSheet.displayName = 'LanguageBottomSheet';
export default LanguageBottomSheet;
