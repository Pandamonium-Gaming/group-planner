/**
 * Fetch Star Citizen subscriber ships for the current month from RSI Comm-Link
 * This script scrapes the monthly subscriber promotions post and updates the config
 */

import * as cheerio from 'cheerio';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// For compatibility with both Bun and Node.js
let __filename: string;
let __dirname: string;
if (typeof import.meta.url !== 'undefined') {
  __filename = fileURLToPath(import.meta.url);
  __dirname = dirname(__filename);
} else {
  __dirname = process.cwd();
  __filename = '';
}

interface SubscriberShipMonth {
  label: string;
  centurion: string[];
  imperator: string[];
  flair?: string;
  notes?: string;
}

interface FetchResult {
  success: boolean;
  month?: string;
  data?: SubscriberShipMonth;
  error?: string;
  explanation: string;
  pageUrl?: string;
}

/**
 * Get the current month's subscriber promotions URL pattern
 * Format: https://robertsspaceindustries.com/comm-link/transmission/[ID]-[Month]-[Year]-Subscriber-Promotions
 */
function getCurrentMonthCommLinkUrl(): { url: string; monthKey: string; monthLabel: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  // Month names for URL
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const monthName = monthNames[month];
  const monthPad = String(month + 1).padStart(2, '0');
  const monthKey = `${year}-${monthPad}`;
  const monthLabel = `${monthName} ${year}`;

  // We don't know the comm-link ID, so search the comm-link feed instead
  const searchUrl = `https://robertsspaceindustries.com/comm-link/transmission/?search=${monthName}+${year}+Subscriber+Promotions`;

  return { url: searchUrl, monthKey, monthLabel };
}

/**
 * Fetch the comm-link feed and find the current month's subscriber promotions post
 */
async function findSubscriberPromotionsUrl(monthName: string, year: number): Promise<string | null> {
  try {
    // Try direct comm-link transmission page first
    const commLinkUrl = 'https://robertsspaceindustries.com/comm-link/transmission';
    console.log(`Fetching comm-link transmissions from: ${commLinkUrl}`);

    const response = await fetch(commLinkUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      console.error(`Failed to fetch comm-link: ${response.status}`);
      return null;
    }

    const html = await response.text();
    console.log(`Fetched ${html.length} bytes from comm-link`);

    // Look for links with "Subscriber" and the month/year in them
    // Pattern: href="...March-2026-Subscriber-Promotions" or similar
    const promotionPattern = new RegExp(`href="([^"]*${monthName}[^"]*${year}[^"]*Subscriber[^"]*)"`, 'i');
    const match = html.match(promotionPattern);

    if (match && match[1]) {
      const path = match[1];
      // Make it absolute if it's relative
      const url = path.startsWith('http') ? path : `https://robertsspaceindustries.com${path}`;
      console.log(`✓ Found promotion URL: ${url}`);
      return url;
    }

    // Alternative pattern: look for any link that contains the promotion text
    const altPattern = new RegExp(`href="([^"]*Subscriber[^"]*Promotions[^"]*)"`, 'i');
    const altMatches = html.match(new RegExp(altPattern, 'g')) || [];

    console.log(`Found ${altMatches.length} potential promotion links`);
    for (const altMatch of altMatches) {
      const link = altMatch.match(/"([^"]+)"/)?.[1];
      if (link) {
        const fullUrl = link.startsWith('http') ? link : `https://robertsspaceindustries.com${link}`;
        console.log(`  Checking: ${fullUrl}`);
      }
    }

    console.warn(`Could not find ${monthName} ${year} Subscriber Promotions link`);
    return null;
  } catch (error) {
    console.error('Error fetching comm-link:', error);
    return null;
  }
}

/**
 * Parse Atom feed format (alternative XML format)
 */
async function tryParseAtomFeed(entries: string[], monthName: string, year: number): Promise<string | null> {
  for (const entry of entries) {
    const titleMatch = entry.match(/<title>([^<]+)<\/title>/);
    if (!titleMatch) continue;

    const title = titleMatch[1];
    if (title.includes('Subscriber Promotions') && title.includes(monthName) && title.includes(String(year))) {
      console.log(`✓ Found in Atom feed: "${title}"`);
      const linkMatch = entry.match(/<link[^>]*href="([^"]+)"/);
      if (linkMatch) {
        return linkMatch[1];
      }
    }
  }
  return null;
}

