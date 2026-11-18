import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';

import { useApi } from '@/providers/registry/useApi';
import { useServerReachable } from '@/features/connectivity/useServerReachable';
import { selectActiveServer } from '@/state/redux/selectors/serversSelectors';
import { QueryKeys } from '@/state/query/queryKeys';

/**
 * Whether the active server really has loudness to level towards.
 *
 * `songs.reportsLoudness` says the protocol carries a figure and the mapper
 * reads it; it does not say a figure will arrive. Jellyfin measures loudness
 * from 10.10 and only for a library it has scanned, so a server can satisfy
 * the declaration and still return nothing — and the Player screen would
 * offer a levelling switch, and a preamp under it, that correct against
 * nothing. That is the complaint in #314 in a new place rather than a fix for
 * it.
 *
 * So the server is asked, once per server per day, exactly as
 * `useServerSurface` asks whether podcasts and shares really exist. A
 * provider with no probe is taken at its word: Navidrome's ReplayGain tags
 * come from the files, and the server reports whatever it was given.
 *
 * Until it has answered, the switch stays out. A control that appears once
 * the server confirms is better than one that is there and does nothing,
 * which is the whole lesson of this bug.
 */
export function useServerLoudness(): boolean {
  const api = useApi();
  const serverId = useSelector(selectActiveServer)?.id;
  const reachable = useServerReachable();
  const declared = api.songs.reportsLoudness;
  const probe = api.songs.probeLoudness;

  const query = useQuery<boolean>({
    queryKey: [QueryKeys.ServerLoudness, serverId],
    queryFn: async () => (probe ? probe() : true),
    enabled: declared && Boolean(probe) && Boolean(serverId) && reachable,
    // A scan finishing, or a server upgrade, changes this — neither happens
    // between screens.
    staleTime: 1000 * 60 * 60 * 24,
    gcTime: 1000 * 60 * 60 * 24 * 7,
  });

  if (!declared) return false;
  // Nothing to ask: the declaration is the answer.
  if (!probe) return true;
  return query.data === true;
}
