import type { MediaBrowserClient } from "../client";
import type { MediaBrowserItem } from "../types";

type ItemsResponse = { Items?: MediaBrowserItem[] };

/**
 * Whether this Jellyfin returns a loudness figure for the library in use.
 *
 * Asked of the server with one item, because every cheaper way of deciding
 * answers a different question:
 *
 * - **The version is a proxy, and a wrong one.** Jellyfin measures loudness
 *   from 10.10, but only for a library it has scanned. A 10.10 server whose
 *   music was never scanned returns nothing, and a version check would show
 *   the levelling switch anyway — the dead switch this exists to prevent.
 * - **The brand is weaker still.** Emby shares this mapper and reports no
 *   figure at all.
 *
 * One track's answer stands for the library: the figure comes from Jellyfin's
 * own scan, which runs over the library rather than per request. A library
 * part-way through its first scan can answer false and be remembered as such
 * for a day — see the caller's `staleTime` — which is the same trade
 * `useServerSurface` makes, and the same recovery: it asks again tomorrow.
 *
 * `SortBy=Random` deliberately: `SortName` would ask about the same track
 * every time, so one unscanned file at the top of the alphabet would speak
 * for a library that is otherwise fully measured.
 */
export async function probeLoudness(client: MediaBrowserClient): Promise<boolean> {
  const path =
    `/Users/${encodeURIComponent(client.userId)}/Items` +
    `?IncludeItemTypes=Audio` +
    `&Recursive=true` +
    `&SortBy=Random` +
    `&Limit=1` +
    (client.parentId ? `&ParentId=${encodeURIComponent(client.parentId)}` : "");

  // No `Fields=`: verified against a Jellyfin 12.4 server that
  // `NormalizationGain` arrives on audio items unasked. Requesting it as a
  // field would be requesting a name that is not in `ItemFields`.
  const response = await client.request<ItemsResponse>(path);
  const item = response.Items?.[0];

  return typeof item?.NormalizationGain === 'number'
    || typeof item?.AlbumNormalizationGain === 'number';
}
