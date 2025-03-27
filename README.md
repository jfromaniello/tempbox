# TempBox

**TempBox** is a lightweight, in-memory key-value store for Node.js with built-in TTL (time-to-live) support and proactive expiration. It's not a cache—it's a tiny ephemeral store that keeps your data just long enough, and then lets it go.

---

## ✨ Features

- 🧠 In-memory, in-process store
- ⏳ Per-key TTL support (milliseconds)
- ⏱️ Proactive expiration (via `setTimeout`, not lazy)
- 🔔 Optional `onExpire` callback
- 🚫 No LRU, no persistence, no external dependencies (except for `tinyqueue`)

---

## 🚀 Installation

```bash
npm install tempbox
```

## 🧰 Usage

```javascript
import { TempBox } from "tempbox";

const store = new TempBox();

store.set("session:123", { userId: 1 }, 3000); // expires in 3 seconds
store.set("token:abc", "xyz"); // no expiration

console.log(store.get("session:123")); // { userId: 1 }

setTimeout(() => {
  console.log(store.get("session:123")); // undefined (expired)
}, 3100);
```

## 🔔 Expiration Callback

You can provide a callback that runs when keys expire:

```javascript
const store = new TempBox({
  onExpire: (key, value) => {
    console.log(`Expired: ${key} →`, value);
  },
});
```

## 🧪 API

### `new TempBox(options?)`

Creates a new instance of the store.

#### Available options:

| Option     | Type                                | Default     | Description                         |
| ---------- | ----------------------------------- | ----------- | ----------------------------------- |
| `onExpire` | `(key: string, value: any) => void` | `undefined` | Callback invoked when a key expires |

---

### `store.set(key: string, value: any, ttlMs?: number): void`

Stores a key with an optional TTL in milliseconds.
If no TTL is provided, the value will not expire automatically.

---

### `store.get(key: string): any | undefined`

Returns the stored value if it exists and hasn't expired.
If the key has expired, it will be removed and `undefined` is returned.

---

### `store.has(key: string): boolean`

Returns `true` if the key exists and hasn't expired, `false` otherwise.

---

### `store.delete(key: string): boolean`

Manually removes a key.
Returns `true` if the key existed and was deleted, `false` otherwise.

---

### `store.stop(): void`

Stops the internal expiration timers.
Useful for graceful shutdown or during testing.

## ⚠️ Not a Cache

TempBox is not a cache. It's not optimized for size or eviction strategies (e.g. LRU). It's built for situations where you just want to store small pieces of data for a limited time, entirely in memory.

## 🪶 Lightweight

TempBox only uses tinyqueue internally for efficient scheduling of expirations. No other dependencies.

## 📄 License

MIT 2025 - José F. Romaniello
