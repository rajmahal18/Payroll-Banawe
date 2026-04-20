# Absensya Payroll MVP

Owner-first payroll and attendance PWA built with Next.js, React, TypeScript, Prisma, and Postgres.

## Included MVP features

- Admin login using environment-based seeded account
- Employee master list with daily rate and status
- Attendance encoding by owner
- Absence-only attendance flow
- Advances tracking with running balance
- Payables tracking with running balance
- Payroll settings for:
  - Daily
  - Weekly
  - Twice a month
  - Monthly
- Payroll generation based on the selected schedule
- Payroll period review and finalize flow
- PWA manifest and service worker
- `vercel.json` set to `sin1`

## Stack

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- Prisma ORM
- PostgreSQL
- PWA-ready

## Environment setup

Copy `.env.example` to `.env` and update the values.

```bash
cp .env.example .env
```

Required values:

- `DATABASE_URL`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `SESSION_SECRET`
- `NEXT_PUBLIC_APP_NAME`
- `NEXT_PUBLIC_COMPANY_NAME`

## Local setup

```bash
npm install
npx prisma migrate dev --name init
npm run seed
npm run dev
```

Open:

```bash
http://localhost:3000
```

## Production setup

Run the same Prisma migration flow against your production database:

```bash
npx prisma migrate deploy
npm run seed
npm run build
npm run start
```

## Notes about payroll behavior

### Attendance
- Active employees are expected to be present by default.
- Owner marks absences manually.
- Attendance is stored per employee per date.

### Payroll generation
The system uses the selected reference date plus the configured payroll frequency:

- **Daily**: one payroll period per day
- **Weekly**: uses the selected weekday as the sahod day
- **Twice a month**: uses two selected payroll days, usually 15 and 30
- **Monthly**: uses one selected payroll day each month

### Deductions
When payroll is generated, open advances and payables are deducted in order until the employee's gross pay is exhausted.

## Seed behavior
Running:

```bash
npm run seed
```

will:

- create or update the admin account based on `.env`
- create default payroll settings if none exist
- create sample employees only when the employee table is empty

## Main folders

- `app/` - pages, layouts, server actions
- `components/` - reusable UI pieces
- `lib/` - auth, payroll logic, prisma client, utils
- `prisma/` - schema and seed script
- `public/` - service worker and icons

## Suggested next improvements

- edit and delete flows for records
- printable payslips
- export to CSV or Excel
- role-based access for encoder vs owner
- holiday and bonus handling
- richer offline sync for the PWA
