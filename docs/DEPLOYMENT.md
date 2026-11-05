# Deployment Guide - AoC Group Planner

## Prerequisites

* GitHub account
* Vercel account (free)
* Supabase account (free)
* Discord account (for OAuth)

***

## Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click **New Project**
3. Fill in:
   * **Name**: `aoc-profession-planner`
   * **Region**: Choose closest to your users
   * **Database Password**: Save this securely
4. Wait for project to be created (~2 minutes)

### Create Database Tables

1. Go to **SQL Editor** in the left sidebar
2. Click **New Query**
3. Run all migrations in the `supabase/migrations/` folder in numeric order:
   * `001_initial_schema.sql` - Core database tables
   * `002_character_management.sql` - Character and profile tables
   * ... (continue through all numbered migrations)
   * Latest migration (per-game Discord, role requirements, etc.)
4. Click **Run** for each migration

**Tip**: Use `yarn supabase db push` locally to apply all pending migrations automatically.

### Get API Keys

1. Go to **Settings** → **API**
2. Copy these values:
   * **Project URL**: `https://xxxxx.supabase.co`
   * **anon public key**: `eyJhbGciOiJI...`

***

## Step 2: Set Up Discord OAuth

### Create Discord Application

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **New Application**
3. Name it: `AoC Group Planner`
4. Go to **OAuth2** → **General**
5. Copy **Client ID** and **Client Secret**
6. Add redirect URI:

   ```text
   https://YOUR_PROJECT_ID.supabase.co/auth/v1/callback
   ```

   (Replace YOUR\_PROJECT\_ID with your Supabase project ID)

### Enable Discord in Supabase

1. In Supabase Dashboard → **Authentication** → **Providers**
2. Find **Discord** and enable it
3. Paste **Client ID** and **Client Secret**
4. Save

***

## Step 3: Configure Environment Variables

### For Local Development

Create `.env.local` in your project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### For Vercel (Production)

1. In Vercel project → **Settings** → **Environment Variables**
2. Add these variables for all environments:

| Name                            | Value                              |
| ------------------------------- | ---------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Your Supabase URL                  |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your anon key                      |
| `NEXT_PUBLIC_SITE_URL`          | Your Vercel URL (e.g.,             |
|                                 | <https://aoc-planner.vercel.app>)  |

Set `NEXT_PUBLIC_SITE_URL` to the exact address players normally use, including
HTTPS and the preferred hostname. Discord event links and authentication
callbacks must use the same hostname to reuse saved sessions. With Auth.js,
keep `NEXTAUTH_URL` on that same origin. If the site URL is unset, server-generated
notification links prefer `NEXTAUTH_URL` over a Vercel deployment hostname.
Changing public environment variables requires a rebuild and deployment;
existing Discord messages keep their original links until reposted.

***

## Step 4: Deploy to Vercel

### Connect GitHub to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **Add New...** → **Project**
3. Select your GitHub repository
4. Vercel will auto-detect Next.js settings
5. Add the environment variables from Step 3
6. Click **Deploy**

### Update Discord Redirect

After deployment, add your Vercel URL to Discord OAuth:

1. Go to Discord Developer Portal → Your App → OAuth2
2. Add redirect: `https://YOUR_VERCEL_URL/auth/callback`
3. Also add to Supabase: **Authentication** → **URL Configuration** → **Site URL**

### Automatic Deployments

After initial setup:

* Every push to `develop` → Dev deployment (team workflow)
* Every pull request → Preview deploy
* Production deployment remains controlled separately (for example `main` or manual promotion, based on Vercel project settings)

***

## Step 5: Verify Deployment

1. Open your Vercel URL
2. Click **Login with Discord**
3. Authorize the app
4. Enter a group name (e.g., "my-group")
5. You should become the Admin of the new group
6. Try logging in with another Discord account to test the apply/accept flow

***

## Authentication Flow

```text
User visits /my-group
       ↓
Not logged in? → Redirect to /login → Discord OAuth
       ↓
Logged in, group doesn't exist? → Offer to create (become Admin)
       ↓
Logged in, not a member? → Apply to join (pending state)
       ↓
Pending member? → Wait for Admin/Officer approval
       ↓
Approved member → Full access to group dashboard
```

***

## Troubleshooting

### "Invalid redirect\_uri"

* Check Discord Developer Portal redirect URIs match exactly
* Include both Supabase callback and Vercel callback URLs

### User stuck in loading after Discord login

* Check Supabase Auth logs for errors
* Verify Site URL is set correctly in Supabase

### Missing Supabase environment variables

* Check that all env vars are set in Vercel
* Redeploy after adding variables

### Data not persisting

* Check Supabase → Table Editor to see if data is being saved
* Check browser console for errors
* Verify RLS policies are created (from schema.sql)

***

## Security Notes

| ✅ Safe to commit | ❌ Never commit       |
| ----------------- | --------------------- |
| `.env.example`    | `.env.local`          |
| Source code       | Discord Client Secret |
| Schema SQL        | Service role key      |
