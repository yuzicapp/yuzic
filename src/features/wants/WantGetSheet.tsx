import React, { useEffect } from 'react';

import GetReviewSheet from '@/components/options/GetReviewSheet';
import { useSheetRef } from '@/components/useSheetRef';
import type { Want } from '@/state/redux/slices/wantsSlice';
import { wantAlbum, wantTrack } from './wantEntity';

/**
 * The normal Get review, opened for a want.
 *
 * A want's Get is not a different kind of Get, so it is not a different
 * sheet: the same review, the same provider choice, the same explicit confirm
 * tap that every other acquisition in the app goes through. All this adds is
 * the translation from a saved want back into the album (or album-and-track)
 * that sheet speaks in, and `wantLocalId`, which tells it which want to wire
 * the started job back to — a track Get had no way to say before.
 */
export default function WantGetSheet({ want, onClose }: { want: Want; onClose: () => void }) {
  const sheetRef = useSheetRef();

  useEffect(() => { sheetRef.current?.present(); }, [sheetRef]);

  return (
    <GetReviewSheet
      album={wantAlbum(want)}
      track={want.unit === 'track' ? wantTrack(want) : undefined}
      wantLocalId={want.localId}
      sheetRef={sheetRef}
      onDismiss={onClose}
    />
  );
}
