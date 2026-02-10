/**
 * Turnkey API Environment Validation
 * Validates required environment variables at startup to fail fast
 * instead of crashing with unhelpful errors at runtime.
 */

import { z } from 'zod/v4';

const TurnkeyEnvSchema = z.object({
  TURNKEY_API_PRIVATE_KEY: z.string().min(1, 'TURNKEY_API_PRIVATE_KEY is required'),
  TURNKEY_API_PUBLIC_KEY: z.string().min(1, 'TURNKEY_API_PUBLIC_KEY is required'),
  TURNKEY_ORGANIZATION_ID: z.string().min(1, 'TURNKEY_ORGANIZATION_ID is required'),
});

type TurnkeyEnv = z.infer<typeof TurnkeyEnvSchema>;

let _validatedEnv: TurnkeyEnv | null = null;

/**
 * Validates and returns Turnkey environment variables.
 * Throws a descriptive error at startup if any required env vars are missing.
 * Result is cached after first successful validation.
 */
export function getValidatedTurnkeyEnv(): TurnkeyEnv {
  if (_validatedEnv) return _validatedEnv;

  const result = TurnkeyEnvSchema.safeParse({
    TURNKEY_API_PRIVATE_KEY: process.env.TURNKEY_API_PRIVATE_KEY,
    TURNKEY_API_PUBLIC_KEY: process.env.TURNKEY_API_PUBLIC_KEY,
    TURNKEY_ORGANIZATION_ID: process.env.TURNKEY_ORGANIZATION_ID,
  });

  if (!result.success) {
    const missing = result.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(
      `[Turnkey API] Missing required environment variables: ${missing}. ` +
      'Ensure these are set in your .env.local file.'
    );
  }

  _validatedEnv = result.data;
  return _validatedEnv;
}
