import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
try { process.loadEnvFile(path.join(projectRoot, ".env")); } catch {}

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8787),
  HOST: z.string().default("127.0.0.1"),
  DEMO_MODE: z.string().default("true").transform((value) => value === "true"),
  DATABASE_PATH: z.string().default("./data/mainhaus.sqlite"),
  UPLOAD_DIR: z.string().default("./data/uploads"),
  SESSION_SECRET: z.string().min(32).default("local-mainhaus-session-secret-change-me"),
  DEMO_ADMIN_TOKEN: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().optional(),
  GROQ_API_KEYS: z.string().optional(),
  GROQ_MODEL: z.string().optional(),
  GOOGLE_MAPS_SERVER_KEY: z.string().optional(),
});

export type Config = ReturnType<typeof loadConfig>;

export function loadConfig(overrides: Record<string, string | undefined> = {}) {
  const env = EnvSchema.parse({ ...process.env, ...overrides });
  return {
    ...env,
    databasePath: path.resolve(projectRoot, env.DATABASE_PATH),
    uploadDir: path.resolve(projectRoot, env.UPLOAD_DIR),
    openAiEnabled: Boolean(env.OPENAI_API_KEY && env.OPENAI_MODEL),
    groqApiKeys: [...new Set((env.GROQ_API_KEYS ?? "").split(",").map((key) => key.trim()).filter(Boolean))],
    groqEnabled: Boolean(env.GROQ_API_KEYS && env.GROQ_MODEL),
    googleMapsEnabled: Boolean(env.GOOGLE_MAPS_SERVER_KEY),
  };
}
