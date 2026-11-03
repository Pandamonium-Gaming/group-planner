-- Baseline migration squashed from 68 migrations
-- Generated: 2026-02-04 22:15:42
-- Note: Migrations 046 and 047 excluded (clans→groups renaming already applied inline)


-- =====================================================
-- SOURCE: 001_initial_schema.sql
-- =====================================================
-- =====================================================
-- AoC Guild Planner - Database Schema
-- Phase 1: Authentication & Security
-- =====================================================

-- Track applied migrations (must be first for all future DBs)
CREATE TABLE IF NOT EXISTS migration_history (
  id SERIAL PRIMARY KEY,
  filename TEXT NOT NULL,
  applied_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- CORE TABLES
-- =====================================================

-- groups table
CREATE TABLE groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID  -- Will reference users table after it's created
);

-- Users table (linked to Supabase Auth)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  discord_id VARCHAR(50) UNIQUE,
  discord_username VARCHAR(100),
  discord_avatar VARCHAR(255),
  display_name VARCHAR(100),  -- Custom name, defaults to discord_username
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key to groups.created_by after users table exists
ALTER TABLE groups ADD CONSTRAINT fk_groups_created_by 
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

-- =====================================================
-- TRIGGER: Auto-create user record on auth signup
-- =====================================================

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, discord_id, discord_username, discord_avatar, display_name)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'provider_id',
    NEW.raw_user_meta_data->>'user_name',
    NEW.raw_user_meta_data->>'avatar_url',
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'user_name')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call the function when a new user signs up
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Group memberships with status and roles
CREATE TABLE group_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'pending' 
    CHECK (role IN ('admin', 'officer', 'member', 'pending')),
  is_creator BOOLEAN DEFAULT FALSE,
  applied_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES users(id),
  UNIQUE(group_id, user_id)
);

-- Members table (game characters/players in clan)
CREATE TABLE members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,  -- Optional: link to app user
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Member professions (one row per profession per member)
CREATE TABLE member_professions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID REFERENCES members(id) ON DELETE CASCADE,
  profession VARCHAR(50) NOT NULL,
  rank INTEGER NOT NULL CHECK (rank >= 1 AND rank <= 4),
  UNIQUE(member_id, profession)
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX idx_members_clan_id ON members(group_id);
CREATE INDEX idx_members_user_id ON members(user_id);
CREATE INDEX idx_member_professions_member_id ON member_professions(member_id);
CREATE INDEX idx_groups_slug ON groups(slug);
CREATE INDEX idx_clan_members_clan_id ON group_members(group_id);
CREATE INDEX idx_clan_members_user_id ON group_members(user_id);

-- =====================================================
-- HELPER FUNCTION
-- =====================================================

-- Function to check if user has an approved role in a clan (avoids recursion)
CREATE OR REPLACE FUNCTION user_has_clan_role(check_group_id UUID, check_user_id UUID, allowed_roles TEXT[])
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM group_members 
    WHERE group_id = check_group_id 
    AND user_id = check_user_id 
    AND role = ANY(allowed_roles)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_professions ENABLE ROW LEVEL SECURITY;

-- USERS: Everyone can read, users can update own profile
CREATE POLICY "Users can view all users" ON users
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Auth can insert user on signup" ON users
  FOR INSERT WITH CHECK (id = auth.uid());

-- groups: Public read for checking if clan exists, full access for members
-- We need public read so users can check if a clan exists before creating/joining
CREATE POLICY "Anyone can view groups" ON groups
  FOR SELECT USING (true);

CREATE POLICY "Anyone can create clan" ON groups
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admin can update clan" ON groups
  FOR UPDATE USING (
    user_has_clan_role(id, auth.uid(), ARRAY['admin'])
  );

-- group_members: Simple policies to avoid recursion
-- Users can view their own memberships
CREATE POLICY "Users can view own membership" ON group_members
  FOR SELECT USING (user_id = auth.uid());

-- Admins/Officers can view all members in their groups (uses SECURITY DEFINER function)
CREATE POLICY "group managers can view members" ON group_members
  FOR SELECT USING (
    user_has_clan_role(group_id, auth.uid(), ARRAY['admin', 'officer', 'member'])
  );

-- Anyone can apply to join a clan (insert as pending with own user_id)
CREATE POLICY "Anyone can apply to clan" ON group_members
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL 
    AND user_id = auth.uid() 
    AND role = 'pending'
  );

-- Special policy: Allow inserting as admin when creating clan (for the creator)
CREATE POLICY "Creator becomes admin" ON group_members
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL 
    AND user_id = auth.uid() 
    AND role = 'admin'
    AND is_creator = TRUE
  );

-- Admin/Officer can update memberships (accept/reject)
CREATE POLICY "Admin/Officer manage memberships" ON group_members
  FOR UPDATE USING (
    user_has_clan_role(group_id, auth.uid(), ARRAY['admin', 'officer'])
  );

-- Admin can delete memberships, users can leave
CREATE POLICY "Admin can remove or user can leave" ON group_members
  FOR DELETE USING (
    user_id = auth.uid()
    OR user_has_clan_role(group_id, auth.uid(), ARRAY['admin'])
  );

-- MEMBERS: Approved clan members can view
CREATE POLICY "Approved members can view members" ON members
  FOR SELECT USING (
    user_has_clan_role(group_id, auth.uid(), ARRAY['admin', 'officer', 'member'])
  );

CREATE POLICY "Admin/Officer manage members" ON members
  FOR INSERT WITH CHECK (
    user_has_clan_role(group_id, auth.uid(), ARRAY['admin', 'officer'])
  );

CREATE POLICY "Admin/Officer update members" ON members
  FOR UPDATE USING (
    user_has_clan_role(group_id, auth.uid(), ARRAY['admin', 'officer'])
  );

CREATE POLICY "Admin/Officer delete members" ON members
  FOR DELETE USING (
    user_has_clan_role(group_id, auth.uid(), ARRAY['admin', 'officer'])
  );

-- MEMBER_PROFESSIONS: Follow member access rules
CREATE POLICY "View professions if can view member" ON member_professions
  FOR SELECT USING (
    member_id IN (
      SELECT id FROM members WHERE user_has_clan_role(group_id, auth.uid(), ARRAY['admin', 'officer', 'member'])
    )
  );

CREATE POLICY "Modify professions" ON member_professions
  FOR ALL USING (
    member_id IN (
      SELECT m.id FROM members m
      WHERE user_has_clan_role(m.group_id, auth.uid(), ARRAY['admin', 'officer'])
      OR (user_has_clan_role(m.group_id, auth.uid(), ARRAY['member']) AND m.user_id = auth.uid())
    )
  );

-- =====================================================
-- HELPER FUNCTION: Create user profile on signup
-- =====================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, discord_id, discord_username, discord_avatar, display_name)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'provider_id',
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'full_name'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create user profile
-- (Already created above after users table definition)

-- Record this migration as applied
INSERT INTO migration_history (filename) VALUES ('001_initial_schema.sql');

-- =====================================================
-- SOURCE: 002_character_management.sql
-- =====================================================
-- =====================================================
-- Phase 2 Migration: Character Management
-- Run this AFTER the initial schema.sql
-- =====================================================

-- Add race enum type
DO $$ BEGIN
  CREATE TYPE race AS ENUM (
    'kaelar', 'vaelune',           -- Aela Humans
    'dunir', 'nikua',              -- Dünzenkell Dwarves  
    'empyrean', 'pyrai',           -- Pyrian Elves
    'renkai', 'vek',               -- Kaivek Orcs
    'tulnar'                       -- Tulnar
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add archetype enum type
DO $$ BEGIN
  CREATE TYPE archetype AS ENUM (
    'tank', 'cleric', 'mage', 'fighter', 
    'ranger', 'bard', 'rogue', 'summoner'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add new columns to members table
ALTER TABLE members 
  ADD COLUMN IF NOT EXISTS race race,
  ADD COLUMN IF NOT EXISTS primary_archetype archetype,
  ADD COLUMN IF NOT EXISTS secondary_archetype archetype,
  ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_main BOOLEAN DEFAULT FALSE;

-- Add level constraint
DO $$ BEGIN
  ALTER TABLE members ADD CONSTRAINT members_level_check 
    CHECK (level >= 1 AND level <= 50);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create index for main characters
CREATE INDEX IF NOT EXISTS idx_members_is_main ON members(user_id, is_main) WHERE is_main = TRUE;

-- Comment for documentation
COMMENT ON COLUMN members.race IS 'Character race (kaelar, vaelune, dunir, etc.)';
COMMENT ON COLUMN members.primary_archetype IS 'Primary archetype chosen at character creation';
COMMENT ON COLUMN members.secondary_archetype IS 'Secondary archetype chosen at level 25';
COMMENT ON COLUMN members.level IS 'Character level (1-50)';
COMMENT ON COLUMN members.is_main IS 'Whether this is the users main character';

-- Record this migration as applied
INSERT INTO migration_history (filename) VALUES ('002_character_management.sql');

-- =====================================================
-- SOURCE: 003_events.sql
-- =====================================================
-- =====================================================
-- 003_events.sql - Events, RSVPs, Announcements
-- =====================================================

-- Event types
DO $$ BEGIN
  CREATE TYPE event_type AS ENUM ('raid', 'siege', 'gathering', 'social', 'other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE rsvp_status AS ENUM ('attending', 'maybe', 'declined');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add timezone to users table
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'UTC';

-- Events table
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  title VARCHAR(100) NOT NULL,
  description TEXT,
  event_type event_type DEFAULT 'other',
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  location VARCHAR(100),
  max_attendees INTEGER,
  is_cancelled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Event RSVPs
CREATE TABLE IF NOT EXISTS event_rsvps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  character_id UUID REFERENCES members(id) ON DELETE SET NULL,
  status rsvp_status DEFAULT 'attending',
  note TEXT,
  responded_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

-- Group announcements
CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  title VARCHAR(100) NOT NULL,
  content TEXT NOT NULL,
  is_pinned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_events_clan_id ON events(group_id);
CREATE INDEX IF NOT EXISTS idx_events_starts_at ON events(starts_at);
CREATE INDEX IF NOT EXISTS idx_event_rsvps_event_id ON event_rsvps(event_id);
CREATE INDEX IF NOT EXISTS idx_event_rsvps_user_id ON event_rsvps(user_id);
CREATE INDEX IF NOT EXISTS idx_announcements_clan_id ON announcements(group_id);
CREATE INDEX IF NOT EXISTS idx_announcements_pinned ON announcements(group_id, is_pinned) WHERE is_pinned = TRUE;

-- RLS Policies for events
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Group members can view events"
  ON events FOR SELECT
  USING (user_has_clan_role(group_id, auth.uid(), ARRAY['admin', 'officer', 'member', 'trial']));

CREATE POLICY "Officers+ can create events"
  ON events FOR INSERT
  WITH CHECK (user_has_clan_role(group_id, auth.uid(), ARRAY['admin', 'officer']));

CREATE POLICY "Officers+ can update events"
  ON events FOR UPDATE
  USING (user_has_clan_role(group_id, auth.uid(), ARRAY['admin', 'officer']));

CREATE POLICY "Officers+ can delete events"
  ON events FOR DELETE
  USING (user_has_clan_role(group_id, auth.uid(), ARRAY['admin', 'officer']));

-- RLS Policies for RSVPs
ALTER TABLE event_rsvps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Group members can view RSVPs"
  ON event_rsvps FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM events e 
      WHERE e.id = event_id 
      AND user_has_clan_role(e.group_id, auth.uid(), ARRAY['admin', 'officer', 'member', 'trial'])
    )
  );

CREATE POLICY "Members can RSVP"
  ON event_rsvps FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM events e 
      WHERE e.id = event_id 
      AND user_has_clan_role(e.group_id, auth.uid(), ARRAY['admin', 'officer', 'member', 'trial'])
    )
  );

CREATE POLICY "Users can update own RSVP"
  ON event_rsvps FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own RSVP"
  ON event_rsvps FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for announcements
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Group members can view announcements"
  ON announcements FOR SELECT
  USING (user_has_clan_role(group_id, auth.uid(), ARRAY['admin', 'officer', 'member']));

CREATE POLICY "Officers+ can create announcements"
  ON announcements FOR INSERT
  WITH CHECK (user_has_clan_role(group_id, auth.uid(), ARRAY['admin', 'officer']));

CREATE POLICY "Officers+ can update announcements"
  ON announcements FOR UPDATE
  USING (user_has_clan_role(group_id, auth.uid(), ARRAY['admin', 'officer']));

CREATE POLICY "Officers+ can delete announcements"
  ON announcements FOR DELETE
  USING (user_has_clan_role(group_id, auth.uid(), ARRAY['admin', 'officer']));

-- Comments
COMMENT ON TABLE events IS 'Clan events like raids, sieges, gatherings';
COMMENT ON TABLE event_rsvps IS 'Member responses to events';
COMMENT ON TABLE announcements IS 'Clan announcements and pinned messages';
COMMENT ON COLUMN users.timezone IS 'User timezone for displaying event times (IANA format)';

-- Record this migration as applied
INSERT INTO migration_history (filename) VALUES ('003_events.sql');

-- =====================================================
-- SOURCE: 004_discord.sql
-- =====================================================
-- Migration 004: Discord Webhooks
-- Adds webhook URL support for clan notifications

-- Add discord webhook URL to groups table
ALTER TABLE groups ADD COLUMN group_webhook_url TEXT;

-- Add notification preferences
ALTER TABLE groups ADD COLUMN notify_on_events BOOLEAN DEFAULT true;
ALTER TABLE groups ADD COLUMN notify_on_announcements BOOLEAN DEFAULT true;

-- Comment for clarity
COMMENT ON COLUMN groups.group_webhook_url IS 'Discord webhook URL for clan notifications';
COMMENT ON COLUMN groups.notify_on_events IS 'Whether to send Discord notifications for new events';
COMMENT ON COLUMN groups.notify_on_announcements IS 'Whether to send Discord notifications for announcements';

-- Record this migration as applied
INSERT INTO migration_history (filename) VALUES ('004_discord.sql');

-- =====================================================
-- SOURCE: 005_parties.sql
-- =====================================================
-- Migration 005: Parties, Recruitment & Public Profiles
-- Adds party system, recruitment, and public clan features

-- =====================================================
-- PARTY SYSTEM
-- =====================================================

-- Party templates table
CREATE TABLE parties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  -- Role requirements (how many of each role needed)
  tanks_needed INT DEFAULT 0,
  healers_needed INT DEFAULT 0,
  dps_needed INT DEFAULT 0,
  support_needed INT DEFAULT 0,
  -- Metadata
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Party roster (character assignments to parties)
CREATE TABLE party_roster (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id UUID NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  character_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('tank', 'healer', 'dps', 'support')),
  is_confirmed BOOLEAN DEFAULT false,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(party_id, character_id)
);

-- Indexes for parties
CREATE INDEX idx_parties_group ON parties(group_id);
CREATE INDEX idx_party_roster_party ON party_roster(party_id);
CREATE INDEX idx_party_roster_character ON party_roster(character_id);

-- RLS for parties
ALTER TABLE parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE party_roster ENABLE ROW LEVEL SECURITY;

-- NOTE: Policies for parties and party_roster will be created in 006_fix_rls_recursion with SECURITY DEFINER

-- =====================================================
-- RECRUITMENT & PUBLIC PROFILES
-- =====================================================

-- Add public/recruitment fields to groups
ALTER TABLE groups ADD COLUMN is_public BOOLEAN DEFAULT false;
ALTER TABLE groups ADD COLUMN recruitment_open BOOLEAN DEFAULT false;
ALTER TABLE groups ADD COLUMN recruitment_message TEXT;
ALTER TABLE groups ADD COLUMN public_description TEXT;
ALTER TABLE groups ADD COLUMN banner_url TEXT;

-- Recruitment applications
CREATE TABLE recruitment_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  -- Application data
  discord_username TEXT NOT NULL,
  character_name TEXT,
  primary_class TEXT,
  experience TEXT,
  availability TEXT,
  message TEXT,
  -- Status tracking
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES users(id),
  review_notes TEXT
);

-- Index for applications
CREATE INDEX idx_applications_group ON recruitment_applications(group_id);
CREATE INDEX idx_applications_status ON recruitment_applications(status);

-- RLS for applications
ALTER TABLE recruitment_applications ENABLE ROW LEVEL SECURITY;

-- Anyone can submit applications
CREATE POLICY "Anyone can submit applications"
  ON recruitment_applications FOR INSERT
  WITH CHECK (true);

-- Officers+ can view/manage applications
CREATE POLICY "Officers can manage applications"
  ON recruitment_applications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM group_members cm
      WHERE cm.group_id = recruitment_applications.group_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('admin', 'officer')
    )
    OR user_id = auth.uid()
  );

-- Public clan view (for non-members)
CREATE POLICY "Public groups are viewable"
  ON groups FOR SELECT
  USING (is_public = true OR EXISTS (
    SELECT 1 FROM group_members cm
    WHERE cm.group_id = groups.id
    AND cm.user_id = auth.uid()
  ));

COMMENT ON TABLE parties IS 'Party/raid group templates';
COMMENT ON TABLE party_roster IS 'Character assignments to parties';
COMMENT ON TABLE recruitment_applications IS 'Applications from potential recruits';

-- Record this migration as applied
INSERT INTO migration_history (filename) VALUES ('005_parties.sql');

-- =====================================================
-- SOURCE: 006_fix_rls_recursion.sql
-- =====================================================
-- =====================================================
-- Fix infinite recursion in group_members RLS policies
-- AND optimize parties/events policies to use SECURITY DEFINER
-- =====================================================

-- =====================================================
-- group_members POLICIES (fix recursion)
-- =====================================================

-- Drop ALL existing policies on group_members to start fresh
DROP POLICY IF EXISTS "Users can view own membership" ON group_members;
DROP POLICY IF EXISTS "group managers can view members" ON group_members;
DROP POLICY IF EXISTS "Creator becomes admin" ON group_members;
DROP POLICY IF EXISTS "Admin/Officer manage memberships" ON group_members;
DROP POLICY IF EXISTS "Admin can remove or user can leave" ON group_members;
-- New policy names

-- SELECT: Anyone can view group_members (public visibility)
CREATE POLICY "clan_members_select"
ON group_members FOR SELECT
USING (true);

-- INSERT: Authenticated users can insert their own membership as pending
CREATE POLICY "clan_members_insert_pending"
ON group_members FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND user_id = auth.uid() 
  AND role = 'pending'
);

-- INSERT: Allow creator to become admin when creating a clan
CREATE POLICY "clan_members_insert_creator"
ON group_members FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND user_id = auth.uid() 
  AND role = 'admin'
  AND is_creator = TRUE
);

-- UPDATE: Use SECURITY DEFINER function (bypasses RLS)
CREATE POLICY "clan_members_update"
ON group_members FOR UPDATE
USING (
  user_has_clan_role(group_id, auth.uid(), ARRAY['admin', 'officer'])
);

-- DELETE: Users can leave, admins can remove
CREATE POLICY "clan_members_delete"
ON group_members FOR DELETE
USING (
  user_id = auth.uid()
  OR user_has_clan_role(group_id, auth.uid(), ARRAY['admin'])
);

-- =====================================================
-- PARTIES POLICIES (optimize using SECURITY DEFINER)
-- =====================================================

DROP POLICY IF EXISTS "Officers can manage parties" ON parties;

-- SELECT: Use SECURITY DEFINER function (bypasses RLS on group_members)
CREATE POLICY "Group members can view parties"
ON parties FOR SELECT
USING (
  user_has_clan_role(group_id, auth.uid(), ARRAY['admin', 'officer', 'member'])
);

-- ALL: Officers+ can manage
CREATE POLICY "Officers can manage parties"
ON parties FOR ALL
USING (
  user_has_clan_role(group_id, auth.uid(), ARRAY['admin', 'officer'])
);

-- =====================================================
-- PARTY_ROSTER POLICIES (optimize using SECURITY DEFINER)
-- =====================================================

DROP POLICY IF EXISTS "Officers can manage roster" ON party_roster;

-- SELECT: Use SECURITY DEFINER via parties join
CREATE POLICY "Group members can view roster"
ON party_roster FOR SELECT
USING (
  user_has_clan_role(
    (SELECT group_id FROM parties WHERE id = party_roster.party_id),
    auth.uid(),
    ARRAY['admin', 'officer', 'member']
  )
);

