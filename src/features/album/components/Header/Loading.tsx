import React from 'react';
import {
    View,
    StyleSheet,
} from 'react-native';
import { Skeleton } from 'moti/skeleton';
import { useTheme } from '@/features/theme/useTheme';
import { radius, controlSize, spacing } from '@/constants/design';
import { useRadius } from '@/features/theme/useRadius';

const LoadingAlbumHeader: React.FC = () => {
    const { isDarkMode } = useTheme();
    const rad = useRadius();

    const colorMode = isDarkMode ? 'dark' : 'light';

    return (
        <View style={styles.container}>
            <View style={styles.headerRow}>
                <Skeleton
                    width={24}
                    height={24}
                    radius={radius.xs}
                    colorMode={colorMode}
                />

                {/* Download button */}
                <Skeleton
                    width={24}
                    height={24}
                    radius={radius.xs}
                    colorMode={colorMode}
                />
            </View>

            {/* Cover art */}
            <View style={[styles.coverWrapper, { borderRadius: rad.lg }]}>
                <Skeleton
                    width={280}
                    height={280}
                    radius={rad.lg}
                    colorMode={colorMode}
                />
            </View>

            {/* Title + metadata */}
            <View style={styles.titleInfo}>
                <Skeleton
                    width="70%"
                    height={24}
                    radius={rad.thumb}
                    colorMode={colorMode}
                />

                <View style={styles.metaRow}>
                    <View style={styles.artistRow}>
                        <Skeleton
                            width={20}
                            height={20}
                            radius={rad.pill}
                            colorMode={colorMode}
                        />
                        <View style={{ width: 8 }} />
                        <Skeleton
                            width={120}
                            height={14}
                            radius={rad.thumb}
                            colorMode={colorMode}
                        />
                    </View>
                    <View style={{ width: 8 }} />
                    <Skeleton
                        width={150}
                        height={14}
                        radius={rad.thumb}
                        colorMode={colorMode}
                    />
                </View>
            </View>

            <View style={styles.actionsRow}>
                <View style={styles.actions}>
                    <Skeleton
                        width={controlSize.detailSecondary}
                        height={controlSize.detailSecondary}
                        radius={rad.pillFor(controlSize.detailSecondary)}
                        colorMode={colorMode}
                    />
                    <Skeleton
                        width={controlSize.detailPrimaryWidth}
                        height={controlSize.detailPrimaryHeight}
                        radius={rad.pillFor(controlSize.detailPrimaryHeight)}
                        colorMode={colorMode}
                    />
                    <Skeleton
                        width={controlSize.detailSecondary}
                        height={controlSize.detailSecondary}
                        radius={rad.pillFor(controlSize.detailSecondary)}
                        colorMode={colorMode}
                    />
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingTop: spacing.headerOffset,
        paddingHorizontal: spacing.lg,
        alignItems: 'center',
    },
    headerRow: {
        position: 'absolute',
        top: 16,
        left: 0,
        right: 0,
        zIndex: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
    },
    coverWrapper: {
        width: 280,
        height: 280,
        marginTop: spacing.xxl,
        marginBottom: spacing.xl,
        overflow: 'hidden',
    },
    titleInfo: {
        width: '100%',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    artistRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: spacing.tight,
    },
    actionsRow: {
        width: '100%',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.controlGap,
    },
});

export default LoadingAlbumHeader;