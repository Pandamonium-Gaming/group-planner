/**
 * Scrape and parse the Star Citizen Loaner Ship Matrix from RSI Support
 * This script fetches the latest loaner data and can apply it directly to sc_loaner_matrix.
 */

import * as cheerio from 'cheerio';
import { createClient } from '@supabase/supabase-js';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT_DIR = path.resolve(__dirname, '..');

function toShipId(name: string): string {
  return name
    .toLowerCase()
    .replace(/\bvariants\b/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/[’']/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[^a-z0-9\s/-]/g, '')
    .replace(/\s*\/\s*/g, '/')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function expandPledgedNames(rawName: string): string[] {
  const cleaned = rawName.trim();
  if (!cleaned) {
    return [];
  }

  const baseSuffixPattern = cleaned.match(/^(.+?)\s+([A-Za-z0-9-]+),\s*([A-Za-z0-9-]+)$/);
  if (baseSuffixPattern) {
    const base = baseSuffixPattern[1].trim();
    const first = `${base} ${baseSuffixPattern[2]}`;
    const second = `${base} ${baseSuffixPattern[3]}`;
    return [first, second];
  }

  const hyphenAndPattern = cleaned.match(/^(.+)-([A-Za-z0-9-]+)\s*&\s*([A-Za-z0-9-]+)$/);
  if (hyphenAndPattern) {
    const base = hyphenAndPattern[1].trim();
    return [`${base}-${hyphenAndPattern[2]}`, `${base}-${hyphenAndPattern[3]}`];
  }

  if (cleaned.includes('/')) {
    return cleaned
      .split('/')
      .map((part) => part.trim())
      .filter(Boolean);
  }

  if (cleaned.includes('&')) {
    return cleaned
      .split('&')
      .map((part) => part.trim())
      .filter(Boolean);
  }

  return [cleaned];
}

interface LoanerMapping {
  pledgedShip: string;
  loaners: Array<{
    ship: string;
    type: 'primary' | 'arena_commander' | 'temporary';
    notes?: string;
  }>;
}

const RSI_LOANER_URL = 'https://support.robertsspaceindustries.com/hc/en-us/articles/360003093114-Loaner-Ship-Matrix';
const RSI_LOANER_API_URL = 'https://support.robertsspaceindustries.com/api/v2/help_center/en-us/articles/360003093114.json';

/**
 * Fetch and parse the RSI loaner matrix page
 */
async function fetchLoanerMatrix(): Promise<LoanerMapping[]> {
  console.log('Fetching loaner matrix from RSI...');
  
  const response = await fetch(RSI_LOANER_API_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch loaner matrix API: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json() as { article?: { body?: string } };
  const articleBody = payload.article?.body;
  if (!articleBody) {
    throw new Error('Loaner matrix API returned no article body');
  }

  const $ = cheerio.load(articleBody);
  
  const mappings: LoanerMapping[] = [];
  const tableRows: string[][] = [];
  
  // Parse table rows from article HTML
  $('table tr').each((i, row) => {
    const cells: string[] = [];
    $(row).find('td, th').each((j, cell) => {
      const text = $(cell).text().trim();
      if (text) cells.push(text);
    });
    if (cells.length >= 2) {
      tableRows.push(cells);
    }
  });
  
  console.log(`Found ${tableRows.length} loaner mappings`);
  
  // Parse each row
  for (const [pledgedShipRaw, loanersTextRaw] of tableRows) {
    if (!pledgedShipRaw || !loanersTextRaw) continue;

    const pledgedLower = pledgedShipRaw.toLowerCase();
    const loanerLower = loanersTextRaw.toLowerCase();
    if (
      pledgedLower.includes('your ship') ||
      loanerLower.includes('our loaner')
    ) {
      continue;
    }
    
    const pledgedShips = expandPledgedNames(pledgedShipRaw)
      .map((name) => toShipId(name))
      .filter(Boolean);
    if (pledgedShips.length === 0) {
      continue;
    }
    
    const loaners: LoanerMapping['loaners'] = [];
    
    // Parse the loaners (comma-separated)
    const loanerShips = loanersTextRaw.split(',').map(s => s.trim());
    
    for (const loanerShip of loanerShips) {
      if (!loanerShip) continue;
      
      // Determine loaner type from context
      let type: 'primary' | 'arena_commander' | 'temporary' = 'primary';
      let notes: string | undefined;
      
      // Check for special cases mentioned in notes
      if (loanerShip.toLowerCase().includes('arena') || loanerShip.toLowerCase().includes('ac')) {
        type = 'arena_commander';
      }
      
      // Clean ship name and normalize to canonical ship id style.
      const cleanName = toShipId(loanerShip);

      if (!cleanName) {
        continue;
      }
      
      loaners.push({ ship: cleanName, type, notes });
    }
    
    if (loaners.length > 0) {
      for (const pledgedShip of pledgedShips) {
        mappings.push({ pledgedShip, loaners });
      }
    }
  }
  
  return mappings;
}

/**
 * Generate SQL INSERT statements from loaner mappings
 */
function generateSQL(mappings: LoanerMapping[]): string {
  const sqlStatements: string[] = [
    '-- Auto-generated loaner ship matrix from RSI',
    `-- Generated: ${new Date().toISOString()}`,
    `-- Source: ${RSI_LOANER_URL}`,
    '',
    'BEGIN;',
    '',
    '-- Clear existing loaner matrix',
    'DELETE FROM sc_loaner_matrix;',
    '',
    '-- Insert loaner mappings',
  ];
  
  for (const mapping of mappings) {
    for (const loaner of mapping.loaners) {
      const notes = loaner.notes ? `'${loaner.notes.replace(/'/g, "''")}'` : 'NULL';
      sqlStatements.push(
        `INSERT INTO sc_loaner_matrix (pledged_ship, loaner_ship, loaner_type, notes) ` +
        `VALUES ('${mapping.pledgedShip}', '${loaner.ship}', '${loaner.type}', ${notes});`
      );
    }
  }
  
  sqlStatements.push('', 'COMMIT;');
  
  return sqlStatements.join('\n');
}

async function loadEnvFiles(): Promise<void> {
  const envFiles = [
    path.join(ROOT_DIR, '.env.local'),
    path.join(ROOT_DIR, '.env'),
  ];

  for (const envFilePath of envFiles) {
    try {
      const raw = await readFile(envFilePath, 'utf8');
      const lines = raw.split(/\r?\n/);

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) {
          continue;
        }

        const separatorIndex = trimmed.indexOf('=');
        if (separatorIndex <= 0) {
          continue;
        }

        const key = trimmed.slice(0, separatorIndex).trim();
        let value = trimmed.slice(separatorIndex + 1).trim();

        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }

        if (!(key in process.env)) {
          process.env[key] = value;
        }
      }
    } catch {
      // Ignore missing env files.
    }
  }
}

async function applyMappingsToDatabase(mappings: LoanerMapping[]): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Cannot apply loaner matrix directly.'
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const flattenedRows = mappings.flatMap((mapping) =>
    mapping.loaners.map((loaner) => ({
      pledged_ship: mapping.pledgedShip,
      loaner_ship: loaner.ship,
      loaner_type: loaner.type,
      notes: loaner.notes || null,
    }))
  );

  const uniqueRows = Array.from(
    new Map(
      flattenedRows.map((row) => [
        `${row.pledged_ship}|${row.loaner_ship}|${row.loaner_type}`,
        row,
      ])
    ).values()
  );

  const { error: deleteError } = await supabase.from('sc_loaner_matrix').delete().neq('pledged_ship', '');
  if (deleteError) {
    throw new Error(`Failed to clear sc_loaner_matrix: ${deleteError.message}`);
  }

  const batchSize = 500;
  for (let i = 0; i < uniqueRows.length; i += batchSize) {
    const batch = uniqueRows.slice(i, i + batchSize);
    const { error: insertError } = await supabase.from('sc_loaner_matrix').insert(batch);
    if (insertError) {
      throw new Error(`Failed to insert loaner rows: ${insertError.message}`);
    }
  }
}

