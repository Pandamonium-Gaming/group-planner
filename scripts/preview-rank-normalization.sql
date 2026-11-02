-- Preview legacy rank normalization candidates.
-- This script is read-only and does not update data.
--
-- Mapping rules (deterministic):
-- 1) Exact id match (case-sensitive)
-- 2) Id match (case-insensitive)
-- 3) Name match (case-insensitive)
-- 4) Slugified-name match (for legacy token-like values)
--
-- Only unique best matches are considered "resolvable".

WITH group_rank_catalog AS (
  SELECT
    g.id AS group_id,
    'aoc'::text AS game_id,
    trim(rank_item->>'id') AS rank_id,
    trim(rank_item->>'name') AS rank_name,
    regexp_replace(
      regexp_replace(lower(trim(rank_item->>'name')), '[^a-z0-9]+', '-', 'g'),
      '(^-|-$)',
      '',
      'g'
    ) AS rank_name_slug
  FROM groups g
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(g.aoc_custom_ranks, '[]'::jsonb)) AS rank_item
  WHERE COALESCE(rank_item->>'id', '') <> ''

  UNION ALL

  SELECT
    g.id AS group_id,
    'sc'::text AS game_id,
    trim(rank_item->>'id') AS rank_id,
    trim(rank_item->>'name') AS rank_name,
    regexp_replace(
      regexp_replace(lower(trim(rank_item->>'name')), '[^a-z0-9]+', '-', 'g'),
      '(^-|-$)',
      '',
      'g'
    ) AS rank_name_slug
  FROM groups g
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(g.sc_custom_ranks, '[]'::jsonb)) AS rank_item
  WHERE COALESCE(rank_item->>'id', '') <> ''

  UNION ALL

  SELECT
    g.id AS group_id,
    'ror'::text AS game_id,
    trim(rank_item->>'id') AS rank_id,
    trim(rank_item->>'name') AS rank_name,
    regexp_replace(
      regexp_replace(lower(trim(rank_item->>'name')), '[^a-z0-9]+', '-', 'g'),
      '(^-|-$)',
      '',
      'g'
    ) AS rank_name_slug
  FROM groups g
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(g.ror_custom_ranks, '[]'::jsonb)) AS rank_item
  WHERE COALESCE(rank_item->>'id', '') <> ''
),
member_base AS (
  SELECT
    m.id AS member_id,
    m.group_id,
    m.rank AS current_rank,
    trim(m.rank) AS rank_trim,
    CASE
      WHEN lower(COALESCE(m.game_slug, 'aoc')) IN ('starcitizen', 'star-citizen', 'sc') THEN 'sc'
      WHEN lower(COALESCE(m.game_slug, 'aoc')) IN ('ror', 'returnofreckoning', 'return-of-reckoning') THEN 'ror'
      ELSE 'aoc'
    END AS game_id,
    lower(trim(m.rank)) AS rank_norm,
    regexp_replace(
      regexp_replace(lower(trim(m.rank)), '[^a-z0-9]+', '-', 'g'),
      '(^-|-$)',
      '',
      'g'
    ) AS rank_slug
  FROM members m
  WHERE m.rank IS NOT NULL
    AND btrim(m.rank) <> ''
),
member_candidates AS (
  SELECT
    mb.member_id,
    mb.current_rank,
    grc.rank_id AS mapped_rank,
    CASE
      WHEN mb.rank_trim = grc.rank_id THEN 1
      WHEN mb.rank_norm = lower(grc.rank_id) THEN 2
      WHEN mb.rank_norm = lower(grc.rank_name) THEN 3
      WHEN mb.rank_slug <> '' AND mb.rank_slug = grc.rank_name_slug THEN 4
      ELSE 99
    END AS match_score
  FROM member_base mb
  INNER JOIN group_rank_catalog grc
    ON grc.group_id = mb.group_id
   AND grc.game_id = mb.game_id
  WHERE (
    mb.rank_trim = grc.rank_id
    OR mb.rank_norm = lower(grc.rank_id)
    OR mb.rank_norm = lower(grc.rank_name)
    OR (mb.rank_slug <> '' AND mb.rank_slug = grc.rank_name_slug)
  )
),
member_ranked AS (
  SELECT
    mc.*,
    row_number() OVER (PARTITION BY mc.member_id ORDER BY mc.match_score, mc.mapped_rank) AS rn,
    count(*) OVER (PARTITION BY mc.member_id, mc.match_score) AS tie_count
  FROM member_candidates mc
),
member_resolved AS (
  SELECT
    mr.member_id,
    mr.current_rank,
    mr.mapped_rank,
    mr.match_score
  FROM member_ranked mr
  WHERE mr.rn = 1
    AND mr.tie_count = 1
)
SELECT
  'members' AS scope,
  count(*) FILTER (WHERE current_rank IS DISTINCT FROM mapped_rank) AS rows_to_update,
  count(*) FILTER (WHERE current_rank IS NOT DISTINCT FROM mapped_rank) AS already_normalized,
  (SELECT count(*) FROM member_base mb LEFT JOIN member_resolved mr ON mr.member_id = mb.member_id WHERE mr.member_id IS NULL) AS unresolved_rows