-- ALL: Officers can manage
CREATE POLICY "Officers can manage roster"
ON party_roster FOR ALL
USING (
  user_has_clan_role(
    (SELECT group_id FROM parties WHERE id = party_roster.party_id),
    auth.uid(),
    ARRAY['admin', 'officer']
  )
);

-- =====================================================
-- RECRUITMENT_APPLICATIONS POLICIES (optimize)
-- =====================================================

DROP POLICY IF EXISTS "Officers can manage applications" ON recruitment_applications;
DROP POLICY IF EXISTS "Officers can update applications" ON recruitment_applications;

-- SELECT: Officers can manage OR own applications
CREATE POLICY "Officers can view applications"
ON recruitment_applications FOR SELECT
USING (
  user_has_clan_role(group_id, auth.uid(), ARRAY['admin', 'officer'])
  OR user_id = auth.uid()
);

-- UPDATE: Officers only
CREATE POLICY "Officers can update applications"
ON recruitment_applications FOR UPDATE
USING (
  user_has_clan_role(group_id, auth.uid(), ARRAY['admin', 'officer'])
);
-- Record this migration as applied
INSERT INTO migration_history (filename) VALUES ('006_fix_rls_recursion.sql');

-- =====================================================
-- SOURCE: 007_guild_icon.sql
-- =====================================================
-- Migration: Add group_icon_url to groups table
ALTER TABLE groups ADD COLUMN IF NOT EXISTS group_icon_url TEXT;

-- Record this migration as applied
INSERT INTO migration_history (filename) VALUES ('007_guild_icon.sql');
-- =====================================================
-- SOURCE: 008_node_citizenship.sql
-- =====================================================
-- =====================================================
-- 007_node_citizenship.sql - Node Citizenship Tracking
-- Track where guild members are citizens in the world
-- =====================================================

-- Node type enum (4 types in AoC)
DO $$ BEGIN
  CREATE TYPE node_type AS ENUM ('divine', 'economic', 'military', 'scientific');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Node citizenship table
CREATE TABLE IF NOT EXISTS node_citizenships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  -- Node information
  node_name VARCHAR(100) NOT NULL,
  node_type node_type NOT NULL,
  node_stage INTEGER NOT NULL DEFAULT 3 CHECK (node_stage >= 0 AND node_stage <= 6),
  -- Stage 0=Wilderness, 1=Expedition, 2=Encampment, 3=Village, 4=Town, 5=City, 6=Metropolis
  -- Citizenship requires Stage 3+ but we track lower for world state
  region VARCHAR(100), -- Optional: area/zone name
  -- Special roles
  is_mayor BOOLEAN DEFAULT FALSE,
  is_council_member BOOLEAN DEFAULT FALSE,
  -- Metadata
  became_citizen_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- One citizenship per character (AoC rule)
  UNIQUE(character_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_node_citizenships_character ON node_citizenships(character_id);
CREATE INDEX IF NOT EXISTS idx_node_citizenships_node_name ON node_citizenships(node_name);
CREATE INDEX IF NOT EXISTS idx_node_citizenships_node_type ON node_citizenships(node_type);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE node_citizenships ENABLE ROW LEVEL SECURITY;

-- group members can view citizenships of their clan's characters
CREATE POLICY "Group members can view citizenships"
  ON node_citizenships FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM members m
      WHERE m.id = node_citizenships.character_id
      AND user_has_clan_role(m.group_id, auth.uid(), ARRAY['admin', 'officer', 'member'])
    )
  );

-- Users can manage citizenship for their own characters
CREATE POLICY "Users can manage own character citizenship"
  ON node_citizenships FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM members m
      WHERE m.id = node_citizenships.character_id
      AND m.user_id = auth.uid()
    )
  );

-- Officers can manage any citizenship in their clan
CREATE POLICY "Officers can manage clan citizenships"
  ON node_citizenships FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM members m
      WHERE m.id = node_citizenships.character_id
      AND user_has_clan_role(m.group_id, auth.uid(), ARRAY['admin', 'officer'])
    )
  );

-- =====================================================
-- HELPER VIEW: Node distribution stats
-- =====================================================

CREATE OR REPLACE VIEW node_distribution AS
SELECT 
  m.group_id,
  nc.node_name,
  nc.node_type,
  nc.node_stage,
  COUNT(*) as citizen_count,
  COUNT(*) FILTER (WHERE nc.is_mayor) as has_mayor,
  ARRAY_AGG(m.name ORDER BY m.name) as citizen_names
FROM node_citizenships nc
JOIN members m ON m.id = nc.character_id
GROUP BY m.group_id, nc.node_name, nc.node_type, nc.node_stage;

-- Comments
COMMENT ON TABLE node_citizenships IS 'Tracks which node each character is a citizen of';
COMMENT ON COLUMN node_citizenships.node_stage IS '0=Wilderness, 1=Expedition, 2=Encampment, 3=Village, 4=Town, 5=City, 6=Metropolis';
COMMENT ON VIEW node_distribution IS 'Aggregated view of citizen distribution per node per clan';

-- Record this migration as applied
INSERT INTO migration_history (filename) VALUES ('008_node_citizenship.sql');

-- =====================================================
-- SOURCE: 009_siege_rosters.sql
-- =====================================================
-- =====================================================
-- 008_siege_rosters.sql - Castle/Node Siege Management
-- Large-scale PvP event organization (250v250)
-- =====================================================

-- Siege type enum
DO $$ BEGIN
  CREATE TYPE siege_type AS ENUM (
    'castle_attack',    -- Attacking enemy castle
    'castle_defense',   -- Defending our castle
    'node_attack',      -- Attacking enemy node
    'node_defense'      -- Defending our node
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Siege role enum (different from party roles)
DO $$ BEGIN
  CREATE TYPE siege_role AS ENUM (
    'frontline',        -- Melee fighters, tanks
    'ranged',           -- Archers, mages
    'healer',           -- Healers and support
    'siege_operator',   -- Trebuchets, battering rams
    'scout',            -- Reconnaissance
    'reserve'           -- Backup players
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Roster status
DO $$ BEGIN
  CREATE TYPE roster_status AS ENUM (
    'signed_up',        -- Player signed up
    'confirmed',        -- Player confirmed attendance
    'checked_in',       -- Player checked in on event day
    'no_show'           -- Player didn't show up
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Siege events table
CREATE TABLE IF NOT EXISTS siege_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  -- Event details
  title VARCHAR(100) NOT NULL,
  description TEXT,
  siege_type siege_type NOT NULL,
  target_name VARCHAR(100) NOT NULL, -- Castle/Node name
  -- Timing
  starts_at TIMESTAMPTZ NOT NULL,
  declaration_ends_at TIMESTAMPTZ, -- When signup closes
  -- Capacity
  max_participants INTEGER DEFAULT 250,
  -- Role requirements
  frontline_needed INTEGER DEFAULT 80,
  ranged_needed INTEGER DEFAULT 60,
  healer_needed INTEGER DEFAULT 40,
  siege_operator_needed INTEGER DEFAULT 20,
  scout_needed INTEGER DEFAULT 10,
  reserve_needed INTEGER DEFAULT 40,
  -- Status
  is_cancelled BOOLEAN DEFAULT FALSE,
  result VARCHAR(20) CHECK (result IN ('victory', 'defeat', 'draw', NULL)),
  -- Metadata
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Siege roster (player signups)
CREATE TABLE IF NOT EXISTS siege_roster (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  siege_id UUID NOT NULL REFERENCES siege_events(id) ON DELETE CASCADE,
  character_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  -- Assignment
  role siege_role NOT NULL,
  is_leader BOOLEAN DEFAULT FALSE, -- Squad/group leader
  priority INTEGER DEFAULT 0, -- Higher = more likely to get slot
  -- Status tracking
  status roster_status DEFAULT 'signed_up',
  signed_up_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  checked_in_at TIMESTAMPTZ,
  -- Notes
  note TEXT,
  -- Unique per siege per character
  UNIQUE(siege_id, character_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_siege_events_group ON siege_events(group_id);
CREATE INDEX IF NOT EXISTS idx_siege_events_starts_at ON siege_events(starts_at);
CREATE INDEX IF NOT EXISTS idx_siege_events_type ON siege_events(siege_type);
CREATE INDEX IF NOT EXISTS idx_siege_roster_siege ON siege_roster(siege_id);
CREATE INDEX IF NOT EXISTS idx_siege_roster_character ON siege_roster(character_id);
CREATE INDEX IF NOT EXISTS idx_siege_roster_role ON siege_roster(role);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE siege_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE siege_roster ENABLE ROW LEVEL SECURITY;

-- Siege events: clan members can view
CREATE POLICY "Group members can view sieges"
  ON siege_events FOR SELECT
  USING (user_has_clan_role(group_id, auth.uid(), ARRAY['admin', 'officer', 'member']));

-- Officers can manage siege events
CREATE POLICY "Officers can manage sieges"
  ON siege_events FOR ALL
  USING (user_has_clan_role(group_id, auth.uid(), ARRAY['admin', 'officer']));

-- Roster: clan members can view
-- Members can sign up their own characters
CREATE POLICY "Members can sign up own characters"
  ON siege_roster FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM members m
      JOIN siege_events se ON se.group_id = m.group_id
      WHERE m.id = siege_roster.character_id
      AND se.id = siege_roster.siege_id
      AND m.user_id = auth.uid()
    )
  );

-- Members can update their own signups
CREATE POLICY "Members can update own signup"
  ON siege_roster FOR UPDATE
  USING (user_id = auth.uid());

-- Members can withdraw, officers can manage all
CREATE POLICY "Members can withdraw or officers manage"
  ON siege_roster FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM siege_events se
      WHERE se.id = siege_roster.siege_id
      AND user_has_clan_role(se.group_id, auth.uid(), ARRAY['admin', 'officer'])
    )
  );

-- =====================================================
-- HELPER VIEW: Siege roster counts
-- =====================================================

CREATE OR REPLACE VIEW siege_roster_counts AS
SELECT 
  sr.siege_id,
  sr.role,
  COUNT(*) as total_count,
  COUNT(*) FILTER (WHERE sr.status = 'confirmed') as confirmed_count,
  COUNT(*) FILTER (WHERE sr.status = 'checked_in') as checked_in_count
FROM siege_roster sr
GROUP BY sr.siege_id, sr.role;

-- Comments
COMMENT ON TABLE siege_events IS 'Castle and node siege events (250v250 battles)';
COMMENT ON TABLE siege_roster IS 'Player signups for siege events';
COMMENT ON VIEW siege_roster_counts IS 'Aggregated roster counts by role per siege';

-- Record this migration as applied
INSERT INTO migration_history (filename) VALUES ('009_siege_rosters.sql');

-- =====================================================
-- SOURCE: 010_loot_dkp.sql
-- =====================================================
-- =====================================================
-- 009_loot_dkp.sql - Loot Distribution & DKP System
-- Fair loot distribution with multiple system support
-- =====================================================

-- Loot system type enum
DO $$ BEGIN
  CREATE TYPE loot_system_type AS ENUM (
    'dkp',           -- Dragon Kill Points
    'epgp',          -- Effort Points / Gear Points
    'loot_council',  -- Officer voting
    'roll',          -- Random /roll
    'round_robin'    -- Taking turns
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Item rarity enum
DO $$ BEGIN
  CREATE TYPE item_rarity AS ENUM (
    'common',
    'uncommon', 
    'rare',
    'heroic',
    'epic',
    'legendary'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Loot system configuration per clan
CREATE TABLE IF NOT EXISTS loot_systems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  -- System configuration
  system_type loot_system_type DEFAULT 'dkp',
  name VARCHAR(100) NOT NULL DEFAULT 'Default',
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  -- DKP specific settings
  starting_points INTEGER DEFAULT 0,
  decay_enabled BOOLEAN DEFAULT FALSE,
  decay_rate DECIMAL(5,2) DEFAULT 0, -- Percentage per week
  decay_minimum INTEGER DEFAULT 0, -- Minimum points after decay
  -- Points for activities
  raid_attendance_points INTEGER DEFAULT 10,
  siege_attendance_points INTEGER DEFAULT 15,
  boss_kill_points INTEGER DEFAULT 5,
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Partial unique index: only one active system per clan
CREATE UNIQUE INDEX IF NOT EXISTS idx_loot_systems_active_per_group 
  ON loot_systems(group_id) WHERE is_active = TRUE;

-- Character DKP points
CREATE TABLE IF NOT EXISTS dkp_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loot_system_id UUID NOT NULL REFERENCES loot_systems(id) ON DELETE CASCADE,
  character_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  -- Point totals
  current_points INTEGER DEFAULT 0,
  earned_total INTEGER DEFAULT 0,
  spent_total INTEGER DEFAULT 0,
  -- Priority tracking (for EPGP or priority systems)
  priority_ratio DECIMAL(5,2) DEFAULT 1.0,
  -- Metadata
  last_earned_at TIMESTAMPTZ,
  last_spent_at TIMESTAMPTZ,
  last_decay_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- One entry per character per system
  UNIQUE(loot_system_id, character_id)
);

-- Loot history (all drops)
CREATE TABLE IF NOT EXISTS loot_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loot_system_id UUID NOT NULL REFERENCES loot_systems(id) ON DELETE CASCADE,
  -- Item info
  item_name VARCHAR(200) NOT NULL,
  item_rarity item_rarity DEFAULT 'rare',
  item_slot VARCHAR(50), -- e.g. 'weapon', 'helmet', 'ring'
  item_description TEXT,
  -- Source
  source_type VARCHAR(50), -- 'raid', 'siege', 'dungeon', 'world_boss'
  source_name VARCHAR(100), -- Boss or event name
  event_id UUID, -- Optional link to events table
  siege_id UUID REFERENCES siege_events(id) ON DELETE SET NULL,
  -- Distribution
  awarded_to UUID REFERENCES members(id) ON DELETE SET NULL,
  awarded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  -- DKP cost (if applicable)
  dkp_cost INTEGER DEFAULT 0,
  -- Voting (for loot council)
  votes_for INTEGER DEFAULT 0,
  votes_against INTEGER DEFAULT 0,
  -- Metadata
  dropped_at TIMESTAMPTZ DEFAULT NOW(),
  distributed_at TIMESTAMPTZ,
  notes TEXT
);

-- DKP point transactions (for auditing)
CREATE TABLE IF NOT EXISTS dkp_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dkp_points_id UUID NOT NULL REFERENCES dkp_points(id) ON DELETE CASCADE,
  -- Transaction details
  amount INTEGER NOT NULL, -- Positive = earned, negative = spent
  reason VARCHAR(200) NOT NULL,
  -- Links
  loot_id UUID REFERENCES loot_history(id) ON DELETE SET NULL,
  event_id UUID,
  siege_id UUID REFERENCES siege_events(id) ON DELETE SET NULL,
  -- Metadata
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_loot_systems_group ON loot_systems(group_id);
CREATE INDEX IF NOT EXISTS idx_dkp_points_system ON dkp_points(loot_system_id);
CREATE INDEX IF NOT EXISTS idx_dkp_points_character ON dkp_points(character_id);
CREATE INDEX IF NOT EXISTS idx_loot_history_system ON loot_history(loot_system_id);
CREATE INDEX IF NOT EXISTS idx_loot_history_awarded ON loot_history(awarded_to);
CREATE INDEX IF NOT EXISTS idx_loot_history_dropped ON loot_history(dropped_at);
CREATE INDEX IF NOT EXISTS idx_dkp_transactions_points ON dkp_transactions(dkp_points_id);
CREATE INDEX IF NOT EXISTS idx_dkp_transactions_created ON dkp_transactions(created_at);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE loot_systems ENABLE ROW LEVEL SECURITY;
ALTER TABLE dkp_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE loot_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE dkp_transactions ENABLE ROW LEVEL SECURITY;

-- Loot systems: clan members can view
CREATE POLICY "Group members can view loot systems"
  ON loot_systems FOR SELECT
  USING (user_has_clan_role(group_id, auth.uid(), ARRAY['admin', 'officer', 'member']));

-- Only officers can manage loot systems
CREATE POLICY "Officers can manage loot systems"
  ON loot_systems FOR ALL
  USING (user_has_clan_role(group_id, auth.uid(), ARRAY['admin', 'officer']));

-- DKP points: visible to clan members
CREATE POLICY "Group members can view DKP"
  ON dkp_points FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM loot_systems ls
      WHERE ls.id = dkp_points.loot_system_id
      AND user_has_clan_role(ls.group_id, auth.uid(), ARRAY['admin', 'officer', 'member'])
    )
  );

-- Officers can manage DKP
CREATE POLICY "Officers can manage DKP"
  ON dkp_points FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM loot_systems ls
      WHERE ls.id = dkp_points.loot_system_id
      AND user_has_clan_role(ls.group_id, auth.uid(), ARRAY['admin', 'officer'])
    )
  );

-- Loot history: visible to clan members
CREATE POLICY "Group members can view loot history"
  ON loot_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM loot_systems ls
      WHERE ls.id = loot_history.loot_system_id
      AND user_has_clan_role(ls.group_id, auth.uid(), ARRAY['admin', 'officer', 'member'])
    )
  );

-- Officers can manage loot history
CREATE POLICY "Officers can manage loot history"
  ON loot_history FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM loot_systems ls
      WHERE ls.id = loot_history.loot_system_id
      AND user_has_clan_role(ls.group_id, auth.uid(), ARRAY['admin', 'officer'])
    )
  );

-- Transactions: same as loot history
CREATE POLICY "Group members can view transactions"
  ON dkp_transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM dkp_points dp
      JOIN loot_systems ls ON ls.id = dp.loot_system_id
      WHERE dp.id = dkp_transactions.dkp_points_id
      AND user_has_clan_role(ls.group_id, auth.uid(), ARRAY['admin', 'officer', 'member'])
    )
  );

CREATE POLICY "Officers can manage transactions"
  ON dkp_transactions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM dkp_points dp
      JOIN loot_systems ls ON ls.id = dp.loot_system_id
      WHERE dp.id = dkp_transactions.dkp_points_id
      AND user_has_clan_role(ls.group_id, auth.uid(), ARRAY['admin', 'officer'])
    )
  );

-- =====================================================
-- HELPER VIEW: DKP Leaderboard
-- =====================================================

CREATE OR REPLACE VIEW dkp_leaderboard AS
SELECT 
  dp.loot_system_id,
  dp.character_id,
  m.name as character_name,
  m.group_id,
  dp.current_points,
  dp.earned_total,
  dp.spent_total,
  dp.priority_ratio,
  dp.last_earned_at,
  RANK() OVER (PARTITION BY dp.loot_system_id ORDER BY dp.current_points DESC) as rank
FROM dkp_points dp
JOIN members m ON m.id = dp.character_id;

-- Comments
COMMENT ON TABLE loot_systems IS 'Clan loot distribution system configuration';
COMMENT ON TABLE dkp_points IS 'Character DKP point balances';
COMMENT ON TABLE loot_history IS 'Historical record of all loot drops and distribution';
COMMENT ON TABLE dkp_transactions IS 'Audit log of all DKP point changes';
COMMENT ON VIEW dkp_leaderboard IS 'Ranked DKP standings per loot system';

-- Record this migration as applied
INSERT INTO migration_history (filename) VALUES ('010_loot_dkp.sql');

-- =====================================================
-- SOURCE: 011_add_trial_role.sql
-- =====================================================
-- Add trial role to group_members
-- Migration to introduce the trial membership level between member and pending

BEGIN;

-- Update the CHECK constraint to include 'trial'
ALTER TABLE group_members 
DROP CONSTRAINT group_members_role_check;

ALTER TABLE group_members
ADD CONSTRAINT group_members_role_check 
  CHECK (role IN ('admin', 'officer', 'member', 'trial', 'pending'));

-- Record this migration as applied
INSERT INTO migration_history (filename) VALUES ('011_add_trial_role.sql');

COMMIT;

-- =====================================================
-- SOURCE: 012_guild_bank.sql
-- =====================================================
-- =====================================================
-- 010_guild_bank.sql - Guild Bank & Resource Tracker
-- Track shared guild resources and materials
-- =====================================================

