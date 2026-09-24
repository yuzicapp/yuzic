import React from 'react';
import { Tabs } from 'expo-router';
import { StyleSheet, View, Platform, type LayoutChangeEvent } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, Library, Search } from 'lucide-react-native';
import { StackActions } from '@react-navigation/native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BottomTabBarHeightCallbackContext } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';

import PlayingBar from '@/features/player/playingBar/PlayingBar';
import Touchable from '@/components/Touchable';
import { setToastClearance } from '@/components/toast/clearance';
import { useTheme } from '@/features/theme/useTheme';
import { useActiveTheme } from '@/features/theme/useActiveTheme';
import { contentWidth, iconSize, spacing } from '@/constants/design';

/**
 * The tab bar is a real react-navigation bottom tab bar now: the tab-tracking
 * gymnastics that used to live in (home)/_layout.tsx (segment sniffing,
 * module-scope lastVisitedTab, hand-rolled navigation) are gone — React
 * Navigation knows which tab is focused and calls onPress correctly.
 *
 * PlayingBar renders inside this same tabBar surface so the two are one
 * docked panel at the bottom of the tab screens. Pushing a Stack.Screen
 * from a tab (an album, artist, settings) will hide both together, which
 * matches how every other music app treats its detail views.
 */
// The tab you land on when something navigates to `(tabs)` as a whole.
// Without this, expo-router infers the anchor by looking for a child whose
// route matches the group name — `(tabs)` has no such child, so the landing
// tab was decided by declaration order. Naming it keeps that from shifting
// when tabs are added or reordered.
export const unstable_settings = { anchor: '(home)' };

/** Active and inactive icon weights. The active tab is the theme colour at a
 * heavier stroke, so it differs in shape as well as hue — colour on its own
 * would be the only thing distinguishing it. */
/** Enough to read as glass without turning the tabs into mush over busy art. */
const DOCK_BLUR_INTENSITY = 60;

const STROKE_ACTIVE = 2.4;
const STROKE_INACTIVE = 1.75;

function TabButton({
  onPress,
  active,
  accessibilityLabel,
  testID,
  activeColor,
  inactiveColor,
  children,
}: {
  onPress: () => void;
  active: boolean;
  accessibilityLabel: string;
  testID: string;
  activeColor: string;
  inactiveColor: string;
  children: (color: string, strokeWidth: number) => React.ReactNode;
}) {
  return (
    <Touchable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      testID={testID}
      style={styles.tab}
      onPress={onPress}
      feedback="control"
    >
      {children(
        active ? activeColor : inactiveColor,
        active ? STROKE_ACTIVE : STROKE_INACTIVE
      )}
    </Touchable>
  );
}

