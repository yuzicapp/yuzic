import { formatDuration, formatCompactDuration, formatSongDuration } from './formatDuration';

describe('formatDuration', () => {
  it('formats mm:ss when under one hour', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(9)).toBe('0:09');
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(599)).toBe('9:59');
    expect(formatDuration(3599)).toBe('59:59');
  });

  it('formats h:mm:ss when one hour or longer', () => {
    expect(formatDuration(3600)).toBe('1:00:00');
    expect(formatDuration(3665)).toBe('1:01:05');
    expect(formatDuration(7200)).toBe('2:00:00');
  });
});

describe('formatCompactDuration', () => {
  it('returns empty string for zero or undefined', () => {
    expect(formatCompactDuration(undefined)).toBe('');
    expect(formatCompactDuration(0)).toBe('');
    expect(formatCompactDuration(-10)).toBe('');
  });

  it('formats compact minutes when under one hour', () => {
    expect(formatCompactDuration(45 * 60)).toBe('45m');
    expect(formatCompactDuration(90)).toBe('2m');
  });

  it('formats compact hours and minutes when over one hour', () => {
    expect(formatCompactDuration(3600)).toBe('1h 0m');
    expect(formatCompactDuration(3900)).toBe('1h 5m');
  });
});

describe('formatSongDuration', () => {
  it('handles string and number durations', () => {
    expect(formatSongDuration(125)).toBe('2:05');
    expect(formatSongDuration('125')).toBe('2:05');
    expect(formatSongDuration(undefined)).toBe('');
    expect(formatSongDuration(0)).toBe('');
  });
});
