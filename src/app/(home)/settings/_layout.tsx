import { Stack } from 'expo-router';

export { default as ErrorBoundary } from '@/components/RouteErrorBoundary';

// Declares this stack's root. A deep link straight to a sub-page
// (/settings/serverView) pushes `index` underneath it first, so the back
// arrow always has somewhere to go — without it the header's router.back()
// would try to pop past the modal's own root.
export const unstable_settings = { anchor: 'index' };

/**
 * Every screen here draws its own header, so none of them carries a `title`:
 * eighteen hardcoded English ones sat in this file doing nothing, which is
 * eighteen strings that would have reached a French user the first time
 * anyone turned a header on.
 *
 * Settings lives on the root stack as a modal, not in the
 * `(home,search,library)` shared group — see `(home)/_layout.tsx`. That makes
 * it one instance for the whole app instead of one per tab.
 */
export default function SettingsLayout() {
    return (
        <Stack>
            <Stack.Screen name='index' options={{ headerShown: false }} />
            <Stack.Screen name='appearanceView' options={{ headerShown: false }} />
            <Stack.Screen name='libraryView' options={{ headerShown: false }} />
            <Stack.Screen name='homeView' options={{ headerShown: false }} />
            <Stack.Screen name='playerView' options={{ headerShown: false }} />
            <Stack.Screen name='equalizerView' options={{ headerShown: false }} />
            <Stack.Screen name='serverView' options={{ headerShown: false }} />
            <Stack.Screen name='connectionsView' options={{ headerShown: false }} />
            <Stack.Screen name='lidarrView' options={{ headerShown: false }} />
            <Stack.Screen name='slskdView' options={{ headerShown: false }} />
            <Stack.Screen name='soulsyncView' options={{ headerShown: false }} />
            <Stack.Screen name='downtifyView' options={{ headerShown: false }} />
            <Stack.Screen name='listenbrainzView' options={{ headerShown: false }} />
            <Stack.Screen name='scrobblingView' options={{ headerShown: false }} />
            <Stack.Screen name='listeningView' options={{ headerShown: false }} />
            <Stack.Screen name='pagesView' options={{ headerShown: false }} />
            <Stack.Screen name='searchView' options={{ headerShown: false }} />
            <Stack.Screen name='audiomuseView' options={{ headerShown: false }} />
            <Stack.Screen name='metadataView' options={{ headerShown: false }} />
        </Stack>
    );
}