-- Resource category enum
DO $$ BEGIN
  CREATE TYPE resource_category AS ENUM (
    'raw_material',     -- Ore, wood, herbs
    'processed',        -- Ingots, planks, reagents
    'consumable',       -- Potions, food, scrolls
    'equipment',        -- Weapons, armor, accessories
    'currency',         -- Gold, premium currencies
    'blueprint',        -- Crafting recipes
    'other'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Transaction type enum
DO $$ BEGIN
  CREATE TYPE bank_transaction_type AS ENUM (
    'deposit',
    'withdrawal',
    'transfer',
    'craft_input',      -- Used for crafting
    'craft_output',     -- Created from crafting
    'loot',             -- From raid/siege
    'purchase',
    'sale',
    'adjustment'        -- Manual correction
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Guild bank configuration
CREATE TABLE IF NOT EXISTS guild_banks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  -- Settings
  name VARCHAR(100) DEFAULT 'Guild Bank',
  description TEXT,
  -- Permissions
  deposit_min_role VARCHAR(20) DEFAULT 'member', -- member, officer, admin
  withdraw_min_role VARCHAR(20) DEFAULT 'officer',
  -- Gold tracking
  gold_balance BIGINT DEFAULT 0,
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- One bank per clan
  UNIQUE(group_id)
);

-- Resource catalog (what items exist)
CREATE TABLE IF NOT EXISTS resource_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Item details
  name VARCHAR(200) NOT NULL,
  category resource_category NOT NULL,
  subcategory VARCHAR(100), -- e.g. 'metal', 'cloth', 'leather'
  rarity item_rarity DEFAULT 'common', -- reuse from loot
  -- Pricing
  base_value INTEGER DEFAULT 0,
  -- Crafting info
  is_craftable BOOLEAN DEFAULT FALSE,
  profession_required VARCHAR(50),
  -- Global catalog, not clan-specific
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Unique item names
  UNIQUE(name)
);

-- Guild bank inventory
CREATE TABLE IF NOT EXISTS bank_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_id UUID NOT NULL REFERENCES guild_banks(id) ON DELETE CASCADE,
  resource_id UUID NOT NULL REFERENCES resource_catalog(id) ON DELETE CASCADE,
  -- Quantity tracking
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  -- Reserved for pending requests
  reserved_quantity INTEGER DEFAULT 0 CHECK (reserved_quantity >= 0),
  -- Metadata
  last_updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- One entry per resource per bank
  UNIQUE(bank_id, resource_id)
);

-- Bank transactions (audit log)
CREATE TABLE IF NOT EXISTS bank_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_id UUID NOT NULL REFERENCES guild_banks(id) ON DELETE CASCADE,
  resource_id UUID REFERENCES resource_catalog(id) ON DELETE SET NULL,
  -- Transaction details
  transaction_type bank_transaction_type NOT NULL,
  quantity INTEGER NOT NULL,
  gold_amount BIGINT DEFAULT 0,
  -- Who did it
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  character_id UUID REFERENCES members(id) ON DELETE SET NULL,
  -- Context
  notes TEXT,
  related_siege_id UUID REFERENCES siege_events(id) ON DELETE SET NULL,
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Resource requests (members requesting withdrawals)
CREATE TABLE IF NOT EXISTS resource_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_id UUID NOT NULL REFERENCES guild_banks(id) ON DELETE CASCADE,
  resource_id UUID NOT NULL REFERENCES resource_catalog(id) ON DELETE CASCADE,
  -- Request details
  requested_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  character_id UUID REFERENCES members(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  reason TEXT,
  -- Status
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'fulfilled')),
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  fulfilled_at TIMESTAMPTZ,
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_guild_banks_group ON guild_banks(group_id);
CREATE INDEX IF NOT EXISTS idx_resource_catalog_category ON resource_catalog(category);
CREATE INDEX IF NOT EXISTS idx_bank_inventory_bank ON bank_inventory(bank_id);
CREATE INDEX IF NOT EXISTS idx_bank_inventory_resource ON bank_inventory(resource_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_bank ON bank_transactions(bank_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_created ON bank_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_resource_requests_bank ON resource_requests(bank_id);
CREATE INDEX IF NOT EXISTS idx_resource_requests_status ON resource_requests(status);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE guild_banks ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_requests ENABLE ROW LEVEL SECURITY;

-- Guild banks: clan members can view
CREATE POLICY "Group members can view bank"
  ON guild_banks FOR SELECT
  USING (user_has_clan_role(group_id, auth.uid(), ARRAY['admin', 'officer', 'member']));

-- Only officers can manage bank settings
CREATE POLICY "Officers can manage bank"
  ON guild_banks FOR ALL
  USING (user_has_clan_role(group_id, auth.uid(), ARRAY['admin', 'officer']));

-- Resource catalog: everyone can view (global)
CREATE POLICY "Everyone can view resources"
  ON resource_catalog FOR SELECT
  USING (true);

-- Only system can manage catalog
CREATE POLICY "System can manage catalog"
  ON resource_catalog FOR ALL
  USING (false);

-- Inventory: clan members can view
CREATE POLICY "Group members can view inventory"
  ON bank_inventory FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM guild_banks gb
      WHERE gb.id = bank_inventory.bank_id
      AND user_has_clan_role(gb.group_id, auth.uid(), ARRAY['admin', 'officer', 'member'])
    )
  );

-- Officers can manage inventory
CREATE POLICY "Officers can manage inventory"
  ON bank_inventory FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM guild_banks gb
      WHERE gb.id = bank_inventory.bank_id
      AND user_has_clan_role(gb.group_id, auth.uid(), ARRAY['admin', 'officer'])
    )
  );

-- Transactions: clan members can view
-- Members can create transactions (deposits)
CREATE POLICY "Members can create transactions"
  ON bank_transactions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM guild_banks gb
      WHERE gb.id = bank_transactions.bank_id
      AND user_has_clan_role(gb.group_id, auth.uid(), ARRAY['admin', 'officer', 'member'])
    )
  );

-- Resource requests: own or officer view
CREATE POLICY "Users can view own requests or officers all"
  ON resource_requests FOR SELECT
  USING (
    requested_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM guild_banks gb
      WHERE gb.id = resource_requests.bank_id
      AND user_has_clan_role(gb.group_id, auth.uid(), ARRAY['admin', 'officer'])
    )
  );

-- Members can create requests
CREATE POLICY "Members can create requests"
  ON resource_requests FOR INSERT
  WITH CHECK (
    requested_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM guild_banks gb
      WHERE gb.id = resource_requests.bank_id
      AND user_has_clan_role(gb.group_id, auth.uid(), ARRAY['admin', 'officer', 'member'])
    )
  );

-- Officers can review requests
CREATE POLICY "Officers can review requests"
  ON resource_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM guild_banks gb
      WHERE gb.id = resource_requests.bank_id
      AND user_has_clan_role(gb.group_id, auth.uid(), ARRAY['admin', 'officer'])
    )
  );

-- =====================================================
-- SEED: Common AoC Resources
-- =====================================================

INSERT INTO resource_catalog (name, category, subcategory) VALUES
  -- Metals
  ('Iron Ore', 'raw_material', 'metal'),
  ('Copper Ore', 'raw_material', 'metal'),
  ('Silver Ore', 'raw_material', 'metal'),
  ('Gold Ore', 'raw_material', 'metal'),
  ('Iron Ingot', 'processed', 'metal'),
  ('Steel Ingot', 'processed', 'metal'),
  -- Wood
  ('Oak Log', 'raw_material', 'wood'),
  ('Pine Log', 'raw_material', 'wood'),
  ('Ash Log', 'raw_material', 'wood'),
  ('Oak Plank', 'processed', 'wood'),
  ('Pine Plank', 'processed', 'wood'),
  -- Cloth
  ('Cotton', 'raw_material', 'cloth'),
  ('Silk', 'raw_material', 'cloth'),
  ('Linen Cloth', 'processed', 'cloth'),
  ('Silk Cloth', 'processed', 'cloth'),
  -- Leather
  ('Rawhide', 'raw_material', 'leather'),
  ('Thick Hide', 'raw_material', 'leather'),
  ('Leather', 'processed', 'leather'),
  ('Hardened Leather', 'processed', 'leather'),
  -- Herbs
  ('Healing Herb', 'raw_material', 'herb'),
  ('Mana Blossom', 'raw_material', 'herb'),
  ('Fire Petal', 'raw_material', 'herb'),
  -- Consumables
  ('Health Potion', 'consumable', 'potion'),
  ('Mana Potion', 'consumable', 'potion'),
  ('Stamina Potion', 'consumable', 'potion'),
  ('Feast Dish', 'consumable', 'food')
ON CONFLICT (name) DO NOTHING;

-- Comments
COMMENT ON TABLE guild_banks IS 'Guild bank configuration and gold tracking';
COMMENT ON TABLE resource_catalog IS 'Global catalog of all trackable resources';
COMMENT ON TABLE bank_inventory IS 'Current resource quantities in guild bank';
COMMENT ON TABLE bank_transactions IS 'Audit log of all bank transactions';
COMMENT ON TABLE resource_requests IS 'Member requests for resource withdrawals';

-- Record this migration as applied
INSERT INTO migration_history (filename) VALUES ('012_guild_bank.sql');

-- =====================================================
-- SOURCE: 013_freeholds.sql
-- =====================================================
-- =====================================================
-- 011_freeholds.sql - Freehold Registry
-- Track guild member freeholds and their buildings
-- =====================================================

-- Freehold building type enum
DO $$ BEGIN
  CREATE TYPE freehold_building_type AS ENUM (
    -- Processing buildings
    'smelter',
    'lumbermill',
    'tannery',
    'loom',
    'farm',
    'stable',
    -- Crafting buildings
    'forge',
    'workshop',
    'clothier',
    'jeweler',
    'alchemist_lab',
    'kitchen',
    -- Other
    'warehouse',
    'tavern',
    'inn',
    'house'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Freehold size enum
DO $$ BEGIN
  CREATE TYPE freehold_size AS ENUM (
    'small',   -- 8x8
    'medium',  -- 16x16
    'large'    -- 32x32
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Freeholds table
CREATE TABLE IF NOT EXISTS freeholds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  -- Owner
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  owner_character_id UUID REFERENCES members(id) ON DELETE SET NULL,
  -- Location
  name VARCHAR(100) NOT NULL,
  node_name VARCHAR(100), -- Parent node
  region VARCHAR(100),
  coordinates VARCHAR(50), -- e.g. "1234, 5678"
  -- Details
  size freehold_size NOT NULL DEFAULT 'medium',
  is_public BOOLEAN DEFAULT FALSE, -- Allow guild to use
  description TEXT,
  -- Metadata
  established_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Freehold buildings
CREATE TABLE IF NOT EXISTS freehold_buildings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  freehold_id UUID NOT NULL REFERENCES freeholds(id) ON DELETE CASCADE,
  -- Building info
  building_type freehold_building_type NOT NULL,
  building_name VARCHAR(100),
  tier INTEGER DEFAULT 1 CHECK (tier >= 1 AND tier <= 3),
  -- Associated profession
  profession_id VARCHAR(50), -- Links to profession system
  -- Access
  is_guild_accessible BOOLEAN DEFAULT FALSE,
  usage_fee INTEGER DEFAULT 0, -- Gold cost for guild to use
  -- Metadata
  built_at TIMESTAMPTZ DEFAULT NOW(),
  upgraded_at TIMESTAMPTZ
);

-- Freehold access schedule (when buildings are available)
CREATE TABLE IF NOT EXISTS freehold_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  freehold_id UUID NOT NULL REFERENCES freeholds(id) ON DELETE CASCADE,
  building_id UUID REFERENCES freehold_buildings(id) ON DELETE CASCADE,
  -- Schedule
  day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0 = Sunday
  start_time TIME,
  end_time TIME,
  notes TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_freeholds_group ON freeholds(group_id);
CREATE INDEX IF NOT EXISTS idx_freeholds_owner ON freeholds(owner_id);
CREATE INDEX IF NOT EXISTS idx_freeholds_node ON freeholds(node_name);
CREATE INDEX IF NOT EXISTS idx_freehold_buildings_freehold ON freehold_buildings(freehold_id);
CREATE INDEX IF NOT EXISTS idx_freehold_buildings_type ON freehold_buildings(building_type);
CREATE INDEX IF NOT EXISTS idx_freehold_schedules_freehold ON freehold_schedules(freehold_id);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE freeholds ENABLE ROW LEVEL SECURITY;
ALTER TABLE freehold_buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE freehold_schedules ENABLE ROW LEVEL SECURITY;

-- Freeholds: clan members can view
CREATE POLICY "Group members can view freeholds"
  ON freeholds FOR SELECT
  USING (user_has_clan_role(group_id, auth.uid(), ARRAY['admin', 'officer', 'member']));

-- Owners can manage their freeholds
CREATE POLICY "Owners can manage own freeholds"
  ON freeholds FOR ALL
  USING (owner_id = auth.uid());

-- Officers can manage all freeholds
CREATE POLICY "Officers can manage all freeholds"
  ON freeholds FOR ALL
  USING (user_has_clan_role(group_id, auth.uid(), ARRAY['admin', 'officer']));

-- Buildings: same as freeholds
CREATE POLICY "Group members can view buildings"
  ON freehold_buildings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM freeholds f
      WHERE f.id = freehold_buildings.freehold_id
      AND user_has_clan_role(f.group_id, auth.uid(), ARRAY['admin', 'officer', 'member'])
    )
  );

CREATE POLICY "Freehold owners can manage buildings"
  ON freehold_buildings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM freeholds f
      WHERE f.id = freehold_buildings.freehold_id
      AND f.owner_id = auth.uid()
    )
  );

-- Schedules: same pattern
CREATE POLICY "Group members can view schedules"
  ON freehold_schedules FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM freeholds f
      WHERE f.id = freehold_schedules.freehold_id
      AND user_has_clan_role(f.group_id, auth.uid(), ARRAY['admin', 'officer', 'member'])
    )
  );

CREATE POLICY "Freehold owners can manage schedules"
  ON freehold_schedules FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM freeholds f
      WHERE f.id = freehold_schedules.freehold_id
      AND f.owner_id = auth.uid()
    )
  );

-- Comments
COMMENT ON TABLE freeholds IS 'Guild member freeholds registry';
COMMENT ON TABLE freehold_buildings IS 'Buildings on member freeholds';
COMMENT ON TABLE freehold_schedules IS 'When freehold buildings are available for guild use';

-- Record this migration as applied
INSERT INTO migration_history (filename) VALUES ('013_freeholds.sql');

-- =====================================================
-- SOURCE: 014_caravans.sql
-- =====================================================
-- =====================================================
-- 012_caravans.sql - Caravan Coordination System
-- Plan and coordinate guild caravan runs
-- =====================================================

-- Caravan type enum
DO $$ BEGIN
  CREATE TYPE caravan_type AS ENUM (
    'personal',      -- Small personal caravan
    'guild',         -- Guild-organized caravan
    'trade_route',   -- Regular trade route run
    'escort'         -- Escort mission for another caravan
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Caravan status enum
DO $$ BEGIN
  CREATE TYPE caravan_status AS ENUM (
    'planning',      -- Being organized
    'recruiting',    -- Looking for escorts
    'ready',         -- Ready to depart
    'in_transit',    -- Currently running
    'completed',     -- Successfully completed
    'failed',        -- Attacked/destroyed
    'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Caravan events table
CREATE TABLE IF NOT EXISTS caravan_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  -- Organizer
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  owner_character_id UUID REFERENCES members(id) ON DELETE SET NULL,
  -- Details
  title VARCHAR(200) NOT NULL,
  description TEXT,
  caravan_type caravan_type NOT NULL DEFAULT 'guild',
  -- Route
  origin_node VARCHAR(100) NOT NULL,
  destination_node VARCHAR(100) NOT NULL,
  estimated_distance INTEGER, -- In game units/time
  -- Timing
  departure_at TIMESTAMPTZ NOT NULL,
  estimated_arrival_at TIMESTAMPTZ,
  -- Cargo
  cargo_description TEXT,
  cargo_value INTEGER DEFAULT 0, -- Estimated gold value
  -- Escort requirements
  min_escorts INTEGER DEFAULT 5,
  max_escorts INTEGER DEFAULT 20,
  -- Status
  status caravan_status DEFAULT 'planning',
  completed_at TIMESTAMPTZ,
  was_attacked BOOLEAN DEFAULT FALSE,
  -- Rewards
  escort_reward_gold INTEGER DEFAULT 0,
  escort_reward_dkp INTEGER DEFAULT 0,
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Caravan escorts (signups)
CREATE TABLE IF NOT EXISTS caravan_escorts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caravan_id UUID NOT NULL REFERENCES caravan_events(id) ON DELETE CASCADE,
  character_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  -- Role
  role VARCHAR(50) DEFAULT 'escort', -- escort, scout, lead
  -- Status
  confirmed BOOLEAN DEFAULT FALSE,
  checked_in BOOLEAN DEFAULT FALSE,
  -- Notes
  notes TEXT,
  -- Metadata
  signed_up_at TIMESTAMPTZ DEFAULT NOW(),
  -- One signup per character
  UNIQUE(caravan_id, character_id)
);

-- Caravan route waypoints
CREATE TABLE IF NOT EXISTS caravan_waypoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caravan_id UUID NOT NULL REFERENCES caravan_events(id) ON DELETE CASCADE,
  -- Waypoint details
  order_index INTEGER NOT NULL,
  location_name VARCHAR(100) NOT NULL,
  notes TEXT,
  is_danger_zone BOOLEAN DEFAULT FALSE,
  estimated_time_minutes INTEGER,
  -- Actual tracking
  reached_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_caravan_events_group ON caravan_events(group_id);
CREATE INDEX IF NOT EXISTS idx_caravan_events_status ON caravan_events(status);
CREATE INDEX IF NOT EXISTS idx_caravan_events_departure ON caravan_events(departure_at);
CREATE INDEX IF NOT EXISTS idx_caravan_escorts_caravan ON caravan_escorts(caravan_id);
CREATE INDEX IF NOT EXISTS idx_caravan_escorts_character ON caravan_escorts(character_id);
CREATE INDEX IF NOT EXISTS idx_caravan_waypoints_caravan ON caravan_waypoints(caravan_id);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE caravan_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE caravan_escorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE caravan_waypoints ENABLE ROW LEVEL SECURITY;

-- Caravan events: clan members can view
CREATE POLICY "Group members can view caravans"
  ON caravan_events FOR SELECT
  USING (user_has_clan_role(group_id, auth.uid(), ARRAY['admin', 'officer', 'member']));

-- Members can create caravans
CREATE POLICY "Members can create caravans"
  ON caravan_events FOR INSERT
  WITH CHECK (user_has_clan_role(group_id, auth.uid(), ARRAY['admin', 'officer', 'member']));

-- Creators and officers can update
CREATE POLICY "Creators and officers can update caravans"
  ON caravan_events FOR UPDATE
  USING (
    created_by = auth.uid()
    OR user_has_clan_role(group_id, auth.uid(), ARRAY['admin', 'officer'])
  );

-- Creators and officers can delete
CREATE POLICY "Creators and officers can delete caravans"
  ON caravan_events FOR DELETE
  USING (
    created_by = auth.uid()
    OR user_has_clan_role(group_id, auth.uid(), ARRAY['admin', 'officer'])
  );

-- Escorts: clan members can view
CREATE POLICY "Group members can view escorts"
  ON caravan_escorts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM caravan_events ce
      WHERE ce.id = caravan_escorts.caravan_id
      AND user_has_clan_role(ce.group_id, auth.uid(), ARRAY['admin', 'officer', 'member'])
    )
  );

-- Members can sign up their characters
CREATE POLICY "Members can sign up for escort"
  ON caravan_escorts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM members m
      JOIN caravan_events ce ON ce.group_id = m.group_id
      WHERE m.id = caravan_escorts.character_id
      AND ce.id = caravan_escorts.caravan_id
      AND m.user_id = auth.uid()
    )
  );

-- Members can update own signups
CREATE POLICY "Members can update own escort signup"
  ON caravan_escorts FOR UPDATE
  USING (user_id = auth.uid());

-- Members can withdraw
CREATE POLICY "Members can withdraw from escort"
  ON caravan_escorts FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM caravan_events ce
      WHERE ce.id = caravan_escorts.caravan_id
      AND user_has_clan_role(ce.group_id, auth.uid(), ARRAY['admin', 'officer'])
    )
  );

