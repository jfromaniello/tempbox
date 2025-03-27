import TinyQueue from 'tinyqueue';

type QueuedValue = {
  expiresAt: number;
  key: string;
};

type MapType = {
  value: any;
  expiresAt: number;
}

type Params = {
  onExpire?: (key: any, value: any) => void;
  onSet?: (key: any, value: any) => void;
  onDelete?: (key: any) => void;
  onClear?: () => void;
}

/**
 * TempBox is a simple in-memory key-value store with expiration times.
 * It allows you to set a key with an optional time-to-live (TTL) in milliseconds.
 * Once the TTL expires, the key is automatically removed from the store.
 */
export class TempBox {
  private data: Map<any, any>;
  private timer: NodeJS.Timeout | null;
  private queue: TinyQueue<QueuedValue>;
  private onExpire?: (key: any, value: any) => void;
  private onClear?: () => void;
  private onSet?: (key: any, value: any) => void;
  private onDelete?: (key: any) => void;

  constructor(params?: Params) {
    this.data = new Map<string, MapType>();
    this.queue = new TinyQueue<QueuedValue>([], (a, b) => a.expiresAt - b.expiresAt);
    this.timer = null;

    this.onExpire = params?.onExpire;
    this.onSet = params?.onSet;
    this.onDelete = params?.onDelete;
    this.onClear = params?.onClear;
  }

  /**
   *
   * Set a key with an optional time-to-live (TTL) in milliseconds.
   *
   * @param key {string} - The key to store
   * @param value {any} - The value to store
   * @param [ttlMs = null] {number} - The time-to-live (TTL) in milliseconds. If not provided, the key will never expire.
   */
  set(key: string, value: any, ttlMs?: number) {
    const now = Date.now();
    const expiresAt = ttlMs ? now + ttlMs : null;

    this.data.set(key, { value, expiresAt });

    if (expiresAt) {
      this.queue.push({ key, expiresAt });
      this._scheduleNext();
    }

    this.onSet?.(key, value);
  }

  /**
   *
   * Get the value of a key if it exists and has not expired.
   *
   * @param key {string} - The key to retrieve
   * @returns {any} - The value of the key, or undefined if the key does not exist or has expired.
   */
  get(key: string): any {
    const entry = this.data.get(key);
    if (!entry) return undefined;

    if (entry.expiresAt && entry.expiresAt <= Date.now()) {
      this._expire(key, entry);
      return undefined;
    }

    return entry.value;
  }

  /**
   *
   * Delete a key from the store.
   *
   * @param key {string} - The key to delete
   * @returns {boolean} - True if the key was deleted, false if the key did not exist.
   */
  delete(key: string): boolean {
    const deleted = this.data.delete(key);
    if (deleted) {
      this.onDelete?.(key);
    }
    return deleted;
  }

  /**
   *
   * Check if a key exists in the store and has not expired.
   *
   * @param key {string} - The key to check
   * @returns {boolean} - True if the key exists and has not expired, false otherwise.
   */
  has(key: string): boolean {
    return this.get(key) !== undefined;
  }


  clear() {
    this.data.clear();
    this.stop();
    while (this.queue.length > 0) this.queue.pop();
    this.onClear?.();
  }

  _expire(key: string, entry: any) {
    this.data.delete(key);
    this.onExpire?.(key, entry.value);
  }

  _scheduleNext() {
    if (this.timer) clearTimeout(this.timer);

    while (this.queue.length > 0) {
      const { key, expiresAt } = this.queue.peek()!;
      const entry = this.data.get(key);

      if (!entry || entry.expiresAt !== expiresAt) {
        this.queue.pop(); // stale entry
        continue;
      }

      const delay = Math.max(0, expiresAt - Date.now());
      this.timer = setTimeout(() => {
        this.queue.pop();
        this._expire(key, entry);
        this._scheduleNext(); // schedule next item
      }, delay);
      this.timer.unref?.(); // no impide que el proceso salga
      break;
    }
  }

  /**
   * Stop the store from expiring keys.
   */
  stop() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}
