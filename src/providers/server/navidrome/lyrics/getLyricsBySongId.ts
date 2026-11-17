import type { NavidromeClient } from "../client";
import type { LyricLine, LyricsResult } from "@/providers/contracts/ServerAdapter";
import { parseLrc } from "@/providers/integration/lrclib/parseLrc";

type NavidromeLyricLine = {
  start?: number; // milliseconds
  value: string;
};

type NavidromeStructuredLyrics = {
  synced: boolean;
  line?: NavidromeLyricLine[];
};

type NavidromeLyricsList = {
  structuredLyrics?: NavidromeStructuredLyrics[];
};

type NavidromeResponse = {
  "subsonic-response"?: {
    lyricsList?: NavidromeLyricsList;
  };
};

type SongResponse = {
  "subsonic-response"?: { song?: { title?: string; artist?: string } };
};

type LegacyLyricsResponse = {
  "subsonic-response"?: { lyrics?: { value?: string } };
};

function toResult(entry: NavidromeStructuredLyrics): LyricsResult | null {
  const lines = (entry.line ?? [])
    .filter((l): l is NavidromeLyricLine =>
      typeof l.value === "string" && l.value.trim().length > 0
    )
    .map((l) => ({
      // An unsynced list has no timings to carry; `start` is absent rather
      // than zero on some servers, and a NaN here would break the seek.
      startMs: entry.synced ? l.start ?? 0 : 0,
      text: l.value,
    }));
  return lines.length > 0 ? { synced: entry.synced, lines } : null;
}

/**
 * The best of the lists the server returned: a synced one if any has lines,
 * otherwise the first plain one that does.
 *
 * Only the first list used to be read. A server can return several — synced
 * beside plain, or one per language — and when the first was empty the
 * track showed no lyrics while another list had them (#316).
 */
function pickStructured(lists: NavidromeStructuredLyrics[]): LyricsResult | null {
  const results = lists.map(toResult).filter((r): r is LyricsResult => r !== null);
  return results.find((r) => r.synced) ?? results[0] ?? null;
}

/**
 * Plain Subsonic's `getLyrics.view`, by artist and title, for a server
 * without OpenSubsonic's `getLyricsBySongId`. Its text is one string; some
 * servers hand back LRC there, which keeps its timings when it parses.
 */
async function getLegacyLyrics(client: NavidromeClient, songId: string): Promise<LyricsResult | null> {
  const songRaw = await client.request<SongResponse>("getSong.view", { id: songId });
  const song = songRaw["subsonic-response"]?.song;
  if (!song?.title) return null;

  const raw = await client.request<LegacyLyricsResponse>("getLyrics.view", {
    artist: song.artist ?? "",
    title: song.title,
  });
  const text = raw["subsonic-response"]?.lyrics?.value;
  if (!text?.trim()) return null;

  const timed = parseLrc(text);
  if (timed.length > 0) return { synced: true, lines: timed };

  const lines: LyricLine[] = text
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => ({ startMs: 0, text: line }));
  return lines.length > 0 ? { synced: false, lines } : null;
}

export async function getLyricsBySongId(
  client: NavidromeClient,
  songId: string
): Promise<LyricsResult | null> {
  let raw: NavidromeResponse;
  try {
    raw = await client.request<NavidromeResponse>("getLyricsBySongId.view", { id: songId });
  } catch (error) {
    // A server without the extension refuses the endpoint; the plain one may
    // still have lyrics. If that fails too, the first failure is the one to
    // report — an unreachable server fails both, and that is not "no lyrics".
    try {
      return await getLegacyLyrics(client, songId);
    } catch {
      console.error('Navidrome getLyricsBySongId failed:', error);
      throw error;
    }
  }

  return pickStructured(raw["subsonic-response"]?.lyricsList?.structuredLyrics ?? []);
}