-- Waypoints: clan members can view
CREATE POLICY "Group members can view waypoints"
  ON caravan_waypoints FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM caravan_events ce
      WHERE ce.id = caravan_waypoints.caravan_id
      AND user_has_clan_role(ce.group_id, auth.uid(), ARRAY['admin', 'officer', 'member'])
    )
  );

-- Creators and officers can manage waypoints
CREATE POLICY "Creators can manage waypoints"
  ON caravan_waypoints FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM caravan_events ce
      WHERE ce.id = caravan_waypoints.caravan_id
      AND (ce.created_by = auth.uid() OR user_has_clan_role(ce.group_id, auth.uid(), ARRAY['admin', 'officer']))
    )
  );

-- Comments
COMMENT ON TABLE caravan_events IS 'Guild caravan coordination and planning';
COMMENT ON TABLE caravan_escorts IS 'Player signups for caravan escort duty';
COMMENT ON TABLE caravan_waypoints IS 'Route waypoints for caravan runs';

-- Record this migration as applied
INSERT INTO migration_history (filename) VALUES ('014_caravans.sql');

-- =====================================================
-- SOURCE: 015_alliances.sql
-- =====================================================
-- =====================================================
-- 013_alliances.sql - Alliance Management System
-- Cross-guild coordination and diplomacy
-- =====================================================

-- Alliance status enum
DO $$ BEGIN
  CREATE TYPE alliance_status AS ENUM (
    'pending',       -- Invitation sent
    'active',        -- Alliance is active
    'suspended',     -- Temporarily suspended
    'dissolved'      -- No longer allied
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Alliances table
CREATE TABLE IF NOT EXISTS alliances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Name
  name VARCHAR(100) NOT NULL,
  description TEXT,
  -- Leadership
  leader_group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  -- Settings
  is_public BOOLEAN DEFAULT FALSE, -- Public alliance page
  max_guilds INTEGER DEFAULT 10,
  -- Metadata
  formed_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alliance membership
CREATE TABLE IF NOT EXISTS alliance_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alliance_id UUID NOT NULL REFERENCES alliances(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  -- Status
  status alliance_status DEFAULT 'pending',
  -- Role in alliance
  is_founder BOOLEAN DEFAULT FALSE,
  can_invite BOOLEAN DEFAULT FALSE,
  can_create_events BOOLEAN DEFAULT FALSE,
  -- When joined
  invited_by UUID REFERENCES groups(id),
  joined_at TIMESTAMPTZ,
  left_at TIMESTAMPTZ,
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- One membership per clan per alliance
  UNIQUE(alliance_id, group_id)
);

-- Shared alliance events
CREATE TABLE IF NOT EXISTS alliance_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alliance_id UUID NOT NULL REFERENCES alliances(id) ON DELETE CASCADE,
  -- Event details (similar to regular events)
  title VARCHAR(200) NOT NULL,
  description TEXT,
  event_type VARCHAR(50) NOT NULL, -- siege, raid, trade, social
  -- Timing
  starts_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER DEFAULT 120,
  -- Created by
  created_by_group UUID REFERENCES groups(id) ON DELETE SET NULL,
  created_by_user UUID REFERENCES users(id) ON DELETE SET NULL,
  -- Status
  is_cancelled BOOLEAN DEFAULT FALSE,
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alliance event participation (per guild)
CREATE TABLE IF NOT EXISTS alliance_event_participation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES alliance_events(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  -- Commitment
  confirmed_count INTEGER DEFAULT 0,
  notes TEXT,
  -- Metadata
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, group_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_alliances_leader ON alliances(leader_group_id);
CREATE INDEX IF NOT EXISTS idx_alliance_members_alliance ON alliance_members(alliance_id);
CREATE INDEX IF NOT EXISTS idx_alliance_members_group ON alliance_members(group_id);
CREATE INDEX IF NOT EXISTS idx_alliance_members_status ON alliance_members(status);
CREATE INDEX IF NOT EXISTS idx_alliance_events_alliance ON alliance_events(alliance_id);
CREATE INDEX IF NOT EXISTS idx_alliance_events_starts ON alliance_events(starts_at);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE alliances ENABLE ROW LEVEL SECURITY;
ALTER TABLE alliance_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE alliance_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE alliance_event_participation ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user's clan is in alliance
CREATE OR REPLACE FUNCTION user_in_alliance(p_alliance_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM alliance_members am
    JOIN group_members cm ON cm.group_id = am.group_id
    WHERE am.alliance_id = p_alliance_id
    AND am.status = 'active'
    AND cm.user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Alliances: members can view
CREATE POLICY "Alliance members can view"
  ON alliances FOR SELECT
  USING (is_public OR user_in_alliance(id, auth.uid()));

-- Leader clan officers can manage
CREATE POLICY "Leader can manage alliance"
  ON alliances FOR ALL
  USING (user_has_clan_role(leader_group_id, auth.uid(), ARRAY['admin', 'officer']));

-- Alliance members: alliance members can view
CREATE POLICY "Members can view alliance memberships"
  ON alliance_members FOR SELECT
  USING (user_in_alliance(alliance_id, auth.uid()));

-- Leader clan can manage memberships
CREATE POLICY "Leader can manage memberships"
  ON alliance_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM alliances a
      WHERE a.id = alliance_members.alliance_id
      AND user_has_clan_role(a.leader_group_id, auth.uid(), ARRAY['admin', 'officer'])
    )
  );

-- Events: alliance members can view
CREATE POLICY "Alliance members can view events"
  ON alliance_events FOR SELECT
  USING (user_in_alliance(alliance_id, auth.uid()));

-- Members with permission can create events
CREATE POLICY "Authorized members can manage events"
  ON alliance_events FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM alliance_members am
      JOIN group_members cm ON cm.group_id = am.group_id
      WHERE am.alliance_id = alliance_events.alliance_id
      AND am.can_create_events = TRUE
      AND cm.user_id = auth.uid()
    )
  );

-- Participation: alliance members can view
CREATE POLICY "Alliance members can view participation"
  ON alliance_event_participation FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM alliance_events ae
      WHERE ae.id = alliance_event_participation.event_id
      AND user_in_alliance(ae.alliance_id, auth.uid())
    )
  );

-- Group officers can update own participation
CREATE POLICY "Clan officers can update participation"
  ON alliance_event_participation FOR ALL
  USING (user_has_clan_role(group_id, auth.uid(), ARRAY['admin', 'officer']));

-- Comments
COMMENT ON TABLE alliances IS 'Cross-guild alliances for coordination';
COMMENT ON TABLE alliance_members IS 'Guild memberships in alliances';
COMMENT ON TABLE alliance_events IS 'Shared events across allied guilds';
COMMENT ON TABLE alliance_event_participation IS 'Per-guild commitment to alliance events';

-- Record this migration as applied
INSERT INTO migration_history (filename) VALUES ('015_alliances.sql');

-- =====================================================
-- SOURCE: 016_activity.sql
-- =====================================================
-- =====================================================
-- 014_activity.sql - Activity Tracker
-- Track member participation and identify inactive players
-- =====================================================

-- Activity types enum
DO $$ BEGIN
  CREATE TYPE activity_type AS ENUM (
    'login',             -- Logged into app
    'event_signup',      -- Signed up for event
    'event_attend',      -- Attended event
    'siege_participate', -- Participated in siege
    'caravan_escort',    -- Escorted caravan
    'bank_deposit',      -- Deposited to bank
    'loot_received',     -- Received loot
    'dkp_earned',        -- Earned DKP points
    'character_update',  -- Updated character info
    'profession_update'  -- Updated profession ranks
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Activity log
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  character_id UUID REFERENCES members(id) ON DELETE SET NULL,
  -- Activity details
  activity_type activity_type NOT NULL,
  description TEXT,
  -- Context
  related_event_id UUID,
  related_siege_id UUID REFERENCES siege_events(id) ON DELETE SET NULL,
  related_caravan_id UUID REFERENCES caravan_events(id) ON DELETE SET NULL,
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Member activity summary (materialized for performance)
CREATE TABLE IF NOT EXISTS member_activity_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Activity counts (rolling 30 days)
  last_login_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ,
  events_attended_30d INTEGER DEFAULT 0,
  sieges_attended_30d INTEGER DEFAULT 0,
  caravans_escorted_30d INTEGER DEFAULT 0,
  bank_deposits_30d INTEGER DEFAULT 0,
  total_activities_30d INTEGER DEFAULT 0,
  -- Streak tracking
  current_streak_days INTEGER DEFAULT 0,
  longest_streak_days INTEGER DEFAULT 0,
  -- Inactivity flag
  is_inactive BOOLEAN DEFAULT FALSE,
  inactive_since TIMESTAMPTZ,
  -- Metadata
  last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Unique per user per clan
  UNIQUE(group_id, user_id)
);

-- Inactivity alerts
CREATE TABLE IF NOT EXISTS inactivity_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Alert details
  days_inactive INTEGER NOT NULL,
  alert_level VARCHAR(20) DEFAULT 'warning', -- warning, critical
  -- Status
  is_acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_by UUID REFERENCES users(id),
  acknowledged_at TIMESTAMPTZ,
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_activity_log_group ON activity_log(group_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_user ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_type ON activity_log(activity_type);
CREATE INDEX IF NOT EXISTS idx_activity_log_created ON activity_log(created_at);
CREATE INDEX IF NOT EXISTS idx_member_activity_group ON member_activity_summary(group_id);
CREATE INDEX IF NOT EXISTS idx_member_activity_inactive ON member_activity_summary(is_inactive);
CREATE INDEX IF NOT EXISTS idx_inactivity_alerts_group ON inactivity_alerts(group_id);
CREATE INDEX IF NOT EXISTS idx_inactivity_alerts_ack ON inactivity_alerts(is_acknowledged);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_activity_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE inactivity_alerts ENABLE ROW LEVEL SECURITY;

-- Activity log: officers can view
CREATE POLICY "Officers can view activity log"
  ON activity_log FOR SELECT
  USING (user_has_clan_role(group_id, auth.uid(), ARRAY['admin', 'officer']));

-- System can insert (or members for their own)
CREATE POLICY "Can log own activity"
  ON activity_log FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR user_has_clan_role(group_id, auth.uid(), ARRAY['admin', 'officer'])
  );

-- Activity summary: officers can view
CREATE POLICY "Officers can view activity summary"
  ON member_activity_summary FOR SELECT
  USING (user_has_clan_role(group_id, auth.uid(), ARRAY['admin', 'officer']));

-- Members can view own summary
CREATE POLICY "Members can view own summary"
  ON member_activity_summary FOR SELECT
  USING (user_id = auth.uid());

-- System manages summaries
CREATE POLICY "System manages summaries"
  ON member_activity_summary FOR ALL
  USING (user_has_clan_role(group_id, auth.uid(), ARRAY['admin', 'officer']));

-- Inactivity alerts: officers
CREATE POLICY "Officers can view alerts"
  ON inactivity_alerts FOR SELECT
  USING (user_has_clan_role(group_id, auth.uid(), ARRAY['admin', 'officer']));

CREATE POLICY "Officers can manage alerts"
  ON inactivity_alerts FOR ALL
  USING (user_has_clan_role(group_id, auth.uid(), ARRAY['admin', 'officer']));

-- Comments
COMMENT ON TABLE activity_log IS 'Raw activity tracking for members';
COMMENT ON TABLE member_activity_summary IS 'Aggregated activity metrics per member';
COMMENT ON TABLE inactivity_alerts IS 'Alerts for inactive guild members';

-- Record this migration as applied
INSERT INTO migration_history (filename) VALUES ('016_activity.sql');

-- =====================================================
-- SOURCE: 017_achievements.sql
-- =====================================================
-- =====================================================
-- 015_achievements.sql - Guild Achievements System
-- Track and celebrate guild milestones
-- =====================================================

-- Achievement category enum
DO $$ BEGIN
  CREATE TYPE achievement_category AS ENUM (
    'guild',           -- Guild-wide achievements
    'pvp',             -- Combat/siege achievements  
    'economy',         -- Trade/crafting achievements
    'community',       -- Social achievements
    'milestone'        -- Numeric milestones
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Achievement definitions (templates)
CREATE TABLE IF NOT EXISTS achievement_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Details
  name VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  category achievement_category NOT NULL,
  icon VARCHAR(50), -- Emoji or icon name
  -- Requirements
  requirement_type VARCHAR(50) NOT NULL, -- e.g. 'member_count', 'siege_wins', 'gold_deposited'
  requirement_value INTEGER NOT NULL,
  -- Display
  is_hidden BOOLEAN DEFAULT FALSE, -- Hidden until unlocked
  points INTEGER DEFAULT 10, -- Achievement points
  -- Ordering
  sort_order INTEGER DEFAULT 0,
  -- Global definitions
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Group achievements (unlocked)
CREATE TABLE IF NOT EXISTS group_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES achievement_definitions(id) ON DELETE CASCADE,
  -- Progress
  current_value INTEGER DEFAULT 0,
  is_unlocked BOOLEAN DEFAULT FALSE,
  unlocked_at TIMESTAMPTZ,
  -- First to unlock in clan
  first_contributor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- One per clan per achievement
  UNIQUE(group_id, achievement_id)
);

-- Achievement notifications (to send to Discord etc)
CREATE TABLE IF NOT EXISTS achievement_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES achievement_definitions(id) ON DELETE CASCADE,
  -- Notification status
  is_sent BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMPTZ,
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_achievement_definitions_category ON achievement_definitions(category);
CREATE INDEX IF NOT EXISTS idx_clan_achievements_group ON group_achievements(group_id);
CREATE INDEX IF NOT EXISTS idx_clan_achievements_unlocked ON group_achievements(is_unlocked);
CREATE INDEX IF NOT EXISTS idx_achievement_notifications_group ON achievement_notifications(group_id);
CREATE INDEX IF NOT EXISTS idx_achievement_notifications_sent ON achievement_notifications(is_sent);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE achievement_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievement_notifications ENABLE ROW LEVEL SECURITY;

-- Definitions: everyone can view
CREATE POLICY "Everyone can view achievement definitions"
  ON achievement_definitions FOR SELECT
  USING (true);

-- Group achievements: clan members can view
CREATE POLICY "Group members can view achievements"
  ON group_achievements FOR SELECT
  USING (user_has_clan_role(group_id, auth.uid(), ARRAY['admin', 'officer', 'member']));

-- System manages achievements
CREATE POLICY "System manages achievements"
  ON group_achievements FOR ALL
  USING (user_has_clan_role(group_id, auth.uid(), ARRAY['admin', 'officer']));

-- Notifications: officers
CREATE POLICY "Officers can view notifications"
  ON achievement_notifications FOR SELECT
  USING (user_has_clan_role(group_id, auth.uid(), ARRAY['admin', 'officer']));

CREATE POLICY "Officers can manage notifications"
  ON achievement_notifications FOR ALL
  USING (user_has_clan_role(group_id, auth.uid(), ARRAY['admin', 'officer']));

-- =====================================================
-- SEED: Default Achievements
-- =====================================================

INSERT INTO achievement_definitions (name, description, category, icon, requirement_type, requirement_value, points, sort_order) VALUES
  -- Guild milestones
  ('First Steps', 'Guild created with first member', 'milestone', '🌱', 'member_count', 1, 5, 1),
  ('Growing Strong', 'Reach 10 guild members', 'milestone', '🌿', 'member_count', 10, 10, 2),
  ('Full House', 'Reach 50 guild members', 'milestone', '🌳', 'member_count', 50, 25, 3),
  ('Army', 'Reach 100 guild members', 'milestone', '⚔️', 'member_count', 100, 50, 4),
  -- PvP
  ('First Blood', 'Win your first siege', 'pvp', '🗡️', 'siege_wins', 1, 15, 10),
  ('Siege Veterans', 'Win 10 sieges', 'pvp', '🏰', 'siege_wins', 10, 50, 11),
  ('Conquerors', 'Win 50 sieges', 'pvp', '👑', 'siege_wins', 50, 100, 12),
  -- Economy
  ('Bank Opened', 'Make first guild bank deposit', 'economy', '💰', 'bank_deposits', 1, 10, 20),
  ('Trading Empire', 'Complete 10 caravan runs', 'economy', '🚚', 'caravan_complete', 10, 30, 21),
  ('Master Crafters', 'Have 5 Grandmaster crafters', 'economy', '⚒️', 'grandmaster_count', 5, 50, 22),
  -- Community
  ('Event Planners', 'Host 10 guild events', 'community', '📅', 'events_hosted', 10, 20, 30),
  ('Active Roster', 'Have 25 active members in a week', 'community', '✨', 'weekly_active', 25, 40, 31)
ON CONFLICT DO NOTHING;

-- Comments
COMMENT ON TABLE achievement_definitions IS 'Achievement templates and requirements';
COMMENT ON TABLE group_achievements IS 'Clan progress and unlocks for achievements';
COMMENT ON TABLE achievement_notifications IS 'Queue for achievement unlock notifications';

-- Record this migration as applied
INSERT INTO migration_history (filename) VALUES ('017_achievements.sql');

-- =====================================================
-- SOURCE: 018_builds.sql
-- =====================================================
-- =====================================================
-- 016_builds.sql - Character Build Planner
-- Share and save character builds with skills/augments
-- =====================================================

