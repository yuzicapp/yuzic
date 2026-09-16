import { useDispatch, useSelector } from 'react-redux';
import { selection as hapticsSelection } from '@/components/haptics';
import { selectActiveServerId } from '@/state/redux/selectors/serversSelectors';
import { selectIsWanted } from '@/state/redux/selectors/wantsSelectors';
import { addWant, removeWant, type WantOrigin, type WantUnit } from '@/state/redux/slices/wantsSlice';
import { wantCover } from '@/features/wants/wantCover';
import type { LocalId } from '@/domain/identity/LocalId';
import type { ExternalIds } from '@/domain/identity/ExternalIds';
import type { CoverSource } from '@/domain/entities/Cover';

/**
 * The one Want/Unwant implementation, shared by external songs, albums and
 * artists — every entity kind with a "want" concept. Each call site used to
 * duplicate this same dispatch-a-redux-action logic with only the
 * `unit`/`origin` fields differing; those stay as parameters.
 *
 * The record's `cover` is saved with it. A want is the only row in the app
 * drawn for something no server has, so there is no entity left to ask for a
 * picture later — `wantCover` keeps the source's own image, or the gap naming
 * its subject, which is what lets the one picture rule fill the row in.
 */
export function useWantToggle(localId: LocalId | undefined, unit: WantUnit, origin: WantOrigin) {
  const dispatch = useDispatch();
  const activeServerId = useSelector(selectActiveServerId);
  const isWanted = useSelector(localId ? selectIsWanted(localId) : () => false);

  const toggle = (opts: { externalIds: ExternalIds; title: string; artist: string; cover: CoverSource }) => {
    if (!localId || !activeServerId) return;
    hapticsSelection();
    if (isWanted) {
      dispatch(removeWant({ serverId: activeServerId, localId }));
    } else {
      dispatch(addWant({
        serverId: activeServerId,
        want: {
          localId,
          externalIds: opts.externalIds,
          unit,
          title: opts.title,
          artist: opts.artist,
          cover: wantCover({
            unit,
            cover: opts.cover,
            title: opts.title,
            artist: opts.artist,
            externalIds: opts.externalIds,
          }),
          origin,
        },
      }));
    }
  };

  return { isWanted, toggle };
}
