/**
 * Fetch Star Citizen ship data from RSI ship matrix
 * Run manually: yarn update-ships
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const RSI_SHIP_MATRIX_URL = 'https://robertsspaceindustries.com/ship-matrix/index';
const OUTPUT_PATH = path.join(__dirname, '..', 'src', 'config', 'games', 'star-citizen-ships.json');

console.log('🚀 Fetching Star Citizen ship data from RSI...\n');

https.get(RSI_SHIP_MATRIX_URL, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      // Parse the JSON response from ship matrix API
      const jsonData = JSON.parse(data);
      
      if (!jsonData.data || !Array.isArray(jsonData.data)) {
        throw new Error('Invalid response structure from RSI ship matrix');
      }

      // Function to check if a ship is a paint/skin variant
      const isPaintVariant = (name) => {
        const variantPatterns = [
          /Edition$/i,                    // "Best In Show Edition", "Pirate Edition", etc.
          /Livery$/i,                     // Paint liveries
          /Paint$/i,                      // Paint schemes
          /\(.*Paint.*\)$/i,              // "(Special Paint)"
          /Carbon Edition$/i,             // Argo Mole Carbon Edition
          /Talus Edition$/i,              // Argo Mole Talus Edition
          /Best In Show/i,                // Best In Show variants
          /Bis \d{4}$/i,                  // BIS 2949 etc
          /Solstice Edition$/i,           // Special edition paints
        ];
        return variantPatterns.some(pattern => pattern.test(name));
      };

      const ships = jsonData.data
        .filter(ship => {
          // Filter out paint variants and skins
          if (!ship.name || isPaintVariant(ship.name)) {
            return false;
          }
          return true;
        })
        .map(ship => ({
        id: ship.name ? ship.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') : null,
        name: ship.name || 'Unknown',
        manufacturer: ship.manufacturer?.name || ship.manufacturer?.code || 'Unknown',
        manufacturerCode: ship.manufacturer?.code || null,
        role: ship.focus || ship.type || 'Multi-role',
        size: ship.size || 'unknown',
        length: ship.length || null,
        beam: ship.beam || null,
        height: ship.height || null,
        mass: ship.mass || null,
        cargo: ship.cargocapacity || 0,
        crew: {
          min: ship.min_crew || 1,
          max: ship.max_crew || 1
        },
        speed: {
          scm: ship.scm_speed || null,
          afterburner: ship.afterburner_speed || null
        },
        productionStatus: ship.production_status || 'unknown',
        description: ship.description || null,
        url: ship.url ? `https://robertsspaceindustries.com${ship.url}` : null,
        image: ship.media && ship.media[0] ? ship.media[0].images?.store_large || ship.media[0].source_url : null
      })).filter(ship => ship.id && ship.name !== 'Unknown');

      // Sort alphabetically by ship name
      ships.sort((a, b) => a.name.localeCompare(b.name));

      const output = {
        lastUpdated: new Date().toISOString(),
        source: RSI_SHIP_MATRIX_URL,
        totalShips: ships.length,
        ships
      };

      // Ensure directory exists
      const dir = path.dirname(OUTPUT_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Write to file
      fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf8');

      console.log(`✅ Successfully fetched ${ships.length} ships`);
      console.log(`📝 Saved to: ${OUTPUT_PATH}`);
      console.log(`🕒 Last updated: ${output.lastUpdated}\n`);

      // Show some stats
      const manufacturers = [...new Set(ships.map(s => s.manufacturer))];
      const sizes = [...new Set(ships.map(s => s.size))];
      
      console.log(`📊 Summary:`);
      console.log(`   Manufacturers: ${manufacturers.length}`);
      console.log(`   Ship Sizes: ${sizes.join(', ')}`);
      console.log(`   Flight-ready: ${ships.filter(s => s.productionStatus === 'flight-ready').length}`);
      console.log(`   In-concept: ${ships.filter(s => s.productionStatus === 'in-concept').length}`);

    } catch (error) {
      console.error('❌ Error parsing ship data:', error.message);
      process.exit(1);
    }
  });

}).on('error', (error) => {
  console.error('❌ Error fetching ship data:', error.message);
  console.error('\n💡 Tips:');
  console.error('   - Check your internet connection');
  console.error('   - Verify RSI servers are online');
  console.error('   - The API endpoint may have changed\n');
  process.exit(1);
});
