import React from 'react';
import { Heart, Link, Share2, SquareArrowOutUpRight } from 'lucide-react-native';
import type { Artist } from '@/domain/entities/Artist';
import { iconSize, statusColor } from '@/constants/design';
import type { ActionDef, BaseActionContext } from '../types';

/**
 * A browsed artist's options.
 *
 * Deliberately short: an artist nobody's server has cannot be played,
 * downloaded, queued or favourited, and every library action on
 * `artistActions` is one of those. What is left is Want, and what you can do
 * with the record itself — take it out of the app, or go to where it came
 * from — which is also what the external *album* sheet ends on, so the two
 * read the same.
 *
 * Want leads, matching `albumExternalActions`. An artist want is a bookmark
 * that resolves when the artist turns up in the library, and — with something
 * connected that follows artists — the thing a Get on the Wants screen hands
 * over. Wanting one never starts a download: the Get is a separate, later,
 * explicit tap, which is the whole reason this row does nothing but save.
 */
export interface ArtistExternalActionContext extends BaseActionContext {
  kind: 'artist';
  origin: 'external';
  artist: Artist;
  t: (key: string, opts?: Record<string, unknown>) => string;
  colors: { secondary: string };
  isWanted: boolean;
  /** The library already holds this artist — see `features/library/localFirst`. */
  isInLibrary: boolean;
  /** i18n key naming the source this artist has a public page on, or null. */
  webSourceNameKey: string | null;
  handlers: {
    toggleWant: () => void;
    share: () => void;
    openInSource: () => void;
  };
}

type Ctx = ArtistExternalActionContext;
const sz = iconSize.loader;

export const artistExternalActions: ActionDef<Ctx>[] = [
  // Owning them settles Want, the same way the external album sheet's
  // "In Library" row settles Want and Get there.
  {
    id: 'inLibrary',
    label: ctx => ctx.t('externalAlbum.menu.inLibrary'),
    icon: () => React.createElement(Link, { size: sz, color: statusColor.success }),
    visible: ctx => ctx.isInLibrary,
    enabled: () => false,
    invoke: () => {},
  },
  {
    id: 'want',
    label: ctx => ctx.t(ctx.isWanted ? 'externalAlbum.menu.wanted' : 'externalAlbum.menu.want'),
    icon: ctx => React.createElement(Heart, {
      size: sz,
      color: ctx.isWanted ? statusColor.success : ctx.colors.secondary,
      fill: ctx.isWanted ? statusColor.success : 'none',
    }),
    visible: ctx => !ctx.isInLibrary && !!ctx.artist.localId,
    testID: () => 'artist-option-want',
    invoke: ctx => ctx.handlers.toggleWant(),
  },
  {
    id: 'share',
    label: ctx => ctx.t('artistOptions.actions.share'),
    icon: ctx => React.createElement(Share2, { size: sz, color: ctx.colors.secondary }),
    visible: ctx => ctx.webSourceNameKey !== null,
    invoke: ctx => ctx.handlers.share(),
  },
  {
    id: 'openInSource',
    label: ctx => ctx.t('externalOptions.openInSource', {
      source: ctx.webSourceNameKey ? ctx.t(ctx.webSourceNameKey) : '',
    }),
    icon: ctx => React.createElement(SquareArrowOutUpRight, { size: sz, color: ctx.colors.secondary }),
    visible: ctx => ctx.webSourceNameKey !== null,
    invoke: ctx => ctx.handlers.openInSource(),
  },
];
