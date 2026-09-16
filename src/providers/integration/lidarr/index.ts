import { createLidarrClient } from './client';
import type { LidarrConfig } from '@/providers/integration/lidarr/config';
import * as artists from './artists';
import { monitorArtist as monitorLidarrArtist, type MonitorArtistRequest } from './artists/monitor';

// Auth / connection
export { testConnection } from './auth';

// Artists
export function getQualityProfiles(config: LidarrConfig) {
  return artists.getQualityProfiles(createLidarrClient(config));
}
/** Follow an artist from now on — an artist want's Get. See `artists/monitor`. */
export function monitorArtist(config: LidarrConfig, request: MonitorArtistRequest) {
  return monitorLidarrArtist(createLidarrClient(config), request);
}
export type { LidarrQualityProfile } from './artists';

// Albums
export { downloadAlbum } from './albums';
export { albumRequestFromExternal } from './albums/resolution';

// Queue
export {
  fetchQueue,
  cancelQueueItem,
} from './queue';