async function parseSubscriberPromotions(pageUrl: string): Promise<SubscriberShipMonth | null> {
  try {
    console.log(`Fetching subscriber promotions page: ${pageUrl}`);

    // Load ship database for proper ID mapping
    const shipDatabase = loadShipDatabase();

    const response = await fetch(pageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      console.error(`Failed to fetch page: ${response.status}`);
      return null;
    }

    let html = await response.text();
    console.log(`Fetched page, length: ${html.length} bytes`);

    // Check if content is loaded via S3
    const s3Match = html.match(/const\s+s3Url\s*=\s*['"]([^'"]+)['"]/);
    if (s3Match && s3Match[1]) {
      console.log(`Page loads content from S3, fetching...`);
      const s3Response = await fetch(s3Match[1]);
      if (s3Response.ok) {
        html = await s3Response.text();
        console.log(`Fetched S3 content, length: ${html.length} bytes`);
      }
    }

    // Parse with cheerio
    const $ = cheerio.load(html);

    //  Try to find ship information in various HTML patterns
    let centurionShips: string[] = [];
    let imperatorShips: string[] = [];
    let flairText = '';

    // Look for img alt text or titles that might mention ships
    const allText = html.replace(/<[^>]+>/g, ' ');  // Strip HTML tags
    console.log(`\nSearching in ${allText.length} chars of content...`);

    // Look for actual ship names mentioned in the content
    // Try patterns like: "Centurion: [Ship Name]" or in list items

    // Save the raw HTML for processing
    const normalized = allText.replace(/\s+/g, ' ').trim();

    // Look for distinctive patterns in subscriber promotions
    // Usually formatted as: "Centurion Subscribers receive: [ships]"
    //                       "Imperator Subscribers receive: [ships]"

    const centurionPattern = /Centurion[^.!]*?(?:ship|vehicle|receive)[\s:]*([^.!?\n]+?)(?=Imperator|Flair|$)/i;
    const imperatorPattern = /Imperator[^.!]*?(?:ship|vehicle|receive)[\s:]*([^.!?\n]+?)(?=Flair|Merch|$)/i;
    const explicitTierPattern = /Centurion Subscribers:\s*(.*?)\s*\(with[^)]*\)\s*Imperator Subscribers:\s*(.*?)\s*\(with[^)]*\)/i;

    const explicitTierMatch = normalized.match(explicitTierPattern);
    if (explicitTierMatch) {
      centurionShips = extractShipNames(explicitTierMatch[1], shipDatabase);
      imperatorShips = extractShipNames(explicitTierMatch[2], shipDatabase);
      console.log(`Found explicit tier block`);
    }

    const centurionMatch = normalized.match(centurionPattern);
    const imperatorMatch = normalized.match(imperatorPattern);

    if (centurionMatch && centurionShips.length === 0) {
      console.log(`Centurion match: "${centurionMatch[1].substring(0, 100)}"`);
      centurionShips = extractShipNames(centurionMatch[1], shipDatabase);
    }

    if (imperatorMatch && imperatorShips.length === 0) {
      console.log(`Imperator match: "${imperatorMatch[1].substring(0, 100)}"`);
      imperatorShips = extractShipNames(imperatorMatch[1], shipDatabase);
    }

    // Try an alternative method: look for ship names anywhere as a fallback
    if (centurionShips.length === 0 || imperatorShips.length === 0) {
      console.log(`\nTrying alternative ship detection...`);

      // Find mentions of both Ursa and Apollo (which were visible in our earlier output)
      const allShips = extractShipNames(normalized, shipDatabase);
      console.log(`Found ships in overall text: ${allShips.join(', ')}`);

      // If we found ships, try to split them between Centurion and Imperator
      if (allShips.length > 0) {
        if (centurionShips.length === 0) {
          centurionShips = [allShips[0]];
        }
        if (imperatorShips.length === 0) {
          imperatorShips = allShips.length > 1 ? allShips : [allShips[0]];
        }
      }
    }

    // Try to find flair info from the dedicated section on the promotions page
    const flairSectionMatch = normalized.match(/IN-GAME REWARDS \(FLAIR\)\s*(.*?)\s*Earnable In-Game:/i);
    if (flairSectionMatch) {
      flairText = flairSectionMatch[1].replace(/\s+/g, ' ').trim().substring(0, 220);
    }

    if (centurionShips.length === 0 || imperatorShips.length === 0) {
      console.error('\n❌ Failed to extract ship names');
      console.log('Centurion ships found:', centurionShips);
      console.log('Imperator ships found:', imperatorShips);
      console.log('\nFull normalized text (first 1500 chars):\n', normalized.substring(0, 1500));
      return null;
    }

    // Get month label
    const now = new Date();
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const monthLabel = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;

    console.log(`\n✓ Successfully extracted ships:`);
    console.log(`  Centurion: ${centurionShips.join(', ')}`);
    console.log(`  Imperator: ${imperatorShips.join(', ')}`);
    if (flairText) {
      console.log(`  Flair: ${flairText.substring(0, 100)}`);
    }

    return {
      label: monthLabel,
      centurion: centurionShips,
      imperator: imperatorShips,
      flair: flairText || 'See RSI subscriber promotions post for monthly flair details.',
      notes: `Auto-fetched from RSI comm-link. Ships have 12m insurance for Centurion, 24m for Imperator.`
    };
  } catch (error) {
    console.error('Error parsing page:', error);
    return null;
  }
}

