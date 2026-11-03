import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Supabase client with service role for accurate counts
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key'
);

interface AchievementProgress {
  achievement_id: string;
  current_value: number;
  is_unlocked: boolean;
}

async function calculateAchievementProgress(
  groupId: string
): Promise<AchievementProgress[]> {
  try {
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

      // Define skills for each tier
      const tierSkills: Record<string, string[]> = {
        gathering: ['mining', 'lumberjacking', 'herbalism', 'fishing', 'hunting'],
        processing: ['metalworking', 'lumber_milling', 'stonemasonry', 'weaving', 'tanning', 'alchemy', 'farming', 'animal_husbandry', 'cooking'],
        crafting: ['weapon_smithing', 'armor_smithing', 'leatherworking', 'tailoring', 'jewelcrafting', 'carpentry', 'arcane_engineering', 'scribe'],
      };

      const requiredSkills = tierSkills[tier] || [];
      const skillMastery: Record<string, boolean> = {};

      // Initialize all skills as unmet
      requiredSkills.forEach(skill => {
        skillMastery[skill] = false;
      });

      // Check each character's professions
      for (const char of characters) {
        if (!char.professions) continue;

        const profs = typeof char.professions === 'string' 
          ? JSON.parse(char.professions)
          : char.professions;

        if (Array.isArray(profs)) {
          for (const prof of profs) {
            const profId = typeof prof === 'string' ? prof : prof.id;
            const profRank = typeof prof === 'string' ? 1 : (prof.rank || 1);

            // Check if this profession matches one we need
            if (requiredSkills.includes(profId) && profRank >= minRank) {
              skillMastery[profId] = true;
            }
          }
        }
      }

      // If countAll is true, return count of mastered skills; otherwise check if all are mastered
      if (countAll) {
        return Object.values(skillMastery).filter(v => v).length;
      } else {
        const allMastered = Object.values(skillMastery).every(v => v);
        return allMastered ? 1 : 0;
      }
    }

    // Define all achievement calculations indexed by requirement_type
    const calculations: Record<string, () => Promise<number>> = {
      // Milestone achievements - based on member count
      'member_count': async () => {
        const { count } = await supabaseAdmin
          .from('group_members')
          .select('id', { count: 'exact', head: true })
          .eq('group_id', groupId);
        return count || 0;
      },

      // PvP achievements - based on siege wins
      'siege_wins': async () => {
        const { data: sieges } = await supabaseAdmin
          .from('siege_events')
          .select('id')
          .eq('group_id', groupId)
          .eq('result', 'win');
        return sieges?.length || 0;
      },

      // Economy achievements
      'bank_deposits': async () => {
        // First get the bank for this clan
        const { data: bank } = await supabaseAdmin
          .from('guild_banks')
          .select('id')
          .eq('group_id', groupId)
          .eq('game_slug', 'aoc')
          .single();

        if (!bank) {
          return 0;
        }

        const { count } = await supabaseAdmin
          .from('bank_transactions')
          .select('id', { count: 'exact', head: true })
          .eq('bank_id', bank.id)
          .eq('transaction_type', 'deposit');
        return count || 0;
      },

      'caravan_complete': async () => {
        const { count } = await supabaseAdmin
          .from('caravans')
          .select('id', { count: 'exact', head: true })
          .eq('group_id', groupId)
          .eq('status', 'completed');
        return count || 0;
      },

      'grandmaster_count': async () => {
        // Get grandmaster count from characters with grandmaster professions
        const { data: characters } = await supabaseAdmin
          .from('characters')
          .select('id, professions')
          .eq('group_id', groupId);

        const grandmasters = new Set<string>();
        for (const char of characters || []) {
          if (char.professions) {
            const profs = typeof char.professions === 'string' 
              ? JSON.parse(char.professions)
              : char.professions;
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

      // Community achievements
      'events_hosted': async () => {
        const { count } = await supabaseAdmin
          .from('events')
          .select('id', { count: 'exact', head: true })
          .eq('group_id', groupId);
        return count || 0;
      },

      'weekly_active': async () => {
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

      // Gathering profession mastery
      'gathering_journeyman_all': async () => {
        const _gatheringSkills = ['mining', 'lumberjacking', 'herbalism', 'fishing', 'hunting'];
        return await checkProfessionMastery('gathering', 2); // Journeyman = rank 2
      },

      'gathering_master_all': async () => {
        return await checkProfessionMastery('gathering', 3); // Master = rank 3
      },

      'gathering_grandmaster_all': async () => {
        return await checkProfessionMastery('gathering', 4); // Grandmaster = rank 4
      },

      // Processing profession mastery
      'processing_journeyman_all': async () => {
        return await checkProfessionMastery('processing', 2);
      },

      'processing_master_all': async () => {
        return await checkProfessionMastery('processing', 3);
      },

      'processing_grandmaster_all': async () => {
        return await checkProfessionMastery('processing', 4);
      },

      // Crafting profession mastery
      'crafting_journeyman_all': async () => {
        return await checkProfessionMastery('crafting', 2);
      },

      'crafting_master_all': async () => {
        return await checkProfessionMastery('crafting', 3);
      },

      'crafting_grandmaster_all': async () => {
        return await checkProfessionMastery('crafting', 4);
      },

      // Special achievements
      'jack_of_all_trades': async () => {
        // Check if at least one GM from each tier
        const gatheringGM = await checkProfessionMastery('gathering', 4);
        const processingGM = await checkProfessionMastery('processing', 4);
        const craftingGM = await checkProfessionMastery('crafting', 4);
        
        return (gatheringGM > 0 && processingGM > 0 && craftingGM > 0) ? 1 : 0;
      },

      'master_of_all_trades': async () => {
        // Check if at least 3 Master+ from each tier
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

    if (!definitions) return [];

    const progress: AchievementProgress[] = [];

    for (const def of definitions) {
      const calculation = calculations[def.requirement_type];

      if (!calculation) {
        console.warn(`No calculation found for requirement_type: ${def.requirement_type}`);
        continue;
      }

      try {
        const currentValue = await calculation();
        const isUnlocked = currentValue >= def.requirement_value;

        progress.push({
          achievement_id: def.id,
          current_value: currentValue,
          is_unlocked: isUnlocked,
        });
      } catch (err) {
        console.error(`Error calculating ${def.requirement_type}:`, err);
      }
    }

    return progress;
  } catch (error) {
    console.error('Error calculating achievements:', error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get auth token from header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.slice(7);
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { clanId: groupId } = await request.json();

    if (!groupId) {
      return NextResponse.json(
        { error: 'Missing group_id' },
        { status: 400 }
      );
    }

    // Verify user is admin/officer of the clan
    const { data: membership } = await supabaseAdmin
      .from('group_members')
      .select('role')
      .eq('group_id', groupId)
      .eq('user_id', user.id)
      .single();

    if (!membership || !['admin', 'officer'].includes(membership.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Calculate achievement progress
    const progress = await calculateAchievementProgress(groupId);

    // Upsert achievements with calculated values
    for (const achievement of progress) {
      const { error: upsertError } = await supabaseAdmin
        .from('group_achievements')
        .upsert(
          {
            group_id: groupId,
            achievement_id: achievement.achievement_id,
            current_value: achievement.current_value,
            is_unlocked: achievement.is_unlocked,
            unlocked_at: achievement.is_unlocked 
              ? new Date().toISOString() 
              : null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'group_id,achievement_id' }
        );

      if (upsertError) {
        console.error('Error upserting achievement:', upsertError);
      }
    }

    return NextResponse.json({
      success: true,
      updated: progress.length,
      achievements: progress,
    });
  } catch (error) {
    console.error('Sync achievements error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
