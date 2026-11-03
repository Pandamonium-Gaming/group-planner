import supabaseAdmin from './supabaseAdmin';

/**
 * Calculate and upsert achievement progress for a given clan.
 * Returns the number of achievements updated.
 */
export async function syncGroupAchievements(groupId: string): Promise<number> {
  // Helper function to check profession mastery
  async function checkProfessionMastery(
    tier: 'gathering' | 'processing' | 'crafting',
    minRank: number,
    countAll: boolean = false
  ): Promise<number> {
    const { data: characters } = await supabaseAdmin
      .from('characters')
      .select('id, professions')
      .eq('group_id', groupId);

    if (!characters || characters.length === 0) return 0;

    const tierSkills: Record<string, string[]> = {
      gathering: ['mining', 'lumberjacking', 'herbalism', 'fishing', 'hunting'],
      processing: ['metalworking', 'lumber_milling', 'stonemasonry', 'weaving', 'tanning', 'alchemy', 'farming', 'animal_husbandry', 'cooking'],
      crafting: ['weapon_smithing', 'armor_smithing', 'leatherworking', 'tailoring', 'jewelcrafting', 'carpentry', 'arcane_engineering', 'scribe'],
    };
    const requiredSkills = tierSkills[tier] || [];
    const skillMastery: Record<string, boolean> = {};
    requiredSkills.forEach(skill => { skillMastery[skill] = false; });
    for (const char of characters) {
      if (!char.professions) continue;
      const profs = typeof char.professions === 'string' ? JSON.parse(char.professions) : char.professions;
      if (Array.isArray(profs)) {
        for (const prof of profs) {
          const profId = typeof prof === 'string' ? prof : prof.id;
          const profRank = typeof prof === 'string' ? 1 : (prof.rank || 1);
          if (requiredSkills.includes(profId) && profRank >= minRank) {
            skillMastery[profId] = true;
          }
        }
      }
    }
    if (countAll) {
      return Object.values(skillMastery).filter(v => v).length;
    } else {
      return Object.values(skillMastery).every(v => v) ? 1 : 0;
    }
  }

  // All achievement calculations indexed by requirement_type
  const calculations: Record<string, () => Promise<number>> = {
    member_count: async () => {
      const { count } = await supabaseAdmin
        .from('group_members')
        .select('id', { count: 'exact', head: true })
        .eq('group_id', groupId);
      return count || 0;
    },
    siege_wins: async () => {
      const { data: sieges } = await supabaseAdmin
        .from('siege_events')
        .select('id')
        .eq('group_id', groupId)
        .eq('result', 'win');
      return sieges?.length || 0;
    },
    bank_deposits: async () => {
      const { data: bank } = await supabaseAdmin
        .from('guild_banks')
        .select('id')
        .eq('group_id', groupId)
        .eq('game_slug', 'aoc')
        .single();
      if (!bank) return 0;
      const { count } = await supabaseAdmin
        .from('bank_transactions')
        .select('id', { count: 'exact', head: true })
        .eq('bank_id', bank.id)
        .eq('transaction_type', 'deposit');
      return count || 0;
    },
    caravan_complete: async () => {
      const { count } = await supabaseAdmin
        .from('caravans')
        .select('id', { count: 'exact', head: true })
        .eq('group_id', groupId)
        .eq('status', 'completed');
      return count || 0;
    },
    grandmaster_count: async () => {
      const { data: characters } = await supabaseAdmin
        .from('characters')
        .select('id, professions')
        .eq('group_id', groupId);
      const grandmasters = new Set<string>();
      for (const char of characters || []) {
        if (char.professions) {
          const profs = typeof char.professions === 'string' ? JSON.parse(char.professions) : char.professions;
          if (Array.isArray(profs)) {
            for (const prof of profs) {
              const profName = typeof prof === 'string' ? prof : prof.name;
              if (profName?.toLowerCase().includes('grandmaster')) {
                grandmasters.add(char.id);
              }
            }
          }
        }
      }
      return grandmasters.size;
    },
    events_hosted: async () => {
      const { count } = await supabaseAdmin
        .from('events')
        .select('id', { count: 'exact', head: true })
        .eq('group_id', groupId);
      return count || 0;
    },
    weekly_active: async () => {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const { data: activities } = await supabaseAdmin
        .from('activity_log')
        .select('user_id')
        .eq('group_id', groupId)
        .gte('created_at', oneWeekAgo.toISOString());
      const uniqueUsers = new Set(activities?.map(a => a.user_id) || []);
      return uniqueUsers.size;
    },
    gathering_journeyman_all: async () => checkProfessionMastery('gathering', 2),
    gathering_master_all: async () => checkProfessionMastery('gathering', 3),
    gathering_grandmaster_all: async () => checkProfessionMastery('gathering', 4),
    processing_journeyman_all: async () => checkProfessionMastery('processing', 2),
    processing_master_all: async () => checkProfessionMastery('processing', 3),
    processing_grandmaster_all: async () => checkProfessionMastery('processing', 4),
    crafting_journeyman_all: async () => checkProfessionMastery('crafting', 2),
    crafting_master_all: async () => checkProfessionMastery('crafting', 3),
    crafting_grandmaster_all: async () => checkProfessionMastery('crafting', 4),
    jack_of_all_trades: async () => {
      const gatheringGM = await checkProfessionMastery('gathering', 4);
      const processingGM = await checkProfessionMastery('processing', 4);
      const craftingGM = await checkProfessionMastery('crafting', 4);
      return (gatheringGM > 0 && processingGM > 0 && craftingGM > 0) ? 1 : 0;
    },
    master_of_all_trades: async () => {
      const gatheringMasters = await checkProfessionMastery('gathering', 3, true);
      const processingMasters = await checkProfessionMastery('processing', 3, true);
      const craftingMasters = await checkProfessionMastery('crafting', 3, true);
      return (gatheringMasters >= 3 && processingMasters >= 3 && craftingMasters >= 3) ? 1 : 0;
    },
  };

  // Fetch all definitions
  const { data: definitions } = await supabaseAdmin
    .from('achievement_definitions')
    .select('id, requirement_type, requirement_value');
  if (!definitions) return 0;
  let updated = 0;
  for (const def of definitions) {
    const calculation = calculations[def.requirement_type];
    if (!calculation) continue;
    try {
      const currentValue = await calculation();
      const isUnlocked = currentValue >= def.requirement_value;
      const { error: upsertError } = await supabaseAdmin
        .from('group_achievements')
        .upsert(
          {
            group_id: groupId,
            achievement_id: def.id,
            current_value: currentValue,
            is_unlocked: isUnlocked,
            unlocked_at: isUnlocked ? new Date().toISOString() : null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'group_id,achievement_id' }
        );
      if (!upsertError) updated++;
    } catch (err) {
      // Log and skip
    }
  }
  return updated;
}
