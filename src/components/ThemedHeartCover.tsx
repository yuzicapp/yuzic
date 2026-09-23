import React from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useRadius } from '@/features/theme/useRadius';
import { useTheme } from '@/features/theme/useTheme';

const ThemedHeartCover = ({ size, rounded }: { size?: number; rounded?: number }) => {
    const themeColor = useTheme().colors.themeColor;
    const rad = useRadius();

    const isGrid = size === undefined;
    const borderRadius = isGrid ? rad.md : (rounded ?? rad.md);

    return (
        <View
            style={{
                width: isGrid ? '100%' : size,
                height: isGrid ? undefined : size,
                aspectRatio: isGrid ? 1 : undefined,
                backgroundColor: themeColor,
                borderRadius,
                justifyContent: 'center',
                alignItems: 'center',
                overflow: 'hidden',
            }}
        >
            <Svg
                width={isGrid ? '60%' : size! * 0.7}
                height={isGrid ? '60%' : size! * 0.7}
                viewBox="0 0 512 512"
                preserveAspectRatio="xMidYMid meet"
                style={{
                    transform: [{ translateY: -2 }],
                }}
            >
                <Path
                    d="M256 448s-147.5-103.2-181.6-176.5C52.7 198.6 95.5 112 176 112c39.2 0 65.6 25.6 80 41.6C270.4 137.6 296.8 112 336 112c80.5 0 123.3 86.6 101.6 159.5C403.5 344.8 256 448 256 448z"
                />
            </Svg>
        </View>
    );
};

export default ThemedHeartCover;