/**
 * The credentials screen's styles.
 *
 * Split out rather than refactored: the screen was two lines under the
 * 400-line shape gate before it learned to scroll, and a hundred lines of
 * `StyleSheet.create` is the part of it that is not the screen.
 */
import { StyleSheet } from 'react-native';
import { fixedColor, onDark, spacing, stateLayer, statusColor, typography } from '@/constants/design';

export const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: onDark.background },
    /** What the `flex: 1` column was, as a scroll view's content. */
    form: { flexGrow: 1 },
    mainContent: { flexGrow: 1, paddingHorizontal: spacing.roomy, marginTop: spacing.xxxl },
    buttonContainer: { padding: spacing.roomy, backgroundColor: onDark.background, alignItems: 'center' },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: onDark.muted,
        borderWidth: 1,
        borderColor: onDark.mutedText,
        marginBottom: spacing.lg,
        paddingHorizontal: spacing.md,
        // A minimum: the field's text grows with the text size.
        minHeight: 50,
    },
    inputIcon: { marginRight: spacing.controlGap },
    input: { ...typography.body, flex: 1, color: onDark.text },
    title: { ...typography.display, color: onDark.text, marginBottom: spacing.controlGap },
    subtitle: { ...typography.body, color: onDark.mutedText, marginBottom: spacing.roomy },
    proxyToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.controlGap,
        paddingHorizontal: spacing.md,
        marginBottom: spacing.xs,
    },
    codeAuthToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.controlGap,
        paddingHorizontal: spacing.md,
        marginTop: spacing.sm,
    },
    proxyToggleIcon: { marginRight: spacing.tight },
    proxyToggleText: { ...typography.rowSubtitle, flex: 1, color: onDark.mutedText },
    proxySection: { marginTop: spacing.xs, marginBottom: spacing.sm },
    warningRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: fixedColor.onboardingWarningSurface,
        borderWidth: 1,
        borderColor: fixedColor.onboardingWarningBorder,
        padding: spacing.controlGap,
        marginBottom: spacing.md,
        gap: spacing.sm,
    },
    warningText: { ...typography.caption, flex: 1, color: statusColor.warningText },
    // Code sign-in panel
    codeAuthPanel: {
        alignItems: 'center',
        paddingVertical: spacing.xl,
        gap: spacing.page,
    },
    codeAuthLabel: {
        ...typography.body,
        color: onDark.mutedText,
        textAlign: 'center',
    },
    codeAuthCode: {
        ...typography.hero,
        fontWeight: '700',
        color: onDark.text,
        letterSpacing: 8,
    },
    codeAuthWaiting: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    codeAuthWaitingText: {
        ...typography.rowSubtitle,
        color: onDark.mutedText,
    },
    codeAuthHint: {
        ...typography.caption,
        color: onDark.mutedText,
        textAlign: 'center',
        paddingHorizontal: spacing.md,
    },
    // Buttons
    nextButton: {
        backgroundColor: onDark.text,
        paddingVertical: spacing.lg,
        alignItems: 'center',
        width: '100%',
        marginBottom: spacing.md,
    },
    nextButtonDisabled: { opacity: stateLayer.pressedOpacity },
    nextButtonText: { ...typography.sheetTitle, color: onDark.background },
    backButton: {
        backgroundColor: onDark.border,
        paddingVertical: spacing.lg,
        alignItems: 'center',
        width: '100%',
        marginBottom: spacing.xs,
    },
    backButtonText: { ...typography.sheetTitle, color: onDark.text },
});
