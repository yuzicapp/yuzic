import React from 'react';
import { Heart, CloudDownload, ChevronRight, Link, Share2, SquareArrowOutUpRight, User } from 'lucide-react-native';
import type { Album } from '@/domain/entities/Album';
import { iconSize, spacing, statusColor } from '@/constants/design';
import type { ActionDef, BaseActionContext } from '../types';
import type { ExternalAlbumStatus } from '@/features/downloaders/useExternalAlbumStatus';
import { promptConnectDownloader } from '@/features/downloaders/connectDownloaderPrompt';

export interface AlbumExternalActionContext extends BaseActionContext {
  kind: 'album';
  origin: 'external';
  album: Album;
  t: (key: string, opts?: Record<string, unknown>) => string;
  colors: { secondary: string; muted: string; placeholder: string };
  status: ExternalAlbumStatus;
  isWanted: boolean;
  canDownload: boolean;
  /** i18n key naming the source this record has a public page on, or null when
   *  nothing identifies it publicly — see `providers/registry/sourceLinks`. */
  webSourceNameKey: string | null;
  canGoToArtist: boolean;
  handlers: {
    toggleWant: () => void;
    openGet: () => void;
    goToArtist: () => void;
    share: () => void;
    openInSource: () => void;
  };
}

type Ctx = AlbumExternalActionContext;
const sz = iconSize.loader;

/**
 * Mirrors the original `ExternalAlbumOptionsSheet`'s three-way branch on
 * `status.kind`: "in library" and "downloading" each render a single inert
 * informational row instead of the Want/Get rows, rather than adding a
 * fourth row alongside them. Modeled here as three mutually-exclusive rows
 * gated on `status.kind`, same as the original if/else-if/else.
 */
export const albumExternalActions: ActionDef<Ctx>[] = [
  {
    id: 'inLibrary',
    label: ctx => ctx.t('externalAlbum.menu.inLibrary'),
    icon: () => React.createElement(Link, { size: sz, color: statusColor.success }),
    visible: ctx => ctx.status.kind === 'in_library',
    enabled: () => false,
    invoke: () => {},
  },
  {
    id: 'downloading',
    label: ctx => ctx.t('externalAlbum.menu.downloading', {
      progress: ctx.status.kind === 'downloading' ? ctx.status.progress : undefined,
    }),
    icon: () => null,
    visible: ctx => ctx.status.kind === 'downloading',
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
    visible: ctx => ctx.status.kind === 'none' && !!ctx.album.localId,
    invoke: ctx => ctx.handlers.toggleWant(),
  },
  {
    id: 'get',
    label: ctx => ctx.t('externalAlbum.menu.get'),
    icon: ctx => React.createElement(CloudDownload, { size: sz, color: ctx.colors.secondary }),
    trailing: ctx => React.createElement(ChevronRight, { size: iconSize.inline, color: ctx.colors.placeholder, style: { marginLeft: spacing.xs } }),
    visible: ctx => ctx.status.kind === 'none' && ctx.canDownload,
    invoke: ctx => ctx.handlers.openGet(),
  },
  {
    id: 'noServiceConnected',
    label: ctx => ctx.t('externalAlbum.menu.noServiceConnected'),
    icon: ctx => React.createElement(CloudDownload, { size: sz, color: ctx.colors.muted }),
    labelColor: ctx => ctx.colors.muted,
    visible: ctx => ctx.status.kind === 'none' && !ctx.canDownload,
    invoke: () => promptConnectDownloader('album'),
  },
  // Below the ownership rows, the same three a library album's sheet ends on:
  // where else to go, and the two ways to take the record out of the app. An
  // external album has no server share link — `shares` links to something on
  // your own server — so Share sends the source's own page for it.
  {
    id: 'goToArtist',
    label: ctx => ctx.t('externalAlbum.menu.goToArtist'),
    icon: ctx => React.createElement(User, { size: sz, color: ctx.colors.secondary }),
    visible: ctx => ctx.canGoToArtist,
    invoke: ctx => ctx.handlers.goToArtist(),
  },
  {
    id: 'share',
    label: ctx => ctx.t('albumOptions.actions.share'),
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
