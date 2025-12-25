import { PrismaClient } from "./app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL || DATABASE_URL.trim() === "") {
  console.error("ERROR: Missing required DATABASE_URL environment variable.");
  console.error(
    "Please ensure DATABASE_URL is set in your .env file or environment."
  );
  console.error(
    "Expected format: postgresql://user:password@host:port/database or prisma+postgres://..."
  );
  process.exit(1);
}

const isPrismaPostgres = DATABASE_URL.startsWith("prisma+postgres://");

export const prisma = isPrismaPostgres
  ? new PrismaClient({
      accelerateUrl: DATABASE_URL,
    })
  : new PrismaClient({
      adapter: new PrismaPg(
        new Pool({
          connectionString: DATABASE_URL,
        })
      ),
    });
