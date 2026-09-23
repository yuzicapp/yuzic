import React from 'react'
import { Text } from 'react-native'
import { render, fireEvent, screen } from '@testing-library/react-native'

import Touchable, { dimsOnPress, rippleFor } from './Touchable'
import { stateLayer } from '@/constants/design'

let mockColorKey = 'a'
jest.mock('@/features/theme/useTheme', () => ({
  useTheme: () => ({ isDarkMode: true, colors: {}, colorKey: mockColorKey }),
}))

/*
 * The dim itself isn't asserted through a render: Pressable resolves its style
 * function internally and the host view only ever exposes the resting result,
 * so such a test would be checking React Native rather than this file. The rule
 * that decides it is pure and tested directly instead.
 */

describe('dimsOnPress', () => {
  it('leaves the ripple to answer the press on Android', () => {
    expect(dimsOnPress('android')).toBe(false)
  })

  it('dims everywhere the ripple does not run', () => {
    expect(dimsOnPress('ios')).toBe(true)
    expect(dimsOnPress('web')).toBe(true)
  })
})

describe('Touchable', () => {
  it('presses', async () => {
    const onPress = jest.fn()
    await render(<Touchable testID="t" onPress={onPress}><Text>go</Text></Touchable>)
    fireEvent.press(screen.getByTestId('t'))
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('does not press when disabled', async () => {
    const onPress = jest.fn()
    await render(<Touchable testID="t" disabled onPress={onPress}><Text>go</Text></Touchable>)
    fireEvent.press(screen.getByTestId('t'))
    expect(onPress).not.toHaveBeenCalled()
  })

})

describe('a colour change', () => {
  /**
   * On Android a Pressable's native view kept the background it was mounted
   * with, so switching theme left buttons in the old colours while the plain
   * views around them changed. The fix is a remount whenever the colours do,
   * which this pins by watching a child's state reset.
   */
  it('remounts the pressable, so Android draws the new background', async () => {
    let mounts = 0
    const Child = () => {
      React.useState(() => { mounts += 1 })
      return <Text>go</Text>
    }
    mockColorKey = 'a'
    const view = await render(<Touchable><Child /></Touchable>)
    await view.rerender(<Touchable><Child /></Touchable>)
    expect(mounts).toBe(1)

    mockColorKey = 'b'
    await view.rerender(<Touchable><Child /></Touchable>)
    expect(mounts).toBe(2)
  })
})

describe('rippleFor', () => {
  it('bounds the ripple to the component by default', () => {
    expect(rippleFor('row', false, true)).toMatchObject({
      color: stateLayer.rippleDark,
      borderless: false,
      radius: undefined,
    })
  })

  it('lets a control ripple past its edges, with a reach', () => {
    expect(rippleFor('control', false, true, 30)).toMatchObject({
      borderless: true,
      radius: 30,
    })
  })

  it('gives a control a reach even when none is asked for', () => {
    // A borderless ripple with no radius spreads to the nearest bounded parent,
    // which for a bare icon is most of the screen.
    expect(rippleFor('control', false, true)?.radius).toBeGreaterThan(0)
  })

  it('takes its colour from the theme', () => {
    expect(rippleFor('row', false, false)?.color).toBe(stateLayer.rippleLight)
    expect(rippleFor('row', false, true)?.color).toBe(stateLayer.rippleDark)
  })

  it('gives a disabled control nothing to answer with', () => {
    expect(rippleFor('row', true, true)).toBeUndefined()
    expect(rippleFor('control', true, true)).toBeUndefined()
  })

  it('gives a wrapper that opts out nothing either', () => {
    expect(rippleFor('none', false, true)).toBeUndefined()
  })
})