-- Build visibility enum
DO $$ BEGIN
  CREATE TYPE build_visibility AS ENUM (
    'private',      -- Only owner
    'guild',        -- Guild members
    'public'        -- Everyone
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Builds table
CREATE TABLE IF NOT EXISTS builds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Creator
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id UUID REFERENCES groups(id) ON DELETE SET NULL, -- Optional guild association
  -- Build info
  name VARCHAR(100) NOT NULL,
  description TEXT,
  -- Class info
  primary_archetype VARCHAR(50) NOT NULL,
  secondary_archetype VARCHAR(50),
  -- Build data (JSON for flexibility)
  skills JSONB DEFAULT '[]', -- Array of skill selections
  augments JSONB DEFAULT '[]', -- Array of augment selections
  equipment JSONB DEFAULT '{}', -- Recommended gear
  stats JSONB DEFAULT '{}', -- Target stats
  -- Tags
  tags TEXT[] DEFAULT '{}', -- e.g. ['pvp', 'tank', 'siege']
  role VARCHAR(50), -- tank, healer, dps, support
  -- Visibility
  visibility build_visibility DEFAULT 'private',
  -- Engagement
  views_count INTEGER DEFAULT 0,
  likes_count INTEGER DEFAULT 0,
  copies_count INTEGER DEFAULT 0,
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Build likes (for rating)
CREATE TABLE IF NOT EXISTS build_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  build_id UUID NOT NULL REFERENCES builds(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- One like per user per build
  UNIQUE(build_id, user_id)
);

-- Build comments
CREATE TABLE IF NOT EXISTS build_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  build_id UUID NOT NULL REFERENCES builds(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Comment
  content TEXT NOT NULL,
  -- Threading
  parent_id UUID REFERENCES build_comments(id) ON DELETE CASCADE,
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Skill definitions (reference data - minimal for flexibility)
CREATE TABLE IF NOT EXISTS skill_definitions (
  id VARCHAR(50) PRIMARY KEY,
  archetype VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  skill_type VARCHAR(50), -- active, passive, ultimate
  icon VARCHAR(100),
  -- For UI ordering
  sort_order INTEGER DEFAULT 0
);

-- Augment definitions
CREATE TABLE IF NOT EXISTS augment_definitions (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  archetype_source VARCHAR(50) NOT NULL, -- Which archetype provides this augment
  icon VARCHAR(100),
  sort_order INTEGER DEFAULT 0
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_builds_creator ON builds(created_by);
CREATE INDEX IF NOT EXISTS idx_builds_group ON builds(group_id);
CREATE INDEX IF NOT EXISTS idx_builds_visibility ON builds(visibility);
CREATE INDEX IF NOT EXISTS idx_builds_archetype ON builds(primary_archetype);
CREATE INDEX IF NOT EXISTS idx_builds_tags ON builds USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_builds_likes ON builds(likes_count DESC);
CREATE INDEX IF NOT EXISTS idx_build_likes_build ON build_likes(build_id);
CREATE INDEX IF NOT EXISTS idx_build_comments_build ON build_comments(build_id);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE builds ENABLE ROW LEVEL SECURITY;
ALTER TABLE build_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE build_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE skill_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE augment_definitions ENABLE ROW LEVEL SECURITY;

-- Builds: based on visibility
CREATE POLICY "View builds based on visibility"
  ON builds FOR SELECT
  USING (
    visibility = 'public'
    OR created_by = auth.uid()
    OR (visibility = 'guild' AND group_id IS NOT NULL AND user_has_clan_role(group_id, auth.uid(), ARRAY['admin', 'officer', 'member']))
  );

-- Owners can manage their builds
CREATE POLICY "Owners can manage builds"
  ON builds FOR ALL
  USING (created_by = auth.uid());

-- Likes: users can like visible builds
CREATE POLICY "Users can like builds"
  ON build_likes FOR SELECT
  USING (true);

CREATE POLICY "Users can manage own likes"
  ON build_likes FOR ALL
  USING (user_id = auth.uid());

-- Comments: visible based on build visibility
CREATE POLICY "Comments visible with build"
  ON build_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM builds b
      WHERE b.id = build_comments.build_id
      AND (
        b.visibility = 'public'
        OR b.created_by = auth.uid()
        OR (b.visibility = 'guild' AND b.group_id IS NOT NULL AND user_has_clan_role(b.group_id, auth.uid(), ARRAY['admin', 'officer', 'member']))
      )
    )
  );

CREATE POLICY "Users can manage own comments"
  ON build_comments FOR ALL
  USING (user_id = auth.uid());

-- Skill/augment definitions: everyone can view
CREATE POLICY "Everyone can view skills"
  ON skill_definitions FOR SELECT
  USING (true);

CREATE POLICY "Everyone can view augments"
  ON augment_definitions FOR SELECT
  USING (true);

-- Comments
COMMENT ON TABLE builds IS 'Character build configurations with skills and augments';
COMMENT ON TABLE build_likes IS 'User likes for build rating';
COMMENT ON TABLE build_comments IS 'Comments and discussions on builds';
COMMENT ON TABLE skill_definitions IS 'Reference data for class skills';
COMMENT ON TABLE augment_definitions IS 'Reference data for skill augments';

-- Record this migration as applied
INSERT INTO migration_history (filename) VALUES ('018_builds.sql');

-- =====================================================
-- SOURCE: 019_character_linking.sql
-- =====================================================
-- =====================================================
-- Character Linking Migration (Deprecated)
-- =====================================================
-- This migration was replaced with automatic relationship detection
-- based on user_id and is_main fields.
-- No database changes are needed - relationships are computed at runtime.
--
-- Main/Alt relationships are now automatic:
-- - Characters with the same user_id are grouped together
-- - The character with is_main=true is the main character
-- - All others are alts
--
-- This file is kept for migration history but makes no changes.

-- Record this migration as applied
INSERT INTO migration_history (filename) VALUES ('019_character_linking.sql');

-- =====================================================
-- SOURCE: 020_enforce_single_main.sql
-- =====================================================
-- =====================================================
-- Enforce Single Main Character Per User
-- Ensures only one character per user can be marked as main
-- =====================================================

-- Drop the old index
DROP INDEX IF EXISTS idx_members_is_main;

-- Create a unique partial index to enforce only one main character per user
-- This allows NULL user_id (guest characters) to have multiple mains
CREATE UNIQUE INDEX idx_members_one_main_per_user 
  ON members(user_id) 
  WHERE is_main = TRUE AND user_id IS NOT NULL;

-- Update comment for clarity
COMMENT ON COLUMN members.is_main IS 'Whether this is the users main character. Only one main per user_id is allowed.';

-- Record this migration as applied
INSERT INTO migration_history (filename) VALUES ('020_enforce_single_main.sql');

-- =====================================================
-- SOURCE: 021_backfill_user_ids.sql
-- =====================================================
-- =====================================================
-- Backfill user_id for existing characters
-- Links characters to their creator based on clan membership
-- =====================================================

-- Update characters to have the user_id of the user who can edit them
-- This matches characters with clan members who have edit permissions
UPDATE members m
SET user_id = cm.user_id
FROM group_members cm
WHERE m.group_id = cm.group_id
  AND m.user_id IS NULL
  AND cm.role IN ('admin', 'officer', 'member')
  AND cm.group_id IN (
    -- Only update for groups where there's a single non-pending member
    -- to avoid ambiguity
    SELECT group_id 
    FROM group_members 
    WHERE role IN ('admin', 'officer', 'member')
    GROUP BY group_id 
    HAVING COUNT(*) = 1
  );

-- For groups with multiple members, you'll need to manually assign characters
-- or let users edit their characters to automatically claim them
COMMENT ON TABLE members IS 'Characters in groups. user_id links characters to their owner for automatic main/alt detection.';

-- Record this migration as applied
INSERT INTO migration_history (filename) VALUES ('021_backfill_user_ids.sql');

-- =====================================================
-- SOURCE: 022_detailed_artisan_tracking.sql
-- =====================================================
-- =====================================================
-- Add Detailed Artisan Skill Tracking
-- Adds level (0-50) and quality fields for precise profession tracking
-- =====================================================

-- Add artisan level (0-50)
-- Levels map to ranks:
--   0-9 = Novice (rank 1)
--  10-19 = Apprentice (rank 2)
--  20-29 = Journeyman (rank 3)
--  30-39 = Master (rank 4)
--  40-50 = Grandmaster (rank 5)
ALTER TABLE member_professions 
  ADD COLUMN IF NOT EXISTS artisan_level INTEGER DEFAULT 0;

-- Add quality/proficiency score (can be in the thousands)
ALTER TABLE member_professions 
  ADD COLUMN IF NOT EXISTS quality_score INTEGER DEFAULT 0;

-- Add constraints
DO $$ BEGIN
  ALTER TABLE member_professions ADD CONSTRAINT member_professions_artisan_level_check 
    CHECK (artisan_level >= 0 AND artisan_level <= 50);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE member_professions ADD CONSTRAINT member_professions_quality_score_check 
    CHECK (quality_score >= 0);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add comments
COMMENT ON COLUMN member_professions.artisan_level IS 'Artisan skill level (0-50). Level ranges: 0-9=Novice, 10-19=Apprentice, 20-29=Journeyman, 30-39=Master, 40-50=Grandmaster. Note: Promotion to next rank requires manual certification.';
COMMENT ON COLUMN member_professions.quality_score IS 'Quality/proficiency score (no upper limit)';

-- Record this migration as applied
INSERT INTO migration_history (filename) VALUES ('022_detailed_artisan_tracking.sql');

-- =====================================================
-- SOURCE: 023_allow_members_add_characters.sql
-- =====================================================
-- =====================================================
-- Allow Regular Members to Add Characters
-- Updates RLS policies so all approved clan members can add characters
-- =====================================================

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Admin/Officer manage members" ON members;

-- Create new policy that allows any approved member to insert characters
CREATE POLICY "Approved members can add characters" ON members
  FOR INSERT WITH CHECK (
    user_has_clan_role(group_id, auth.uid(), ARRAY['admin', 'officer', 'member'])
  );

-- Also update the member_professions policy to allow members to manage their own character's professions
DROP POLICY IF EXISTS "Modify professions" ON member_professions;

-- Allow members to modify professions for their own characters
CREATE POLICY "Members can modify own character professions" ON member_professions
  FOR ALL USING (
    member_id IN (
      SELECT m.id FROM members m
      WHERE m.user_id = auth.uid() 
         OR user_has_clan_role(m.group_id, auth.uid(), ARRAY['admin', 'officer'])
    )
  );

-- Update policy: members can update their own characters, officers/admins can update all
DROP POLICY IF EXISTS "Admin/Officer update members" ON members;

CREATE POLICY "Members can update own characters" ON members
  FOR UPDATE USING (
    user_id = auth.uid() OR user_has_clan_role(group_id, auth.uid(), ARRAY['admin', 'officer'])
  );

-- Delete policy: members can delete their own characters, officers/admins can delete all
DROP POLICY IF EXISTS "Admin/Officer delete members" ON members;

CREATE POLICY "Members can delete own characters" ON members
  FOR DELETE USING (
    user_id = auth.uid() OR user_has_clan_role(group_id, auth.uid(), ARRAY['admin', 'officer'])
  );

-- Record this migration as applied
INSERT INTO migration_history (filename) VALUES ('023_allow_members_add_characters.sql');

-- =====================================================
-- SOURCE: 024_fix_quality_constraint.sql
-- =====================================================
-- =====================================================
-- Fix Quality Score Constraint
-- Removes the old 0-100 constraint and ensures unlimited quality values
-- =====================================================

-- Drop the existing constraint if it exists
ALTER TABLE member_professions 
  DROP CONSTRAINT IF EXISTS member_professions_quality_score_check;

-- Recreate with no upper limit
ALTER TABLE member_professions 
  ADD CONSTRAINT member_professions_quality_score_check 
    CHECK (quality_score >= 0);

-- Update comment to clarify
COMMENT ON COLUMN member_professions.quality_score IS 'Quality/proficiency score with all buffs (food, clothes, town buffs, etc.) - no upper limit, can be in thousands';

-- Record this migration as applied
INSERT INTO migration_history (filename) VALUES ('024_fix_quality_constraint.sql');

-- =====================================================
-- SOURCE: 025_discord_role_ping.sql
-- =====================================================
-- =====================================================
-- Add Discord Role Ping for Announcements
-- Allows pinging a specific Discord role when announcements are posted
-- =====================================================

-- Add role ID field to groups table
ALTER TABLE groups ADD COLUMN IF NOT EXISTS discord_announcement_role_id TEXT;

-- Add comment
COMMENT ON COLUMN groups.discord_announcement_role_id IS 'Discord role ID to ping when posting announcements (numeric ID only)';

-- Record this migration as applied
INSERT INTO migration_history (filename) VALUES ('025_discord_role_ping.sql');

-- =====================================================
-- SOURCE: 026_add_farming_event_types.sql
-- =====================================================
-- Add new farming event types to the event_type ENUM
-- Migration: 024_add_farming_event_types
-- Purpose: Add farming_glint, farming_materials, farming_gear, farming_other to event_type enum

-- Add the new enum values
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'farming_glint';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'farming_materials';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'farming_gear';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'farming_other';

-- Add comment documenting the change
COMMENT ON TYPE event_type IS 'Event types: raid, siege, gathering, social, farming_glint, farming_materials, farming_gear, farming_other, other';

-- Record this migration as applied
INSERT INTO migration_history (filename) VALUES ('026_add_farming_event_types.sql');

-- =====================================================
-- SOURCE: 027_event_role_requirements.sql
-- =====================================================
-- Migration 025: Add role-based requirements to events
-- Purpose: Allow events to have role requirements like parties
-- and track which role users are RSVPing for

-- Add role requirement columns to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS tanks_needed INT DEFAULT 0;
ALTER TABLE events ADD COLUMN IF NOT EXISTS healers_needed INT DEFAULT 0;
ALTER TABLE events ADD COLUMN IF NOT EXISTS dps_needed INT DEFAULT 0;
ALTER TABLE events ADD COLUMN IF NOT EXISTS support_needed INT DEFAULT 0;

-- Add role column to event_rsvps to track which role user is attending as
ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS role TEXT;
ALTER TABLE event_rsvps ADD CONSTRAINT event_rsvps_role_check 
  CHECK (role IS NULL OR role IN ('tank', 'healer', 'dps', 'support'));

-- Add comments
COMMENT ON COLUMN events.tanks_needed IS 'Number of tanks needed for this event';
COMMENT ON COLUMN events.healers_needed IS 'Number of healers needed for this event';
COMMENT ON COLUMN events.dps_needed IS 'Number of DPS needed for this event';
COMMENT ON COLUMN events.support_needed IS 'Number of support players needed for this event';
COMMENT ON COLUMN event_rsvps.role IS 'Which role the user is attending as (tank, healer, dps, support)';

-- Note: max_attendees is kept for backward compatibility and general events without role requirements

-- Record this migration as applied
INSERT INTO migration_history (filename) VALUES ('027_event_role_requirements.sql');

-- =====================================================
-- SOURCE: 028_update_role_system.sql
-- =====================================================
-- Migration 026: Update role system to use specific roles
-- Purpose: Replace generic role system with specific roles: tank, cleric, bard, ranged_dps, melee_dps
-- This affects both parties and events

-- =====================================================
-- PARTY ROLE UPDATES
-- =====================================================

-- Drop old constraint on party_roster
ALTER TABLE party_roster DROP CONSTRAINT IF EXISTS party_roster_role_check;

-- Update party_roster to use new roles
ALTER TABLE party_roster ADD CONSTRAINT party_roster_role_check 
  CHECK (role IN ('tank', 'cleric', 'bard', 'ranged_dps', 'melee_dps'));

-- Rename columns in parties table
ALTER TABLE parties RENAME COLUMN healers_needed TO clerics_needed;
ALTER TABLE parties RENAME COLUMN support_needed TO bards_needed;
ALTER TABLE parties RENAME COLUMN dps_needed TO ranged_dps_needed;
ALTER TABLE parties ADD COLUMN IF NOT EXISTS melee_dps_needed INT DEFAULT 0;

-- Update any existing 'healer' roles to 'cleric'
UPDATE party_roster SET role = 'cleric' WHERE role = 'healer';
-- Update any existing 'support' roles to 'bard'
UPDATE party_roster SET role = 'bard' WHERE role = 'support';
-- Update any existing 'dps' roles to 'ranged_dps' (default choice)
UPDATE party_roster SET role = 'ranged_dps' WHERE role = 'dps';

-- =====================================================
-- EVENT ROLE UPDATES
-- =====================================================

-- Drop old constraint on event_rsvps if it exists
ALTER TABLE event_rsvps DROP CONSTRAINT IF EXISTS event_rsvps_role_check;

-- Update event_rsvps to use new roles
ALTER TABLE event_rsvps ADD CONSTRAINT event_rsvps_role_check 
  CHECK (role IS NULL OR role IN ('tank', 'cleric', 'bard', 'ranged_dps', 'melee_dps'));

-- Rename columns in events table
ALTER TABLE events RENAME COLUMN healers_needed TO clerics_needed;
ALTER TABLE events RENAME COLUMN support_needed TO bards_needed;
ALTER TABLE events RENAME COLUMN dps_needed TO ranged_dps_needed;
ALTER TABLE events ADD COLUMN IF NOT EXISTS melee_dps_needed INT DEFAULT 0;

-- Update any existing 'healer' roles to 'cleric'
UPDATE event_rsvps SET role = 'cleric' WHERE role = 'healer';
-- Update any existing 'support' roles to 'bard'
UPDATE event_rsvps SET role = 'bard' WHERE role = 'support';
-- Update any existing 'dps' roles to 'ranged_dps' (default choice)
UPDATE event_rsvps SET role = 'ranged_dps' WHERE role = 'dps';

-- =====================================================
-- UPDATE COMMENTS
-- =====================================================

-- Party comments
COMMENT ON COLUMN parties.tanks_needed IS 'Number of tanks needed';
COMMENT ON COLUMN parties.clerics_needed IS 'Number of clerics needed';
COMMENT ON COLUMN parties.bards_needed IS 'Number of bards needed';
COMMENT ON COLUMN parties.ranged_dps_needed IS 'Number of ranged DPS needed';
COMMENT ON COLUMN parties.melee_dps_needed IS 'Number of melee DPS needed';
COMMENT ON COLUMN party_roster.role IS 'Role: tank, cleric, bard, ranged_dps, melee_dps';

-- Event comments
COMMENT ON COLUMN events.tanks_needed IS 'Number of tanks needed';
COMMENT ON COLUMN events.clerics_needed IS 'Number of clerics needed';
COMMENT ON COLUMN events.bards_needed IS 'Number of bards needed';
COMMENT ON COLUMN events.ranged_dps_needed IS 'Number of ranged DPS needed';
COMMENT ON COLUMN events.melee_dps_needed IS 'Number of melee DPS needed';
COMMENT ON COLUMN event_rsvps.role IS 'Role: tank, cleric, bard, ranged_dps, melee_dps';

-- Record this migration as applied
INSERT INTO migration_history (filename) VALUES ('028_update_role_system.sql');

-- =====================================================
-- SOURCE: 029_clan_permission_overrides.sql
-- =====================================================
-- Migration 027: Add clan permission overrides table
-- Purpose: Store custom role-based permission overrides for groups
-- Allows admins to customize which permissions each role has

BEGIN;

-- Create table for storing custom role permission overrides
CREATE TABLE group_permission_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'officer', 'member', 'trial', 'pending')),
  
  -- Character management permissions
  characters_create BOOLEAN DEFAULT TRUE,
  characters_read_all BOOLEAN DEFAULT TRUE,
  characters_edit_own BOOLEAN DEFAULT TRUE,
  characters_edit_any BOOLEAN DEFAULT FALSE,
  characters_delete_own BOOLEAN DEFAULT TRUE,
  characters_delete_any BOOLEAN DEFAULT FALSE,
  
  -- Guild bank permissions
  guild_bank_withdraw BOOLEAN DEFAULT FALSE,
  guild_bank_deposit BOOLEAN DEFAULT TRUE,
  guild_bank_view_history BOOLEAN DEFAULT FALSE,
  
  -- Event permissions
  events_create BOOLEAN DEFAULT FALSE,
  events_read BOOLEAN DEFAULT TRUE,
  events_edit_own BOOLEAN DEFAULT FALSE,
  events_edit_any BOOLEAN DEFAULT FALSE,
  events_delete_own BOOLEAN DEFAULT FALSE,
  events_delete_any BOOLEAN DEFAULT FALSE,
  events_rsvp BOOLEAN DEFAULT TRUE,
  
  -- Party permissions
  parties_create BOOLEAN DEFAULT FALSE,
  parties_read BOOLEAN DEFAULT TRUE,
  parties_edit_own BOOLEAN DEFAULT FALSE,
  parties_edit_any BOOLEAN DEFAULT FALSE,
  parties_delete_own BOOLEAN DEFAULT FALSE,
  parties_delete_any BOOLEAN DEFAULT FALSE,
  
  -- Siege permissions
  siege_view_rosters BOOLEAN DEFAULT TRUE,
  siege_edit_rosters BOOLEAN DEFAULT FALSE,
  siege_create_event BOOLEAN DEFAULT FALSE,
  
  -- Announcement permissions
  announcements_create BOOLEAN DEFAULT FALSE,
  announcements_edit BOOLEAN DEFAULT FALSE,
  announcements_delete BOOLEAN DEFAULT FALSE,
  
  -- Recruitment permissions
  recruitment_manage BOOLEAN DEFAULT FALSE,
  
  -- Settings permissions
  settings_edit BOOLEAN DEFAULT FALSE,
  settings_edit_roles BOOLEAN DEFAULT FALSE,
  settings_view_permissions BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(group_id, role)
);

-- Create index for faster lookups by clan and role
CREATE INDEX idx_clan_permission_overrides_clan_role 
  ON group_permission_overrides(group_id, role);

-- Enable RLS
ALTER TABLE group_permission_overrides ENABLE ROW LEVEL SECURITY;

-- Create RLS policy: admins can view and modify permissions for their clan
CREATE POLICY "clan_admins_can_manage_permissions" ON group_permission_overrides
  FOR ALL
  USING (
    auth.uid() IN (
      SELECT user_id FROM group_members 
      WHERE group_id = group_permission_overrides.group_id 
      AND role = 'admin'
    )
  )
  WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM group_members 
      WHERE group_id = group_permission_overrides.group_id 
      AND role = 'admin'
    )
  );

-- Create RLS policy: members can view their own clan's permission structure
CREATE POLICY "clan_members_can_view_permissions" ON group_permission_overrides
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM group_members 
      WHERE group_id = group_permission_overrides.group_id
    )
  );

-- Record this migration as applied
INSERT INTO migration_history (filename) VALUES ('029_clan_permission_overrides.sql');

COMMIT;

-- =====================================================
-- SOURCE: 030_crafting_achievements.sql
-- =====================================================
-- =====================================================
-- 028_crafting_achievements.sql - Crafting & Gathering Achievements
-- Add achievements for profession mastery across the guild
-- =====================================================

