# FreshTrack

FreshTrack helps households keep track of food, focus on items that need attention, and consume food before it expires.

## Features

- Supabase Auth sign-up, login, logout, password recovery, and protected pages
- Food inventory with create, edit, view, confirmed delete, search, filters, and sorting
- Date-safe expiry statuses, countdowns, and configurable in-app reminders
- Duplicate-resistant notifications with read/unread state
- Partial or full consumption logging, with fully consumed items archived
- Opt-in sample pantry loaded as real rows for the current authenticated user
- Dashboard summaries, food distribution, and consumption/expiry analytics
- Responsive desktop navigation and mobile-friendly controls
- Row Level Security policies that isolate every user's profile and records

## Tech stack

- React, TypeScript, Vite, Tailwind CSS
- Wouter, TanStack Query, React Hook Form, Zod
- Supabase JavaScript client, Supabase Auth, PostgreSQL, RLS
- Recharts and Lucide icons

## Supabase setup

1. Create a Supabase project.
2. Copy the Project URL and anon/publishable key from **Project Settings → API**.
3. Add the two app environment variables listed below.
4. Apply `supabase/migrations/20261006_initial_schema.sql` in the Supabase SQL Editor or use the Supabase CLI.
5. Configure Supabase Auth's allowed redirect URLs to include the app's `/reset-password` route.
6. Start the app and create an account.

See [`supabase/README.md`](supabase/README.md) for the complete setup and migration notes.

## Environment variables

| Name | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/publishable key; RLS must remain enabled |

Copy `.env.example` as a local reference. Never put a Supabase service-role key in client code or a Vite environment variable.

## Database schema

The migration creates `profiles`, `food_items`, `notifications`, and `consumption_logs`, plus indexes, `updated_at` triggers, profile creation on auth signup, RLS policies, an atomic `consume_food_item` function, and a user-scoped `seed_demo_food_items` function.

## Authentication

Supabase Auth handles credentials and sessions. A Postgres trigger creates each profile from the newly registered auth user. Protected app routes require a valid Supabase session; password recovery returns to `/reset-password`.

## Local development

```sh
pnpm install
pnpm --filter @workspace/freshtrack run dev
```

When Supabase variables are missing, the app shows setup guidance instead of silently switching to mock data or local storage.

## Replit deployment

Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to the app's Replit environment, configure the matching Supabase Auth redirect URL, and publish the FreshTrack artifact. Apply database migrations in Supabase separately; publishing the frontend does not apply external Supabase schema changes.

## Troubleshooting

- **Supabase configuration required:** Set both Vite environment variables, then restart the app.
- **Table not found:** Apply the SQL migration to the same Supabase project referenced by `VITE_SUPABASE_URL`.
- **Permission denied:** Confirm RLS is enabled and the migration policies are present; do not disable RLS.
- **Password reset returns to the wrong page:** Add the exact app origin and `/reset-password` route to Supabase Auth's allowed redirect URLs.
- **No email arrives:** Review Supabase Auth email settings and spam/junk folders.

## Demo flow

Open the landing page, create an account, add food with an expiry date, then review the dashboard's priorities and notifications. Filter inventory, mark an item consumed, and view the updated analytics.
