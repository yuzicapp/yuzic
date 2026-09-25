import React from 'react';
import { useTranslation } from 'react-i18next';

import NotFoundView from '@/components/NotFoundView';

/**
 * Where an unknown link lands.
 *
 * Without this route expo-router has nothing to render for a URL that matches
 * no screen, and a mistyped or stale deep link — a share that outlived the
 * album it pointed at, a link from an older version — took the app nowhere in
 * particular. `NotFoundView` already knows how to get back to the tabs when
 * there is no history behind it, which is exactly the cold-link case.
 */
export default function NotFound() {
  const { t } = useTranslation();
  return <NotFoundView message={t('media.notFound')} />;
}
