// TypeScript types for the AoC Group Planner
import type { WowForeverProfessionRank } from '@/games/wowforever/config';

// Profession tier types
export type ProfessionTier = 'gathering' | 'processing' | 'crafting';

// Rank levels (1-4)
export type RankLevel = 1 | 2 | 3 | 4;

// Rank names mapped to levels
export const RANK_NAMES: Record<RankLevel, string> = {
  1: 'Apprentice',
  2: 'Journeyman',
  3: 'Master',
  4: 'Grandmaster',
};

// Rank limits per player
export const RANK_LIMITS: Record<RankLevel, number> = {
  4: 2,  // Max 2 Grandmaster
  3: 3,  // Max 3 Master (includes GM)
  2: 4,  // Max 4 Journeyman (includes M+GM)
  1: 5,  // Max 5 Apprentice (includes J+M+GM)
};

// Profession definition
export interface Profession {
  id: string;
  name: string;
  tier: ProfessionTier;
  dependencies: string[]; // IDs of required professions
}

// Database types
export interface Clan {
  id: string;
  slug: string;
  name: string;
  created_at: string;
  is_public?: boolean;
  recruitment_open?: boolean;
  recruitment_message?: string | null;
  public_description?: string | null;
  banner_url?: string | null;
  approval_required?: boolean;
  default_role?: 'trial' | 'member';
  group_webhook_url?: string;
  group_welcome_webhook_url?: string;
  aoc_webhook_url?: string;
  aoc_events_webhook_url?: string;
  sc_webhook_url?: string;
  sc_events_webhook_url?: string;
  ror_webhook_url?: string;
  ror_events_webhook_url?: string;
  wowforever_webhook_url?: string;
  wowforever_events_webhook_url?: string;
  wowforever_recruitment_open?: boolean;
  wowforever_recruitment_message?: string | null;
  wowforever_public_description?: string | null;
  notify_on_events?: boolean;
  notify_on_announcements?: boolean;
  discord_announcement_role_id?: string;
  aoc_announcement_role_id?: string;
  aoc_events_role_id?: string;
  sc_announcement_role_id?: string;
  sc_events_role_id?: string;
  ror_announcement_role_id?: string;
  ror_events_role_id?: string;
  wowforever_announcement_role_id?: string;
  wowforever_events_role_id?: string;
  group_icon_url?: string;
  aoc_welcome_enabled?: boolean;
  sc_welcome_enabled?: boolean;
  aoc_recruitment_open?: boolean;
  sc_recruitment_open?: boolean;
  ror_recruitment_open?: boolean;
  aoc_recruitment_message?: string | null;
  sc_recruitment_message?: string | null;
  ror_recruitment_message?: string | null;
  aoc_public_description?: string | null;
  sc_public_description?: string | null;
  ror_public_description?: string | null;
  aoc_ranks_enabled?: boolean;
  sc_ranks_enabled?: boolean;
  ror_ranks_enabled?: boolean;
  wowforever_ranks_enabled?: boolean;
  aoc_custom_ranks?: Array<{ id: string; name: string; hierarchy: number }>;
  sc_custom_ranks?: Array<{ id: string; name: string; hierarchy: number }>;
  ror_custom_ranks?: Array<{ id: string; name: string; hierarchy: number }>;
  wowforever_custom_ranks?: Array<{ id: string; name: string; hierarchy: number }>;
}

// Race and Archetype types (match database ENUMs)
export type Race = 'kaelar' | 'vaelune' | 'dunir' | 'nikua' | 
                   'empyrean' | 'pyrai' | 'renkai' | 'vek' | 'tulnar';

export type Archetype = 'tank' | 'cleric' | 'mage' | 'fighter' | 
                        'ranger' | 'bard' | 'rogue' | 'summoner';

