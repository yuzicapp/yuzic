import React from 'react';
import { useTranslation } from 'react-i18next';
import { Ellipsis } from 'lucide-react-native';

import { DetailHeaderIconButton } from '@/components/DetailHeader';
import ArtistOptions from '@/components/options/ArtistOptions';
import { useSheetRef } from '@/components/useSheetRef';
import { iconSize } from '@/constants/design';
import type { Artist } from '@/domain/entities/Artist';
import { useTheme } from '@/features/theme/useTheme';

/**
 * The "…" on an artist's bar, opening the artist's options sheet.
 *
 * On a browsed artist as well as a library one — the browsed screen used to
 * draw a 36pt hole where the button goes, which is why there was no way to
 * share one or open it at its source. `ArtistOptions` picks the action set
 * from the artist's own provenance.
 */
export default function ArtistOptionsButton({ artist }: { artist: Artist }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const optionsSheetRef = useSheetRef();
  return (
    <>
      <DetailHeaderIconButton
        accessibilityLabel={t('a11y.common.moreOptions')}
        onPress={() => optionsSheetRef.current?.present()}
      >
        <Ellipsis size={iconSize.header} color={colors.secondary} />
      </DetailHeaderIconButton>
      <ArtistOptions ref={optionsSheetRef} artist={artist} hideGoToArtist />
    </>
  );
}
