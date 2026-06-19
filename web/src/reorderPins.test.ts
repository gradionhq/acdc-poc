import { describe, expect, it } from 'vitest';
import { dropPin, movePin, sameOrder } from './reorderPins';

describe('movePin', () => {
  it('moves a note up by one position', () => {
    expect(movePin(['a', 'b', 'c'], 'b', 'up')).toEqual(['b', 'a', 'c']);
  });

  it('moves a note down by one position', () => {
    expect(movePin(['a', 'b', 'c'], 'b', 'down')).toEqual(['a', 'c', 'b']);
  });

  it('is a no-op when moving the first note up', () => {
    expect(movePin(['a', 'b', 'c'], 'a', 'up')).toEqual(['a', 'b', 'c']);
  });

  it('is a no-op when moving the last note down', () => {
    expect(movePin(['a', 'b', 'c'], 'c', 'down')).toEqual(['a', 'b', 'c']);
  });

  it('is a no-op when the id is not present', () => {
    expect(movePin(['a', 'b'], 'z', 'up')).toEqual(['a', 'b']);
  });

  it('does not mutate the input array', () => {
    const order = ['a', 'b', 'c'];
    movePin(order, 'b', 'up');
    expect(order).toEqual(['a', 'b', 'c']);
  });
});

describe('dropPin', () => {
  it('moves a note downward to the target position', () => {
    expect(dropPin(['a', 'b', 'c', 'd'], 'a', 'c')).toEqual(['b', 'c', 'a', 'd']);
  });

  it('moves a note upward to the target position', () => {
    expect(dropPin(['a', 'b', 'c', 'd'], 'd', 'b')).toEqual(['a', 'd', 'b', 'c']);
  });

  it('moving onto an adjacent note swaps them', () => {
    expect(dropPin(['a', 'b', 'c'], 'a', 'b')).toEqual(['b', 'a', 'c']);
  });

  it('is a no-op when dropping a note onto itself', () => {
    expect(dropPin(['a', 'b', 'c'], 'b', 'b')).toEqual(['a', 'b', 'c']);
  });

  it('is a no-op when the dragged id is missing', () => {
    expect(dropPin(['a', 'b'], 'z', 'a')).toEqual(['a', 'b']);
  });

  it('is a no-op when the target id is missing', () => {
    expect(dropPin(['a', 'b'], 'a', 'z')).toEqual(['a', 'b']);
  });

  it('does not mutate the input array', () => {
    const order = ['a', 'b', 'c'];
    dropPin(order, 'a', 'c');
    expect(order).toEqual(['a', 'b', 'c']);
  });
});

describe('sameOrder', () => {
  it('is true for identical orders', () => {
    expect(sameOrder(['a', 'b'], ['a', 'b'])).toBe(true);
  });

  it('is false for different lengths', () => {
    expect(sameOrder(['a'], ['a', 'b'])).toBe(false);
  });

  it('is false for the same members in a different order', () => {
    expect(sameOrder(['a', 'b'], ['b', 'a'])).toBe(false);
  });
});
