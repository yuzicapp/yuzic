import { iconSize, onDark, spacing, statusColor } from '@/constants/design';
import { styles } from './styles';
import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { Text } from '@/components/Text';
import { User, Lock, Shield, ChevronUp, ChevronDown, TriangleAlert, QrCode, ChevronRight } from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch } from 'react-redux';
import { addServer, setActiveServer } from '@/state/redux/slices/serversSlice';
import { notify } from '@/components/toast';
import { nanoid } from '@reduxjs/toolkit';
import { SERVER_PROVIDERS } from '@/providers/registry/serverConnections';
import { saveServerCredentials } from '@/providers/registry/serverCredentials';
import { ServerType, BasicAuth, type ProviderAuth } from '@/providers/contracts/Server';
import { useTranslation } from 'react-i18next';
import SpinningLoaderCircle from '@/components/SpinningLoaderCircle';
import Touchable from '@/components/Touchable';
import { useRadius } from '@/features/theme/useRadius';
import { useCodeAuth } from './useCodeAuth';

export default function Credentials() {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const router = useRouter();
    const rad = useRadius();

    const params = useLocalSearchParams<{ type: ServerType; serverUrl: string }>();
    const { type, serverUrl } = params;

    const [localUsername, setLocalUsername] = useState('');
    const [localPassword, setLocalPassword] = useState('');
    const [isTesting, setIsTesting] = useState(false);

    const [proxyExpanded, setProxyExpanded] = useState(false);
    const [proxyUsername, setProxyUsername] = useState('');
    const [proxyPassword, setProxyPassword] = useState('');

    const passwordRef = useRef<TextInput>(null);
    const proxyUsernameRef = useRef<TextInput>(null);
    const proxyPasswordRef = useRef<TextInput>(null);

    const buildBasicAuth = (): BasicAuth | undefined => {
        const u = proxyUsername.trim();
        const p = proxyPassword.trim();
        return u && p ? { username: u, password: p } : undefined;
    };

    // Whether this provider can sign in by code at all. Presence-gated, so a
    // provider that gains the flow gets the row with no change to this screen
    // and one that lacks it never renders it.
    const codeAuth = type ? SERVER_PROVIDERS[type]?.codeAuth : undefined;
    const { phase, start: startCodeAuth, cancel: cancelCodeAuth } = useCodeAuth({
        codeAuth,
        serverUrl,
        basicAuth: buildBasicAuth(),
    });

    const inCodeAuth = phase.status !== 'idle';

    const insecureWithProxy =
        proxyUsername.trim().length > 0 &&
        typeof serverUrl === 'string' &&
        serverUrl.startsWith('http://');

    useEffect(() => {
        if (!type || !serverUrl) router.replace('/(onboarding)/servers');
    }, [router, type, serverUrl]);

    // Secrets go to the keystore via `saveServerCredentials` before this ever
    // reaches `dispatch` — Redux only sees the sanitized halves it returns.
    // Awaited so `credentialCache` is warm before the libraries screen (or
    // anything else `useApi` touches) renders for this new server.
    const saveServer = async (auth: ProviderAuth, usernameOverride?: string) => {
        const id = nanoid();
        const sanitized = await saveServerCredentials(id, auth, buildBasicAuth());
        dispatch(addServer({
            id, type, serverUrl,
            username: usernameOverride ?? localUsername,
            auth: sanitized.auth,
            basicAuth: sanitized.basicAuth,
            isAuthenticated: true,
        }));
        dispatch(setActiveServer(id));
        router.push(`/(onboarding)/libraries?serverId=${id}`);
    };

    // The hook owns the state machine; this screen only reacts to it landing on
    // a terminal phase.
    useEffect(() => {
        if (phase.status === 'approved') {
            saveServer(phase.auth, phase.username);
            return;
        }
        if (phase.status === 'failed') {
            notify.error(
                phase.reason === 'expired'
                    ? t('onboarding.credentials.codeAuth.expired')
                    // Approved, then stopped by the server. Saying the code
                    // expired would send the user back to re-approve a code
                    // that worked, and the two server cases need opposite
                    // advice: a refusal is about the account, not the address.
                    : phase.reason === 'serverRefused'
                        ? t('onboarding.credentials.codeAuth.serverRefused')
                        : phase.reason === 'serverUnreachable'
                            ? t('onboarding.credentials.codeAuth.serverUnreachable')
                            : phase.message || t('onboarding.credentials.codeAuth.unavailable')
            );
            cancelCodeAuth();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phase]);

    // ── Username / password ──────────────────────────────────────────────────

    const handleNext = async () => {
        if (!type || !serverUrl) return;
        if (!localUsername || !localPassword) {
            notify.error(t('onboarding.credentials.missingCredentials'));
            return;
        }
        const provider = SERVER_PROVIDERS[type];
        const basicAuth = buildBasicAuth();
        setIsTesting(true);
        try {
            const result = await provider.connect(serverUrl, localUsername, localPassword, basicAuth);
            if (!result.success || !result.auth) {
                notify.error(result.message || t('onboarding.credentials.authFailed'));
                return;
            }
            const pingOk = await provider.ping(serverUrl, localUsername, result.auth, basicAuth);
            if (!pingOk) {
                notify.error(t('onboarding.credentials.apiNotResponding'));
                return;
            }
            await saveServer(result.auth);
        } catch {
            notify.error(t('onboarding.credentials.connectError'));
        } finally {
            setIsTesting(false);
        }
    };

    // ────────────────────────────────────────────────────────────────────────

    return (
        <SafeAreaView style={styles.container}>
            {/* The column still fills the screen when it fits, so nothing
                moves; it scrolls only once it cannot. A phone on its side is
                390pt tall and the keyboard takes half of that, which used to
                leave the button that submits the form below both. */}
            <ScrollView
                contentContainerStyle={styles.form}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.mainContent}>
                    <Text style={styles.title}>{t('onboarding.credentials.title')}</Text>
                    <Text style={styles.subtitle}>{t('onboarding.credentials.subtitle')}</Text>

                    {inCodeAuth ? (
                        // ── Code sign-in panel ───────────────────────────────
                        <View style={styles.codeAuthPanel}>
                            <Text style={styles.codeAuthLabel}>
                                {t('onboarding.credentials.codeAuth.enterCode')}
                            </Text>
                            {phase.status === 'waiting' ? (
                                <Text style={styles.codeAuthCode}>{phase.code}</Text>
                            ) : (
                                <View style={{ marginVertical: spacing.roomy }}>
                                  <SpinningLoaderCircle size={iconSize.loader} color={onDark.text} />
                                </View>
                            )}
                            {phase.status === 'waiting' ? (
                                <View style={styles.codeAuthWaiting}>
                                    <SpinningLoaderCircle size={iconSize.inline} color={onDark.mutedText} />
                                    <Text style={styles.codeAuthWaitingText}>
                                        {t('onboarding.credentials.codeAuth.waiting')}
                                    </Text>
                                </View>
                            ) : null}
                            {codeAuth ? (
                                <Text style={styles.codeAuthHint}>{t(codeAuth.instructionKey)}</Text>
                            ) : null}
                        </View>
                    ) : (
                        // ── Username / password form ──────────────────────────
                        <>
                            <View style={[styles.inputWrapper, { borderRadius: rad.md }]}>
                                <User size={iconSize.control} color={onDark.mutedText} style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder={t('onboarding.credentials.usernamePlaceholder')}
                                    placeholderTextColor={onDark.mutedText}
                                    value={localUsername}
                                    onChangeText={setLocalUsername}
                                    autoCapitalize="none"
                                    returnKeyType="next"
                                    onSubmitEditing={() => passwordRef.current?.focus()}
                                />
                            </View>

                            <View style={[styles.inputWrapper, { borderRadius: rad.md }]}>
                                <Lock size={iconSize.control} color={onDark.mutedText} style={styles.inputIcon} />
                                <TextInput
                                    ref={passwordRef}
                                    style={styles.input}
                                    placeholder={t('onboarding.credentials.passwordPlaceholder')}
                                    placeholderTextColor={onDark.mutedText}
                                    secureTextEntry
                                    value={localPassword}
                                    onChangeText={setLocalPassword}
                                    autoCapitalize="none"
                                    returnKeyType="done"
                                    onSubmitEditing={handleNext}
                                />
                            </View>

                            {/* Reverse proxy auth */}
                            <Touchable
                                style={styles.proxyToggle}
                                onPress={() => setProxyExpanded(v => !v)}
                            >
                                <Shield size={iconSize.inline} color={onDark.mutedText} style={styles.proxyToggleIcon} />
                                <Text style={styles.proxyToggleText}>{t('onboarding.credentials.proxy.toggle')}</Text>
                                {proxyExpanded ? <ChevronUp size={iconSize.inline} color={onDark.mutedText} /> : <ChevronDown size={iconSize.inline} color={onDark.mutedText} />}
                            </Touchable>

                            {proxyExpanded && (
                                <View style={styles.proxySection}>
                                    {insecureWithProxy && (
                                        <View style={[styles.warningRow, { borderRadius: rad.md }]}>
                                            <TriangleAlert size={iconSize.inline} color={statusColor.warningText} />
                                            <Text style={styles.warningText}>
                                                {t('onboarding.credentials.proxy.insecureWarning')}
                                            </Text>
                                        </View>
                                    )}
                                    <View style={[styles.inputWrapper, { borderRadius: rad.md }]}>
                                        <User size={iconSize.control} color={onDark.mutedText} style={styles.inputIcon} />
                                        <TextInput
                                            ref={proxyUsernameRef}
                                            style={styles.input}
                                            placeholder={t('onboarding.credentials.proxy.usernamePlaceholder')}
                                            placeholderTextColor={onDark.mutedText}
                                            value={proxyUsername}
                                            onChangeText={setProxyUsername}
                                            autoCapitalize="none"
                                            returnKeyType="next"
                                            onSubmitEditing={() => proxyPasswordRef.current?.focus()}
                                        />
                                    </View>
                                    <View style={[styles.inputWrapper, { borderRadius: rad.md }]}>
                                        <Lock size={iconSize.control} color={onDark.mutedText} style={styles.inputIcon} />
                                        <TextInput
                                            ref={proxyPasswordRef}
                                            style={styles.input}
                                            placeholder={t('onboarding.credentials.proxy.passwordPlaceholder')}
                                            placeholderTextColor={onDark.mutedText}
                                            secureTextEntry
                                            value={proxyPassword}
                                            onChangeText={setProxyPassword}
                                            autoCapitalize="none"
                                            returnKeyType="done"
                                            onSubmitEditing={handleNext}
                                        />
                                    </View>
                                </View>
                            )}

                            {/* Code sign-in, where the provider offers one */}
                            {codeAuth && (
                                <Touchable
                                    style={styles.codeAuthToggle}
                                    onPress={startCodeAuth}
                                    disabled={isTesting}
                                >
                                    <QrCode size={iconSize.inline} color={onDark.mutedText} style={styles.proxyToggleIcon} />
                                    <Text style={styles.proxyToggleText}>{t(codeAuth.actionKey)}</Text>
                                    <ChevronRight size={iconSize.inline} color={onDark.mutedText} />
                                </Touchable>
                            )}
                        </>
                    )}
                </View>

                <View style={styles.buttonContainer}>
                    {!inCodeAuth && (
                        <Touchable
                            style={[styles.nextButton, { borderRadius: rad.pill }, isTesting && styles.nextButtonDisabled]}
                            onPress={handleNext}
                            disabled={isTesting}
                        >
                            {isTesting
                                ? <SpinningLoaderCircle size={iconSize.row} color={onDark.background} />
                                : <Text style={styles.nextButtonText}>{t('common.done')}</Text>
                            }
                        </Touchable>
                    )}

                    <Touchable
                        style={[styles.backButton, { borderRadius: rad.pill }]}
                        onPress={inCodeAuth ? cancelCodeAuth : () => router.back()}
                    >
                        <Text style={styles.backButtonText}>
                            {inCodeAuth ? t('onboarding.credentials.codeAuth.usePassword') : t('common.back')}
                        </Text>
                    </Touchable>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