-- Insert new crafting and gathering achievements
INSERT INTO achievement_definitions (name, description, category, icon, requirement_type, requirement_value, points, sort_order) VALUES
  -- Gathering mastery
  ('Gatherers Guild', 'Have Journeyman+ in all gathering skills', 'economy', '🪓', 'gathering_journeyman_all', 1, 25, 40),
  ('Master Gatherers', 'Have Master+ in all gathering skills', 'economy', '⛏️', 'gathering_master_all', 1, 50, 41),
  ('Gathering Legends', 'Have Grandmaster in all gathering skills', 'economy', '🌟', 'gathering_grandmaster_all', 1, 100, 42),
  
  -- Processing mastery
  ('Processors United', 'Have Journeyman+ in all processing skills', 'economy', '⚙️', 'processing_journeyman_all', 1, 25, 43),
  ('Master Processors', 'Have Master+ in all processing skills', 'economy', '⚙️', 'processing_master_all', 1, 50, 44),
  ('Processing Mastery', 'Have Grandmaster in all processing skills', 'economy', '🔧', 'processing_grandmaster_all', 1, 100, 45),
  
  -- Crafting mastery
  ('Crafters United', 'Have Journeyman+ in all crafting skills', 'economy', '🔨', 'crafting_journeyman_all', 1, 25, 46),
  ('Master Crafters', 'Have Master+ in all crafting skills', 'economy', '🔨', 'crafting_master_all', 1, 50, 47),
  ('Ultimate Craftsmanship', 'Have Grandmaster in all crafting skills', 'economy', '👑', 'crafting_grandmaster_all', 1, 100, 48),
  
  -- Special milestones
  ('Jack of All Trades', 'Have Grandmaster in at least one skill from each tier', 'economy', '🎓', 'jack_of_all_trades', 1, 75, 49),
  ('Master of All Trades', 'Have Master+ in at least 3 skills from each tier', 'economy', '📚', 'master_of_all_trades', 1, 90, 50)
ON CONFLICT DO NOTHING;

-- Record this migration as applied
INSERT INTO migration_history (filename) VALUES ('030_crafting_achievements.sql');

-- =====================================================
-- SOURCE: 031_add_discord_welcome_webhook_url.sql
-- =====================================================
-- Migration: Add group_welcome_webhook_url to groups table
ALTER TABLE groups ADD COLUMN IF NOT EXISTS group_welcome_webhook_url TEXT;

COMMENT ON COLUMN groups.group_welcome_webhook_url IS 'Discord webhook URL for welcome messages (optional, falls back to main webhook if not set)';

INSERT INTO migration_history (filename) VALUES ('031_add_discord_welcome_webhook_url.sql');

-- =====================================================
-- SOURCE: 032_role_minimums_not_caps.sql
-- =====================================================
-- Migration: Change role requirements from caps to minimums
-- Change field names to reflect they are minimums, not caps
-- This allows unlimited signups while still tracking minimum requirements

ALTER TABLE events 
  RENAME COLUMN tanks_needed TO tanks_min;

ALTER TABLE events 
  RENAME COLUMN clerics_needed TO clerics_min;

ALTER TABLE events 
  RENAME COLUMN bards_needed TO bards_min;

ALTER TABLE events 
  RENAME COLUMN ranged_dps_needed TO ranged_dps_min;

ALTER TABLE events 
  RENAME COLUMN melee_dps_needed TO melee_dps_min;

COMMENT ON COLUMN events.tanks_min IS 'Minimum number of tanks required (not a cap)';
COMMENT ON COLUMN events.clerics_min IS 'Minimum number of clerics required (not a cap)';
COMMENT ON COLUMN events.bards_min IS 'Minimum number of bards required (not a cap)';
COMMENT ON COLUMN events.ranged_dps_min IS 'Minimum number of ranged DPS required (not a cap)';
COMMENT ON COLUMN events.melee_dps_min IS 'Minimum number of melee DPS required (not a cap)';

INSERT INTO migration_history (filename) VALUES ('032_role_minimums_not_caps.sql');

-- =====================================================
-- SOURCE: 033_add_role_max_caps.sql
-- =====================================================
-- Migration: Add optional maximum caps for each role
-- Defaults to NULL (unlimited) but allows setting a cap if needed

ALTER TABLE events 
  ADD COLUMN IF NOT EXISTS tanks_max INTEGER DEFAULT NULL;

ALTER TABLE events 
  ADD COLUMN IF NOT EXISTS clerics_max INTEGER DEFAULT NULL;

ALTER TABLE events 
  ADD COLUMN IF NOT EXISTS bards_max INTEGER DEFAULT NULL;

ALTER TABLE events 
  ADD COLUMN IF NOT EXISTS ranged_dps_max INTEGER DEFAULT NULL;

ALTER TABLE events 
  ADD COLUMN IF NOT EXISTS melee_dps_max INTEGER DEFAULT NULL;

COMMENT ON COLUMN events.tanks_max IS 'Maximum number of tanks allowed (NULL = unlimited)';
COMMENT ON COLUMN events.clerics_max IS 'Maximum number of clerics allowed (NULL = unlimited)';
COMMENT ON COLUMN events.bards_max IS 'Maximum number of bards allowed (NULL = unlimited)';
COMMENT ON COLUMN events.ranged_dps_max IS 'Maximum number of ranged DPS allowed (NULL = unlimited)';
COMMENT ON COLUMN events.melee_dps_max IS 'Maximum number of melee DPS allowed (NULL = unlimited)';

INSERT INTO migration_history (filename) VALUES ('033_add_role_max_caps.sql');

-- =====================================================
-- SOURCE: 034_fix_events_rls_include_trial.sql
-- =====================================================
-- Migration: Fix event RLS policies to include trial members
-- Purpose: Trial members should be able to view events and RSVP, just like regular members

-- Drop and recreate the "Clan members can view events" policy
-- Drop and recreate the "Clan members can view RSVPs" policy
-- Drop and recreate the "Members can RSVP" policy
DROP POLICY IF EXISTS "Members can RSVP" ON event_rsvps;
-- Record this migration as applied
INSERT INTO migration_history (filename) VALUES ('034_fix_events_rls_include_trial.sql');

-- =====================================================
-- SOURCE: 035_allow_admin_rsvp_on_behalf.sql
-- =====================================================
-- Migration: Allow admins and officers to RSVP on behalf of members
-- Purpose: Enable event organizers to register members who can't respond themselves

-- Drop and recreate the "Members can RSVP" policy to allow admins to RSVP for others
DROP POLICY IF EXISTS "Members can RSVP" ON event_rsvps;
-- Also update the UPDATE policy to allow admins to update RSVPs for members
DROP POLICY IF EXISTS "Users can update own RSVP" ON event_rsvps;
-- Record this migration as applied
INSERT INTO migration_history (filename) VALUES ('035_allow_admin_rsvp_on_behalf.sql');

-- =====================================================
-- SOURCE: 036_allow_allied_clan_event_participation.sql
-- =====================================================
-- Migration: Allow Allied group members to view and RSVP to clan events
-- Purpose: Enable members from allied groups to participate in events, even if not in the system

-- =====================================================
-- HELPER FUNCTION
-- =====================================================

-- Function to check if user is in the event's clan OR in an Allied group
CREATE OR REPLACE FUNCTION user_in_group_or_allied_group(check_group_id UUID, check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    -- User is in the event's clan
    SELECT 1 FROM group_members 
    WHERE group_id = check_group_id 
    AND user_id = check_user_id
  ) OR EXISTS (
    -- User is in a clan allied with the event's clan
    SELECT 1 FROM group_members cm
    INNER JOIN alliance_members am ON cm.group_id = am.group_id
    INNER JOIN alliance_members am2 ON am.alliance_id = am2.alliance_id
    WHERE am2.group_id = check_group_id
    AND cm.user_id = check_user_id
    AND am.status = 'active'
    AND am2.status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- UPDATE RLS POLICIES
-- =====================================================

-- Update "Clan members can view events" to include Allied group members
-- Update "Clan members can view RSVPs" to include Allied group members
-- Update "Members can RSVP" to include Allied group members
DROP POLICY IF EXISTS "Members can RSVP" ON event_rsvps;
-- Update "Users can update own RSVP" to include allied members
DROP POLICY IF EXISTS "Users can update own RSVP" ON event_rsvps;
-- Record this migration as applied
INSERT INTO migration_history (filename) VALUES ('036_allow_allied_clan_event_participation.sql');

-- =====================================================
-- SOURCE: 037_add_combined_dps_option.sql
-- =====================================================
-- Migration: Add combined DPS option to events
-- Purpose: Allow event creators to set a combined ranged+melee DPS max instead of separate limits

-- Add columns to track combined DPS settings
ALTER TABLE events
ADD COLUMN allow_combined_dps BOOLEAN DEFAULT FALSE,
ADD COLUMN combined_dps_max INTEGER;

-- Add constraint: if combined_dps is enabled, should have a max
-- (Note: This is advisory - can be null if not combined mode)

-- Record this migration as applied
INSERT INTO migration_history (filename) VALUES ('037_add_combined_dps_option.sql');

-- =====================================================
-- SOURCE: 038_guest_event_rsvps.sql
-- =====================================================
-- Migration: Guest RSVP table for allies not yet in the system
-- Purpose: Allow Allied group members to RSVP without having an account

CREATE TABLE guest_event_rsvps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  allied_group_id UUID NOT NULL REFERENCES groups(id),
  guest_name VARCHAR(255) NOT NULL,
  class_id UUID,
  role VARCHAR(20) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one RSVP per guest per event
  UNIQUE(event_id, allied_group_id, guest_name)
);

-- Create index for faster queries
CREATE INDEX idx_guest_event_rsvps_event ON guest_event_rsvps(event_id);
CREATE INDEX idx_guest_event_rsvps_allied_group ON guest_event_rsvps(allied_group_id);

-- Enable RLS
ALTER TABLE guest_event_rsvps ENABLE ROW LEVEL SECURITY;

-- Policy: Clan members can view guest RSVPs for their events
CREATE POLICY "Members can view guest RSVPs"
  ON guest_event_rsvps FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_id
      AND user_in_group_or_allied_group(e.group_id, auth.uid())
    )
  );

-- Policy: Allow inserts via API (validated server-side)
-- We use a permissive policy since validation happens in the API
CREATE POLICY "API can create guest RSVPs"
  ON guest_event_rsvps FOR INSERT
  WITH CHECK (true);

-- Policy: Members can update guest RSVPs (admins only)
CREATE POLICY "Admins can manage guest RSVPs"
  ON guest_event_rsvps FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_id
      AND user_has_clan_role(e.group_id, auth.uid(), ARRAY['admin', 'officer'])
    )
  );

-- Policy: Admins can delete guest RSVPs
CREATE POLICY "Admins can delete guest RSVPs"
  ON guest_event_rsvps FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_id
      AND user_has_clan_role(e.group_id, auth.uid(), ARRAY['admin', 'officer'])
    )
  );

-- Record this migration as applied
INSERT INTO migration_history (filename) VALUES ('038_guest_event_rsvps.sql');

-- =====================================================
-- SOURCE: 039_add_check_clans_allied_function.sql
-- =====================================================
-- Migration: Add helper function to check if groups are allied
-- Purpose: Validate that guest's clan is allied with event's clan

CREATE OR REPLACE FUNCTION check_groups_allied(group_a UUID, group_b UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM alliance_members am1
    INNER JOIN alliance_members am2 ON am1.alliance_id = am2.alliance_id
    WHERE am1.group_id = group_a
    AND am2.group_id = group_b
    AND am1.status = 'active'
    AND am2.status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Record this migration as applied
INSERT INTO migration_history (filename) VALUES ('039_add_check_groups_allied_function.sql');

-- =====================================================
-- SOURCE: 040_add_public_events.sql
-- =====================================================
-- Migration: Add public event support
-- Purpose: Allow groups to mark events as public for unauthenticated guest access

-- =====================================================
-- ADD PUBLIC FLAG TO EVENTS
-- =====================================================

ALTER TABLE events ADD COLUMN is_public BOOLEAN DEFAULT FALSE;

-- =====================================================
-- ADD EMAIL FIELD FOR ANONYMOUS GUESTS
-- =====================================================

ALTER TABLE guest_event_rsvps ADD COLUMN guest_email VARCHAR(255);

-- Add unique constraint for anonymous guests (email + event)
ALTER TABLE guest_event_rsvps 
ADD CONSTRAINT guest_rsvp_unique_anonymous UNIQUE NULLS NOT DISTINCT (event_id, guest_email);

-- =====================================================
-- UPDATE RLS POLICIES FOR PUBLIC EVENTS
-- =====================================================

-- Allow anonymous users to view public events
CREATE POLICY "Group members and public can view events"
  ON events FOR SELECT
  USING (
    is_public = TRUE
    OR user_in_group_or_allied_group(group_id, auth.uid())
  );

-- Allow anonymous users to insert guest RSVPs on public events
DROP POLICY IF EXISTS "Insert guest RSVPs" ON guest_event_rsvps;
CREATE POLICY "Anyone can RSVP to public events as guest"
  ON guest_event_rsvps FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = guest_event_rsvps.event_id
      AND e.is_public = TRUE
    )
  );

-- Keep view access for authenticated users via allied groups
CREATE POLICY "Allied members can view guest RSVPs"
  ON guest_event_rsvps FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = guest_event_rsvps.event_id
      AND user_in_group_or_allied_group(e.group_id, auth.uid())
    )
  );

-- Record this migration as applied
INSERT INTO migration_history (filename) VALUES ('040_add_public_events.sql');

-- =====================================================
-- SOURCE: 041_add_allied_signup_control.sql
-- =====================================================
-- Migration: Add allied member signup control
-- Purpose: Allow event creators to control whether allied members can sign up for events

-- =====================================================
-- ADD ALLIED SIGNUP CONTROL TO EVENTS
-- =====================================================

ALTER TABLE events ADD COLUMN allow_allied_signups BOOLEAN DEFAULT TRUE;

-- =====================================================
-- UPDATE RLS POLICIES FOR ALLIED SIGNUP CONTROL
-- =====================================================

-- Update Allied group RSVP policy to check the allow_allied_signups flag
DROP POLICY IF EXISTS "Allied group members can RSVP to events" ON event_rsvps;
CREATE POLICY "Allied group members can RSVP to events"
  ON event_rsvps FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_rsvps.event_id
      AND e.allow_allied_signups = TRUE
      AND user_in_group_or_allied_group(e.group_id, auth.uid())
    )
  );

-- Record this migration as applied
INSERT INTO migration_history (filename) VALUES ('041_add_allied_signup_control.sql');

-- =====================================================
-- SOURCE: 042_allow_public_event_rsvp_view.sql
-- =====================================================
-- Migration: Allow public viewing of RSVPs on public events
-- Purpose: Allow unauthenticated users to see attendance counts for public events

-- =====================================================
-- ADD RLS POLICY FOR PUBLIC EVENT RSVP VIEWING
-- =====================================================

-- Allow anyone (including anonymous) to view RSVPs for public events
CREATE POLICY "Anyone can view RSVPs for public events"
  ON event_rsvps FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_rsvps.event_id
      AND e.is_public = TRUE
    )
  );

-- Record this migration as applied
INSERT INTO migration_history (filename) VALUES ('042_allow_public_event_rsvp_view.sql');

-- =====================================================
-- SOURCE: 043_fix_guest_rsvp_policies.sql
-- =====================================================
-- Migration: Fix guest RSVP for public events
-- Purpose: Allow public guests to RSVP without an Allied group

-- =====================================================
-- MAKE allied_group_id NULLABLE FOR PUBLIC GUESTS
-- =====================================================

-- Make allied_group_id nullable so public guests can sign up without a clan
ALTER TABLE guest_event_rsvps ALTER COLUMN allied_group_id DROP NOT NULL;

-- Drop the foreign key constraint and recreate it as deferrable
ALTER TABLE guest_event_rsvps DROP CONSTRAINT guest_event_rsvps_allied_group_id_fkey;
ALTER TABLE guest_event_rsvps 
ADD CONSTRAINT guest_event_rsvps_allied_group_id_fkey 
FOREIGN KEY (allied_group_id) REFERENCES groups(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;

-- Update unique constraint to allow NULL allied_group_id for public guests
ALTER TABLE guest_event_rsvps DROP CONSTRAINT guest_rsvp_unique_anonymous;
ALTER TABLE guest_event_rsvps 
ADD CONSTRAINT guest_rsvp_unique_anonymous UNIQUE NULLS NOT DISTINCT (event_id, guest_email, allied_group_id);

-- =====================================================
-- DISABLE RLS (validation happens at application layer)
-- =====================================================

-- Disable RLS since we validate at the application layer
ALTER TABLE guest_event_rsvps DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- MAKE GUEST_EMAIL NULLABLE
-- =====================================================

-- Email is optional for public guests
ALTER TABLE guest_event_rsvps ALTER COLUMN guest_email DROP NOT NULL;

-- Record this migration as applied
INSERT INTO migration_history (filename) VALUES ('043_fix_guest_rsvp_policies.sql');

-- =====================================================
-- SOURCE: 044_add_guest_rsvp_status.sql
-- =====================================================
-- Migration: Add status to guest RSVPs
-- Purpose: Track confirmation status (attending/maybe) for guest signups

-- Add status column to guest_event_rsvps
ALTER TABLE guest_event_rsvps 
ADD COLUMN status VARCHAR(20) DEFAULT 'attending' CHECK (status IN ('attending', 'maybe', 'declined'));

-- Record this migration as applied
INSERT INTO migration_history (filename) VALUES ('044_add_guest_rsvp_status.sql');

-- =====================================================
-- SOURCE: 045_add_game_support.sql
-- =====================================================
-- =====================================================
-- Add Multi-Game Support
-- =====================================================
-- Migration: 034_add_game_support

-- Add game column to groups table
ALTER TABLE groups ADD COLUMN game VARCHAR(50) DEFAULT 'aoc' NOT NULL;

-- Add constraint for valid games
ALTER TABLE groups ADD CONSTRAINT valid_game CHECK (game IN ('aoc', 'starcitizen'));

-- Create game types enum equivalent
CREATE TABLE IF NOT EXISTS game_types (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(5),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed game types
INSERT INTO game_types (id, name, description, icon) VALUES
  ('aoc', 'Ashes of Creation', 'Guild profession planning and coordination', '⚔️'),
  ('starcitizen', 'Star Citizen', 'Fleet management and pilot coordination', '🚀')
ON CONFLICT (id) DO NOTHING;

-- Create user_games table to track which games a user participates in
CREATE TABLE IF NOT EXISTS user_games (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  game VARCHAR(50) REFERENCES game_types(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, game)
);

CREATE INDEX idx_user_games_user_id ON user_games(user_id);
CREATE INDEX idx_user_games_game ON user_games(game);

-- Create index on groups.game for faster filtering
CREATE INDEX idx_groups_game ON groups(game);

INSERT INTO migration_history (filename) VALUES ('045_add_game_support.sql');
-- =====================================================
-- SOURCE: 048_create_group_games_table.sql
-- =====================================================
-- Create group_games table to store which games are enabled for each group
CREATE TABLE IF NOT EXISTS group_games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  game_slug TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(group_id, game_slug)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_group_games_group_id ON group_games(group_id);
CREATE INDEX IF NOT EXISTS idx_group_games_game_slug ON group_games(game_slug);

-- Enable RLS
ALTER TABLE group_games ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view games for groups they're in
CREATE POLICY "Users can view games for their groups"
  ON group_games FOR SELECT
  USING (
    group_id IN (
      SELECT id FROM groups 
      WHERE id IN (
        SELECT group_id FROM group_members 
        WHERE user_id = auth.uid()
      )
    )
  );

-- RLS Policy: Admins can manage games for their groups
CREATE POLICY "Admins can manage group games"
  ON group_games FOR ALL
  USING (
    user_has_clan_role(group_id, auth.uid(), ARRAY['admin'])
  )
  WITH CHECK (
    user_has_clan_role(group_id, auth.uid(), ARRAY['admin'])
  );

-- Track this migration
INSERT INTO migration_history (filename) VALUES ('048_create_group_games_table.sql') ON CONFLICT DO NOTHING;

-- =====================================================
-- SOURCE: 049_add_game_to_characters.sql
-- =====================================================
-- Add game_slug column to members table for game-specific characters
ALTER TABLE members ADD COLUMN IF NOT EXISTS game_slug TEXT NOT NULL DEFAULT 'aoc';

-- Create index for faster lookups by game
CREATE INDEX IF NOT EXISTS idx_members_game_slug ON members(game_slug);

-- Create composite index for common queries (group + game)
CREATE INDEX IF NOT EXISTS idx_members_group_game ON members(group_id, game_slug);

-- Track this migration
INSERT INTO migration_history (filename) VALUES ('049_add_game_to_characters.sql') ON CONFLICT DO NOTHING;

-- =====================================================
-- SOURCE: 050_add_game_to_events.sql
-- =====================================================
-- Add game_slug column to events table for game-specific events
ALTER TABLE events ADD COLUMN IF NOT EXISTS game_slug TEXT NOT NULL DEFAULT 'aoc';

-- Create index for faster lookups by game
CREATE INDEX IF NOT EXISTS idx_events_game_slug ON events(game_slug);

-- Create composite index for common queries (group + game)
CREATE INDEX IF NOT EXISTS idx_events_group_game ON events(group_id, game_slug);

-- Track this migration
INSERT INTO migration_history (filename) VALUES ('050_add_game_to_events.sql') ON CONFLICT DO NOTHING;

-- =====================================================
-- SOURCE: 051_add_preferred_role_to_members.sql
-- =====================================================
-- Add preferred_role column to members table for game-specific role tracking
-- Roles are defined in src/config/games/[game].json instead of database for easier updates
ALTER TABLE members ADD COLUMN IF NOT EXISTS preferred_role TEXT;

-- Track this migration
INSERT INTO migration_history (filename) VALUES ('051_add_preferred_role_to_members.sql') ON CONFLICT DO NOTHING;

-- =====================================================
-- SOURCE: 052_add_guild_rank_to_members.sql
-- =====================================================
-- Add guild_rank column to group_members table for game-specific rank assignment
-- Ranks are assigned per-user (like role), and defined in src/config/games/[game].json
ALTER TABLE group_members ADD COLUMN IF NOT EXISTS guild_rank TEXT;

-- Track this migration
INSERT INTO migration_history (filename) VALUES ('052_add_guild_rank_to_members.sql') ON CONFLICT DO NOTHING;

-- =====================================================
-- SOURCE: 053_add_character_ships.sql
-- =====================================================
-- Add ship ownership tracking for Star Citizen characters
-- A character can own multiple ships with different ownership types

CREATE TABLE IF NOT EXISTS character_ships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  ship_id TEXT NOT NULL, -- References ship ID from star-citizen-ships.json
  ownership_type TEXT NOT NULL CHECK (ownership_type IN ('pledged', 'in-game', 'loaner')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(character_id, ship_id, ownership_type)
);

-- Index for querying ships by character
CREATE INDEX IF NOT EXISTS idx_character_ships_character_id ON character_ships(character_id);

-- Index for querying by ownership type
CREATE INDEX IF NOT EXISTS idx_character_ships_ownership_type ON character_ships(ownership_type);

-- RLS Policies
ALTER TABLE character_ships ENABLE ROW LEVEL SECURITY;

-- Users can view ships for characters in their groups
CREATE POLICY "Users can view character ships in their groups"
  ON character_ships
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM members m
      JOIN group_members gm ON gm.user_id = m.user_id
      WHERE m.id = character_ships.character_id
      AND gm.group_id = m.group_id
    )
  );