FROM member_resolved;

WITH group_rank_catalog AS (
  SELECT
    g.id AS group_id,
    'aoc'::text AS game_id,
    trim(rank_item->>'id') AS rank_id,
    trim(rank_item->>'name') AS rank_name,
    regexp_replace(
      regexp_replace(lower(trim(rank_item->>'name')), '[^a-z0-9]+', '-', 'g'),
      '(^-|-$)',
      '',
      'g'
    ) AS rank_name_slug
  FROM groups g
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(g.aoc_custom_ranks, '[]'::jsonb)) AS rank_item
  WHERE COALESCE(rank_item->>'id', '') <> ''

  UNION ALL

  SELECT
    g.id AS group_id,
    'sc'::text AS game_id,
    trim(rank_item->>'id') AS rank_id,
    trim(rank_item->>'name') AS rank_name,
    regexp_replace(
      regexp_replace(lower(trim(rank_item->>'name')), '[^a-z0-9]+', '-', 'g'),
      '(^-|-$)',
      '',
      'g'
    ) AS rank_name_slug
  FROM groups g
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(g.sc_custom_ranks, '[]'::jsonb)) AS rank_item
  WHERE COALESCE(rank_item->>'id', '') <> ''

  UNION ALL

  SELECT
    g.id AS group_id,
    'ror'::text AS game_id,
    trim(rank_item->>'id') AS rank_id,
    trim(rank_item->>'name') AS rank_name,
    regexp_replace(
      regexp_replace(lower(trim(rank_item->>'name')), '[^a-z0-9]+', '-', 'g'),
      '(^-|-$)',
      '',
      'g'
    ) AS rank_name_slug
  FROM groups g
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(g.ror_custom_ranks, '[]'::jsonb)) AS rank_item
  WHERE COALESCE(rank_item->>'id', '') <> ''
),
group_member_base AS (
  SELECT
    gm.id AS group_member_id,
    gm.group_id,
    gm.guild_rank AS current_rank,
    trim(gm.guild_rank) AS rank_trim,
    lower(trim(gm.guild_rank)) AS rank_norm,
    regexp_replace(
      regexp_replace(lower(trim(gm.guild_rank)), '[^a-z0-9]+', '-', 'g'),
      '(^-|-$)',
      '',
      'g'
    ) AS rank_slug
  FROM group_members gm
  WHERE gm.guild_rank IS NOT NULL
    AND btrim(gm.guild_rank) <> ''
),
group_member_candidates AS (
  SELECT
    gmb.group_member_id,
    gmb.current_rank,
    grc.rank_id AS mapped_rank,
    CASE
      WHEN gmb.rank_trim = grc.rank_id THEN 1
      WHEN gmb.rank_norm = lower(grc.rank_id) THEN 2
      WHEN gmb.rank_norm = lower(grc.rank_name) THEN 3
      WHEN gmb.rank_slug <> '' AND gmb.rank_slug = grc.rank_name_slug THEN 4
      ELSE 99
    END AS match_score
  FROM group_member_base gmb
  INNER JOIN group_rank_catalog grc
    ON grc.group_id = gmb.group_id
  WHERE (
    gmb.rank_trim = grc.rank_id
    OR gmb.rank_norm = lower(grc.rank_id)
    OR gmb.rank_norm = lower(grc.rank_name)
    OR (gmb.rank_slug <> '' AND gmb.rank_slug = grc.rank_name_slug)
  )
),
group_member_ranked AS (
  SELECT
    gmc.*,
    row_number() OVER (PARTITION BY gmc.group_member_id ORDER BY gmc.match_score, gmc.mapped_rank) AS rn,
    count(*) OVER (PARTITION BY gmc.group_member_id, gmc.match_score) AS tie_count
  FROM group_member_candidates gmc
),
group_member_resolved AS (
  SELECT
    gmr.group_member_id,
    gmr.current_rank,
    gmr.mapped_rank,
    gmr.match_score
  FROM group_member_ranked gmr
  WHERE gmr.rn = 1
    AND gmr.tie_count = 1
)
SELECT
  'group_members' AS scope,
  count(*) FILTER (WHERE current_rank IS DISTINCT FROM mapped_rank) AS rows_to_update,
  count(*) FILTER (WHERE current_rank IS NOT DISTINCT FROM mapped_rank) AS already_normalized,
  (SELECT count(*) FROM group_member_base gmb LEFT JOIN group_member_resolved gmr ON gmr.group_member_id = gmb.group_member_id WHERE gmr.group_member_id IS NULL) AS unresolved_rows