// Character (formerly Member) - represents a game character
export interface Character {
  id: string;
  group_id: string;
  user_id: string | null;
  discord_id?: string | null;
  game_slug?: string | null;
  name: string;
  race: Race | null;
  primary_archetype: Archetype | null;
  secondary_archetype: Archetype | null;
  level: number;
  is_main: boolean;
  preferred_role?: string[] | null;
  rank?: string | null;
  ror_faction?: string | null;
  ror_class?: string | null;
  wow_race?: string | null;
  wow_faction?: 'Alliance' | 'Horde' | null;
  wow_class?: string | null;
  wow_main_spec?: string | null;
  wow_secondary_spec?: string | null;
  wow_profession_1?: string | null;
  wow_profession_2?: string | null;
  wow_profession_1_rank?: WowForeverProfessionRank | null;
  wow_profession_2_rank?: WowForeverProfessionRank | null;
  subscriber_tier?: 'centurion' | 'imperator' | null;
  subscriber_since?: string | null;
  subscriber_ships_month?: string | null;
  created_at: string;
}

// Legacy alias for compatibility
export type Member = Character;

export interface MemberProfession {
  id: string;
  member_id: string;
  profession: string;
  rank: RankLevel; // Certification rank (manual promotion required)
  artisan_level: number; // 0-50: Current skill level (can exceed rank requirements)
  quality_score: number; // Quality/proficiency score (can be in thousands)
}

// Extended character with professions loaded
export interface CharacterWithProfessions extends Character {
  professions: MemberProfession[];
  owner?: { display_name: string | null; discord_username: string | null } | null;
}

// Legacy alias for compatibility
export type MemberWithProfessions = CharacterWithProfessions;

// Clan coverage statistics
export interface ProfessionCoverage {
  profession: string;
  grandmasters: string[]; // member names
  masters: string[];
  journeymen: string[];
  apprentices: string[];
}

// Helper function to get rank from artisan level
export function getRankFromLevel(level: number): RankLevel {
  if (level >= 40) return 4; // Grandmaster
  if (level >= 30) return 4; // Master
  if (level >= 20) return 3; // Journeyman
  if (level >= 10) return 2; // Apprentice
  return 1; // Novice
}

// Helper function to get max level allowed for a rank
export function getMaxLevelForRank(rank: RankLevel): number {
  switch (rank) {
    case 1: return 20; // Apprentice caps at 20
    case 2: return 30; // Journeyman caps at 30
    case 3: return 40; // Master caps at 40
    case 4: return 50; // Grandmaster caps at 50
    default: return 10;
  }
}

// Helper function to check if at rank cap
export function isAtRankCap(level: number, rank: RankLevel): boolean {
  return level >= getMaxLevelForRank(rank);
}

// Helper function to get rank name including level range
export function getRankWithLevelRange(level: number): string {
  const rank = getRankFromLevel(level);
  const rankName = RANK_NAMES[rank];
  return `${rankName} (${level}/50)`;
}

// Rank color configuration
export const RANK_COLORS: Record<RankLevel, { text: string; border: string; bg: string; glow: string }> = {
  4: { 
    text: 'text-orange-400', 
    border: 'border-orange-500', 
    bg: 'bg-orange-500/20',
    glow: 'shadow-orange-500/50'
  },
  3: { 
    text: 'text-purple-400', 
    border: 'border-purple-500', 
    bg: 'bg-purple-500/20',
    glow: 'shadow-purple-500/50'
  },
  2: { 
    text: 'text-blue-400', 
    border: 'border-blue-500', 
    bg: 'bg-blue-500/20',
    glow: 'shadow-blue-500/50'
  },
  1: { 
    text: 'text-green-400', 
    border: 'border-green-500', 
    bg: 'bg-green-500/20',
    glow: 'shadow-green-500/50'
  },
};

// Party types
export type PartyRole = 'tank' | 'cleric' | 'bard' | 'ranged_dps' | 'melee_dps';

