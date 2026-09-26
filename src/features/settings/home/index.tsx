import React from 'react';
import { ScrollView, View, Image, StyleSheet, Alert, Linking } from 'react-native';
import { Text } from '@/components/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Server, Library, Volume2, Palette, Puzzle, Github, Newspaper, FileText, ShieldCheck, ScrollText, House as HomeIcon, Tags, Disc3, Search, ChartColumn } from 'lucide-react-native';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { selectActiveServer } from '@/state/redux/selectors/serversSelectors';
import { useSourceScreenSummary } from '../sources/useSourceScreenSummary';
import { useTheme } from '@/features/theme/useTheme';
import { useIconSize } from '@/features/theme/useIconSize';
import Header from '../components/Header';
import SettingsCard from '../components/SettingsCard';
import SettingsDivider from '../components/SettingsDivider';
import SettingsRow from '../components/SettingsRow';
import Touchable from '@/components/Touchable';
import UserAvatar from '@/components/UserAvatar';
import { controlSize, radius, spacing, typography } from '@/constants/design';
import { useRadius } from '@/features/theme/useRadius';
import { useScrollClearance } from '@/features/theme/useScrollClearance';

export default function Settings() {
    const { t } = useTranslation();
    const router = useRouter();
    const activeServer = useSelector(selectActiveServer);
    const metadataSummary = useSourceScreenSummary('metadata');
    const pagesSummary = useSourceScreenSummary('pages');
    const searchSummary = useSourceScreenSummary('search');

    const { colors } = useTheme();
  const icons = useIconSize();
    const rad = useRadius();
    // The version line is the last thing on this screen, so it is what sits
    // behind the tabs when the dock is translucent and takes no layout space.
    // The flat `spacing.scrollClearance` is only the breathing room; the hook
    // adds the dock's real height, which changes with the safe-area inset and
    // with whether a track is playing.
    const scrollClearance = useScrollClearance();
    const appVersion = Constants.expoConfig?.version ?? '—';

    if (!activeServer) return null;

    const { type, username, serverUrl } = activeServer;
    const cleanUrl = serverUrl?.replace(/^https?:\/\//, '') || t('settings.profile.noServer');

    const openLink = async (url: string) => {
        const supported = await Linking.canOpenURL(url);
        if (supported) {
            await Linking.openURL(url);
        } else {
            Alert.alert(t('settings.links.cantOpen', { url }));
        }
    };

    return (
        <SafeAreaView
            edges={['top']}
            style={[styles.container, { backgroundColor: colors.background }]}
        >
            <Header title={t('settings.title')} />

            <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollClearance }]}>
                {/*
                  The card repeats what the sheet you arrived from already
                  showed — the same avatar, name, badge and host. Rather than
                  drop it and lose the anchor at the top of the screen, it
                  opens Server: the one place where those four facts can
                  actually be changed. It draws text, so the row reads itself
                  and needs no label of its own.
                */}
                <Touchable
                    feedback="none"
                    accessibilityRole="button"
                    onPress={() => router.push('/settings/serverView')}
                >
                <SettingsCard style={styles.profileCard}>
                    <View style={styles.profileRow}>
                        <UserAvatar
                            username={username}
                            size={controlSize.avatarProfileCard}
                            borderRadius={rad.pill}
                            style={styles.avatar}
                        />
                        <View style={styles.profileInfo}>
                            <Text style={[styles.profileName, { color: colors.secondary }]}>
                                {username || t('settings.profile.unknownUser')}
                            </Text>
                            <View style={styles.serverMeta}>
                                <View style={[styles.typeBadge, { backgroundColor: colors.muted }]}>
                                    <Text style={[styles.typeBadgeText, { color: colors.subtext }]}>
                                        {type}
                                    </Text>
                                </View>
                                <Text style={[styles.serverUrl, { color: colors.subtext }]} numberOfLines={1}>
                                    {cleanUrl}
                                </Text>
                            </View>
                        </View>
                    </View>
                </SettingsCard>
                </Touchable>

                {/* General */}
                <Text style={[styles.sectionTitle, { color: colors.subtext }]}>
                    {t('settings.sections.general')}
                </Text>
                <SettingsCard>
                    <SettingsRow
                        label={t('settings.rows.server')}
                        leftIcon={<Server size={icons.secondary} color={colors.secondary} />}
                        onPress={() => router.push('/settings/serverView')}
                    />
                    <SettingsDivider />
                    <SettingsRow
                        testID="settings-row-library"
                        label={t('settings.rows.library')}
                        leftIcon={<Library size={icons.secondary} color={colors.secondary} />}
                        onPress={() => router.push('/settings/libraryView')}
                    />
                    <SettingsDivider />
                    <SettingsRow
                        label={t('settings.rows.player')}
                        leftIcon={<Volume2 size={icons.secondary} color={colors.secondary} />}
                        onPress={() => router.push('/settings/playerView')}
                    />
                    <SettingsDivider />
                    <SettingsRow
                        label={t('settings.rows.appearance')}
                        leftIcon={<Palette size={icons.secondary} color={colors.secondary} />}
                        onPress={() => router.push('/settings/appearanceView')}
                    />
                    <SettingsDivider />
                    <SettingsRow
                        testID="settings-row-metadata"
                        label={t('settings.metadata.title')}
                        rightText={metadataSummary}
                        leftIcon={<Tags size={icons.secondary} color={colors.secondary} />}
                        onPress={() => router.push('/settings/metadataView')}
                    />
                </SettingsCard>

                <Text style={[styles.sectionTitle, { color: colors.subtext }]}>
                    {t('settings.sections.discovery')}
                </Text>
                <SettingsCard>
                    <SettingsRow
                        label={t('settings.home.title')}
                        leftIcon={<HomeIcon size={icons.secondary} color={colors.secondary} />}
                        onPress={() => router.push('/settings/homeView')}
                    />
                    <SettingsDivider />
                    <SettingsRow
                        testID="settings-row-pages"
                        label={t('settings.pages.title')}
                        rightText={pagesSummary}
                        leftIcon={<FileText size={icons.secondary} color={colors.secondary} />}
                        onPress={() => router.push('/settings/pagesView')}
                    />
                    <SettingsDivider />
                    <SettingsRow
                        testID="settings-row-search"
                        label={t('settings.search.title')}
                        rightText={searchSummary}
                        leftIcon={<Search size={icons.secondary} color={colors.secondary} />}
                        onPress={() => router.push('/settings/searchView')}
                    />
                    <SettingsDivider />
                    <SettingsRow
                        label={t('settings.listening.title')}
                        leftIcon={<ChartColumn size={icons.secondary} color={colors.secondary} />}
                        onPress={() => router.push('/settings/listeningView')}
                    />
                    <SettingsDivider />
                    <SettingsRow
                        label={t('settings.scrobbling.title')}
                        leftIcon={<Disc3 size={icons.secondary} color={colors.secondary} />}
                        onPress={() => router.push('/settings/scrobblingView')}
                    />
                </SettingsCard>

                {/*
                  This card had no heading at all: the Discovery card led the one above
                  it and "About" the one below, leaving Integrations and
                  Downloaders reading as either the tail of General or as
                  nothing. They are neither — they are the things Yuzic talks
                  to besides your server.

                  It used to carry a second row straight to the Downloads
                  screen. That screen is a library collection — it lives on the
                  Library tab with the other ways of browsing what you have,
                  and a duplicate entry in Settings put the same screen in a
                  place that configures things rather than opens them. Nothing
                  was configured here; the row was a link, so removing it drops
                  a way in and no setting.
                */}
                <Text style={[styles.sectionTitle, { color: colors.subtext }]}>
                    {t('settings.sections.connections')}
                </Text>
                <SettingsCard>
                    <SettingsRow
                        label={t('settings.sections.connections')}
                        leftIcon={<Puzzle size={icons.secondary} color={colors.secondary} />}
                        onPress={() => router.push('/settings/connectionsView')}
                    />
                </SettingsCard>

                {/* About */}
                <Text style={[styles.sectionTitle, { color: colors.subtext }]}>
                    {t('settings.sections.about')}
                </Text>
                <SettingsCard>
                    {/*
                      What this version brought, and where the app lives. The
                      release notes were written for every release and readable
                      only on the web, so the one screen that says which version
                      you are running could not say what came with it.
                    */}
                    <SettingsRow
                        testID="settings-row-changelog"
                        label={t('settings.rows.changelog')}
                        leftIcon={<Newspaper size={icons.secondary} color={colors.secondary} />}
                        onPress={() => openLink('https://yuzicapp.github.io/yuzic-web/changelog/')}
                    />
                    <SettingsDivider />
                    <SettingsRow
                        label={t('settings.rows.github')}
                        leftIcon={<Github size={icons.secondary} color={colors.secondary} />}
                        onPress={() => openLink('https://github.com/yuzicapp/yuzic')}
                    />
                    <SettingsDivider />
                    <SettingsRow
                        label={t('settings.rows.privacyPolicy')}
                        leftIcon={<ShieldCheck size={icons.secondary} color={colors.secondary} />}
                        onPress={() => openLink('https://yuzicapp.github.io/yuzic-web/privacypolicy/')}
                    />
                    <SettingsDivider />
                    <SettingsRow
                        label={t('settings.rows.termsOfUse')}
                        leftIcon={<ScrollText size={icons.secondary} color={colors.secondary} />}
                        onPress={() => openLink('https://yuzicapp.github.io/yuzic-web/tos/')}
                    />
                </SettingsCard>

                {/*
                  The mark under the version, tinted to the same grey as the
                  text above it — it is a signature at the foot of the screen,
                  not a logo being shown off. `splash.png` is the mark with no
                  square behind it, so a tint is all it takes to sit right in
                  either theme; the app icon would have put a coral tile here.
                */}
                <View style={styles.versionBlock}>
                    <Text style={[styles.versionText, { color: colors.subtext }]}>
                        Yuzic {appVersion}
                    </Text>
                    <Image
                        source={require('@assets/images/splash.png')}
                        style={[styles.versionLogo, { tintColor: colors.subtext }]}
                        resizeMode="contain"
                        accessible={false}
                    />
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.lg,
        paddingBottom: spacing.scrollClearance,
    },
    sectionTitle: {
        ...typography.label,
        marginBottom: spacing.tight,
        marginTop: spacing.lg,
        marginLeft: spacing.xs,
    },
    profileCard: {
        padding: spacing.lg,
        marginBottom: spacing.md,
    },
    profileRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatar: {
        marginRight: spacing.md,
    },
    profileInfo: {
        flex: 1,
    },
    profileName: {
        ...typography.rowTitle,
        fontWeight: '600',
        marginBottom: spacing.xs,
    },
    serverMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.tight,
    },
    typeBadge: {
        paddingHorizontal: spacing.tight,
        paddingVertical: spacing.xxs,
        borderRadius: radius.xs,
    },
    typeBadgeText: {
        ...typography.micro,
        fontWeight: '500',
        textTransform: 'capitalize',
    },
    serverUrl: {
        ...typography.caption,
        flex: 1,
    },
    versionBlock: {
        alignItems: 'center',
        marginTop: spacing.xxl,
        marginBottom: spacing.headerOffset,
    },
    versionLogo: {
        // Drawn at the size a signature is actually legible at. It was 56×20
        // *and* dimmed twice — tinted to `subtext` and then faded again — so
        // the mark read as a smudge beside the version rather than as the mark.
        // The tint alone is what makes it sit right in either theme.
        width: 132,
        height: 48,
        marginTop: spacing.sm,
    },
    versionText: {
        ...typography.caption,
        textAlign: 'center',
    },
});
