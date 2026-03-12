# Prisma Phase 1 Setup (Non-Breaking)

This project now has Prisma initialized in parallel with existing SQL migration scripts.
No existing backend runtime logic was replaced.

## Added in Phase 1

- `prisma/schema.prisma`
- `prisma.config.ts`
- npm scripts:
  - `npm run prisma:pull`
  - `npm run prisma:generate`
  - `npm run prisma:studio`
- `DATABASE_URL` added to `.env`

## Important

Current production/backend logic still uses:

- `src/config/migrate.js`
- `src/config/admin.migrate.js`
- `src/config/settings.migrate.js`

Do not remove those yet.

## Run Introspection

Run this on the environment where MySQL is reachable:

```bash
npm run prisma:pull
npm run prisma:generate
```

If local machine cannot connect to DB (e.g. `P1001`), run on server/VM where DB host is accessible.

## Next Safe Step

After successful `db pull`, start with one read-only endpoint migration to Prisma (e.g. admin user listing), validate output parity, then proceed endpoint-by-endpoint.
