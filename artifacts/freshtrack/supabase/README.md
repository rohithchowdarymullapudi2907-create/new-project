# Supabase setup

FreshTrack uses Supabase Auth and PostgreSQL directly from the browser. Do not add a service-role key to the app; the anon/publishable key is safe for browser use only when Row Level Security is enabled and the policies in the migration are applied.

1. Create a Supabase project.
2. In **Project Settings → API**, copy the Project URL and the anon/publishable key.
3. Add these values to the FreshTrack app's environment:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Run `migrations/20261006_initial_schema.sql` in the Supabase SQL Editor, or apply it with the Supabase CLI:
   ```sh
   supabase link --project-ref YOUR_PROJECT_REF
   supabase db push
   ```
5. In **Authentication → URL Configuration**, set the app URL and allow the app's `/reset-password` route as a redirect URL.
6. Start FreshTrack. Sign-up creates the profile through a database trigger. Food records and notifications are isolated by RLS policies tied to `auth.uid()`.

## Tables and behavior

- `profiles` is linked to `auth.users`; users can only read and update their own profile.
- `food_items` stores date-only expiry dates and keeps consumed items archived with `consumed_at`.
- `notifications` uses `(user_id, dedupe_key)` uniqueness to prevent duplicate expiry reminders.
- `consumption_logs` keeps item-name snapshots so consumption history survives removal of an inventory item.
- `consume_food_item(...)` atomically writes a consumption log and updates or archives the food item.
- `seed_demo_food_items()` adds realistic sample foods only for the authenticated user who requests them, and only when that user's active inventory is empty.
- RLS is enabled for every user-owned table. Never disable it or expose a service-role key in frontend code.

## Applying schema updates

Run future SQL migration files in order using the Supabase CLI or SQL Editor. Back up production data and review migration statements before applying schema changes to a live project.
