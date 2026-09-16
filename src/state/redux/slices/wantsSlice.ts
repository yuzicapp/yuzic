import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { LocalId } from '@/domain/identity/LocalId';
import type { ExternalIds } from '@/domain/identity/ExternalIds';
import type { CoverSource } from '@/domain/entities/Cover';
import type { DownloaderId } from '@/state/redux/slices/downloadersSlice';

export type WantUnit = 'track' | 'album' | 'artist';

export type WantOrigin = 'search' | 'shelf' | 'artist-page' | 'manual';

/**
 * The Get that was sent for a want, as the want remembers it.
 *
 * Deliberately not a status: a job's state is read live off the downloader's
 * own queue (`features/wants/jobStatus`), because the downloader is the only
 * thing that knows it. What is stored is which downloader was asked and when
 * — enough to find the job in that queue, and enough to tell a request that
 * never showed up from one that has not been picked up yet.
 *
 * It replaces a `jobRef: string` that was written as `${id}:${Date.now()}`
 * and never read: the id half could not be compared to anything without
 * parsing it back out of the string, so nothing ever did.
 */
interface WantJobRef {
  downloader: DownloaderId;
  /** Unix ms the Get was accepted by the downloader. */
  requestedAt: number;
}

/**
 * A saved intent to acquire a track, an album, or an artist's output.
 *
 * Stores enough (title/artist/cover) to render a wishlist row with zero
 * lookups — per design, even a 'manual' origin (nothing resolved on-device)
 * saves title+artist locally.
 *
 * `cover` is the entity's cover *as its source gave it*, which for a browsed
 * record is usually a gap naming who it is of (`Cover.missingCover`). Storing
 * it is what lets the one picture rule — own source, then the library's copy,
 * then the artwork backups — fill a want row in, exactly as it fills any other
 * surface. Absent on wants saved before covers were stored; those rows draw
 * the placeholder as they always did.
 *
 * `jobRef` is populated when a Get is dispatched for this want; the want only
 * references the job, it never owns it, and nothing here ever starts one.
 */
export interface Want {
  localId: LocalId;
  externalIds?: ExternalIds;
  unit: WantUnit;
  title: string;
  artist: string;
  cover?: CoverSource;
  origin: WantOrigin;
  jobRef?: WantJobRef;
  createdAt: number;
  updatedAt: number;
}

interface WantsState {
  byServer: Record<string, Want[]>;
}

const initialState: WantsState = {
  byServer: {},
};

type ServerRef = { serverId: string };

/**
 * Save-only: no reducer performs or triggers acquisition; Get is a separate
 * action (Phase C3). These reducers only ever add/update/remove entries in
 * `byServer` — zero network calls, zero side effects.
 */
const wantsSlice = createSlice({
  name: 'wants',
  initialState,
  reducers: {
    addWant(state, action: PayloadAction<ServerRef & { want: Omit<Want, 'createdAt' | 'updatedAt'> }>) {
      const { serverId, want } = action.payload;
      const existing = state.byServer[serverId] ?? [];
      const now = Date.now();
      const index = existing.findIndex(w => w.localId === want.localId);
      if (index === -1) {
        state.byServer[serverId] = [...existing, { ...want, createdAt: now, updatedAt: now }];
      } else {
        const current = existing[index];
        const updated = [...existing];
        updated[index] = { ...current, ...want, createdAt: current.createdAt, updatedAt: now };
        state.byServer[serverId] = updated;
      }
    },
    removeWant(state, action: PayloadAction<ServerRef & { localId: LocalId }>) {
      const { serverId, localId } = action.payload;
      const existing = state.byServer[serverId];
      if (!existing) return;
      state.byServer[serverId] = existing.filter(w => w.localId !== localId);
    },
    setWantJobRef(state, action: PayloadAction<ServerRef & { localId: LocalId; jobRef: WantJobRef | undefined }>) {
      const { serverId, localId, jobRef } = action.payload;
      const existing = state.byServer[serverId];
      if (!existing) return;
      const index = existing.findIndex(w => w.localId === localId);
      if (index === -1) return;
      const updated = [...existing];
      updated[index] = { ...updated[index], jobRef, updatedAt: Date.now() };
      state.byServer[serverId] = updated;
    },
    clearWantsForServer(state, action: PayloadAction<ServerRef>) {
      state.byServer[action.payload.serverId] = [];
    },
  },
});

export const {
  addWant,
  removeWant,
  setWantJobRef,
  clearWantsForServer,
} = wantsSlice.actions;

export default wantsSlice.reducer;
