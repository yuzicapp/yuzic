import { fixedColor, hitSlopFor, iconSize, onDark, spacing, typography } from '@/constants/design';
import React from 'react';
import { View, StyleSheet, Platform, FlatList, Alert } from 'react-native';
import { Text } from '@/components/Text';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '@/state/redux/store';
import {
    setActiveServer,
    removeServer,
} from '@/state/redux/slices/serversSlice';
import { clearOfflineMutationsForServer } from '@/state/redux/slices/offlineMutationsSlice';
import { Ellipsis } from 'lucide-react-native';

import { SERVER_PROVIDERS } from '@/providers/registry/serverConnections';
import { forgetAllServerCredentials } from '@/providers/registry/serverCredentials';
import { Server } from '@/providers/contracts/Server';
import { useTranslation } from 'react-i18next';
import Touchable from '@/components/Touchable';
import { useRadius } from '@/features/theme/useRadius';
import { selectOnboardingDiscoveryPrompted } from '@/features/settings/onboarding/state';
import ServerTypeIcon from '@/features/onboarding/ServerTypeIcon';

export default function Servers() {
    const { t } = useTranslation();
    const router = useRouter();
    const dispatch = useDispatch();
    const rad = useRadius();
    const onboardingDiscoveryPrompted = useSelector(selectOnboardingDiscoveryPrompted);

    const servers = useSelector((state: RootState) => state.servers.servers);
    const activeServerId = useSelector(
        (state: RootState) => state.servers.activeServerId
    );

    const handleSelectServer = (id: string) => {
        dispatch(setActiveServer(id));
        router.replace(
            onboardingDiscoveryPrompted
                ? '/(home)/(tabs)/(home)'
                : '/(onboarding)/discovery'
        );
    };

    const handleAddServer = () => {
        router.push('/(onboarding)/connect');
    };

    const confirmDelete = (id: string, serverUrl: string) => {
        Alert.alert(
            t('onboarding.servers.deleteTitle'),
            t('onboarding.servers.deleteBody', { server: serverUrl.replace(/^https?:\/\//, '') }),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('common.delete'),
                    style: 'destructive',
                    onPress: () => {
                        // Otherwise these become permanently invisible and
                        // permanently un-retryable: PendingOfflineChanges only
                        // ever shows entries for the current activeServerId,
                        // which this server can never be again.
                        dispatch(clearOfflineMutationsForServer(id));
                        dispatch(removeServer(id));
                        void forgetAllServerCredentials(id);
                    },
                },
            ]
        );
    };

    const renderServer = ({ item }: { item: Server }) => {
        const isActive = item.id === activeServerId;
        const icon = SERVER_PROVIDERS[item.type]?.icon;

        return (
            <View style={[styles.serverCard, { borderRadius: rad.card }]}>
                <Touchable
                    style={styles.serverInfo}
                    onPress={() => handleSelectServer(item.id)}
                >
                    <ServerTypeIcon
                        icon={icon}
                        size={iconSize.providerLogo}
                        color={onDark.text}
                        style={styles.serverIcon}
                    />

                    <View style={styles.textContainer}>
                        <Text style={styles.serverName}>
                            {item.serverUrl.replace(/^https?:\/\//, '')}
                        </Text>

                        <View style={styles.subRow}>
                            <Text style={styles.serverSubtext}>
                                {item.username}
                            </Text>

                            {isActive && (
                                <View style={[styles.activeBadge, { borderRadius: rad.pill }]}>
                                    <Text style={styles.activeBadgeText}>
                                        {t('onboarding.servers.active')}
                                    </Text>
                                </View>
                            )}
                        </View>
                    </View>
                </Touchable>

                <Touchable
                    accessibilityRole="button"
                    accessibilityLabel={t('a11y.onboarding.serverOptions', { url: item.serverUrl })}
                    style={[styles.menuButton, { borderRadius: rad.md }]}
                    hitSlop={hitSlopFor(iconSize.row)}
                    onPress={() => confirmDelete(item.id, item.serverUrl)}
                >
                    <Ellipsis size={iconSize.row} color={onDark.mutedText} />
                </Touchable>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <Text style={styles.title}>{t('onboarding.servers.title')}</Text>
                <Text style={styles.subtitle}>
                    {t('onboarding.servers.subtitle')}
                </Text>

                <FlatList
                    data={servers}
                    keyExtractor={(item) => item.id}
                    renderItem={renderServer}
                    ListEmptyComponent={
                        <Text style={styles.emptyText}>
                            {t('onboarding.servers.empty')}
                        </Text>
                    }
                    contentContainerStyle={{
                        paddingTop: spacing.roomy,
                        paddingBottom: spacing.roomy,
                    }}
                />
            </View>

            <View style={styles.bottomContent}>
                <Touchable
                    style={[
                        styles.addButton,
                        { borderRadius: rad.pill },
                    ]}
                    onPress={handleAddServer}
                >
                    <Text style={styles.addButtonText}>{t('onboarding.servers.add')}</Text>
                </Touchable>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: onDark.background,
        paddingHorizontal: spacing.roomy,
        justifyContent: 'space-between',
    },
    content: {
        flex: 1,
        paddingTop: spacing.xxl,
    },
    title: {
        ...typography.display,
        color: onDark.text,
        marginBottom: spacing.sm,
    },
    subtitle: {
        ...typography.body,
        color: onDark.subtext,
    },

    serverCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: onDark.surface,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        marginBottom: spacing.controlGap,
    },

    serverInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        paddingRight: spacing.md,
    },

    serverIcon: {
        width: 36,
        height: 36,
        marginRight: spacing.md,
    },

    textContainer: {
        flex: 1,
    },

    serverName: {
        ...typography.body,
        color: onDark.text,
        marginBottom: spacing.xs,
    },

    subRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },

    serverSubtext: {
        ...typography.caption,
        color: onDark.mutedText,
    },

    activeBadge: {
        backgroundColor: fixedColor.onboardingBlue,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xxs,
    },

    activeBadgeText: {
        ...typography.micro,
        fontWeight: '600',
        color: onDark.text,
    },

    menuButton: {
        padding: spacing.tight,
    },

    emptyText: {
        ...typography.rowSubtitle,
        textAlign: 'center',
        color: onDark.mutedText,
        marginTop: spacing.xxxl,
    },

    bottomContent: {
        marginBottom: Platform.OS === 'ios' ? spacing.xxxl : spacing.roomy,
    },

    addButton: {
        backgroundColor: onDark.text,
        paddingVertical: spacing.lg,
        alignItems: 'center',
        width: '100%',
        marginBottom: spacing.md,
    },

    addButtonText: {
        ...typography.sheetTitle,
        color: onDark.background,
    },
});
