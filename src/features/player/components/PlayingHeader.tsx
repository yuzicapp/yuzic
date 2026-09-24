import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Ellipsis } from 'lucide-react-native';

import Touchable from '@/components/Touchable';
import { hitSlopFor, iconSize, onDark, spacing } from '@/constants/design';
import SleepTimerIndicator from './SleepTimerIndicator';

/**
 * The player's top row: close on the left, sleep timer and ⋯ on the right.
 *
 * Its own component because `PlayingScreen` is held to a size limit by the
 * file-shape gate, and this is the part of it that says the least about how
 * the player works — a row of two controls, with no state of its own.
 */
const PlayingHeader: React.FC<{
    /** The safe-area inset the row sits below. */
    paddingTop: number;
    /**
     * The step down to the content under it: tight in a landscape or inline
     * layout where the room is sideways, generous when a screen of height
     * follows.
     */
    paddingBottom: number;
    onClose: () => void;
    onOpenSleepTimer: () => void;
    onOpenSongOptions: () => void;
}> = ({ paddingTop, paddingBottom, onClose, onOpenSleepTimer, onOpenSongOptions }) => {
    const { t } = useTranslation();

    return (
        <View style={[styles.header, { paddingTop, paddingBottom }]}>
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

            {/* A running sleep timer says so beside the ⋯ that sets it, rather
                than adding a third control to the transport row. */}
            <View style={styles.headerRight}>
                <SleepTimerIndicator onPress={onOpenSleepTimer} />

                <Touchable
                    accessibilityRole="button"
                    accessibilityLabel={t('a11y.player.songOptions')}
                    onPress={onOpenSongOptions}
                    style={styles.headerButton}
                    hitSlop={hitSlopFor(40)}
                >
                    <Ellipsis size={iconSize.header} color={onDark.text} />
                </Touchable>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
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
});

export default PlayingHeader;
