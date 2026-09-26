import React, { useState } from 'react';
import { View, TextInput, ScrollView, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { notify } from '@/components/toast';
import { ChevronDown, Lock, LockOpen, Check } from 'lucide-react-native';
import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { ServerType } from '@/providers/contracts/Server';
import { useTranslation } from 'react-i18next';
import { renderBackdrop } from '@/components/BottomSheetBackdrop';
import { useSheetRef } from '@/components/useSheetRef';
import Touchable from '@/components/Touchable';
import SpinningLoaderCircle from '@/components/SpinningLoaderCircle';
import { getServerProvider } from '@/providers/registry/serverConnections';
import { iconSize, onDark, spacing, statusColor, typography, veil } from '@/constants/design';
import { useRadius } from '@/features/theme/useRadius';

type Scheme = 'https' | 'http';

export default function Address() {
    const { t } = useTranslation();
    const router = useRouter();
    const { type } = useLocalSearchParams<{ type: ServerType }>();
    const rad = useRadius();

    const [scheme, setScheme] = useState<Scheme>('https');
    const [host, setHost] = useState('');
    const [checking, setChecking] = useState(false);
    const [problem, setProblem] = useState<'unreachable' | 'notThisServer' | 'untrustedCertificate' | null>(null);
    const provider = type ? getServerProvider(type) : undefined;

    const schemeSheetRef = useSheetRef();
    const serverUrl = `${scheme}://${host.trim()}`;
    const goToCredentials = () => {
        setProblem(null);
        router.push({ pathname: '/(onboarding)/credentials', params: { type, serverUrl } });
    };

    // The address is asked about before the password is. A wrong address used
    // to surface only after credentials, as a sign-in failure that read like a
    // wrong password; the server's public endpoint can tell the two apart.
    const handleNext = async () => {
        if (!host.trim()) {
            notify.error(t('onboarding.address.enterUrl'));
            return;
        }
        if (checking) return;
        if (provider?.probeAddress) {
            setChecking(true);
            try {
                const result = await provider.probeAddress(serverUrl);
                if (result.kind !== 'ok') {
                    setProblem(result.kind);
                    return;
                }
            } finally {
                setChecking(false);
            }
        }
        goToCredentials();
    };

    return (
        <>
            <SafeAreaView style={styles.container}>
                {/* The column still fills the screen when it fits, so nothing
                    moves; it scrolls only once it cannot. A phone on its side is
                    390pt tall and the keyboard takes half of that, which used to
                    leave the button that moves the flow on below both. */}
                <ScrollView
                  contentContainerStyle={styles.form}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                    <View style={styles.mainContent}>
                        <Text style={styles.title}>{t('onboarding.address.title')}</Text>
                        <Text style={styles.subtitle}>{t('onboarding.address.subtitle')}</Text>

                        <View style={[styles.inputRow, { borderRadius: rad.md }]}>
                            <Touchable
                                style={styles.schemeButton}
                                onPress={() => schemeSheetRef.current?.present()}
                            >
                                <Text style={styles.schemeText}>{scheme}://</Text>
                                <ChevronDown size={iconSize.badge} color={onDark.mutedText} style={{ marginLeft: spacing.xs }} />
                            </Touchable>

                            <TextInput
                                style={styles.hostInput}
                                placeholder="your-server.com"
                                placeholderTextColor={onDark.mutedText}
                                value={host}
                                onChangeText={(text) => {
                                    setHost(text);
                                    setProblem(null);
                                }}
                                autoCapitalize="none"
                                autoCorrect={false}
                                keyboardAppearance="dark"
                                keyboardType="url"
                                returnKeyType="done"
                                onSubmitEditing={handleNext}
                                autoFocus
                            />
                        </View>

                        <Text style={styles.hint}>{t(provider?.addressHintKey ?? 'onboarding.address.hint')}</Text>

                        {problem && (
                            <View testID="address-problem" style={styles.problem}>
                                <Text style={styles.problemText}>
                                    {t(`onboarding.address.${problem}`, { server: provider?.label })}
                                </Text>
                                {/* The check can be wrong about an unusual setup, so it never has the last word. */}
                                <Touchable testID="address-continue-anyway" onPress={goToCredentials}>
                                    <Text style={styles.continueText}>{t('onboarding.address.continueAnyway')}</Text>
                                </Touchable>
                            </View>
                        )}
                    </View>

                    <View style={styles.buttonContainer}>
                        <Touchable
                            testID="address-next"
                            style={[styles.nextButton, { borderRadius: rad.pill }]}
                            onPress={() => void handleNext()}
                            disabled={checking}
                        >
                            {checking
                                ? <SpinningLoaderCircle size={iconSize.row} color={onDark.background} />
                                : <Text style={styles.nextButtonText}>{t('common.next')}</Text>}
                        </Touchable>

                        <Touchable style={[styles.backButton, { borderRadius: rad.pill }]} onPress={() => router.back()}>
                            <Text style={styles.backButtonText}>{t('common.back')}</Text>
                        </Touchable>
                    </View>
                </ScrollView>
            </SafeAreaView>

            <BottomSheetModal
                ref={schemeSheetRef}
                enableDynamicSizing
                enablePanDownToClose
                backdropComponent={renderBackdrop}
                stackBehavior="push"
                backgroundStyle={styles.sheetBackground}
                handleIndicatorStyle={styles.sheetHandle}
            >
                <BottomSheetView style={styles.sheetContent}>
                    <Text style={styles.sheetTitle}>{t('onboarding.address.schemeTitle')}</Text>

                    {(['https', 'http'] as Scheme[]).map((s) => {
                        const isSelected = scheme === s;
                        return (
                            <Touchable
                                key={s}
                                style={[styles.schemeOption, { borderRadius: rad.md }, isSelected && styles.schemeOptionSelected]}
                                onPress={() => {
                                    setScheme(s);
                                    setProblem(null);
                                    schemeSheetRef.current?.dismiss();
                                }}
                            >
                                <View style={styles.schemeOptionLeft}>
                                    {s === 'https'
                                      ? <Lock size={iconSize.row} color={isSelected ? onDark.text : onDark.mutedText} style={{ marginRight: spacing.controlGap }} />
                                      : <LockOpen size={iconSize.row} color={isSelected ? onDark.text : onDark.mutedText} style={{ marginRight: spacing.controlGap }} />
                                    }
                                    <View>
                                        <Text style={[styles.schemeOptionText, isSelected && styles.schemeOptionTextSelected]}>
                                            {s}
                                        </Text>
                                        <Text style={styles.schemeOptionDesc}>
                                            {s === 'https'
                                                ? t('onboarding.address.httpsDesc')
                                                : t('onboarding.address.httpDesc')}
                                        </Text>
                                    </View>
                                </View>
                                {isSelected && <Check size={iconSize.control} color={onDark.text} />}
                            </Touchable>
                        );
                    })}
                </BottomSheetView>
            </BottomSheetModal>
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: onDark.background,
    },
    /** What the `flex: 1` column was, as a scroll view's content. */
    form: {
        flexGrow: 1,
    },
    mainContent: {
        flexGrow: 1,
        paddingHorizontal: spacing.roomy,
        marginTop: spacing.xxxl,
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
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: onDark.muted,
        borderWidth: 1,
        borderColor: onDark.mutedText,
        paddingHorizontal: spacing.md,
        // A minimum: the field's text grows with the text size.
        minHeight: 50,
        marginBottom: spacing.controlGap,
    },
    schemeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingRight: spacing.sm,
        borderRightWidth: 1,
        borderRightColor: onDark.border,
        height: '100%',
    },
    schemeText: {
        ...typography.compactRowTitle,
        color: onDark.text,
    },
    hostInput: {
        ...typography.body,
        flex: 1,
        color: onDark.text,
        marginLeft: spacing.controlGap,
    },
    hint: {
        ...typography.caption,
        color: onDark.mutedText,
    },
    problem: {
        marginTop: spacing.md,
        gap: spacing.xs,
    },
    problemText: {
        ...typography.caption,
        color: statusColor.warningText,
    },
    continueText: {
        ...typography.caption,
        color: onDark.text,
        textDecorationLine: 'underline',
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
    nextButtonText: {
        ...typography.sheetTitle,
        color: onDark.background,
    },
    backButton: {
        backgroundColor: onDark.border,
        paddingVertical: spacing.lg,
        alignItems: 'center',
        width: '100%',
        marginBottom: spacing.xs,
    },
    backButtonText: {
        ...typography.sheetTitle,
        color: onDark.text,
    },
    sheetBackground: {
        backgroundColor: onDark.muted,
    },
    sheetHandle: {
        backgroundColor: onDark.mutedText,
    },
    sheetContent: {
        paddingHorizontal: spacing.roomy,
        paddingTop: spacing.controlGap,
    },
    sheetTitle: {
        ...typography.sheetTitle,
        color: onDark.text,
        marginBottom: spacing.controlGap,
    },
    schemeOption: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
    },
    schemeOptionSelected: {
        backgroundColor: veil.field,
    },
    schemeOptionLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    schemeOptionText: {
        ...typography.rowTitle,
        color: onDark.subtext,
    },
    schemeOptionTextSelected: {
        color: onDark.text,
        fontWeight: '600',
    },
    schemeOptionDesc: {
        ...typography.caption,
        color: onDark.mutedText,
        marginTop: spacing.xxs,
    },
});
