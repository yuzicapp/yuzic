import type { NavidromeClient } from "../client";
import { LyricsResult } from "@/providers/contracts/ServerAdapter";
import { log } from '@/features/diagnostics/log';
import { detailOf } from '@/features/diagnostics/errorDetail';

type NavidromeLyricLine = {
  start: number; // milliseconds
  value: string;
};

type NavidromeStructuredLyrics = {
  synced: boolean;
  line: NavidromeLyricLine[];
};

type NavidromeLyricsList = {
  structuredLyrics?: NavidromeStructuredLyrics[];
};

type NavidromeResponse = {
  "subsonic-response"?: {
    lyricsList?: NavidromeLyricsList;
  };
};

export async function getLyricsBySongId(
  client: NavidromeClient,
  songId: string
): Promise<LyricsResult | null> {
  try {
    const raw = await client.request<NavidromeResponse>("getLyricsBySongId.view", { id: songId });

    const structured =
      raw["subsonic-response"]?.lyricsList?.structuredLyrics?.[0];

    if (!structured || structured.line.length === 0) {
      return null;
    }

    const lines = structured.line
      .filter((l): l is NavidromeLyricLine =>
        typeof l.value === "string" && l.value.trim().length > 0
      )
      .map((l) => ({
        // An unsynced list has no timings to carry; `start` is absent rather
        // than zero on some servers, and a NaN here would break the seek.
        startMs: structured.synced ? l.start ?? 0 : 0,
        text: l.value,
      }));

    if (lines.length === 0) return null;

    return {
      synced: structured.synced,
      lines,
    };
  } catch (error) {
    log.server.error('request failed', { provider: 'navidrome', operation: 'getLyricsBySongId', detail: detailOf(error) });
    throw error;
  }
}