-- Users can manage ships for their own characters
CREATE POLICY "Users can manage their own character ships"
  ON character_ships
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM members m
      WHERE m.id = character_ships.character_id
      AND m.user_id = auth.uid()
    )
  );

-- Admins and officers can manage all character ships in their groups
CREATE POLICY "Admins and officers can manage character ships in their groups"
  ON character_ships
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM members m
      JOIN group_members gm ON gm.user_id = auth.uid()
      WHERE m.id = character_ships.character_id
      AND gm.group_id = m.group_id
      AND gm.role IN ('admin', 'officer')
    )
  );

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_character_ships_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_character_ships_updated_at
  BEFORE UPDATE ON character_ships
  FOR EACH ROW
  EXECUTE FUNCTION update_character_ships_updated_at();

-- Track this migration
INSERT INTO migration_history (filename) VALUES ('053_add_character_ships.sql') ON CONFLICT DO NOTHING;

-- =====================================================
-- SOURCE: 054_add_game_specific_roles.sql
-- =====================================================
-- Add game-specific role and channel support for announcements/events
-- Supports separate announcement channels and roles for different games (e.g., Star Citizen)

-- Add columns to groups table for game-specific announcement roles
ALTER TABLE groups 
ADD COLUMN IF NOT EXISTS sc_announcement_role_id TEXT,
ADD COLUMN IF NOT EXISTS sc_events_role_id TEXT;

-- Add comments
COMMENT ON COLUMN groups.sc_announcement_role_id IS 'Star Citizen: Discord role ID to ping for announcements';
COMMENT ON COLUMN groups.sc_events_role_id IS 'Star Citizen: Discord role ID to ping for events';

-- Track this migration
INSERT INTO migration_history (filename) VALUES ('054_add_game_specific_roles.sql') ON CONFLICT DO NOTHING;
-- =====================================================
-- SOURCE: 055_add_game_specific_webhooks.sql
-- =====================================================
-- Add game-specific Discord webhook URLs to groups table
-- Allows different games to have different notification webhooks

ALTER TABLE groups ADD COLUMN IF NOT EXISTS aoc_webhook_url TEXT;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS aoc_events_webhook_url TEXT;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS sc_webhook_url TEXT;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS sc_events_webhook_url TEXT;

-- Add comments for documentation
COMMENT ON COLUMN groups.aoc_webhook_url IS 'Discord webhook URL for AoC announcements and general notifications';
COMMENT ON COLUMN groups.aoc_events_webhook_url IS 'Discord webhook URL for AoC event notifications';
COMMENT ON COLUMN groups.sc_webhook_url IS 'Discord webhook URL for Star Citizen announcements and general notifications';
COMMENT ON COLUMN groups.sc_events_webhook_url IS 'Discord webhook URL for Star Citizen event notifications';

-- Update existing groups to use old webhook URL for AoC if it exists
UPDATE groups 
SET aoc_webhook_url = group_webhook_url,
    aoc_events_webhook_url = group_webhook_url
WHERE group_webhook_url IS NOT NULL AND aoc_webhook_url IS NULL;

-- Update migration history
INSERT INTO migration_history (filename) VALUES ('055_add_game_specific_webhooks.sql') ON CONFLICT DO NOTHING;

-- =====================================================
-- SOURCE: 056_add_ship_role_permissions.sql
-- =====================================================
-- Add role-based permissions for ship management
-- Allows restricting who can add/edit/delete ships based on their group role

-- Add a table to store which roles can manage ships for each game
CREATE TABLE IF NOT EXISTS game_ship_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  game_slug TEXT NOT NULL,
  min_role TEXT NOT NULL DEFAULT 'member', -- Minimum role required to manage ships (admin, officer, member)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, game_slug)
);

-- Index for querying permissions by group and game
CREATE INDEX IF NOT EXISTS idx_game_ship_permissions_group_game 
  ON game_ship_permissions(group_id, game_slug);

-- RLS Policies
ALTER TABLE game_ship_permissions ENABLE ROW LEVEL SECURITY;

-- Admins can view and manage ship permissions for their groups
CREATE POLICY "Admins can manage ship permissions in their groups"
  ON game_ship_permissions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = game_ship_permissions.group_id
      AND group_members.user_id = auth.uid()
      AND group_members.role = 'admin'
    )
  );

-- All authenticated users can view ship permissions for their groups
CREATE POLICY "Users can view ship permissions in their groups"
  ON game_ship_permissions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = game_ship_permissions.group_id
      AND group_members.user_id = auth.uid()
    )
  );

-- Initialize default permissions for Star Citizen (allow members to manage ships)
INSERT INTO game_ship_permissions (group_id, game_slug, min_role)
SELECT id, 'star-citizen', 'member'
FROM groups
WHERE id NOT IN (
  SELECT DISTINCT group_id FROM game_ship_permissions WHERE game_slug = 'star-citizen'
)
ON CONFLICT DO NOTHING;

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_game_ship_permissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_game_ship_permissions_updated_at
  BEFORE UPDATE ON game_ship_permissions
  FOR EACH ROW
  EXECUTE FUNCTION update_game_ship_permissions_updated_at();

-- Update migration history
INSERT INTO migration_history (filename) VALUES ('056_add_ship_role_permissions.sql') ON CONFLICT DO NOTHING;

-- =====================================================
-- SOURCE: 057_add_welcome_message_toggles.sql
-- =====================================================
-- Add per-game welcome message toggles
-- Allows enabling/disabling welcome messages independently for each game

-- Add welcome message enable columns for each game
ALTER TABLE groups ADD COLUMN IF NOT EXISTS aoc_welcome_enabled BOOLEAN DEFAULT true;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS sc_welcome_enabled BOOLEAN DEFAULT true;

COMMENT ON COLUMN groups.aoc_welcome_enabled IS 'Enable welcome messages for AoC members';
COMMENT ON COLUMN groups.sc_welcome_enabled IS 'Enable welcome messages for Star Citizen members';

-- Update migration history
INSERT INTO migration_history (filename) VALUES ('057_add_welcome_message_toggles.sql') ON CONFLICT DO NOTHING;

-- =====================================================
-- SOURCE: 058_add_ship_permissions.sql
-- =====================================================
-- Migration 058: Add ship management permissions
-- Purpose: Add permissions for managing ships (Star Citizen)
-- Allows role-based control over who can add/edit/delete ships

-- Add ship permission columns to group_permission_overrides table
ALTER TABLE group_permission_overrides
  ADD COLUMN IF NOT EXISTS ships_create BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS ships_edit_own BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS ships_edit_any BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ships_delete_own BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS ships_delete_any BOOLEAN DEFAULT FALSE;

-- Add comments
COMMENT ON COLUMN group_permission_overrides.ships_create IS 'Permission to add ships to characters';
COMMENT ON COLUMN group_permission_overrides.ships_edit_own IS 'Permission to edit ships on own characters';
COMMENT ON COLUMN group_permission_overrides.ships_edit_any IS 'Permission to edit ships on any character';
COMMENT ON COLUMN group_permission_overrides.ships_delete_own IS 'Permission to delete ships from own characters';
COMMENT ON COLUMN group_permission_overrides.ships_delete_any IS 'Permission to delete ships from any character';

-- Update existing rows with default values based on role
UPDATE group_permission_overrides
SET 
  ships_create = CASE 
    WHEN role = 'admin' THEN TRUE
    WHEN role = 'officer' THEN TRUE
    WHEN role = 'member' THEN TRUE
    WHEN role = 'trial' THEN TRUE
    ELSE FALSE
  END,
  ships_edit_own = CASE 
    WHEN role = 'admin' THEN TRUE
    WHEN role = 'officer' THEN TRUE
    WHEN role = 'member' THEN TRUE
    WHEN role = 'trial' THEN TRUE
    ELSE FALSE
  END,
  ships_edit_any = CASE 
    WHEN role = 'admin' THEN TRUE
    WHEN role = 'officer' THEN TRUE
    ELSE FALSE
  END,
  ships_delete_own = CASE 
    WHEN role = 'admin' THEN TRUE
    WHEN role = 'officer' THEN TRUE
    WHEN role = 'member' THEN TRUE
    WHEN role = 'trial' THEN TRUE
    ELSE FALSE
  END,
  ships_delete_any = CASE 
    WHEN role = 'admin' THEN TRUE
    WHEN role = 'officer' THEN TRUE
    ELSE FALSE
  END
WHERE ships_create IS NULL;

-- Update migration history
INSERT INTO migration_history (filename) VALUES ('058_add_ship_permissions.sql') ON CONFLICT DO NOTHING;

-- =====================================================
-- SOURCE: 059_add_ror_to_games.sql
-- =====================================================
-- =====================================================
-- Add Return of Reckoning to Games Support
-- =====================================================

-- Add Return of Reckoning to game_types
INSERT INTO game_types (id, name, description, icon) VALUES
  ('ror', 'Return of Reckoning', 'Faction-based PvP and character management', '⚔️')
ON CONFLICT (id) DO NOTHING;

-- Update the CHECK constraint to include Return of Reckoning
ALTER TABLE groups DROP CONSTRAINT IF EXISTS valid_game;
ALTER TABLE groups ADD CONSTRAINT valid_game CHECK (game IN ('aoc', 'starcitizen', 'ror'));

-- Track this migration
INSERT INTO migration_history (filename) VALUES ('059_add_ror_to_games.sql') ON CONFLICT DO NOTHING;

-- =====================================================
-- SOURCE: 060_standardize_starcitizen_slug.sql
-- =====================================================
-- =====================================================
-- Standardize Star Citizen Game Slug
-- =====================================================
-- Ensure all Star Citizen references use 'starcitizen' consistently

-- Update game_types if needed
UPDATE game_types
SET id = 'starcitizen'
WHERE id = 'star-citizen';

-- Delete old 'star-citizen' entries from group_games where 'starcitizen' already exists
DELETE FROM group_games
WHERE game_slug = 'star-citizen' 
AND group_id IN (
  SELECT group_id FROM group_games WHERE game_slug = 'starcitizen'
);

-- Update remaining group_games with old slug
UPDATE group_games
SET game_slug = 'starcitizen'
WHERE game_slug = 'star-citizen';

-- Update members if any have old slug
UPDATE members
SET game_slug = 'starcitizen'
WHERE game_slug = 'star-citizen';

-- Update events if any have old slug
UPDATE events
SET game_slug = 'starcitizen'
WHERE game_slug = 'star-citizen';

-- Track this migration
INSERT INTO migration_history (filename) VALUES ('060_standardize_starcitizen_slug.sql') ON CONFLICT DO NOTHING;

-- =====================================================
-- SOURCE: 061_ror_event_role_requirements.sql
-- =====================================================
-- =====================================================
-- Add RoR Event Role Requirements
-- =====================================================
-- Add role requirement columns for RoR events (2 Tank / 2 Healer / 2 DPS composition)

-- Add RoR-specific role requirement columns
ALTER TABLE events 
  ADD COLUMN IF NOT EXISTS ror_tanks_min INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ror_tanks_max INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ror_healers_min INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ror_healers_max INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ror_dps_min INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ror_dps_max INTEGER DEFAULT NULL;

-- Add comments for clarity
COMMENT ON COLUMN events.ror_tanks_min IS 'Minimum number of tanks required for RoR events';
COMMENT ON COLUMN events.ror_tanks_max IS 'Maximum number of tanks allowed for RoR events (NULL = unlimited)';
COMMENT ON COLUMN events.ror_healers_min IS 'Minimum number of healers required for RoR events';
COMMENT ON COLUMN events.ror_healers_max IS 'Maximum number of healers allowed for RoR events (NULL = unlimited)';
COMMENT ON COLUMN events.ror_dps_min IS 'Minimum number of DPS required for RoR events (includes melee, skirmish, and ranged)';
COMMENT ON COLUMN events.ror_dps_max IS 'Maximum number of DPS allowed for RoR events (NULL = unlimited)';

-- Track this migration
INSERT INTO migration_history (filename) VALUES ('061_ror_event_role_requirements.sql') ON CONFLICT DO NOTHING;

-- =====================================================
-- SOURCE: 062_ror_discord_webhooks_and_roles.sql
-- =====================================================
-- =====================================================
-- Add RoR Discord Webhooks and Game-Specific Roles
-- =====================================================
-- Extend Discord integration to support Return of Reckoning
-- and make roles/webhooks fully game-specific

ALTER TABLE groups ADD COLUMN IF NOT EXISTS ror_webhook_url TEXT;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS ror_events_webhook_url TEXT;

-- Add game-specific role IDs for announcements and events
ALTER TABLE groups ADD COLUMN IF NOT EXISTS aoc_announcement_role_id TEXT;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS aoc_events_role_id TEXT;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS ror_announcement_role_id TEXT;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS ror_events_role_id TEXT;

-- Add comments for documentation
COMMENT ON COLUMN groups.ror_webhook_url IS 'Discord webhook URL for RoR announcements and general notifications';
COMMENT ON COLUMN groups.ror_events_webhook_url IS 'Discord webhook URL for RoR event notifications';
COMMENT ON COLUMN groups.aoc_announcement_role_id IS 'Discord role ID to ping for AoC announcements';
COMMENT ON COLUMN groups.aoc_events_role_id IS 'Discord role ID to ping for AoC event notifications';
COMMENT ON COLUMN groups.sc_announcement_role_id IS 'Discord role ID to ping for Star Citizen announcements';
COMMENT ON COLUMN groups.sc_events_role_id IS 'Discord role ID to ping for Star Citizen event notifications';
COMMENT ON COLUMN groups.ror_announcement_role_id IS 'Discord role ID to ping for RoR announcements';
COMMENT ON COLUMN groups.ror_events_role_id IS 'Discord role ID to ping for RoR event notifications';

-- Migrate existing role IDs to game-specific columns
UPDATE groups 
SET aoc_announcement_role_id = discord_announcement_role_id
WHERE discord_announcement_role_id IS NOT NULL AND aoc_announcement_role_id IS NULL;

UPDATE groups 
SET aoc_events_role_id = sc_events_role_id
WHERE sc_events_role_id IS NOT NULL AND aoc_events_role_id IS NULL;

-- Track this migration
INSERT INTO migration_history (filename) VALUES ('062_ror_discord_webhooks_and_roles.sql') ON CONFLICT DO NOTHING;

-- =====================================================
-- SOURCE: 063_add_star_citizen_subscriber_support.sql
-- =====================================================
-- Add subscriber tier support to Star Citizen characters
-- Allows tracking subscriber status and auto-assigning ships
-- Also fixes missing columns from previous migrations

ALTER TABLE members ADD COLUMN IF NOT EXISTS subscriber_tier VARCHAR(50);
-- Values: NULL, 'centurion', 'imperator'

-- Track when subscriber status was set/changed
ALTER TABLE members ADD COLUMN IF NOT EXISTS subscriber_since TIMESTAMPTZ;

-- Track which month's ships the character has
-- Useful for syncing when new months arrive
ALTER TABLE members ADD COLUMN IF NOT EXISTS subscriber_ships_month VARCHAR(7);
-- Format: 'YYYY-MM' e.g., '2026-01'

-- Fix: Add missing rank column (migration 052 had wrong table name)
ALTER TABLE members ADD COLUMN IF NOT EXISTS rank TEXT;

-- Fix: Add missing Return of Reckoning columns
ALTER TABLE members ADD COLUMN IF NOT EXISTS ror_faction VARCHAR(50);
ALTER TABLE members ADD COLUMN IF NOT EXISTS ror_class VARCHAR(50);

-- Create index for efficient subscriber queries
CREATE INDEX IF NOT EXISTS idx_members_subscriber_tier 
  ON members(subscriber_tier) 
  WHERE subscriber_tier IS NOT NULL;

-- Add comments for clarity
COMMENT ON COLUMN members.subscriber_tier IS 'Subscriber tier: centurion or imperator. NULL if not a subscriber.';
COMMENT ON COLUMN members.subscriber_since IS 'When the subscriber tier was first set.';
COMMENT ON COLUMN members.subscriber_ships_month IS 'Which month (YYYY-MM) of subscriber ships have been added.';
COMMENT ON COLUMN members.rank IS 'Guild rank assigned to this member/character. Values defined per-game in config.';
COMMENT ON COLUMN members.ror_faction IS 'Return of Reckoning faction: order or destruction.';
COMMENT ON COLUMN members.ror_class IS 'Return of Reckoning class ID.';

-- Track this migration
INSERT INTO migration_history (filename) VALUES ('063_add_star_citizen_subscriber_support.sql') ON CONFLICT DO NOTHING;
-- =====================================================
-- SOURCE: 064_main_character_per_game.sql
-- =====================================================
-- Allow one main character per user per game per group
-- Replaces global-per-user uniqueness with per-game, per-group constraint

-- Drop old index
DROP INDEX IF EXISTS idx_members_one_main_per_user;

-- Create new unique partial index scoped by group and game
CREATE UNIQUE INDEX idx_members_one_main_per_user_game
  ON members(group_id, user_id, game_slug)
  WHERE is_main = TRUE AND user_id IS NOT NULL;

