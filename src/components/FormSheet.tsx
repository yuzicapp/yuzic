import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/Text';
import {
  BottomSheetModal,
  BottomSheetTextInput,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { useTranslation } from 'react-i18next';
import { renderBackdrop } from '@/components/BottomSheetBackdrop';
import SpinningLoaderCircle from '@/components/SpinningLoaderCircle';
import Touchable from '@/components/Touchable';
import {
  optionSheetStyles,
  useOptionSheetBackground,
  useSheetBottomInset,
} from '@/components/options/sheetScaffold';
import { controlSize, iconSize, spacing, typography } from '@/constants/design';
import { useRadius } from '@/features/theme/useRadius';
import { useTheme } from '@/features/theme/useTheme';
import { useSheetRef } from '@/components/useSheetRef';

type FormSheetProps = {
  title: string;
  /** A line under the title, for a form that needs to say what it wants. */
  description?: string;
  /** The primary button's label — "Save", "Add podcast". Never "OK". */
  submitLabel: string;
  /** False while the form is incomplete; the primary button goes quiet. */
  canSubmit: boolean;
  /** Does the work and says whether the sheet should close. Returning false
   *  keeps it open with what the user typed still in it, which is what a
   *  failed save needs. */
  onSubmit: () => Promise<boolean>;
  /** Called once the sheet has finished dismissing, however it was dismissed
   *  — the button, the backdrop, or a drag. */
  onClose: () => void;
  children: React.ReactNode;
};

/**
 * A sheet that asks for a few fields and does something with them.
 *
 * Radio and Podcasts each grew their own centred `Modal` for this — dimmed
 * backdrop, card, two text buttons — which made "fill this in" the one
 * interaction in the app that did not come up from the bottom. Everything else
 * the app asks of the user, from song options to picking a downloader, is a
 * `BottomSheetModal`, and a form is not different enough to earn a second
 * language for it.
 *
 * It presents itself on mount, so a screen renders it when there is something
 * to fill in and drops it when there isn't, rather than holding a ref. It owns
 * the in-flight state too: the caller's job is to do the work and say whether
 * that worked.
 */
export function FormSheet({
  title,
  description,
  submitLabel,
  canSubmit,
  onSubmit,
  onClose,
  children,
}: FormSheetProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const rad = useRadius();
  const sheetRef = useSheetRef();
  const sheetBg = useOptionSheetBackground();
  const bottomInset = useSheetBottomInset();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    sheetRef.current?.present();
  }, [sheetRef]);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      if (await onSubmit()) sheetRef.current?.dismiss();
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, onSubmit, sheetRef, submitting]);

  const submitEnabled = canSubmit && !submitting;

  return (
    <BottomSheetModal
      ref={sheetRef}
      enableDynamicSizing
      // Dragging a half-finished form away mid-save would leave the work with
      // nowhere to report back to.
      enablePanDownToClose={!submitting}
      backdropComponent={renderBackdrop}
      stackBehavior="push"
      onDismiss={onClose}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      handleIndicatorStyle={{ backgroundColor: colors.border }}
      backgroundStyle={[optionSheetStyles.sheetBackground, sheetBg]}
    >
      {/* The buttons are the last thing in the sheet, so the home indicator is
          what they would otherwise land on. A flat bottom padding is enough
          for a sheet that ends in text and not for one that ends in a 48pt
          pill. */}
      <BottomSheetView
        style={[
          sheetBg,
          styles.content,
          { paddingBottom: Math.max(spacing.generous, bottomInset + spacing.xl) },
        ]}
      >
        <Text style={[styles.title, { color: colors.secondary }]}>{title}</Text>
        {description ? (
          <Text style={[styles.description, { color: colors.subtext }]}>{description}</Text>
        ) : null}

        <View style={styles.fields}>{children}</View>

        <View style={styles.actions}>
          <Touchable
            onPress={() => sheetRef.current?.dismiss()}
            disabled={submitting}
            style={styles.cancel}
            accessibilityRole="button"
            accessibilityState={{ disabled: submitting }}
          >
            <Text style={[styles.cancelText, { color: colors.subtext }]}>
              {t('common.cancel')}
            </Text>
          </Touchable>

          <Touchable
            onPress={() => void handleSubmit()}
            disabled={!submitEnabled}
            style={[
              styles.submit,
              {
                backgroundColor: submitEnabled ? colors.themeColor : colors.muted,
                borderRadius: rad.pillFor(controlSize.detailPrimaryHeight),
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={submitLabel}
            accessibilityState={{ disabled: !submitEnabled }}
          >
            {submitting ? (
              <SpinningLoaderCircle size={iconSize.row} color={colors.onThemeColor} />
            ) : (
              <Text
                style={[
                  styles.submitText,
                  { color: submitEnabled ? colors.onThemeColor : colors.subtext },
                ]}
              >
                {submitLabel}
              </Text>
            )}
          </Touchable>
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
}

type FormSheetFieldProps = React.ComponentProps<typeof BottomSheetTextInput> & {
  label: string;
};

/**
 * One labelled field inside a {@link FormSheet}.
 *
 * `BottomSheetTextInput` rather than a plain one: inside a sheet, a plain
 * `TextInput` does not tell the sheet the keyboard is coming, so the field it
 * belongs to ends up underneath it. `SettingsInputField` is the same idea for
 * an ordinary screen, where that problem does not exist.
 */
export function FormSheetField({ label, style, ...inputProps }: FormSheetFieldProps) {
  const { colors } = useTheme();
  const rad = useRadius();

  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.subtext }]}>{label}</Text>
      <BottomSheetTextInput
        {...inputProps}
        placeholderTextColor={colors.placeholder}
        style={[
          styles.fieldInput,
          { backgroundColor: colors.muted, borderRadius: rad.md, color: colors.secondary },
          style,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
  },
  title: {
    ...typography.sectionTitle,
  },
  description: {
    ...typography.caption,
    marginTop: spacing.xs,
  },
  fields: {
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  field: {
    gap: spacing.xs,
  },
  fieldLabel: {
    ...typography.caption,
  },
  fieldInput: {
    ...typography.body,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  cancel: {
    height: controlSize.detailPrimaryHeight,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  cancelText: {
    ...typography.button,
  },
  submit: {
    minWidth: controlSize.detailPrimaryWidth,
    height: controlSize.detailPrimaryHeight,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  submitText: {
    ...typography.button,
  },
});