export interface Party {
  id: string;
  group_id: string;
  name: string;
  description?: string;
  tanks_needed: number;
  clerics_needed: number;
  bards_needed: number;
  ranged_dps_needed: number;
  melee_dps_needed: number;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface PartyRoster {
  id: string;
  party_id: string;
  character_id: string;
  role: PartyRole;
  is_confirmed: boolean;
  assigned_at: string;
}

export interface PartyWithRoster extends Party {
  roster: (PartyRoster & { character?: CharacterWithProfessions })[];
}

// Party role configuration
export const PARTY_ROLES: Record<PartyRole, { name: string; icon: string; color: string }> = {
  tank: { name: 'Tank', icon: '🛡️', color: 'text-blue-400' },
  cleric: { name: 'Cleric', icon: '✨', color: 'text-green-400' },
  bard: { name: 'Bard', icon: '🎵', color: 'text-purple-400' },
  ranged_dps: { name: 'Ranged DPS', icon: '🏹', color: 'text-red-400' },
  melee_dps: { name: 'Melee DPS', icon: '⚔️', color: 'text-orange-400' },
};

export interface RecruitmentApplication {
  id: string;
  group_id: string;
  user_id?: string;
  game_slug?: string;
  discord_username: string;
  character_name?: string;
  primary_class?: string;
  experience?: string;
  availability?: string;
  message?: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  reviewed_at?: string;
  reviewed_by?: string;
  review_notes?: string;
}

// ============================================================
// NODE CITIZENSHIP TYPES
// ============================================================

// Node types in AoC (4 types)
export type NodeType = 'divine' | 'economic' | 'military' | 'scientific';

// Node stages (0-6)
export type NodeStage = 0 | 1 | 2 | 3 | 4 | 5 | 6;

// Node stage names
export const NODE_STAGE_NAMES: Record<NodeStage, string> = {
  0: 'Wilderness',
  1: 'Expedition',
  2: 'Encampment',
  3: 'Village',
  4: 'Town',
  5: 'City',
  6: 'Metropolis',
};

// Node type configuration
export const NODE_TYPE_CONFIG: Record<NodeType, { label: string; icon: string; color: string }> = {
  divine: { label: 'Divine', icon: '✨', color: 'text-yellow-400' },
  economic: { label: 'Economic', icon: '💰', color: 'text-green-400' },
  military: { label: 'Military', icon: '⚔️', color: 'text-red-400' },
  scientific: { label: 'Scientific', icon: '🔬', color: 'text-blue-400' },
};

// Node citizenship interface
export interface NodeCitizenship {
  id: string;
  character_id: string;
  node_name: string;
  node_type: NodeType;
  node_stage: NodeStage;
  region?: string;
  is_mayor: boolean;
  is_council_member: boolean;
  became_citizen_at: string;
  updated_at: string;
}

// Character with citizenship
export interface CharacterWithCitizenship extends CharacterWithProfessions {
  citizenship?: NodeCitizenship;
}

// Node distribution stats (from the SQL view)
export interface NodeDistribution {
  group_id: string;
  node_name: string;
  node_type: NodeType;
  node_stage: NodeStage;
  citizen_count: number;
  has_mayor: boolean;
  citizen_names: string[];
}

// ============================================================
// SIEGE TYPES
// ============================================================

// Siege event types
export type SiegeType = 'castle_attack' | 'castle_defense' | 'node_attack' | 'node_defense';

// Siege roles (different from party roles - more specialized for large battles)
export type SiegeRole = 'frontline' | 'ranged' | 'healer' | 'siege_operator' | 'scout' | 'reserve';

// Roster status
export type RosterStatus = 'signed_up' | 'confirmed' | 'checked_in' | 'no_show';

// Siege result
export type SiegeResult = 'victory' | 'defeat' | 'draw' | null;

// Siege type configuration
export const SIEGE_TYPE_CONFIG: Record<SiegeType, { label: string; icon: string; color: string; isDefence: boolean }> = {
  castle_attack: { label: 'Castle Attack', icon: '🏰', color: 'text-red-400', isDefence: false },
  castle_defense: { label: 'Castle Defence', icon: '🛡️', color: 'text-blue-400', isDefence: true },
  node_attack: { label: 'Node Attack', icon: '⚔️', color: 'text-orange-400', isDefence: false },
  node_defense: { label: 'Node Defence', icon: '🏛️', color: 'text-green-400', isDefence: true },
};

// Siege role configuration
export const SIEGE_ROLE_CONFIG: Record<SiegeRole, { label: string; icon: string; color: string; description: string }> = {
  frontline: { label: 'Frontline', icon: '🗡️', color: 'text-red-400', description: 'Melee fighters and tanks' },
  ranged: { label: 'Ranged', icon: '🏹', color: 'text-orange-400', description: 'Archers and mages' },
  healer: { label: 'Healer', icon: '💚', color: 'text-green-400', description: 'Healers and support' },
  siege_operator: { label: 'Siege Operator', icon: '🎯', color: 'text-purple-400', description: 'Trebuchets, rams' },
  scout: { label: 'Scout', icon: '👁️', color: 'text-cyan-400', description: 'Reconnaissance' },
  reserve: { label: 'Reserve', icon: '⏳', color: 'text-slate-400', description: 'Backup players' },
};

// Siege event interface
export interface SiegeEvent {
  id: string;
  group_id: string;
  title: string;
  description?: string;
  siege_type: SiegeType;
  target_name: string;
  starts_at: string;
  declaration_ends_at?: string;
  max_participants: number;
  frontline_needed: number;
  ranged_needed: number;
  healer_needed: number;
  siege_operator_needed: number;
  scout_needed: number;
  reserve_needed: number;
  is_cancelled: boolean;
  result: SiegeResult;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

// Siege roster entry
export interface SiegeRoster {
  id: string;
  siege_id: string;
  character_id: string;
  user_id?: string;
  role: SiegeRole;
  is_leader: boolean;
  priority: number;
  status: RosterStatus;
  signed_up_at: string;
  confirmed_at?: string;
  checked_in_at?: string;
  note?: string;
}

// Roster with character data
export interface SiegeRosterWithCharacter extends SiegeRoster {
  character?: CharacterWithProfessions;
}

// Siege event with roster
export interface SiegeEventWithRoster extends SiegeEvent {
  roster: SiegeRosterWithCharacter[];
}

// Roster counts by role (from view)
export interface SiegeRosterCounts {
  siege_id: string;
  role: SiegeRole;
  total_count: number;
  confirmed_count: number;
  checked_in_count: number;
}

// ============================================================
// LOOT & DKP TYPES
// ============================================================

// Loot distribution system types
export type LootSystemType = 'dkp' | 'epgp' | 'loot_council' | 'roll' | 'round_robin';

// Item rarity
export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'heroic' | 'epic' | 'legendary';

// Loot system type configuration
export const LOOT_SYSTEM_CONFIG: Record<LootSystemType, { label: string; description: string }> = {
  dkp: { label: 'DKP', description: 'Dragon Kill Points - Earn and spend points' },
  epgp: { label: 'EPGP', description: 'Effort Points / Gear Points ratio' },
  loot_council: { label: 'Loot Council', description: 'Officers vote on distribution' },
  roll: { label: 'Roll', description: 'Random /roll for items' },
  round_robin: { label: 'Round Robin', description: 'Taking turns for loot' },
};

// Item rarity configuration
export const ITEM_RARITY_CONFIG: Record<ItemRarity, { label: string; color: string; bgColor: string }> = {
  common: { label: 'Common', color: 'text-slate-400', bgColor: 'bg-slate-500/20' },
  uncommon: { label: 'Uncommon', color: 'text-green-400', bgColor: 'bg-green-500/20' },
  rare: { label: 'Rare', color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
  heroic: { label: 'Heroic', color: 'text-purple-400', bgColor: 'bg-purple-500/20' },
  epic: { label: 'Epic', color: 'text-orange-400', bgColor: 'bg-orange-500/20' },
  legendary: { label: 'Legendary', color: 'text-amber-400', bgColor: 'bg-amber-500/20' },
};

// Loot system configuration
export interface LootSystem {
  id: string;
  group_id: string;
  system_type: LootSystemType;
  name: string;
  description?: string;
  is_active: boolean;
  starting_points: number;
  decay_enabled: boolean;
  decay_rate: number;
  decay_minimum: number;
  raid_attendance_points: number;
  siege_attendance_points: number;
  boss_kill_points: number;
  created_at: string;
  updated_at: string;
}

// Character DKP points
export interface DKPPoints {
  id: string;
  loot_system_id: string;
  character_id: string;
  current_points: number;
  earned_total: number;
  spent_total: number;
  priority_ratio: number;
  last_earned_at?: string;
  last_spent_at?: string;
  last_decay_at?: string;
  created_at: string;
  updated_at: string;
}

// DKP points with character info
export interface DKPPointsWithCharacter extends DKPPoints {
  character?: CharacterWithProfessions;
  rank?: number;
}

// Loot history entry
export interface LootHistory {
  id: string;
  loot_system_id: string;
  item_name: string;
  item_rarity: ItemRarity;
  item_slot?: string;
  item_description?: string;
  source_type?: string;
  source_name?: string;
  event_id?: string;
  siege_id?: string;
  awarded_to?: string;
  awarded_by?: string;
  dkp_cost: number;
  votes_for: number;
  votes_against: number;
  dropped_at: string;
  distributed_at?: string;
  notes?: string;
}

// Loot history with character names
export interface LootHistoryWithDetails extends LootHistory {
  awarded_to_character?: CharacterWithProfessions;
  awarded_by_user?: { display_name: string };
}

// DKP transaction (audit log)
export interface DKPTransaction {
  id: string;
  dkp_points_id: string;
  amount: number;
  reason: string;
  loot_id?: string;
  event_id?: string;
  siege_id?: string;
  created_by?: string;
  created_at: string;
}

// ============================================================
// GUILD BANK TYPES
// ============================================================

// Resource categories
export type ResourceCategory = 'raw_material' | 'processed' | 'consumable' | 'equipment' | 'currency' | 'blueprint' | 'other';

// Bank transaction types
export type BankTransactionType = 'deposit' | 'withdrawal' | 'transfer' | 'craft_input' | 'craft_output' | 'loot' | 'purchase' | 'sale' | 'adjustment';

// Resource request status
export type RequestStatus = 'pending' | 'approved' | 'denied' | 'fulfilled';

// Resource category config
export const RESOURCE_CATEGORY_CONFIG: Record<ResourceCategory, { label: string; icon: string; color: string }> = {
  raw_material: { label: 'Raw Material', icon: '⛏️', color: 'text-amber-400' },
  processed: { label: 'Processed', icon: '⚙️', color: 'text-blue-400' },
  consumable: { label: 'Consumable', icon: '🧪', color: 'text-green-400' },
  equipment: { label: 'Equipment', icon: '⚔️', color: 'text-purple-400' },
  currency: { label: 'Currency', icon: '💰', color: 'text-yellow-400' },
  blueprint: { label: 'Blueprint', icon: '📜', color: 'text-cyan-400' },
  other: { label: 'Other', icon: '📦', color: 'text-slate-400' },
};

// Guild bank configuration
export interface GuildBank {
  id: string;
  group_id: string;
  game_slug: string;
  name: string;
  description?: string;
  deposit_min_role: string;
  withdraw_min_role: string;
  gold_balance: number;
  created_at: string;
  updated_at: string;
}

// Resource catalog item
export interface ResourceCatalog {
  id: string;
  game_slug: string;
  name: string;
  category: ResourceCategory;
  subcategory?: string;
  rarity: ItemRarity;
  base_value: number;
  is_craftable: boolean;
  profession_required?: string;
  created_at: string;
}

// Bank inventory item
export interface BankInventoryItem {
  id: string;
  bank_id: string;
  resource_id: string;
  quantity: number;
  reserved_quantity: number;
  last_updated_at: string;
}

// Inventory with resource details
export interface BankInventoryWithResource extends BankInventoryItem {
  resource: ResourceCatalog;
}

// Bank transaction
export interface BankTransaction {
  id: string;
  bank_id: string;
  resource_id?: string;
  transaction_type: BankTransactionType;
  quantity: number;
  gold_amount: number;
  user_id?: string;
  character_id?: string;
  notes?: string;
  related_siege_id?: string;
  created_at: string;
}

// Transaction with details
export interface BankTransactionWithDetails extends BankTransaction {
  resource?: ResourceCatalog;
  user?: { display_name: string };
  character?: { name: string };
}

// Resource request
export interface ResourceRequest {
  id: string;
  bank_id: string;
  resource_id: string;
  requested_by: string;
  character_id?: string;
  quantity: number;
  reason?: string;
  status: RequestStatus;
  reviewed_by?: string;
  reviewed_at?: string;
  fulfilled_at?: string;
  created_at: string;
}

// Request with details
export interface ResourceRequestWithDetails extends ResourceRequest {
  resource: ResourceCatalog;
  requested_by_user?: { display_name: string };
  character?: { name: string };
}

// ============================================================
// FREEHOLD TYPES
// ============================================================

export type FreeholdSize = 'small' | 'medium' | 'large';

export type FreeholdBuildingType = 
  | 'smelter' | 'lumbermill' | 'tannery' | 'loom' | 'farm' | 'stable'
  | 'forge' | 'workshop' | 'clothier' | 'jeweler' | 'alchemist_lab' | 'kitchen'
  | 'warehouse' | 'tavern' | 'inn' | 'house';

export const FREEHOLD_SIZE_CONFIG: Record<FreeholdSize, { label: string; dimensions: string }> = {
  small: { label: 'Small', dimensions: '8x8' },
  medium: { label: 'Medium', dimensions: '16x16' },
  large: { label: 'Large', dimensions: '32x32' },
};

export interface Freehold {
  id: string;
  group_id: string;
  owner_id: string;
  owner_character_id?: string;
  name: string;
  node_name?: string;
  region?: string;
  coordinates?: string;
  size: FreeholdSize;
  is_public: boolean;
  description?: string;
  established_at: string;
  updated_at: string;
}

export interface FreeholdBuilding {
  id: string;
  freehold_id: string;
  building_type: FreeholdBuildingType;
  building_name?: string;
  tier: number;
  profession_id?: string;
  is_guild_accessible: boolean;
  usage_fee: number;
  built_at: string;
  upgraded_at?: string;
}

export interface FreeholdWithBuildings extends Freehold {
  buildings: FreeholdBuilding[];
  owner?: { display_name: string };
  owner_character?: { name: string };
}

// ============================================================
// CARAVAN TYPES
// ============================================================

export type CaravanType = 'personal' | 'guild' | 'trade_route' | 'escort';
export type CaravanStatus = 'planning' | 'recruiting' | 'ready' | 'in_transit' | 'completed' | 'failed' | 'cancelled';

export interface CaravanEvent {
  id: string;
  group_id: string;
  created_by?: string;
  owner_character_id?: string;
  title: string;
  description?: string;
  caravan_type: CaravanType;
  origin_node: string;
  destination_node: string;
  estimated_distance?: number;
  departure_at: string;
  estimated_arrival_at?: string;
  cargo_description?: string;
  cargo_value: number;
  min_escorts: number;
  max_escorts: number;
  status: CaravanStatus;
  completed_at?: string;
  was_attacked: boolean;
  escort_reward_gold: number;
  escort_reward_dkp: number;
  created_at: string;
  updated_at: string;
}

export interface CaravanEscort {
  id: string;
  caravan_id: string;
  character_id: string;
  user_id?: string;
  role: string;
  confirmed: boolean;
  checked_in: boolean;
  notes?: string;
  signed_up_at: string;
}

export interface CaravanWaypoint {
  id: string;
  caravan_id: string;
  order_index: number;
  location_name: string;
  notes?: string;
  is_danger_zone: boolean;
  estimated_time_minutes?: number;
  reached_at?: string;
}

export interface CaravanEventWithDetails extends CaravanEvent {
  escorts: (CaravanEscort & { character?: { name: string } })[];
  waypoints: CaravanWaypoint[];
}

// ============================================================
// ALLIANCE TYPES
// ============================================================

export type AllianceStatus = 'pending' | 'active' | 'suspended' | 'dissolved';

export interface Alliance {
  id: string;
  name: string;
  description?: string;
  leader_group_id: string;
  is_public: boolean;
  max_guilds: number;
  formed_at: string;
  updated_at: string;
}

export interface AllianceMember {
  id: string;
  alliance_id: string;
  group_id: string;
  status: AllianceStatus;
  is_founder: boolean;
  can_invite: boolean;
  can_create_events: boolean;
  invited_by?: string;
  joined_at?: string;
  left_at?: string;
  created_at: string;
}

export interface AllianceWithMembers extends Alliance {
  members: (AllianceMember & { clan?: { name: string; slug: string } })[];
}

// ============================================================
// ACTIVITY TYPES
// ============================================================

export type ActivityType = 
  | 'login' | 'event_signup' | 'event_attend' | 'siege_participate'
  | 'caravan_escort' | 'bank_deposit' | 'loot_received' | 'dkp_earned'
  | 'character_update' | 'profession_update';

export interface ActivityLog {
  id: string;
  group_id: string;
  user_id?: string;
  character_id?: string;
  activity_type: ActivityType;
  description?: string;
  created_at: string;
}

export interface MemberActivitySummary {
  id: string;
  group_id: string;
  user_id: string;
  last_login_at?: string;
  last_activity_at?: string;
  events_attended_30d: number;
  sieges_attended_30d: number;
  caravans_escorted_30d: number;
  bank_deposits_30d: number;
  total_activities_30d: number;
  current_streak_days: number;
  longest_streak_days: number;
  is_inactive: boolean;
  inactive_since?: string;
  last_calculated_at: string;
}

export interface InactivityAlert {
  id: string;
  group_id: string;
  user_id: string;
  days_inactive: number;
  alert_level: 'warning' | 'critical';
  is_acknowledged: boolean;
  acknowledged_by?: string;
  acknowledged_at?: string;
  created_at: string;
}

// ============================================================
// ACHIEVEMENT TYPES
// ============================================================

export type AchievementCategory = 'guild' | 'pvp' | 'economy' | 'community' | 'milestone';

export interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  icon?: string;
  requirement_type: string;
  requirement_value: number;
  is_hidden: boolean;
  points: number;
  sort_order: number;
  created_at: string;
}

export interface ClanAchievement {
  id: string;
  group_id: string;
  achievement_id: string;
  current_value: number;
  is_unlocked: boolean;
  unlocked_at?: string;
  first_contributor_id?: string;
  created_at: string;
  updated_at: string;
}

export interface ClanAchievementWithDefinition extends ClanAchievement {
  definition: AchievementDefinition;
}

// ============================================================
// BUILD TYPES
// ============================================================

export type BuildVisibility = 'private' | 'guild' | 'public';

export interface Build {
  id: string;
  created_by: string;
  clan_id?: string;
  name: string;
  description?: string;
  primary_archetype: string;
  secondary_archetype?: string;
  skills: Record<string, unknown>[];
  augments: Record<string, unknown>[];
  equipment: Record<string, unknown>;
  stats: Record<string, unknown>;
  tags: string[];
  role?: string;
  visibility: BuildVisibility;
  views_count: number;
  likes_count: number;
  copies_count: number;
  created_at: string;
  updated_at: string;
}

export interface BuildWithDetails extends Build {
  creator?: { display_name: string };
  is_liked?: boolean;
}

export interface BuildComment {
  id: string;
  build_id: string;
  user_id: string;
  content: string;
  parent_id?: string;
  created_at: string;
  updated_at: string;
  user?: { display_name: string };
}
