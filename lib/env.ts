import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  TOMTOM_API_KEY: z.string().min(1).optional(),
  TOMTOM_BASE_URL: z.url().default("https://api.tomtom.com"),
  TOMTOM_FLOW_VERSION: z.coerce.number().int().positive().default(4),
  TOMTOM_FLOW_STYLE: z.enum(["absolute", "relative"]).default("absolute"),
  TOMTOM_FLOW_ZOOM: z.coerce.number().int().min(0).max(22).default(12),
  TOMTOM_FLOW_UNIT: z.enum(["kmph", "mph"]).default("kmph"),
  INGEST_TIMEZONE: z.string().min(1).default("Africa/Cairo"),
  INGEST_ACTIVE_START_HOUR_LOCAL: z.coerce
    .number()
    .int()
    .min(0)
    .max(23)
    .default(7),
  INGEST_ACTIVE_END_HOUR_LOCAL: z.coerce
    .number()
    .int()
    .min(0)
    .max(24)
    .default(22),
  INGEST_DAILY_REQUEST_CAP: z.coerce.number().int().positive().default(2450),
  INGEST_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  INGEST_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(2),
  BACKEND_API_BASE_URL: z.string().trim().optional(),
  BACKEND_API_SECRET: z.string().trim().optional(),
  BACKEND_API_TIMEOUT_MS: z.coerce.number().int().positive().default(8000),
  API_REQUIRE_BACKEND_SECRET: z
    .enum(["true", "false", "1", "0"])
    .default("false")
    .transform((value) => value === "true" || value === "1"),
  BACKEND_PROXY_ADMIN_REFRESH_ENABLED: z
    .enum(["true", "false", "1", "0"])
    .default("false")
    .transform((value) => value === "true" || value === "1"),
  ADMIN_REFRESH_ENABLED: z
    .enum(["true", "false", "1", "0"])
    .default("false")
    .transform((value) => value === "true" || value === "1"),
  ADMIN_REFRESH_MAX_SECONDS: z.coerce.number().int().positive().default(420),
});

export type AppEnv = z.infer<typeof envSchema>;

let cachedEnv: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (!cachedEnv) {
    cachedEnv = envSchema.parse(process.env);
  }

  return cachedEnv;
}

export function isTomTomConfigured(): boolean {
  return Boolean(getEnv().TOMTOM_API_KEY);
}
