import React, { forwardRef, useMemo } from 'react';
import { ArrowDownAZ, Calendar, CalendarPlus, Clock3, Flame } from 'lucide-react-native';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useTranslation } from 'react-i18next';
import SingleSelectBottomSheet, { type SingleSelectOption } from '@/components/SingleSelectBottomSheet';

type SortOrder = 'title' | 'recent' | 'userplays' | 'year' | 'recentlyAdded';
interface SortBottomSheetProps { sortOrder: SortOrder; onSelect: (value: SortOrder) => void; }

const SortBottomSheet = forwardRef<BottomSheetModal, SortBottomSheetProps>(({ sortOrder, onSelect }, ref) => {
  const { t } = useTranslation();
  const options = useMemo<SingleSelectOption[]>(() => [
    { value: 'recent', label: t('home.sort.mostRecent'), Icon: Clock3 },
    { value: 'recentlyAdded', label: t('home.sort.recentlyAdded'), Icon: CalendarPlus },
    { value: 'title', label: t('home.sort.alphabetical'), Icon: ArrowDownAZ },
    { value: 'year', label: t('home.sort.releaseYear'), Icon: Calendar },
    { value: 'userplays', label: t('home.sort.mostPlayed'), Icon: Flame },
  ], [t]);
  return (
    <SingleSelectBottomSheet
      ref={ref}
      testID="sort-sheet"
      selected={sortOrder}
      options={options}
      title={t('home.sortSheet.title')}
      onSelect={value => onSelect(value as SortOrder)}
    />
  );
});
SortBottomSheet.displayName = 'SortBottomSheet';
export default SortBottomSheet;
