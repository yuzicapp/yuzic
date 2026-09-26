import React, { createContext, useContext } from 'react';

import { useActiveTheme } from './useActiveTheme';

/**
 * The user's text size, published once for everything that draws at it.
 *
 * Both the text itself (`components/Text`) and the icons beside it
 * (`useIconSize`) read from here rather than from the store, for two reasons:
 * 400-odd `Text`s should not each hold a store subscription, and a default of
 * 1 without a provider means a component under test draws at its written size
 * without the test having to stand up a store to say so.
 */
const TextScaleContext = createContext(1);

export function TextScaleProvider({ children }: { children: React.ReactNode }) {
  const scale = useActiveTheme().shape.textScale;
  return <TextScaleContext.Provider value={scale}>{children}</TextScaleContext.Provider>;
}

export function useTextScale(): number {
  return useContext(TextScaleContext);
}
