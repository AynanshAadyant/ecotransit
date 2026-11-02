const Redis = require('ioredis');

let redisClient = null;
let isUsingMemoryRedis = false;

// Simple in-memory fallback store when Redis is unavailable
class InMemoryRedis {
  constructor() {
    this.store = new Map();
    this.ttls = new Map();
  }

  _isExpired(key) {
    const expireAt = this.ttls.get(key);
    if (expireAt && Date.now() > expireAt) {
      this.store.delete(key);
      this.ttls.delete(key);
      return true;
    }
    return false;
  }

  async get(key) {
    if (this._isExpired(key)) return null;
    const val = this.store.get(key);
    return val !== undefined ? String(val) : null;
  }

  async set(key, value) {
    this.store.set(key, value);
    this.ttls.delete(key);
    return 'OK';
  }

  async setex(key, seconds, value) {
    this.store.set(key, value);
    this.ttls.set(key, Date.now() + seconds * 1000);
    return 'OK';
  }

  async del(...keys) {
    let count = 0;
    for (const key of keys.flat()) {
      if (this.store.delete(key)) count++;
      this.ttls.delete(key);
    }
    return count;
  }

  async keys(pattern = '*') {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    const matched = [];
    for (const key of this.store.keys()) {
      if (!this._isExpired(key) && regex.test(key)) {
        matched.push(key);
      }
    }
    return matched;
  }

  async hset(key, ...fieldValues) {
    if (this._isExpired(key)) this.store.delete(key);
    let hash = this.store.get(key);
    if (!hash || typeof hash !== 'object') {
      hash = {};
      this.store.set(key, hash);
    }

    if (fieldValues.length === 1 && typeof fieldValues[0] === 'object') {
      Object.assign(hash, fieldValues[0]);
    } else {
      for (let i = 0; i < fieldValues.length; i += 2) {
        hash[fieldValues[i]] = fieldValues[i + 1];
      }
    }
    return 1;
  }

  async hgetall(key) {
    if (this._isExpired(key)) return {};
    const hash = this.store.get(key);
    return hash && typeof hash === 'object' ? { ...hash } : {};
  }

  async flushall() {
    this.store.clear();
    this.ttls.clear();
    return 'OK';
  }

  async ping() {
    return 'PONG';
  }
}

const memoryRedisInstance = new InMemoryRedis();

const getRedisConfig = () => {
  if (process.env.REDIS_URL) {
    return process.env.REDIS_URL;
  }
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    retryStrategy: () => null // don't spam retries on init
  };
};

const initRedis = async () => {
  if (redisClient) return redisClient;

  const config = getRedisConfig();
  const testClient = new Redis(config);

  testClient.on('error', () => {
    // Suppress unhandled error log during initial connection attempt
  });

  try {
    await testClient.connect();
    console.log(`[Redis] Connected to Redis server at ${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`);
    redisClient = testClient;
    isUsingMemoryRedis = false;
    return redisClient;
  } catch (err) {
    console.warn(`[Redis] External Redis unavailable (${err.message}). Using resilient in-memory Redis fallback.`);
    isUsingMemoryRedis = true;
    redisClient = memoryRedisInstance;
    return redisClient;
  }
};

// Proxy to allow seamless method calls before or after init
const redisProxy = new Proxy({}, {
  get(target, prop) {
    if (prop === 'isUsingMemory') {
      return () => isUsingMemoryRedis;
    }
    if (prop === 'initRedis') {
      return initRedis;
    }
    return async (...args) => {
      if (!redisClient) {
        await initRedis();
      }
      if (typeof redisClient[prop] === 'function') {
        return redisClient[prop](...args);
      }
      return undefined;
    };
  }
});

module.exports = redisProxy;
