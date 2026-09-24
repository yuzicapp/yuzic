import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePlayingState, usePlayingProgress } from '@/features/playback/PlayingContext';
import { useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { selectShowPlaybackSpeed, selectShowVolumeSlider } from '@/features/settings/playback/state';
import { useSongScreenModel, type SongScreenModel } from '@/features/song/useSongScreenModel';
import type { LyricsResult } from '@/providers/contracts/ServerAdapter';
import SongOptions from '@/components/options/SongOptions';
import Queue from './components/Queue';
import Animated, { useAnimatedScrollHandler } from 'react-native-reanimated';
import { GestureDetector } from 'react-native-gesture-handler';
import { usePlayerExpansion } from '@/features/player/PlayerExpansion';
import PlaylistList from '@/components/PlaylistList';
import PlayingMain from './components/PlayingMain';
import Controls from './components/Controls';
import BottomControls from './components/BottomControls';
import LyricsBottomSheet from './components/LyricsBottomSheet';
import LyricsPreviewCard from './components/LyricsPreviewCard';
import OutputDeviceSheet from './components/OutputDeviceSheet';
import AboutTheArtistCard from './components/AboutTheArtistCard';
import SleepTimerSheet from './components/SleepTimerSheet';
import SleepTimerIndicator from './components/SleepTimerIndicator';
import { setSleepTimerPlaybackRate } from './sleepTimer';
import PlaybackSpeedCard from './components/PlaybackSpeedCard';
import VolumeCard from './components/VolumeCard';
import { useDragToClose } from './useDragToClose';
import { usePlayingTransitions, type PlayingViewMode } from './usePlayingTransitions';
import { ChevronDown, Ellipsis } from 'lucide-react-native';
import { useSheetRef } from '@/components/useSheetRef';
import Touchable from '@/components/Touchable';
import { contentWidth, hitSlopFor, iconSize, onDark, spacing } from '@/constants/design';
import { useWindowLayout } from '@/features/layout/useWindowLayout';
import { cappedContentWidth } from '@/features/layout/windowClass';
import { playerLayout } from './playerLayout';
import { useActiveTheme } from '@/features/theme/useActiveTheme';

interface PlayingScreenProps {
    onClose: () => void;
}

// Isolated so the once-a-second progress tick only re-renders this small
// card, not the whole PlayingScreen tree (header, PlayingMain, Controls,
// BottomControls, and the other cards) — that tree stays mounted the entire
// time a song is playing, hidden behind the collapsed player sheet, so an
// unnecessary full re-render every second was a constant, avoidable cost.
const LyricsPreviewCardResolver: React.FC<{
    lyrics: LyricsResult;
    contentWidth: number;
    onPress: () => void;
}> = ({ lyrics, contentWidth, onPress }) => {
    const progress = usePlayingProgress();
    return (
        <LyricsPreviewCard
            lyrics={lyrics}
            position={progress.position}
            contentWidth={contentWidth}
            onPress={onPress}
        />
    );
};

const PlayingScreen: React.FC<PlayingScreenProps> = ({
    onClose,
}) => {
    const { t } = useTranslation();
    const router = useRouter();
    const { currentSong, playbackSpeed } = usePlayingState();
    const insets = useSafeAreaInsets();
    const songModel: SongScreenModel = useSongScreenModel(currentSong);
    const { artistId, lyrics, lyricsAvailable } = songModel;

    const songOptionsRef = useSheetRef();
    const playlistRef = useSheetRef();
    const lyricsSheetRef = useSheetRef();
    const outputDeviceSheetRef = useSheetRef();
    const sleepTimerSheetRef = useSheetRef();

    // "End of track" is measured in the listener's time, not the track's.
    useEffect(() => { setSleepTimerPlaybackRate(playbackSpeed); }, [playbackSpeed]);

    const { expansion, scrollY, coverVisibility, isOpen } = usePlayerExpansion();

    const handleScroll = useAnimatedScrollHandler(event => {
        scrollY.value = event.contentOffset.y;
    });

    const [mode, setMode] = useState<PlayingViewMode>("player");
    // The queue is a whole draggable list — a gesture handler and a reanimated
    // context per row — and it used to mount with the player whether or not
    // anyone asked for it, on a screen whose mount time is what the user feels
    // when they tap the playing bar. Mount it the first time the queue is
    // actually opened; after that it stays, so the crossfade back and forth
    // costs nothing.
    const [queueMounted, setQueueMounted] = useState(false);
    const { playerStyle, queueStyle } =
        usePlayingTransitions(mode, coverVisibility);

    // The player screen is kept mounted between openings, so without this the
    // next tap on the bar would reopen it on whatever was last on screen —
    // the queue, with its cover hidden, which is not what tapping the artwork
    // in the dock asks for. Snap rather than fade: by the time the player is
    // closed the cover is already undrawn, and it has to be back before the
    // next drag lifts it out of the bar.
    useEffect(() => {
        if (isOpen) return;
        setMode("player");
        coverVisibility.value = 1;
    }, [isOpen, coverVisibility]);

    const changeMode = useCallback((next: PlayingViewMode) => {
        if (next === "queue") setQueueMounted(true);
        setMode(next);
    }, []);

    const { width, height, landscape } = useWindowLayout();
    const variant = useActiveTheme().components.playerLayout;
    const layout = playerLayout({ width, height, landscape }, variant);
    // Everything under the player — the lyrics preview, the speed and volume
    // cards, the artist card — lines up with the player above it, which in
    // the split shape is the cover and the column together rather than just
    // the column.
    const columnWidth = layout.rowWidth;
    const queueWidth = cappedContentWidth(width - spacing.xl, contentWidth.readable);
    // The full player fills the first screen and the rest waits below it. The
    // compact one is only as tall as it is, so the lyrics preview and the
    // cards follow straight on: that is what a smaller cover is for.
    const playerMinHeight = variant === 'compact' ? undefined : height - insets.top - insets.bottom;

    const dragToClose = useDragToClose(expansion, scrollY, height);

    const showPlaybackSpeed = useSelector(selectShowPlaybackSpeed);
    const showVolumeSlider = useSelector(selectShowVolumeSlider);

    const navigateToArtist = useCallback(() => {
        if (artistId) {
            onClose();
            router.push({
                pathname: '/artistView',
                params: { id: artistId },
            });
        }
    }, [artistId, onClose, router]);

    const openLyricsSheet = useCallback(() => {
        if (lyricsAvailable && lyrics) {
            lyricsSheetRef.current?.present();
        }
    }, [lyricsAvailable, lyrics, lyricsSheetRef]);

    if (!currentSong) {
        return <View style={{ flex: 1, backgroundColor: onDark.background }} />;
    }

    return (
        <View testID="playing-screen" style={styles.gradientContainer}>
            <View style={styles.container}>
                <View style={styles.playerArea}>

                    {/*
                      Only while the player is open. The screen mounts early,
                      before it is first opened, and stays mounted after it
                      closes, so an unconditional light bar outranked the app's
                      own and left white icons on every light screen whenever a
                      track was loaded. Unmounted, the bar falls back to the
                      app's own style.
                    */}
                    {isOpen && (
                        <StatusBar
                            barStyle="light-content"
                            backgroundColor="transparent"
                            translucent
                        />
                    )}
                    {queueMounted && (
                        <Animated.View
                            style={[queueStyle, { alignItems: 'center', justifyContent: 'flex-start' }]}
                            pointerEvents={mode === "queue" ? 'auto' : 'none'}
                        >
                            <Queue
                                onBack={() => changeMode("player")}
                                width={queueWidth}
                            />
                        </Animated.View>
                    )}

                    <Animated.View
                        style={[playerStyle, { flex: 1, width: '100%' }]}
                        pointerEvents={mode === "player" ? 'auto' : 'none'}
                    >
                        <GestureDetector gesture={dragToClose}>
                        <Animated.ScrollView
                            onScroll={handleScroll}
                            scrollEventThrottle={16}
                            // An iOS rubber-band at the top would be competing
                            // with the drag that collapses the player, and the
                            // two together read as neither working.
                            bounces={false}
                            style={styles.scrollView}
                            contentContainerStyle={[
                                styles.scrollContent,
                                { paddingBottom: insets.bottom + (lyricsAvailable ? 100 : 24) },
                            ]}
                            showsVerticalScrollIndicator={false}
                        >
                            <View style={[styles.playerSection, { minHeight: playerMinHeight }]}>
                                {/* The 40pt step under the header is right
                                    when there is a screen of height beneath
                                    it and a quarter of a landscape window
                                    when there is not. */}
                                <View
                                    style={[
                                        styles.header,
                                        {
                                            paddingTop: insets.top,
                                            paddingBottom: landscape || layout.inline || layout.bleed ? spacing.md : spacing.xxxl,
                                        },
                                    ]}
                                >
                                    <Touchable
                                        testID="playing-close"
                                        accessibilityRole="button"
                                        accessibilityLabel={t('a11y.player.close')}
                                        onPress={onClose}
                                        style={styles.headerButton}
                                        hitSlop={hitSlopFor(40)}
                                    >
                                        <ChevronDown size={iconSize.large} color={onDark.text} />
                                    </Touchable>

                                    {/* A running sleep timer says so beside the
                                        ⋯ that sets it, rather than adding a
                                        third control to the transport row. */}
                                    <View style={styles.headerRight}>
                                        <SleepTimerIndicator
                                            onPress={() => sleepTimerSheetRef.current?.present()}
                                        />

                                        <Touchable
                                            accessibilityRole="button"
                                            accessibilityLabel={t('a11y.player.songOptions')}
                                            onPress={() => songOptionsRef.current?.present()}
                                            style={styles.headerButton}
                                            hitSlop={hitSlopFor(40)}
                                        >
                                            <Ellipsis size={iconSize.header} color={onDark.text} />
                                        </Touchable>
                                    </View>
                                </View>

                                <View style={layout.inline ? styles.topContent : styles.centerContent}>
                                    <PlayingMain
                                        layout={layout}
                                        onPressArtist={navigateToArtist}
                                        onPressOptions={() => songOptionsRef.current?.present()}
                                        onPressAdd={() => playlistRef.current?.present()}
                                    >
                                        <Controls />
                                    </PlayingMain>
                                </View>

                                <View
                                    style={[
                                        styles.bottomControlsRow,
                                        {
                                            width: columnWidth,
                                            paddingBottom: insets.bottom + spacing.md,
                                        },
                                    ]}
                                >
                                    <BottomControls
                                        mode={mode}
                                        setMode={changeMode}
                                        onOpenOutputSheet={() => outputDeviceSheetRef.current?.present()}
                                    />
                                </View>
                            </View>

                            {/* The preview card exists to follow the current
                                line, which unsynced lyrics have no notion of —
                                they open in the sheet from the player's own
                                control instead. */}
                            {lyricsAvailable && lyrics?.synced && (
                                <LyricsPreviewCardResolver
                                    lyrics={lyrics}
                                    contentWidth={columnWidth}
                                    onPress={openLyricsSheet}
                                />
                            )}

                            {showPlaybackSpeed && (
                                <PlaybackSpeedCard contentWidth={columnWidth} />
                            )}

                            {showVolumeSlider && (
                                <VolumeCard contentWidth={columnWidth} />
                            )}

                            <AboutTheArtistCard
                                artistName={currentSong.artist.name}
                                artistCover={currentSong.artist.cover}
                                contentWidth={columnWidth}
                                onPress={artistId ? navigateToArtist : undefined}
                            />
                        </Animated.ScrollView>
                        </GestureDetector>
                    </Animated.View>

                </View>
            </View>
            <SongOptions
                ref={songOptionsRef}
                selectedSong={currentSong}
                onAddToPlaylist={() => playlistRef.current?.present()}
                onSleepTimer={() => sleepTimerSheetRef.current?.present()}
                onNavigate={onClose}
            />

            <PlaylistList
                ref={playlistRef}
                selectedSong={currentSong}
                onClose={() => playlistRef.current?.dismiss()}
            />

            <LyricsBottomSheet
                ref={lyricsSheetRef}
                lyrics={lyrics}
                onClose={() => lyricsSheetRef.current?.dismiss()}
            />

            <OutputDeviceSheet ref={outputDeviceSheetRef} />

            <SleepTimerSheet ref={sleepTimerSheetRef} />
        </View>
    );
};

const styles = StyleSheet.create({
    gradientContainer: {
        flex: 1,
    },
    playerArea: {
        flex: 1,
        width: '100%',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        alignItems: 'center',
    },
    playerSection: {
        width: '100%',
        alignItems: 'center',
    },
    centerContent: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    // The compact player starts under the header rather than floating in the
    // middle of a screen it no longer fills.
    topContent: {
        alignItems: 'center',
    },
    container: {
        flex: 1,
        alignItems: 'center',
    },
    header: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
    },
    headerButton: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    bottomControlsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        // A step below the transport row, not crowded under it: 12pt left the
        // pair reading as part of the play button's row while carrying twice
        // that much empty space beneath them. `justifyContent` was
        // `space-between` over a single flex child, which is the shape this
        // row had before the two controls became a centred cluster.
        paddingTop: spacing.xl,
    },
});

export default PlayingScreen;
