import React, { useEffect, useState } from 'react';
import { type StyleProp, type TextStyle } from 'react-native';
import { Text } from '@/components/Text';
import { useTranslation } from 'react-i18next';
import { formatSleepCountdown, sleepTimerSecondsLeft, type SleepTimer } from '../sleepTimer';

type Props = {
  timer: SleepTimer;
  style?: StyleProp<TextStyle>;
};

/**
 * What is left on a running timer — a countdown, or "End of track".
 *
 * Its own component so the once-a-second tick re-renders this text and not
 * the sheet or player around it.
 */
export default function SleepTimerRemaining({ timer, style }: Props) {
  const { t } = useTranslation();
  const [now, setNow] = useState(Date.now);
  const counting = timer.mode === 'duration';

  useEffect(() => {
    if (!counting) return;
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [counting]);

  if (timer.mode === 'off') return null;
  return (
    <Text style={style}>
      {timer.mode === 'endOfTrack'
        ? t('playing.sleepTimer.endOfTrack')
        : formatSleepCountdown(sleepTimerSecondsLeft(timer.endsAt, now))}
    </Text>
  );
}