function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { colors, isDarkMode } = useTheme();
  const themeColor = colors.themeColor;
  const translucent = useActiveTheme().components.dock === 'translucent';
  const { t } = useTranslation();

  // react-navigation only measures the tab bar it renders itself. A custom one
  // has to report its own height, or every consumer of
  // BottomTabBarHeightContext gets the library's estimate for a plain tab row
  // — which is nothing like this dock, since it carries the playing bar too.
  const onHeightChange = React.useContext(BottomTabBarHeightCallbackContext);
  // Toasts live above the navigator and cannot read its context, so the dock
  // tells them too — see `components/toast/clearance.ts`.
  React.useEffect(() => () => setToastClearance(null), []);
  const handleLayout = React.useCallback(
    (e: LayoutChangeEvent) => {
      onHeightChange?.(e.nativeEvent.layout.height);
      setToastClearance(e.nativeEvent.layout.height);
    },
    [onHeightChange]
  );

  const activeColor = themeColor;
  const inactiveColor = colors.subtext;

  // Each tab is a Stack group — `(home)`, `(search)`, `(library)`.
  const focusedRouteName = state.routes[state.index]?.name;

  const go = (name: string) => {
    const target = state.routes.find(r => r.name === name);
    if (!target) return;
    // Standard react-navigation tab-press semantics: if it's a jump between
    // tabs, navigate; if the user re-taps the current tab, popToTop so a
    // deep detail push goes back to the tab root.
    const event = navigation.emit({ type: 'tabPress', target: target.key, canPreventDefault: true });
    if (event.defaultPrevented) return;

    if (focusedRouteName !== name) {
      navigation.navigate(target.name as never);
      return;
    }

    // The event alone does not pop. The built-in tab bar pops in its own
    // onPress and only *notifies* through `tabPress`; a custom bar has to do
    // it itself. Without this, re-tapping the active tab from a pushed screen
    // did nothing at all — `useScrollToTop` listens to the same event but
    // no-ops unless the screen is already the first in its stack.
    //
    // The action has to be addressed to the *stack inside* this tab, by that
    // navigator's own state key. `target.key` is the tab route's key, which
    // belongs to no navigator, so the action goes unhandled — visibly, as a
    // red "POP_TO_TOP was not handled" box in development. The nested state is
    // undefined until that stack has rendered once, and a tab that has never
    // been opened has nothing to pop anyway.
    const nestedStackKey = target.state?.key;
    if (nestedStackKey) {
      navigation.dispatch({ ...StackActions.popToTop(), target: nestedStackKey });
    }
  };

  const rows = (
    // The surface below stays edge to edge; this is the column of controls on
    // it. Three tabs at `flex: 1` across a 1366pt iPad are three icons 455pt
    // apart, and the playing bar is a row like any other row — so both are
    // capped and centred together, as the two rows of one dock they are.
    <View style={styles.dockContent}>
      <PlayingBar />
      <View style={styles.tabRow}>
        <TabButton
          onPress={() => go('(home)')}
          active={focusedRouteName === '(home)'}
          accessibilityLabel={t('tabs.home')}
          testID="home-tab"
          activeColor={activeColor}
          inactiveColor={inactiveColor}
        >
          {(color, strokeWidth) => (
            <Home size={iconSize.header} color={color} strokeWidth={strokeWidth} />
          )}
        </TabButton>
        <TabButton
          onPress={() => go('(search)')}
          active={focusedRouteName === '(search)'}
          accessibilityLabel={t('tabs.search')}
          testID="search-tab"
          activeColor={activeColor}
          inactiveColor={inactiveColor}
        >
          {(color, strokeWidth) => (
            <Search size={iconSize.header} color={color} strokeWidth={strokeWidth} />
          )}
        </TabButton>
        <TabButton
          onPress={() => go('(library)')}
          active={focusedRouteName === '(library)'}
          accessibilityLabel={t('tabs.library')}
          testID="library-tab"
          activeColor={activeColor}
          inactiveColor={inactiveColor}
        >
          {(color, strokeWidth) => (
            <Library size={iconSize.header} color={color} strokeWidth={strokeWidth} />
          )}
        </TabButton>
      </View>
    </View>
  );

  const padding = { paddingBottom: Math.max(insets.bottom, 8) };

  // One surface, edge to edge. The now-playing row and the tab row are two
  // rows of the same dock rather than a card parked on a slab. The dock sits
  // a step above the page on the app's raised-surface colour, which is what
  // marks where content ends — a drawn hairline on top of a tonal change
  // would be saying the same thing twice.
  //
  // Translucent turns that surface into real glass: the navigator positions
  // the bar absolutely so content runs under it, and the blur has something
  // to blur. Screens reserve the height themselves via useScrollClearance.
  if (translucent) {
    return (
      <BlurView
        onLayout={handleLayout}
        intensity={DOCK_BLUR_INTENSITY}
        tint={isDarkMode ? 'dark' : 'light'}
        style={[styles.panel, styles.floating, padding]}
      >
        {rows}
      </BlurView>
    );
  }

  return (
    <View
      onLayout={handleLayout}
      style={[styles.panel, padding, { backgroundColor: colors.card }]}
    >
      {rows}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={props => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        freezeOnBlur: true,
        ...(Platform.OS === 'android' ? { tabBarStyle: { elevation: 0 } } : null),
      }}
    >
      <Tabs.Screen name="(home)" />
      <Tabs.Screen name="(search)" />
      <Tabs.Screen name="(library)" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  panel: {
    // In flow by default: react-navigation sizes the screens above it, so
    // they end at the dock's top edge without us duplicating the math.
  },
  floating: {
    // Taking the dock out of flow is what puts content behind the glass. The
    // slot react-navigation renders us into collapses to nothing, screens get
    // the full height, and the clearance hook gives their lists the room back.
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  dockContent: {
    width: '100%',
    maxWidth: contentWidth.readable,
    alignSelf: 'center',
  },
  tabRow: {
    flexDirection: 'row',
    paddingTop: spacing.md,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    justifyContent: 'center',
  },
});
