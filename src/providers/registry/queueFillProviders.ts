import { useMemo } from 'react';

import type { ApiAdapter } from '@/providers/contracts/ServerAdapter';
import {
  createSimilarityServiceQueueFillProvider,
  createNativeSimilarityQueueFillProvider,
  createLibraryQueueFillProvider,
  type QueueFillProvider,
} from '@/features/playback/queueProviders';
import { useSimilarityService } from './similarityService';

/**
 * Where Autoplay, Smart Shuffle and Play Similar look for tracks nobody
 * chose, strongest first: the similarity service's acoustic matches when one
 * is connected, the server's own similar-songs, then the library itself.
 *
 * Declared here with the other provider declarations, so playback asks for
 * "the fill sources" without naming any of them.
 */
export function useQueueFillProviders(api: ApiAdapter): QueueFillProvider[] {
  const similarity = useSimilarityService();

  return useMemo(() => [
    ...(similarity ? [createSimilarityServiceQueueFillProvider(similarity, api)] : []),
    createNativeSimilarityQueueFillProvider(api),
    createLibraryQueueFillProvider(api),
  ], [api, similarity]);
}
