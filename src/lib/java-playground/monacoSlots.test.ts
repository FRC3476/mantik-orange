import { describe, expect, it } from 'vitest';
import { pickLiveEditors } from './monacoSlots';

describe('pickLiveEditors', () => {
  it('prefers intersecting editors that need Monaco', () => {
    expect(pickLiveEditors(['a', 'b', 'c', 'd'], ['c', 'd'], ['a'], 3)).toEqual(['c', 'd', 'a']);
  });

  it('does not exceed the cap', () => {
    expect(pickLiveEditors(['a', 'b', 'c', 'd'], ['a', 'b', 'c', 'd'], [], 3)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('drops ids that no longer need an editor', () => {
    expect(pickLiveEditors(['b'], ['a'], ['a', 'b'], 3)).toEqual(['b']);
  });
});
