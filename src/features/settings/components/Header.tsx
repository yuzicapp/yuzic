import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { ChevronLeft } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/features/theme/useTheme';
import Touchable from '@/components/Touchable';
import { iconSize, spacing, typography } from '@/constants/design';

type HeaderProps = {
    title: string;
    onBackPress?: () => void;
    rightAction?: React.ReactNode;
};

const Header: React.FC<HeaderProps> = ({
    title,
    onBackPress,
    rightAction,
}) => {
    const { t } = useTranslation();
    const router = useRouter();
    const { colors } = useTheme();

    const handleBack = () => {
        if (onBackPress) {
            onBackPress();
            return;
        }
        // Settings is a modal on the root stack, so back() dismisses it and
        // returns to whichever tab opened it. A cold deep link straight to a
        // settings route has nothing behind it to pop, which would strand the
        // user in the modal with a dead back arrow — fall back to the tabs.
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/(home)/(tabs)/(home)');
        }
    };

    return (
        <View style={styles.container}>
            <Touchable
                accessibilityRole="button"
                accessibilityLabel={t('a11y.common.back')}
                onPress={handleBack}
                style={styles.backButton}
            >
                <ChevronLeft
                    size={iconSize.header}
                    color={colors.secondary}
                />
            </Touchable>

            <View pointerEvents="none" style={styles.titleWrapper}>
                <Text
                    style={[styles.title, { color: colors.secondary }]}
                    numberOfLines={1}
                >
                    {title}
                </Text>
            </View>

            <View style={styles.rightSlot}>
                {rightAction ?? null}
            </View>
        </View>
    );
};

export default Header;

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
    },
    backButton: {
        padding: spacing.tight,
    },
    titleWrapper: {
        position: 'absolute',
        left: 0,
        right: 0,
        alignItems: 'center',
    },
    title: {
        ...typography.navigationTitle,
        fontWeight: '700',
        maxWidth: '60%',
    },
    rightSlot: {
        minWidth: 36,
        alignItems: 'flex-end',
        justifyContent: 'center',
    },
});
