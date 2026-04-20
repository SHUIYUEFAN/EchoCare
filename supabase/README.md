# Supabase (Sprint 1)

Create a project at [supabase.com](https://supabase.com), then:

1. Add tables for `families`, `profiles`, `messages` (with RLS).
2. Enable **Realtime** on `messages` (or use Broadcast from Edge Functions).
3. Copy `.env.example` from repo root into `apps/*` / `services/api` as needed.

Local CLI (optional):

```bash
npx supabase init
npx supabase start
```

Migrations can live under `supabase/migrations/` once you adopt the CLI.
