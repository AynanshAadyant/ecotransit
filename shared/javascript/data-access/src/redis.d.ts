import { type RedisClientType } from 'redis';
export interface RedisConfig {
    host?: string | undefined;
    port?: number | undefined;
    password?: string | undefined;
    url?: string | undefined;
}
export declare function createRedisClient(config?: RedisConfig): RedisClientType;
//# sourceMappingURL=redis.d.ts.map