import { defineConfig } from 'prisma/config';

// Prisma 7 reads the connection string from here, not from schema.prisma.
// Local default matches infra/compose/compose.dev.yml; CI and servers set DATABASE_URL.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? 'postgresql://archboard:archboard@localhost:5432/archboard',
  },
});
