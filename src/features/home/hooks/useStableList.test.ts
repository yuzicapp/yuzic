import { renderHook } from '@testing-library/react-native';
import { sameList, useStableList } from './useStableList';

/**
 * A shelf's items keep their identity when a stats change leaves them as they
 * were, so the scrobble at the end of every song does not re-render the shelf.
 */
describe('useStableList', () => {
  const a = { id: 'a' };
  const b = { id: 'b' };
  const c = { id: 'c' };

  it('hands back the first array while the contents are the same', async () => {
    let items = [a, b];
    const hook = await renderHook(() => useStableList(items));
    const first = hook.result.current;

    items = [a, b];
    await hook.rerender({});
    expect(hook.result.current).toBe(first);
  });

  it('takes the new array when an entry changes, is added, or moves', async () => {
    let items = [a, b];
    const hook = await renderHook(() => useStableList(items));

    items = [a, c];
    await hook.rerender({});
    expect(hook.result.current).toEqual([a, c]);

    items = [a, c, b];
    await hook.rerender({});
    expect(hook.result.current).toEqual([a, c, b]);

    items = [c, a, b];
    await hook.rerender({});
    expect(hook.result.current).toEqual([c, a, b]);
  });

  it('uses the comparison it is given', () => {
    const byId = (x: { id: string }, y: { id: string }) => x.id === y.id;
    expect(sameList([{ id: 'a' }], [{ id: 'a' }], byId)).toBe(true);
    expect(sameList([{ id: 'a' }], [{ id: 'a' }])).toBe(false);
    expect(sameList([a], [a, b])).toBe(false);
  });
});