FROM group_member_resolved;

-- Sample unresolved values for manual review.
WITH group_rank_catalog AS (
  SELECT
    g.id AS group_id,
    trim(rank_item->>'id') AS rank_id,
    trim(rank_item->>'name') AS rank_name,
    regexp_replace(
      regexp_replace(lower(trim(rank_item->>'name')), '[^a-z0-9]+', '-', 'g'),
      '(^-|-$)',
      '',
      'g'
    ) AS rank_name_slug
  FROM groups g
  CROSS JOIN LATERAL (
    SELECT rank_item FROM jsonb_array_elements(COALESCE(g.aoc_custom_ranks, '[]'::jsonb)) AS rank_item
    UNION ALL
    SELECT rank_item FROM jsonb_array_elements(COALESCE(g.sc_custom_ranks, '[]'::jsonb)) AS rank_item
    UNION ALL
    SELECT rank_item FROM jsonb_array_elements(COALESCE(g.ror_custom_ranks, '[]'::jsonb)) AS rank_item
  ) all_ranks
  WHERE COALESCE(rank_item->>'id', '') <> ''
),
group_member_base AS (
  SELECT
    gm.id AS group_member_id,
    gm.group_id,
    gm.guild_rank AS current_rank,
    trim(gm.guild_rank) AS rank_trim,
    lower(trim(gm.guild_rank)) AS rank_norm,
    regexp_replace(
      regexp_replace(lower(trim(gm.guild_rank)), '[^a-z0-9]+', '-', 'g'),
      '(^-|-$)',
      '',
      'g'
    ) AS rank_slug
  FROM group_members gm
  WHERE gm.guild_rank IS NOT NULL
    AND btrim(gm.guild_rank) <> ''
),
group_member_candidates AS (
  SELECT
    gmb.group_member_id,
    CASE
      WHEN gmb.rank_trim = grc.rank_id THEN 1
      WHEN gmb.rank_norm = lower(grc.rank_id) THEN 2
      WHEN gmb.rank_norm = lower(grc.rank_name) THEN 3
      WHEN gmb.rank_slug <> '' AND gmb.rank_slug = grc.rank_name_slug THEN 4
      ELSE 99
    END AS match_score
  FROM group_member_base gmb
  INNER JOIN group_rank_catalog grc
    ON grc.group_id = gmb.group_id
  WHERE (
    gmb.rank_trim = grc.rank_id
    OR gmb.rank_norm = lower(grc.rank_id)
    OR gmb.rank_norm = lower(grc.rank_name)
    OR (gmb.rank_slug <> '' AND gmb.rank_slug = grc.rank_name_slug)
  )
),
resolvable AS (
  SELECT group_member_id
  FROM (
    SELECT
      gmc.group_member_id,
      gmc.match_score,
      row_number() OVER (PARTITION BY gmc.group_member_id ORDER BY gmc.match_score) AS rn,
      count(*) OVER (PARTITION BY gmc.group_member_id, gmc.match_score) AS tie_count
    FROM group_member_candidates gmc
  ) x
  WHERE rn = 1
    AND tie_count = 1
)
SELECT
  gmb.current_rank,
  count(*) AS frequency
FROM group_member_base gmb
LEFT JOIN resolvable r ON r.group_member_id = gmb.group_member_id
WHERE r.group_member_id IS NULL
GROUP BY gmb.current_rank
ORDER BY frequency DESC, gmb.current_rank
LIMIT 50;
