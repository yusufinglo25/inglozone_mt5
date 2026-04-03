import path from "node:path";
import * as dotenv from "dotenv";
import { defineConfig } from "prisma/config";

const envFileMap: Record<string, string> = {
  production: ".env.prod",
  staging: ".env.staging",
  development: ".env.dev",
  dev: ".env.dev",
};

const nodeEnv = String(process.env.NODE_ENV || "development").toLowerCase();
const envFile = envFileMap[nodeEnv] || ".env.dev";
const envPath = path.resolve(process.cwd(), envFile);

dotenv.config({ path: envPath });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