/**
 * Load the ship database and create a mapping from display names to ship IDs
 */
function loadShipDatabase(): Map<string, string> {
  try {
    const shipsPath = resolve(__dirname, '../src/config/games/star-citizen-ships.json');
    const shipsContent = readFileSync(shipsPath, 'utf-8');
    const shipsData: { ships: Array<{ id: string; name: string }> } | Array<{ id: string; name: string }> = JSON.parse(shipsContent);
    const ships = Array.isArray(shipsData) ? shipsData : shipsData.ships;
    if (!Array.isArray(ships)) {
      throw new Error('Ship database must contain a ships array.');
    }

    const nameToId = new Map<string, string>();

    for (const ship of ships) {
      if (ship.id && ship.name) {
        // Map exact name
        nameToId.set(ship.name.toLowerCase(), ship.id);

        // Also map variants without parentheses (e.g., "Apollo Medivac" for "Apollo (Medivac)")
        const nameWithoutParens = ship.name.replace(/\s*\([^)]*\)/g, '').trim();
        if (nameWithoutParens) {
          nameToId.set(nameWithoutParens.toLowerCase(), ship.id);
        }
      }
    }

    console.log(`Loaded ${nameToId.size} ships from database`);
    return nameToId;
  } catch (error) {
    console.error('Could not load ship database:', error);
    throw error;
  }
}

/**
 * Extract ship names from text using actual ship database
 */
