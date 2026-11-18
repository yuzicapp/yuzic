import { onDark, shadow, spacing, typography } from '@/constants/design';
import { PRIVACY_POLICY_URL, TERMS_URL } from '@/constants/links';
import { useTheme } from '@/features/theme/useTheme';
import React, { useState } from 'react';
import { View, TouchableWithoutFeedback, StyleSheet, Platform, Linking } from 'react-native';
import { Text } from '@/components/Text';
import { Image } from 'expo-image';
import { Redirect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { selectActiveServer } from '@/state/redux/selectors/serversSelectors';
import { setHasSeenGetStarted, selectHasSeenGetStarted } from '@/features/settings/onboarding/state';
import { useTranslation } from 'react-i18next';
import { useRadius } from '@/features/theme/useRadius';
import { useWindowLayout } from '@/features/layout/useWindowLayout';
import { squareArtSize } from '@/features/layout/windowClass';

/** The mark on the welcome screen, at the size it has always been drawn. */
const WELCOME_ICON_SIZE = 150;

/**
 * How much of a short window the mark may take.
 *
 * The screen is a fixed column between a centred hero and a button pinned to
 * the bottom, and it adds up to about 410pt — six more than a phone on its
 * side has. Nothing in it shrinks on its own, so the icon is what gives, and
 * only when the window is short enough to ask.
 */
const WELCOME_ICON_HEIGHT_SHARE = 0.22;

/**
 * The terms line, split into text and the two links inside it.
 *
 * The sentence is one translated string with `{{terms}}` and `{{privacy}}`
 * in it, rather than three strings glued together at this call site, because
 * glue assumes English word order — and the line exists to be read before
 * someone agrees to it. A translator moves the placeholders where their
 * grammar wants them and the links follow.
 *
 * Interpolating sentinels and splitting on them, rather than reading the raw
 * template: i18next owns interpolation, and asking it for the unresolved
 * string means depending on what it does with a value it was not given. These
 * two characters cannot occur in the copy.
 */
const TERMS_MARK = '\u0001';
const PRIVACY_MARK = '\u0002';

type SentencePart = { text: string; href?: string };

function termsSentence(t: (key: string, values?: Record<string, string>) => string): SentencePart[] {
  const sentence = t('onboarding.home.terms', { terms: TERMS_MARK, privacy: PRIVACY_MARK });

  return sentence
    .split(/([\u0001\u0002])/)
    .filter(piece => piece !== '')
    .map(piece => {
      if (piece === TERMS_MARK) return { text: t('onboarding.home.termsLink'), href: TERMS_URL };
      if (piece === PRIVACY_MARK) return { text: t('onboarding.home.privacyLink'), href: PRIVACY_POLICY_URL };
      return { text: piece };
    });
}

export default function Home() {
    const { t } = useTranslation();
    const router = useRouter();
    const themeColor = useTheme().colors.themeColor;
    const dispatch = useDispatch();
    const rad = useRadius();
    const [isPressed, setIsPressed] = useState(false);
    const { height } = useWindowLayout();
    const iconSize = squareArtSize(
        WELCOME_ICON_SIZE,
        height * WELCOME_ICON_HEIGHT_SHARE
    );

    const hasSeenGetStarted = useSelector(selectHasSeenGetStarted);

    const activeServer = useSelector(selectActiveServer);
    const isAuthenticated = activeServer?.isAuthenticated;

    if (isAuthenticated) {
        return <Redirect href="/(home)/(tabs)/(home)" />;
    }

    if (hasSeenGetStarted) {
        return <Redirect href="/(onboarding)/servers" />;
    }

    const handlePressIn = () => setIsPressed(true);

    const handlePressOut = async () => {
        setIsPressed(false);

        dispatch(setHasSeenGetStarted(true));
        router.push('/(onboarding)/servers');
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <Image
                    source={require('@assets/images/logo.png')}
                    style={[styles.appIcon, { width: iconSize, height: iconSize, borderRadius: rad.md }]}
                    contentFit="contain"
                    cachePolicy="memory-disk"
                />
                <Text style={styles.appName}>Yuzic</Text>
                <Text style={styles.subtext}>
                    {t('onboarding.home.subtitle')}
                </Text>
            </View>

            <View style={styles.bottomContent}>
                <TouchableWithoutFeedback
                    onPressIn={handlePressIn}
                    onPressOut={handlePressOut}
                >
                    <View style={styles.buttonContainer}>
                        <View
                            style={[
                                styles.offsetButton,
                                { backgroundColor: `${themeColor}AA`, borderRadius: rad.md },
                            ]}
                        />
                        <View
                            style={[
                                styles.button,
                                { backgroundColor: themeColor, shadowColor: themeColor, borderRadius: rad.md },
                                isPressed && styles.buttonPressed,
                            ]}
                        >
                            <Text style={styles.buttonText}>{t('onboarding.home.getStarted')}</Text>
                        </View>
                    </View>
                </TouchableWithoutFeedback>

                <Text style={styles.termsText}>
                    {termsSentence(t).map((part, index) =>
                        part.href ? (
                            <Text
                                key={index}
                                style={styles.termsLink}
                                accessibilityRole="link"
                                onPress={() => { void Linking.openURL(part.href as string); }}
                            >
                                {part.text}
                            </Text>
                        ) : (
                            part.text
                        )
                    )}
                </Text>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: onDark.background,
        paddingHorizontal: spacing.roomy,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    appIcon: {
        marginBottom: spacing.xxl,
    },
    appName: {
        ...typography.display,
        color: onDark.text,
        textAlign: 'center',
        marginBottom: spacing.controlGap,
    },
    subtext: {
        ...typography.body,
        color: onDark.subtext,
        textAlign: 'center',
        paddingHorizontal: spacing.xxl,
    },
    bottomContent: {
        width: '100%',
        alignItems: 'center',
        marginBottom: Platform.OS === 'ios' ? spacing.xxxl : spacing.roomy,
    },
    buttonContainer: {
        width: '90%',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    offsetButton: {
        position: 'absolute',
        top: 6,
        width: '100%',
        height: 48,
        zIndex: -1,
    },
    button: {
        width: '100%',
        paddingVertical: spacing.lg,
        alignItems: 'center',
        justifyContent: 'center',
        ...shadow.primaryButton,
    },
    buttonPressed: {
        top: 6,
        shadowOpacity: 0,
    },
    buttonText: {
        ...typography.sheetTitle,
        color: onDark.text,
    },
    termsText: {
        ...typography.caption,
        color: onDark.mutedText,
        textAlign: 'center',
        paddingHorizontal: spacing.controlGap,
        marginTop: spacing.md,
    },
    /**
     * Underlined and brighter than the sentence around it. Underline alone is
     * what says "link" without a colour, which matters here: the line sits on
     * the splash's fixed dark background, where the theme's accent has not
     * been chosen yet and would be the wrong thing to spend anyway — the
     * accent means *yours*, and these are documents.
     */
    termsLink: {
        color: onDark.text,
        textDecorationLine: 'underline',
    },
});
