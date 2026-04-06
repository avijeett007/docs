interface CacheItem<T> {
  value: T;
  timestamp: number;
}

class Cache {
  private static instance: Cache;
  private cache: Map<string, CacheItem<any>>;
  private ttl: number; // Time to live in milliseconds

  private constructor(ttl: number = 5 * 60 * 1000) { // Default 5 minutes
    this.cache = new Map();
    this.ttl = ttl;
  }

  static getInstance(): Cache {
    if (!Cache.instance) {
      Cache.instance = new Cache();
    }
    return Cache.instance;
  }

  set<T>(key: string, value: T): void {
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
    });
  }

  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;

    const now = Date.now();
    if (now - item.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    return item.value as T;
  }

  clear(): void {
    this.cache.clear();
  }
}

export const analyticsCache = Cache.getInstance();
