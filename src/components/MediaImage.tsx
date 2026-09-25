import React, { useEffect, useMemo, useState } from 'react';
import { View, Text } from 'react-native';
import TurboImage from 'react-native-turbo-image';
import { useSelector } from 'react-redux';
import { buildCover, buildCoverCacheKey, coverIdentity, DRAWN_COVER } from '@/providers/registry/covers';
import { CoverSource } from '@/domain/entities/Cover';
import ThemedHeartCover from '@/components/ThemedHeartCover';
import ThemedRadioCover from '@/components/ThemedRadioCover';
import { selectActiveServerId } from '@/state/redux/selectors/serversSelectors';
import { useTheme } from '@/features/theme/useTheme';
import { useResolvedCover } from '@/features/artwork/useResolvedCover';
import { coverPlaceholder } from './coverPlaceholder';
import {
  hasImageUrlFailed,
  IMAGE_CACHE_POLICY,
  markImageUrlFailed,
  markImageUrlSucceeded,
} from '@/features/artwork/imageCache';

/**
 * What the drawn stand-in is of. The seed is the album's identity rather than
 * its title, so correcting a tag does not change the colour; the name is what
 * the letters come from.
 */
function placeholderIdentity(cover: CoverSource): { seed: string; name: string } {
  const subject = 'subject' in cover ? cover.subject : undefined;
  if (subject?.kind === 'album') {
    return { seed: `album:${subject.artistName}\u0000${subject.title}`, name: subject.title };
  }
  if (subject?.kind === 'artist') {
    return { seed: `artist:${subject.name}`, name: subject.name };
  }
  if (subject?.kind === 'station') {
    return { seed: `station:${subject.streamUrl ?? subject.name}`, name: subject.name };
  }
  // No subject: a cover the server named but could not serve. Its own identity
  // still names the item, so the tile stays stable and distinct — there is just
  // nothing to take letters from. The registry answers this, because which
  // providers exist is not a thing a component should know.
  return { seed: coverIdentity(cover) ?? 'none', name: '' };
}

/** Letters scale with the tile: a thumb cannot carry the detail screen's size. */
const INITIALS_SIZE: Record<'thumb' | 'grid' | 'detail' | 'background', number> = {
  thumb: 18,
  grid: 34,
  detail: 64,
  background: 64,
};

export function MediaImage({
  cover,
  size,
  style,
}: {
  cover: CoverSource;
  size: 'thumb' | 'grid' | 'detail' | 'background';
  style?: any;
}) {
  // Subscribe so we re-render when active server becomes available or changes.
  // buildCover() reads from the store; without this, URLs stay null until
  // some other state (e.g. list data) causes a re-render.
  const activeServerId = useSelector(selectActiveServerId);
  // `isDarkMode` rather than the mode: a custom theme can draw a dark palette
  // while the app is set to light, and the stand-in has to sit on the palette
  // that is actually showing.
  const { colors, isDarkMode } = useTheme();
  // A gap is filled here the same way everywhere: the library's copy, then
  // the artwork backups the user has switched on. Asking a backup starts here.
  const { cover: resolved } = useResolvedCover(cover);
  const uri = useMemo(() => {
    void activeServerId;
    return buildCover(resolved, size);
  }, [resolved, size, activeServerId]);
  const cacheKey = useMemo(() => {
    void activeServerId;
    return buildCoverCacheKey(resolved, size);
  }, [resolved, size, activeServerId]);
  const drawn = useMemo(() => {
    const { seed, name } = placeholderIdentity(resolved);
    return coverPlaceholder(seed, name, isDarkMode ? 'dark' : 'light');
  }, [resolved, isDarkMode]);
  const [failedVersion, setFailedVersion] = useState(0);
  const primaryFailed = hasImageUrlFailed(uri);
  const sourceUri = useMemo(() => {
    void failedVersion;
    return uri && !primaryFailed ? uri : null;
  }, [failedVersion, primaryFailed, uri]);

  useEffect(() => {
    setFailedVersion(version => version + 1);
  }, [uri]);

  if (uri === DRAWN_COVER.heart) {
    return (
      <View style={[style, { overflow: 'hidden' }]}>
        <ThemedHeartCover />
      </View>
    );
  }

  if (uri === DRAWN_COVER.radio) {
    return (
      <View style={[style, { overflow: 'hidden' }]}>
        <ThemedRadioCover />
      </View>
    );
  }

  // Nothing to draw. Rather than the same picture-with-a-slash glyph on every
  // tile — issue #290, a library of live recordings that will never have
  // covers — the stand-in is derived from what the cover is of, so each album
  // gets its own colour and keeps it.
  if (!sourceUri) {
    return (
      <View
        style={[
          style,
          { overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: drawn.background },
        ]}
      >
        {drawn.initials !== '' && (
          <Text
            // Decorative: the row or tile around this already carries the name,
            // so a screen reader reading the initials back would just repeat it.
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            allowFontScaling={false}
            numberOfLines={1}
            style={{ color: drawn.foreground, fontSize: INITIALS_SIZE[size], fontWeight: '600' }}
          >
            {drawn.initials}
          </Text>
        )}
      </View>
    );
  }

  // Loading is not the same state as "there is no artwork", and it should not
  // look like it. Behind a load in progress goes a plain surface, not the
  // stand-in above: a slow grid would otherwise flash a screenful of coloured
  // tiles and settle into covers a second later, which reads as the artwork
  // changing rather than arriving. This mattered more when the stand-in was a
  // picture-with-a-slash glyph and a slow grid read as nine failures, but it is
  // still the reason the two states are drawn differently.
  return (
    <View style={[style, { overflow: 'hidden', backgroundColor: colors.card }]}>
      <TurboImage
        source={{ uri: sourceUri, cacheKey: cacheKey ?? sourceUri }}
        style={{ width: '100%', height: '100%' }}
        resizeMode="cover"
        cachePolicy={IMAGE_CACHE_POLICY}
        fadeDuration={200}
        onSuccess={() => {
          markImageUrlSucceeded(sourceUri);
        }}
        onFailure={() => {
          markImageUrlFailed(sourceUri);
          setFailedVersion(version => version + 1);
        }}
      />
    </View>
  );
}
