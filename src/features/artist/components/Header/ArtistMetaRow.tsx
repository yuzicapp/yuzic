import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/Text';

import { spacing, typography } from '@/constants/design';
import type { ArtistScreenModel } from '@/features/artist/useArtistScreenModel';
import { useTheme } from '@/features/theme/useTheme';

/**
 * One meta row for both modes — the local/external split used to live as
 * two near-identical components (`LocalMetaRow`/`ExternalMetaRow`), each
 * re-deriving the same album/song counts the screen model now computes
 * once (`counts`).
 */
export default function ArtistMetaRow({ isLocal, counts }: { isLocal: boolean; counts: ArtistScreenModel['counts'] }) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const metadataItems = useMemo(() => {
    const items: string[] = [];
    if (isLocal || counts.albums > 0) {
      items.push(`${counts.albums} ${counts.albums === 1 ? t('common.album') : t('common.albums')}`);
    }
    if (isLocal && counts.songs > 0) {
      items.push(`${counts.songs} ${counts.songs === 1 ? t('common.song') : t('common.songs')}`);
    }
    return items;
  }, [isLocal, counts.albums, counts.songs, t]);

  return (
    <View style={styles.metaRow}>
      {metadataItems.map((item, index) => (
        <React.Fragment key={`${item}-${index}`}>
          {index > 0 && <Text style={[styles.metaDot, { color: colors.subtext }]}>•</Text>}
          <Text style={[styles.metaText, { color: colors.subtext }]} numberOfLines={1}>
            {item}
          </Text>
        </React.Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.tight,
    flexWrap: 'wrap',
  },
  metaDot: {
    ...typography.rowSubtitle,
    marginHorizontal: spacing.tight,
  },
  metaText: {
    ...typography.rowSubtitle,
  },
});
