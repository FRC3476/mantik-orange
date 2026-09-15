import { describe, expect, it } from 'vitest';
import { overflowState } from './codeScrollHint';

describe('code example overflow cue', () => {
  it('hides the cue when the full example is already visible', () => {
    expect(overflowState(0, 400, 400)).toEqual({ below: false, above: false });
    expect(overflowState(0, 400, 410)).toEqual({ below: false, above: false });
  });

  it('shows more-below when content is clipped at the top of the example', () => {
    expect(overflowState(0, 400, 1200)).toEqual({ below: true, above: false });
  });

  it('hides more-below after the reader reaches the end', () => {
    expect(overflowState(800, 400, 1200)).toEqual({ below: false, above: true });
  });

  it('keeps more-below visible in the middle of a long example', () => {
    expect(overflowState(200, 400, 1200)).toEqual({ below: true, above: true });
  });
});