function extractShipNames(text: string, shipDatabase: Map<string, string>): string[] {
  const found: Set<string> = new Set();
  const matchedNames: Set<string> = new Set(); // Track names we've already matched

  // Try to match ship names from the database
  // Sort by length descending to match longer names first
  const sortedShips = Array.from(shipDatabase.entries()).sort((a, b) => b[0].length - a[0].length);

  for (const [name, id] of sortedShips) {
    // Skip if this name is a substring of an already-matched name
    // e.g., don't match "Ursa" if we already matched "Ursa Medivac"
    const isSubstring = Array.from(matchedNames).some(matched =>
      matched.toLowerCase().includes(name.toLowerCase())
    );
    if (isSubstring) {
      console.log(`  Skipping "${name}" (substring of already-matched name)`);
      continue;
    }

    // Create case-insensitive regex for the ship name with word boundaries
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedName}\\b`, 'i');

    if (regex.test(text)) {
      found.add(id);
      matchedNames.add(name);
      console.log(`  Found ship in text: "${name}" -> "${id}"`);

      // Once we have 5 ships, stop looking
      if (found.size >= 5) break;
    }
  }
  return Array.from(found).slice(0, 5); // Limit results
}

/**
 * Update the subscriber-ships config file
 */
function updateConfigFile(monthKey: string, shipData: SubscriberShipMonth): boolean {
  try {
    const configPath = resolve(__dirname, '../src/games/starcitizen/config/subscriber-ships.ts');
    let content = readFileSync(configPath, 'utf-8');

    // Create the new entry
    const newEntry = `  '${monthKey}': {
    label: '${shipData.label}',
    centurion: ${JSON.stringify(shipData.centurion)},
    imperator: ${JSON.stringify(shipData.imperator)},
    flair: '${shipData.flair || ''}',
    notes: '${shipData.notes || ''}',
  },`;

    // Insert before the closing brace of SUBSCRIBER_SHIPS
    // Find the last entry and add after it
    const shipEntriesEnd = content.lastIndexOf('};', content.indexOf('export function'));

    if (shipEntriesEnd === -1) {
      console.error('Could not find insertion point in config file');
      return false;
    }

    // Insert the new entry
    const beforeNew = content.substring(0, shipEntriesEnd);
    const afterNew = content.substring(shipEntriesEnd);
    content = beforeNew + '\n' + newEntry + '\n' + afterNew;

    writeFileSync(configPath, content, 'utf-8');
    console.log(`Updated ${configPath}`);
    return true;
  } catch (error) {
    console.error('Error updating config file:', error);
    return false;
  }
}

/**
 * Main execution
 */
async function main(): Promise<FetchResult> {
  try {
    const { monthKey, monthLabel } = getCurrentMonthCommLinkUrl();

    console.log(`Looking for ${monthLabel} subscriber promotions...`);

    // Find the promotions page
    const now = new Date();
    const monthName = now.toLocaleString('en-US', { month: 'long' });
    const year = now.getFullYear();

    const pageUrl = await findSubscriberPromotionsUrl(monthName, year);

    if (!pageUrl) {
      return {
        success: false,
        explanation: `Could not find ${monthLabel} subscriber promotions post. Please check RSI comm-link manually.`,
        error: `No comm-link post found for ${monthLabel}`
      };
    }

    console.log(`Found page: ${pageUrl}`);

    // Parse the page
    const shipData = await parseSubscriberPromotions(pageUrl);

    if (!shipData) {
      return {
        success: false,
        explanation: `Failed to parse subscriber ships from the promotions page. The page layout may have changed.`,
        error: 'Failed to parse subscriber promotions page'
      };
    }

    // Update config
    if (!updateConfigFile(monthKey, shipData)) {
      return {
        success: false,
        explanation: `Failed to update the configuration file.`,
        error: 'Failed to update config file'
      };
    }

    return {
      success: true,
      month: monthKey,
      data: shipData,
      pageUrl: pageUrl,
      explanation: `Successfully fetched and updated ${monthLabel} subscriber ships!`
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      explanation: `An error occurred while fetching subscriber ships: ${message}`,
      error: message
    };
  }
}

// Export for testing and GitHub Actions
// Check if running as main module (Node.js or Bun)
const isMainModule = typeof import.meta.main !== 'undefined' ? import.meta.main : process.argv[1]?.endsWith('fetch-subscriber-ships.ts') || process.argv[1]?.includes('tsx');

if (isMainModule) {
  main().then(result => {
    console.log(`\nResult: ${result.success ? '✓ SUCCESS' : '✗ FAILED'}`);
    console.log(result.explanation);

    if (result.data) {
      console.log('\nFetched ships:');
      console.log(`  Centurion: ${result.data.centurion.join(', ')}`);
      console.log(`  Imperator: ${result.data.imperator.join(', ')}`);
    }

    if (result.pageUrl) {
      console.log(`\nSource: ${result.pageUrl}`);
    }

    process.exit(result.success ? 0 : 1);
  });
}

export { main, extractShipNames, parseSubscriberPromotions };
export type { FetchResult, SubscriberShipMonth };
