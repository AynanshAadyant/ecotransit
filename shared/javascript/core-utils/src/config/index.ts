import { z, type ZodType } from 'zod';

export function loadConfig<T>(schema: ZodType<T>, env: NodeJS.ProcessEnv = process.env): T {
  const result = schema.safeParse(env);
  if (!result.success) {
    const errorDetails = result.error.errors
      .map((err) => `  - ${err.path.join('.')}: ${err.message}`)
      .join('\n');
    console.error(`\n❌ Configuration validation failed at boot:\n${errorDetails}\n`);
    throw new Error(`Configuration validation failed at boot:\n${errorDetails}`);
  }
  return result.data;
}

export { z };
