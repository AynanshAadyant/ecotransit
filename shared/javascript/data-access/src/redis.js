import { createClient } from 'redis';
export function createRedisClient(config = {}) {
    const host = config.host || process.env['REDIS_HOST'] || 'localhost';
    const port = config.port || parseInt(process.env['REDIS_PORT'] || '6379', 10);
    const password = config.password || process.env['REDIS_PASSWORD'] || undefined;
    const url = config.url || (password ? `redis://:${password}@${host}:${port}` : `redis://${host}:${port}`);
    const client = createClient({
        url,
    });
    client.on('error', (err) => {
        console.error('[Redis Client Error]', err);
    });
    return client;
}
//# sourceMappingURL=redis.js.map