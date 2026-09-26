import { iconSize, onDark, spacing, stateLayer, typography } from '@/constants/design';
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text } from '@/components/Text';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { notify } from '@/components/toast';
import { nanoid } from '@reduxjs/toolkit';
import { addServer, setActiveServer } from '@/state/redux/slices/serversSlice';
import { useDispatch, useSelector } from 'react-redux';
import { ServerType } from '@/providers/contracts/Server';
import { SERVER_PROVIDERS } from '@/providers/registry/serverConnections';
import { saveServerCredentials } from '@/providers/registry/serverCredentials';
import { useTranslation } from 'react-i18next';
import SpinningLoaderCircle from '@/components/SpinningLoaderCircle';
import Touchable from '@/components/Touchable';
import { useRadius } from '@/features/theme/useRadius';
import { selectOnboardingDiscoveryPrompted } from '@/features/settings/onboarding/state';
import ServerTypeIcon from '@/features/onboarding/ServerTypeIcon';

export default function Connect() {
    const [selectedType, setSelectedType] = useState<ServerType | null>(null);
    const [isLayoutMounted, setIsLayoutMounted] = useState(false);
    const [isTesting, setIsTesting] = useState(false);

    const { t } = useTranslation();
    const router = useRouter();
    const dispatch = useDispatch();
    const rad = useRadius();
    const onboardingDiscoveryPrompted = useSelector(selectOnboardingDiscoveryPrompted);

    useEffect(() => {
        const timer = setTimeout(() => setIsLayoutMounted(true), 0);
        return () => clearTimeout(timer);
    }, []);

    const handleNext = () => {
        if (!selectedType) {
            notify.error(t('onboarding.connect.selectTypeFirst'));
            return;
        }
        if (selectedType === 'local') {
            const id = nanoid();
            dispatch(addServer({
                id,
                type: 'local',
                // A local server still occupies the normal Server record; this
                // stable pseudo-URL is display-only and never fetched.
                serverUrl: 'local://device',
                username: t('onboarding.local.libraryName'),
                auth: {},
                isAuthenticated: true,
            }));
            dispatch(setActiveServer(id));
            router.push('/(onboarding)/local' as never);
            return;
        }
        router.push({
            pathname: '/(onboarding)/address',
            params: { type: selectedType },
        });
    };

    const handleDemo = async () => {
        if (!selectedType) return;
        const provider = SERVER_PROVIDERS[selectedType];
        if (!provider.capabilities.supportsDemo || !provider.demo) {
            notify.error(t('onboarding.connect.demoUnavailableProvider'));
            return;
        }
        setIsTesting(true);
        try {
            const demo = await provider.demo();
            const id = nanoid();
            const sanitized = await saveServerCredentials(id, demo.auth, undefined);
            dispatch(addServer({
                id,
                type: selectedType,
                serverUrl: demo.serverUrl,
                username: demo.username,
                auth: sanitized.auth,
                isAuthenticated: true,
            }));
            dispatch(setActiveServer(id));
            router.replace(
                onboardingDiscoveryPrompted
                    ? '/(home)/(tabs)/(home)'
                    : '/(onboarding)/discovery'
            );
        } catch {
            notify.error(t('onboarding.connect.connectError'));
        } finally {
            setIsTesting(false);
        }
    };

    if (!isLayoutMounted) {
        return (
            <View style={styles.loadingContainer}>
                <SpinningLoaderCircle size={iconSize.loader} color={onDark.mutedText} />
            </View>
        );
    }

    const providers = Object.values(SERVER_PROVIDERS);

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
            >
                <Text style={styles.title}>{t('onboarding.connect.title')}</Text>
                <Text style={styles.subtitle}>{t('onboarding.connect.subtitle')}</Text>

                <View style={styles.serverTypeContainer}>
                    {providers.map((provider) => {
                        const isSelected = selectedType === provider.type;
                        return (
                            <Touchable
                                key={provider.type}
                                onPress={() => setSelectedType(provider.type)}
                                style={[
                                    styles.serverTypeButton,
                                    { borderRadius: rad.card },
                                    isSelected && styles.serverTypeButtonSelected,
                                ]}
                            >
                                <ServerTypeIcon
                                    icon={provider.icon}
                                    size={iconSize.providerLogo}
                                    color={onDark.text}
                                    style={{ marginBottom: spacing.tight }}
                                />
                                <Text
                                    style={[
                                        styles.serverTypeText,
                                        isSelected && styles.serverTypeTextSelected,
                                    ]}
                                >
                                    {provider.label}
                                </Text>
                            </Touchable>
                        );
                    })}
                </View>

                {selectedType && (
                    <Text style={styles.description}>
                        {t(`onboarding.connect.providerDescription.${selectedType}`)}
                    </Text>
                )}
            </ScrollView>

            <View style={styles.buttonContainer}>
                <Touchable
                    style={[styles.nextButton, { borderRadius: rad.pill }, isTesting && styles.buttonDisabled]}
                    onPress={handleNext}
                    disabled={isTesting}
                >
                    {isTesting ? (
                        <SpinningLoaderCircle size={iconSize.row} color={onDark.background} />
                    ) : (
                        <Text style={styles.nextButtonText}>{t('common.next')}</Text>
                    )}
                </Touchable>

                <Touchable
                    style={[
                        styles.demoButton,
                        { borderRadius: rad.pill },
                        (!selectedType || !SERVER_PROVIDERS[selectedType]?.capabilities.supportsDemo || isTesting) && styles.buttonDisabled,
                    ]}
                    onPress={handleDemo}
                    disabled={!selectedType || !SERVER_PROVIDERS[selectedType]?.capabilities.supportsDemo || isTesting}
                >
                    <Text style={styles.demoButtonText}>
                        {selectedType && SERVER_PROVIDERS[selectedType]?.capabilities.supportsDemo
                            ? t('onboarding.connect.useDemo', { provider: SERVER_PROVIDERS[selectedType].label })
                            : t('onboarding.connect.demoUnavailable')}
                    </Text>
                </Touchable>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: onDark.background,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: onDark.background,
    },
    scroll: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: spacing.roomy,
        paddingTop: spacing.xxxl,
        paddingBottom: spacing.roomy,
    },
    title: {
        ...typography.display,
        color: onDark.text,
        marginBottom: spacing.controlGap,
    },
    subtitle: {
        ...typography.body,
        color: onDark.mutedText,
        marginBottom: spacing.roomy,
    },
    description: {
        color: onDark.subtext,
        marginBottom: spacing.roomy,
        marginTop: spacing.sm,
    },
    serverTypeContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.rowGap,
        marginBottom: spacing.xs,
    },
    serverTypeButton: {
        flexGrow: 1,
        flexBasis: '28%',
        paddingVertical: spacing.md,
        borderWidth: 1,
        borderColor: onDark.mutedText,
        backgroundColor: onDark.surface,
        alignItems: 'center',
        justifyContent: 'center',
    },
    serverTypeButtonSelected: {
        borderColor: onDark.text,
        backgroundColor: onDark.text,
    },
    serverTypeText: {
        ...typography.label,
        color: onDark.text,
        marginTop: spacing.tight,
    },
    serverTypeTextSelected: {
        color: onDark.background,
    },
    buttonContainer: {
        padding: spacing.roomy,
        backgroundColor: onDark.background,
        alignItems: 'center',
    },
    nextButton: {
        backgroundColor: onDark.text,
        paddingVertical: spacing.lg,
        alignItems: 'center',
        width: '100%',
        marginBottom: spacing.md,
    },
    buttonDisabled: {
        opacity: stateLayer.pressedOpacity,
    },
    nextButtonText: {
        ...typography.sheetTitle,
        color: onDark.background,
    },
    demoButton: {
        backgroundColor: onDark.border,
        paddingVertical: spacing.lg,
        alignItems: 'center',
        width: '100%',
        marginBottom: spacing.xs,
    },
    demoButtonText: {
        ...typography.sheetTitle,
        color: onDark.text,
    },
});
