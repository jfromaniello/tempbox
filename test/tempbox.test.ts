import { TempBox } from '../src';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('TempBox', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('should store and retrieve keys correctly before expiration', () => {
    const store = new TempBox();
    // Set multiple keys with TTL and ensure they can be retrieved before they expire
    store.set('key1', 'value1', 1000);  // TTL 1000ms
    store.set('key2', 'value2', 2000);  // TTL 2000ms

    // Immediately retrieve the values
    expect(store.get('key1')).toBe('value1');
    expect(store.get('key2')).toBe('value2');

    // Advance time by 500ms (less than both TTLs)
    vi.advanceTimersByTime(500);
    // Both keys should still be retrievable
    expect(store.get('key1')).toBe('value1');
    expect(store.get('key2')).toBe('value2');
  });

  it('should call the onSet and onDelete callbacks', () => {
    const onSetMock = vi.fn();
    const onDeleteMock = vi.fn();
    const store = new TempBox({ onSet: onSetMock, onDelete: onDeleteMock });

    store.set('key1', 'value1', 1000);  // TTL 1000ms
    expect(onSetMock).toHaveBeenCalledWith('key1', 'value1');

    store.delete('key1');
    expect(onDeleteMock).toHaveBeenCalledWith('key1');

    store.delete('keyX');
    expect(onDeleteMock).not.toHaveBeenCalledWith('keyX');
  });

  it('should expire keys with TTL and remove them automatically after the TTL', () => {
    const store = new TempBox();
    // Store a key with a TTL
    store.set('tempKey', 'tempValue', 1000);  // TTL 1000ms

    // Before TTL expires, the key should exist
    vi.advanceTimersByTime(999);
    expect(store.get('tempKey')).toBe('tempValue');
    expect(store.has('tempKey')).toBe(true);

    // Advance time to beyond the TTL
    vi.advanceTimersByTime(2);  // Now total time advanced is 1001ms
    // The key should have expired and been removed
    expect(store.get('tempKey')).toBeUndefined();
    expect(store.has('tempKey')).toBe(false);
  });

  it('should not expire keys that are stored without a TTL', () => {
    const store = new TempBox();
    // Store a key without specifying a TTL (meaning it should never expire)
    store.set('persistentKey', 'persistentValue');

    // Advance time by a large amount
    vi.advanceTimersByTime(10000);
    // The key should still be present
    expect(store.get('persistentKey')).toBe('persistentValue');
    expect(store.has('persistentKey')).toBe(true);
  });

  it('should delete a key correctly using the delete method', () => {
    const store = new TempBox();
    store.set('deleteKey', 'deleteValue', 5000);  // Store a key (TTL is optional here)
    // Ensure the key is initially present
    expect(store.get('deleteKey')).toBe('deleteValue');
    expect(store.has('deleteKey')).toBe(true);

    // Delete the key
    store.delete('deleteKey');
    // After deletion, the key should no longer be accessible
    expect(store.get('deleteKey')).toBeUndefined();
    expect(store.has('deleteKey')).toBe(false);
  });

  it('should return undefined for an expired key and remove it from the store when accessed', () => {
    const store = new TempBox();
    // Store a key with a short TTL
    store.set('expiredKey', 'expiredValue', 100);  // TTL 100ms

    // Advance time beyond the TTL so the key expires
    vi.advanceTimersByTime(101);
    // The key is now expired. Attempt to retrieve it.
    const result = store.get('expiredKey');
    // The result should be undefined since the key expired
    expect(result).toBeUndefined();
    // The act of accessing an expired key should also remove it from the store
    expect(store.has('expiredKey')).toBe(false);
  });

  it('should correctly reflect key existence using has() (including handling expired keys)', () => {
    const store = new TempBox();
    // Store a key with a TTL
    store.set('existsKey', 'existsValue', 200);  // TTL 200ms
    // Initially, has() should return true for the existing key
    expect(store.has('existsKey')).toBe(true);
    // has() should return false for a key that was never set
    expect(store.has('nonExistentKey')).toBe(false);

    // Advance time beyond the TTL to expire the key
    vi.advanceTimersByTime(201);
    // Now has() should indicate the key is gone (expired)
    expect(store.has('existsKey')).toBe(false);

    // Store a key without TTL (never expires)
    store.set('permanentKey', 'permanentValue');
    expect(store.has('permanentKey')).toBe(true);
    // Advance time significantly
    vi.advanceTimersByTime(5000);
    // The key without TTL should still exist
    expect(store.has('permanentKey')).toBe(true);
    expect(store.get('permanentKey')).toBe('permanentValue');
  });

  it('should invoke the onExpire callback with the key and value when a key expires', () => {
    const onExpireMock = vi.fn();
    const store = new TempBox({ onExpire: onExpireMock });
    // Store a key with a TTL and provide the onExpire callback
    store.set('callbackKey', 'callbackValue', 1000);  // TTL 1000ms

    // Advance time to trigger expiration
    vi.advanceTimersByTime(1000);
    // onExpire should have been called once, with the key and value
    expect(onExpireMock).toHaveBeenCalledTimes(1);
    expect(onExpireMock).toHaveBeenCalledWith('callbackKey', 'callbackValue');
    // After expiration, the key should be removed from the store
    expect(store.get('callbackKey')).toBeUndefined();
    expect(store.has('callbackKey')).toBe(false);
  });

  it('should expire keys with different TTLs in the correct order', () => {
    const onExpireMock = vi.fn();
    const store = new TempBox({ onExpire: onExpireMock });
    // Store two keys with different TTLs
    store.set('firstKey', 'firstValue', 300);   // expires after 300ms
    store.set('secondKey', 'secondValue', 500); // expires after 500ms

    // Advance time to just past the first key's TTL
    vi.advanceTimersByTime(300);
    // The first key should have expired by now
    expect(onExpireMock).toHaveBeenCalledTimes(1);
    expect(onExpireMock.mock.calls[0][0]).toBe('firstKey');
    expect(onExpireMock.mock.calls[0][1]).toBe('firstValue');
    // The first key should be removed, second key should still exist
    expect(store.has('firstKey')).toBe(false);
    expect(store.get('secondKey')).toBe('secondValue');
    expect(store.has('secondKey')).toBe(true);

    // Advance time to cover the second key's TTL
    vi.advanceTimersByTime(200);  // (Total time advanced is now 500ms)
    // Now the second key should have expired
    expect(onExpireMock).toHaveBeenCalledTimes(2);
    expect(onExpireMock.mock.calls[1][0]).toBe('secondKey');
    expect(onExpireMock.mock.calls[1][1]).toBe('secondValue');
    expect(store.has('secondKey')).toBe(false);

    // Verify the expiration order via the callback call sequence
    const expiredOrder = onExpireMock.mock.calls.map(call => call[0]);
    expect(expiredOrder).toEqual(['firstKey', 'secondKey']);
  });
});
