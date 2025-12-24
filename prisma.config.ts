import "dotenv/config";
import { defineConfig } from "prisma/config";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL || DATABASE_URL.trim() === "") {
  throw new Error(
    "Missing required DATABASE_URL environment variable. " +
      "Please ensure DATABASE_URL is set in your environment configuration. " +
      "You can set it in a .env file in the project root (e.g., DATABASE_URL=postgresql://user:password@localhost:5432/dbname) " +
      "or export it in your shell environment."
  );
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: DATABASE_URL,
  },
});
