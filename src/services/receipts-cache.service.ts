import LRUCache from 'lru-cache';

export const receiptsCacheService = new LRUCache<string, string>({
  max: 10000,
});