/**
 * Generate TypeScript type definitions for ship names
 */
function generateTypes(mappings: LoanerMapping[]): string {
  const allShips = new Set<string>();
  
  for (const mapping of mappings) {
    allShips.add(mapping.pledgedShip);
    for (const loaner of mapping.loaners) {
      allShips.add(loaner.ship);
    }
  }
  
  const sortedShips = Array.from(allShips).sort();
  
  return `// Auto-generated Star Citizen ship names
// Generated: ${new Date().toISOString()}
// Source: ${RSI_LOANER_URL}

export type StarCitizenShipName = 
${sortedShips.map(ship => `  | '${ship}'`).join('\n')};

export const SC_SHIPS: readonly StarCitizenShipName[] = [
${sortedShips.map(ship => `  '${ship}',`).join('\n')}
] as const;
`;
}

/**
 * Main execution
 */
async function main() {
  try {
    const shouldApply = process.argv.includes('--apply');
    await loadEnvFiles();
    const mappings = await fetchLoanerMatrix();
    if (mappings.length === 0) {
      throw new Error('No loaner mappings parsed from RSI page');
    }
    
    // Write a SQL snapshot for auditing/manual fallback (not a migration file)
    const sql = generateSQL(mappings);
    const sqlPath = path.join(ROOT_DIR, 'scripts', 'generated', 'refresh_sc_loaner_matrix.sql');
    await mkdir(path.dirname(sqlPath), { recursive: true });
    await writeFile(sqlPath, sql, 'utf8');
    console.log(`✓ Generated SQL snapshot: ${sqlPath}`);
    
    // Generate types
    const types = generateTypes(mappings);
    const typesPath = path.join(ROOT_DIR, 'src', 'types', 'sc-ships-loaner.ts');
    await mkdir(path.dirname(typesPath), { recursive: true });
    await writeFile(typesPath, types, 'utf8');
    console.log(`✓ Generated types: ${typesPath}`);

    if (shouldApply) {
      await applyMappingsToDatabase(mappings);
      console.log('✓ Applied loaner matrix directly to sc_loaner_matrix');
    } else {
      console.log('ℹ️ Dry run complete. Use --apply to write data directly to the database.');
    }
    
    console.log(`\nProcessed ${mappings.length} pledged ships`);
    const totalLoaners = mappings.reduce((sum, m) => sum + m.loaners.length, 0);
    console.log(`Total loaner mappings: ${totalLoaners}`);
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
