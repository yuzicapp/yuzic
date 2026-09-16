import React from 'react';
import { Heart, Play, Download, CloudDownload, ChevronRight, Link } from 'lucide-react-native';
import type { Song } from '@/domain/entities/Song';
import { iconSize, spacing, statusColor } from '@/constants/design';
import type { ActionDef, BaseActionContext } from '../types';

export interface SongExternalActionContext extends BaseActionContext {
  kind: 'song';
  origin: 'external';
  song: Song;
  t: (key: string, opts?: Record<string, unknown>) => string;
  colors: { secondary: string; placeholder: string };
  onPlay?: () => void;
  isWanted: boolean;
  /** The library already holds this recording — see `features/library/localFirst`. */
  isInLibrary: boolean;
  canDownload: boolean;
  canDownloadTrack: boolean;
  handlers: {
    play: () => void;
    toggleWant: () => void;
    openAlbumGet: () => void;
    openTrackGet: () => void;
  };
}

type Ctx = SongExternalActionContext;
const chevron = (color: string) => React.createElement(ChevronRight, {
  size: iconSize.inline, color, style: { marginLeft: spacing.xs },
});

export const songExternalActions: ActionDef<Ctx>[] = [
  {
    id: 'play',
    label: ctx => ctx.t('songOptions.actions.play'),
    icon: ctx => React.createElement(Play, { size: iconSize.loader, color: ctx.colors.secondary, fill: ctx.colors.secondary }),
    visible: ctx => !!ctx.onPlay,
    invoke: ctx => ctx.handlers.play(),
  },
  // Owning it settles all three of the rows below, the same way the external
  // album sheet's "In Library" row settles Want and Get there: an inert line
  // saying you have it, rather than an offer to acquire it again.
  {
    id: 'inLibrary',
    label: ctx => ctx.t('externalAlbum.menu.inLibrary'),
    icon: () => React.createElement(Link, { size: iconSize.loader, color: statusColor.success }),
    visible: ctx => ctx.isInLibrary,
    enabled: () => false,
    invoke: () => {},
  },
  {
    id: 'want',
    label: ctx => ctx.t(ctx.isWanted ? 'externalAlbum.menu.wanted' : 'externalAlbum.menu.want'),
    icon: ctx => React.createElement(Heart, {
      size: iconSize.loader,
      color: ctx.isWanted ? statusColor.success : ctx.colors.secondary,
      fill: ctx.isWanted ? statusColor.success : 'none',
    }),
    visible: ctx => !ctx.isInLibrary && !!ctx.song.localId,
    invoke: ctx => ctx.handlers.toggleWant(),
  },
  {
    id: 'getSong',
    label: ctx => ctx.t('externalAlbum.menu.getSong'),
    icon: ctx => React.createElement(Download, { size: iconSize.loader, color: ctx.colors.secondary }),
    trailing: ctx => chevron(ctx.colors.placeholder),
    visible: ctx => !ctx.isInLibrary && ctx.canDownloadTrack,
    invoke: ctx => ctx.handlers.openTrackGet(),
  },
  {
    id: 'get',
    label: ctx => ctx.t('externalAlbum.menu.get'),
    icon: ctx => React.createElement(CloudDownload, { size: iconSize.loader, color: ctx.colors.secondary }),
    trailing: ctx => chevron(ctx.colors.placeholder),
    visible: ctx => !ctx.isInLibrary && ctx.canDownload,
    invoke: ctx => ctx.handlers.openAlbumGet(),
  },
];
