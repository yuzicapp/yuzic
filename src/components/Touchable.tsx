import React from 'react'
import {
  Platform,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native'

import { useTheme } from '@/features/theme/useTheme'
import { stateLayer } from '@/constants/design'

/**
 * How the press should read.
 *
 * `row` bounds the ripple to the component, for anything with edges — a list
 * row, a card, a button. `control` lets it spill past them, for a bare icon
 * whose touch target is larger than the glyph. `none` is for a wrapper that
 * handles a press on behalf of something else that already shows the feedback.
 */
type TouchableFeedback = 'row' | 'control' | 'none'

type TouchableProps = Omit<PressableProps, 'style' | 'android_ripple'> & {
  style?: StyleProp<ViewStyle>
  feedback?: TouchableFeedback
  /** Reach of a `control` ripple, in points. Defaults to a typical icon target. */
  rippleRadius?: number
}

const DEFAULT_CONTROL_RIPPLE_RADIUS = 22

/**
 * Whether a press should be answered by dimming the component.
 *
 * Android answers it with the ripple instead; doing both would be two responses
 * to one touch.
 */
export function dimsOnPress(platform: typeof Platform.OS): boolean {
  return platform !== 'android'
}

type Ripple = {
  color: string
  borderless: boolean
  radius?: number
}

/**
 * The ripple a press should raise, or nothing where it shouldn't raise one.
 *
 * A disabled control looks inert rather than pressable-but-unresponsive, and a
 * wrapper that opts out is passing the press to something else that already
 * shows it.
 */
export function rippleFor(
  feedback: TouchableFeedback,
  disabled: boolean,
  isDarkMode: boolean,
  rippleRadius?: number
): Ripple | undefined {
  if (feedback === 'none' || disabled) return undefined
  return {
    color: isDarkMode ? stateLayer.rippleDark : stateLayer.rippleLight,
    borderless: feedback === 'control',
    radius: feedback === 'control'
      ? rippleRadius ?? DEFAULT_CONTROL_RIPPLE_RADIUS
      : undefined,
  }
}

/**
 * The app's pressable.
 *
 * `TouchableOpacity` fades the entire component to a fixed opacity wherever you
 * touch it, which is the same gesture whether you hit a 300pt row or a 20pt
 * icon inside it — and on Android it is visibly not what every other app does.
 * This gives Android a real ripple, bounded to the component and originating
 * under the finger, and iOS the opacity dip it expects, from one place so the
 * two can't drift apart per screen.
 */
const Touchable = React.forwardRef<React.ComponentRef<typeof Pressable>, TouchableProps>(
  function Touchable({ style, feedback = 'row', rippleRadius, disabled, ...rest }, ref) {
    const { isDarkMode, colorKey } = useTheme()

    const ripple = rippleFor(feedback, disabled === true, isDarkMode, rippleRadius)

    return (
      <Pressable
        // Remounted when the colours change. On Android the native view of a
        // Pressable kept the background it was mounted with: a theme or
        // light/dark switch rendered the new colour in JS and the old one on
        // screen, until something else remounted it. Colours change rarely,
        // so a remount is the cheap and certain answer.
        key={colorKey}
        ref={ref}
        disabled={disabled}
        android_ripple={ripple}
        style={({ pressed }) => [
          style,
          pressed && ripple && dimsOnPress(Platform.OS)
            ? { opacity: stateLayer.pressedOpacity }
            : null,
        ]}
        {...rest}
      />
    )
  }
)

export default Touchable