-- Track this migration
INSERT INTO migration_history (filename) VALUES ('064_main_character_per_game.sql') ON CONFLICT DO NOTHING;

-- =====================================================
-- SOURCE: 065_add_subscriber_ownership_type.sql
-- =====================================================
-- Add subscriber ownership type for monthly subscriber perks
-- This allows explicit tracking of subscriber-exclusive ships

-- Drop the existing CHECK constraint
ALTER TABLE character_ships DROP CONSTRAINT IF EXISTS character_ships_ownership_type_check;

-- Add the new CHECK constraint with subscriber option
ALTER TABLE character_ships ADD CONSTRAINT character_ships_ownership_type_check 
  CHECK (ownership_type IN ('pledged', 'in-game', 'loaner', 'subscriber'));

-- Track this migration
INSERT INTO migration_history (filename) VALUES ('065_add_subscriber_ownership_type.sql') ON CONFLICT DO NOTHING;

-- =====================================================
-- SOURCE: 066_sync_existing_subscriber_ships.sql
-- =====================================================
-- Migration to sync subscriber ships for existing characters with subscriber tiers
-- This is a one-time migration to add subscriber ships to characters that already have subscriber_tier set
-- Ships are based on the February 2026 promotion:
--   Centurion: MISC Starlancer MAX
--   Imperator: MISC Starlancer MAX + MISC Starlancer TAC

DO $$
DECLARE
  char_record RECORD;
  v_ship_id TEXT;  -- Renamed to avoid ambiguity with column name
  month_key TEXT;
BEGIN
  -- Get current month in YYYY-MM format
  month_key := TO_CHAR(CURRENT_DATE, 'YYYY-MM');
  
  -- Loop through all Star Citizen characters with subscriber_tier set
  FOR char_record IN 
    SELECT id, subscriber_tier 
    FROM members 
    WHERE game_slug = 'starcitizen' 
    AND subscriber_tier IS NOT NULL
  LOOP
    RAISE NOTICE 'Processing character % with tier %', char_record.id, char_record.subscriber_tier;
    
    -- Insert Imperator ships (Starlancer MAX + Starlancer TAC) for Imperator subscribers
    IF char_record.subscriber_tier = 'imperator' THEN
      -- MISC Starlancer MAX
      v_ship_id := 'starlancer-max';
      INSERT INTO character_ships (character_id, ship_id, ownership_type, notes)
      VALUES (char_record.id, v_ship_id, 'subscriber', 'imperator subscriber perk (' || month_key || ')')
      ON CONFLICT (character_id, ship_id, ownership_type) DO NOTHING;
      
      -- MISC Starlancer TAC
      v_ship_id := 'starlancer-tac';
      INSERT INTO character_ships (character_id, ship_id, ownership_type, notes)
      VALUES (char_record.id, v_ship_id, 'subscriber', 'imperator subscriber perk (' || month_key || ')')
      ON CONFLICT (character_id, ship_id, ownership_type) DO NOTHING;
      
      RAISE NOTICE 'Added Imperator ships (Starlancer MAX, Starlancer TAC) for character %', char_record.id;
    END IF;
    
    -- Insert Centurion ship (Starlancer MAX only) for Centurion subscribers
    IF char_record.subscriber_tier = 'centurion' THEN
      -- MISC Starlancer MAX
      v_ship_id := 'starlancer-max';
      INSERT INTO character_ships (character_id, ship_id, ownership_type, notes)
      VALUES (char_record.id, v_ship_id, 'subscriber', 'centurion subscriber perk (' || month_key || ')')
      ON CONFLICT (character_id, ship_id, ownership_type) DO NOTHING;
      
      RAISE NOTICE 'Added Centurion ship (Starlancer MAX) for character %', char_record.id;
    END IF;
    
    -- Update subscriber_ships_month
    UPDATE members 
    SET subscriber_ships_month = month_key 
    WHERE id = char_record.id;
    
  END LOOP;
  
  RAISE NOTICE 'Subscriber ship sync complete';
END $$;

-- Track this migration
INSERT INTO migration_history (filename) VALUES ('066_sync_existing_subscriber_ships.sql') ON CONFLICT DO NOTHING;
-- =====================================================
-- SOURCE: 067_add_group_games_archived.sql
-- =====================================================
-- Add archived column to group_games table
-- This allows groups to archive games without deleting any data

ALTER TABLE group_games ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN group_games.archived IS 'Whether this game is archived for the group. Archived games are hidden from the UI and prevent updates but preserve all data.';

-- Track this migration
INSERT INTO migration_history (filename) VALUES ('067_add_group_games_archived.sql') ON CONFLICT DO NOTHING;

-- =====================================================
-- SOURCE: 068_change_preferred_role_to_array.sql
-- =====================================================
-- Change preferred_role from TEXT to TEXT[] to support multiple role selection
-- This allows characters to have multiple preferred roles (e.g., pilot AND gunner)

-- First, convert existing TEXT values to single-element arrays
ALTER TABLE members ALTER COLUMN preferred_role TYPE TEXT[] USING 
  CASE 
    WHEN preferred_role IS NULL THEN NULL
    WHEN preferred_role = '' THEN NULL
    ELSE ARRAY[preferred_role]
  END;

-- Track this migration
INSERT INTO migration_history (filename) VALUES ('068_change_preferred_role_to_array.sql') ON CONFLICT DO NOTHING;

-- =====================================================
-- SOURCE: 069_add_sc_loaner_matrix.sql
-- =====================================================
-- Add loaner ship matrix table for Star Citizen
-- Stores the official loaner ship mappings from RSI

CREATE TABLE IF NOT EXISTS sc_loaner_matrix (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pledged_ship TEXT NOT NULL, -- The ship that is pledged (not flight ready)
  loaner_ship TEXT NOT NULL, -- The ship provided as a loaner
  loaner_type TEXT DEFAULT 'primary' CHECK (loaner_type IN ('primary', 'arena_commander', 'temporary')),
  notes TEXT, -- Additional notes (e.g., "for Arena Commander", "temporary due to bug")
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(pledged_ship, loaner_ship, loaner_type)
);

-- Index for looking up loaners by pledged ship
CREATE INDEX IF NOT EXISTS idx_sc_loaner_matrix_pledged 
  ON sc_loaner_matrix(pledged_ship);

-- Index for finding which pledged ships grant a specific loaner
CREATE INDEX IF NOT EXISTS idx_sc_loaner_matrix_loaner 
  ON sc_loaner_matrix(loaner_ship);

-- RLS Policies
ALTER TABLE sc_loaner_matrix ENABLE ROW LEVEL SECURITY;

-- Everyone can read the loaner matrix (it's public data from RSI)
CREATE POLICY "Everyone can view loaner matrix"
  ON sc_loaner_matrix
  FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can update the loaner matrix
CREATE POLICY "Only service role can update loaner matrix"
  ON sc_loaner_matrix
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Helper function to convert ship_id to display name
CREATE OR REPLACE FUNCTION ship_id_to_display_name(ship_id TEXT)
RETURNS TEXT AS $$
DECLARE
  parts TEXT[];
  result TEXT;
  part TEXT;
BEGIN
  -- Split on dashes and title-case each part
  parts := string_to_array(ship_id, '-');
  result := '';
  
  FOREACH part IN ARRAY parts
  LOOP
    IF result != '' THEN
      result := result || ' ';
    END IF;
    result := result || initcap(part);
  END LOOP;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to automatically add loaner ships when a pledged ship is added
CREATE OR REPLACE FUNCTION add_loaner_ships_for_pledge()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process pledged ships (not in-game or existing loaners)
  IF NEW.ownership_type = 'pledged' THEN
    -- Add all loaners for this pledged ship
    INSERT INTO character_ships (character_id, ship_id, ownership_type, notes)
    SELECT 
      NEW.character_id,
      loaner_ship,
      'loaner',
      'Auto-granted loaner for ' || ship_id_to_display_name(NEW.ship_id) || 
      CASE 
        WHEN loaner_type = 'arena_commander' THEN ' (Arena Commander)'
        WHEN loaner_type = 'temporary' THEN ' (Temporary: ' || COALESCE(notes, 'see RSI') || ')'
        ELSE ''
      END
    FROM sc_loaner_matrix
    WHERE pledged_ship = NEW.ship_id
    ON CONFLICT (character_id, ship_id, ownership_type) DO NOTHING; -- Don't duplicate loaners
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to add loaners when pledged ships are added
DROP TRIGGER IF EXISTS trigger_add_loaner_ships ON character_ships;
CREATE TRIGGER trigger_add_loaner_ships
  AFTER INSERT ON character_ships
  FOR EACH ROW
  EXECUTE FUNCTION add_loaner_ships_for_pledge();

-- Function to remove loaner ships when the pledged ship is removed
CREATE OR REPLACE FUNCTION remove_loaner_ships_for_pledge()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process pledged ships
  IF OLD.ownership_type = 'pledged' THEN
    -- Check if this was the last/only pledge granting these loaners
    -- Don't remove loaners that are still granted by other pledges
    DELETE FROM character_ships cs
    WHERE cs.character_id = OLD.character_id
    AND cs.ownership_type = 'loaner'
    AND cs.ship_id IN (
      SELECT loaner_ship 
      FROM sc_loaner_matrix 
      WHERE pledged_ship = OLD.ship_id
    )
    -- Only delete if no other pledges grant this loaner
    AND NOT EXISTS (
      SELECT 1 
      FROM character_ships other_pledges
      JOIN sc_loaner_matrix lm ON lm.pledged_ship = other_pledges.ship_id
      WHERE other_pledges.character_id = OLD.character_id
      AND other_pledges.ownership_type = 'pledged'
      AND other_pledges.id != OLD.id
      AND lm.loaner_ship = cs.ship_id
    );
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Trigger to remove loaners when pledged ships are removed
DROP TRIGGER IF EXISTS trigger_remove_loaner_ships ON character_ships;
CREATE TRIGGER trigger_remove_loaner_ships
  BEFORE DELETE ON character_ships
  FOR EACH ROW
  EXECUTE FUNCTION remove_loaner_ships_for_pledge();

COMMIT;

-- =====================================================
-- SOURCE: 070_populate_sc_loaner_matrix.sql
-- =====================================================
-- Auto-populated loaner ship matrix from RSI Support
-- Source: https://support.robertsspaceindustries.com/hc/en-us/articles/360003093114-Loaner-Ship-Matrix
-- Last Updated: November 26th, 2025 | 4.4.0-live.10733565

BEGIN;

-- Clear any existing data
DELETE FROM sc_loaner_matrix;

-- Insert loaner mappings from RSI
-- Format: (pledged_ship, loaner_ship, loaner_type, notes)
-- Note: All ship IDs normalized to lowercase-with-dashes format

-- 400i
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('400i', '325a', 'primary');

-- 600i series
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('600i-touring', '325a', 'primary');
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('600i-explorer', '325a', 'primary');
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('600i-explorer', 'cyclone', 'primary');
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('600i-executive', '325a', 'primary');
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('600i-executive', 'cyclone', 'primary');

-- 890 Jump
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('890-jump', '325a', 'primary');
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('890-jump', '85x', 'primary');

-- Arrastra (with temporary Prospector loaner due to bug STARC-113044)
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type, notes) VALUES ('arrastra', 'prospector', 'temporary', 'Temporary due to mining HUD issues (STARC-113044)');
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type, notes) VALUES ('arrastra', 'mole', 'temporary', 'Temporary due to mining HUD issues (STARC-113044)');
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('arrastra', 'arrow', 'arena_commander');

-- Carrack series
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('carrack', 'c8-pisces', 'primary');
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('carrack', 'ursa-rover', 'primary');
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('carrack-expedition', 'c8-pisces', 'primary');
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('carrack-expedition', 'ursa-rover', 'primary');
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('carrack-w/-c8x', 'c8x-pisces-expedition', 'primary');
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('carrack-w/-c8x', 'ursa-rover', 'primary');
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('carrack-expedition-w/c8x', 'c8x-pisces-expedition', 'primary');
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('carrack-expedition-w/c8x', 'ursa-rover', 'primary');

-- Caterpillar
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('caterpillar', 'buccaneer', 'primary');

-- Centurion
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('centurion', 'aurora-mr', 'primary');

-- Constellation series
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('constellation-andromeda', 'p-52-merlin', 'primary');
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('constellation-aquila', 'p-52-merlin', 'primary');
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('constellation-aquila', 'ursa-rover', 'primary');
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('constellation-phoenix', 'p-72-archimedes', 'primary');
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('constellation-phoenix', 'lynx-rover', 'primary');
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('constellation-phoenix-emerald', 'p-72-archimedes', 'primary');
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('constellation-phoenix-emerald', 'lynx-rover', 'primary');

-- Corsair
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('corsair', 'buccaneer', 'primary');

-- Crucible
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('crucible', 'constellation-andromeda', 'primary');

-- CSV-SM
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('csv-sm', 'aurora-mr', 'primary');

-- Cyclone Variants
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('cyclone', 'aurora-mr', 'primary');

-- Dragonfly
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('dragonfly', 'aurora-mr', 'primary');

-- E1 Spirit
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('e1-spirit', 'a1-spirit', 'primary');

-- Endeavor
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('endeavor', 'starfarer', 'primary');
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('endeavor', 'cutlass-red', 'primary');

-- Expanse
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('expanse', 'prospector', 'primary');
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('expanse', 'reliant-kore', 'primary');

-- Fury Variants
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('fury', 'aurora-mr', 'primary');

-- G12 Variants
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('g12', 'lynx', 'primary');

-- Galaxy
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('galaxy', 'carrack', 'primary');

-- Genesis Starliner
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('genesis-starliner', 'hercules-c2', 'primary');

-- Hull series
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('hull-b', 'hull-a', 'primary');
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('hull-b', 'arrow', 'arena_commander');
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('hull-c', 'arrow', 'primary');
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('hull-d', 'hull-c', 'primary');
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('hull-d', 'hercules-c2', 'primary');
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('hull-d', 'arrow', 'arena_commander');
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('hull-e', 'hull-c', 'primary');
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('hull-e', 'hercules-c2', 'primary');
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('hull-e', 'arrow', 'arena_commander');

-- Idris series
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('idris-m', 'f7c-m-super-hornet', 'primary');
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('idris-m', 'mpuv-passenger', 'primary');
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('idris-p', 'f7c-m-super-hornet', 'primary');
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('idris-p', 'mpuv-passenger', 'primary');

-- Ironclad series
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('ironclad', 'caterpillar', 'primary');
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('ironclad-assault', 'caterpillar', 'primary');

-- Javelin
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('javelin', 'idris-p', 'primary');
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('javelin', 'mpuv-cargo', 'primary');

-- Kraken series
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('kraken', 'polaris', 'primary');
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('kraken', 'hercules-c2', 'primary');
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('kraken', 'caterpillar', 'primary');
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('kraken', 'buccaneer', 'primary');
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('kraken-privateer', 'polaris', 'primary');
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('kraken-privateer', 'hercules-c2', 'primary');
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('kraken-privateer', 'caterpillar', 'primary');
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('kraken-privateer', 'buccaneer', 'primary');

-- Liberator
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('liberator', 'hercules-m2', 'primary');
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('liberator', 'f7c-m-super-hornet', 'primary');

-- Legionnaire
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('legionnaire', 'vanguard-hoplite', 'primary');

-- Lynx
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('lynx', 'aurora-mr', 'primary');

-- Mantis
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('mantis', 'aurora-ln', 'primary');

-- Merchantman
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('merchantman', 'hull-c', 'primary');
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('merchantman', 'defender', 'primary');
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('merchantman', 'hercules-c2', 'primary');

-- Mole (with temporary Prospector loaner)
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type, notes) VALUES ('mole', 'prospector', 'temporary', 'Temporary due to mining HUD issues (STARC-113044)');

-- MPUV-Tractor
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('mpuv-tractor', 'aurora-mr', 'primary');

-- MXC
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('mxc', 'aurora-mr', 'primary');

-- Mule
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('mule', 'aurora-mr', 'primary');

-- Nautilus
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('nautilus', 'polaris', 'primary');
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('nautilus', 'avenger-titan', 'primary');

-- Nova
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('nova', 'aurora-mr', 'primary');

-- Nox
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('nox', 'aurora-mr', 'primary');

-- Odyssey
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('odyssey', 'carrack', 'primary');
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('odyssey', 'reliant-kore', 'primary');

-- Orion (with temporary loaners)
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type, notes) VALUES ('orion', 'prospector', 'temporary', 'Temporary due to mining HUD issues (STARC-113044)');
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type, notes) VALUES ('orion', 'mole', 'temporary', 'Temporary due to mining HUD issues (STARC-113044)');

-- Pioneer
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('pioneer', 'caterpillar', 'primary');
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('pioneer', 'nomad', 'primary');

-- Polaris
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('polaris', 'f7c-m-super-hornet', 'primary');

-- Pulse series
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('pulse', 'aurora-mr', 'primary');
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('pulse-lx', 'aurora-mr', 'primary');

-- Railen
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('railen', 'hercules-c2', 'primary');
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('railen', 'syulen', 'primary');

-- RAFT
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('raft', 'f7c-hornet', 'primary');

-- Ranger series
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('ranger-cv', 'cyclone', 'primary');
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('ranger-rc', 'cyclone-rc', 'primary');
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('ranger-tr', 'cyclone-tr', 'primary');

-- Redeemer
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('redeemer', 'arrow', 'primary');

-- Retaliator
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('retaliator', 'gladiator', 'primary');

-- SRV
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('srv', 'aurora-ln', 'primary');

-- Storm Variants
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('storm', 'aurora-mr', 'primary');

-- STV
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('stv', 'aurora-mr', 'primary');

-- Terrapin series
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('terrapin', 'f7c-m-super-hornet', 'primary');
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('terrapin-medic', 'f7c-m-super-hornet', 'primary');

-- Valkyrie
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('valkyrie', 'f7c-m-super-hornet', 'primary');

-- Vulcan
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('vulcan', 'starfarer', 'primary');

-- Vulture
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('vulture', 'buccaneer', 'primary');

-- X1 series
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('x1', 'aurora-mr', 'primary');
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('x1-velocity', 'aurora-mr', 'primary');
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('x1-force', 'aurora-mr', 'primary');

-- Zeus Mk II MR
INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type) VALUES ('zeus-mk-ii-mr', 'zeus-mk-ii-es', 'primary');

-- =====================================================
-- SOURCE: Storage bucket for guild icons
-- =====================================================
-- Create storage bucket for guild icons

-- Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'aoc-guild-icons',
  'aoc-guild-icons',
  true,  -- public bucket so icons can be displayed without authentication
  5242880,  -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Public Access for Guild Icons" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload guild icons" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update guild icons" ON storage.objects;
DROP POLICY IF EXISTS "Group admins can delete guild icons" ON storage.objects;

-- Policy: Anyone can view guild icons (since bucket is public)
CREATE POLICY "Public Access for Guild Icons"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'aoc-guild-icons');

-- Policy: Group admins and officers can upload guild icons
CREATE POLICY "Authenticated users can upload guild icons"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'aoc-guild-icons'
    AND (storage.foldername(name))[1] IN (
      -- Only allow uploads to folders matching group IDs where user is a member
      SELECT group_id::text 
      FROM group_members 
      WHERE user_id = auth.uid() 
        AND role IN ('admin', 'officer', 'member')
    )
  );

-- Policy: Group admins and officers can update their guild icons (upsert)
CREATE POLICY "Authenticated users can update guild icons"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'aoc-guild-icons'
    AND (storage.foldername(name))[1] IN (
      SELECT group_id::text 
      FROM group_members 
      WHERE user_id = auth.uid() 
        AND role IN ('admin', 'officer', 'member')
    )
  );

-- Policy: Group admins/officers can delete guild icons
CREATE POLICY "Group admins can delete guild icons"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'aoc-guild-icons'
    AND (storage.foldername(name))[1] IN (
      SELECT group_id::text 
      FROM group_members 
      WHERE user_id = auth.uid() 
        AND role IN ('admin', 'officer')
    )
  );

-- Track this migration
INSERT INTO migration_history (filename) VALUES ('000_baseline.sql') ON CONFLICT DO NOTHING;

COMMIT;
