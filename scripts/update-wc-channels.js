#!/usr/bin/env node
/**
 * update-wc-channels.js
 *
 * Fetches the WC 2026 UK TV schedule from live-footballontv.com,
 * extracts confirmed ITV1 / BBC One / BBC Two / ITV4 assignments per home team,
 * and updates assets/channels.json → GB section.
 *
 * Run: node scripts/update-wc-channels.js
 * CI:  .github/workflows/update-wc-channels.yml (daily cron)
 */

const fs   = require('fs');
const path = require('path');

const CHANNELS_PATH = path.join(__dirname, '../assets/channels.json');
const SOURCE_URL    = 'https://www.live-footballontv.com/live-world-cup-football-on-tv.html';

// Same norm() as sportsDbService.ts — must stay in sync
const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 22);

// Display name overrides: site name → TheSportsDB strHomeTeam equivalent
const NAME_MAP = {
  "cote d'ivoire":       'ivory coast',
  "côte d'ivoire":       'ivory coast',
  'republic of ireland': 'republic of ireland',
  'northern ireland':    'northern ireland',
  'dr congo':            'dr congo',
  'democratic republic of congo': 'dr congo',
};

// Only these channels count as a confirmed UK broadcast channel
const VALID_CHANNELS = new Set(['ITV1', 'BBC One', 'BBC Two', 'ITV4', 'Channel 5']);

function resolveTeam(raw) {
  const lower = raw.trim().toLowerCase();
  return NAME_MAP[lower] || raw.trim();
}

async function fetchPage() {
  const res = await fetch(SOURCE_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WCChannelBot/1.0)' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

/**
 * Parse fixtures from the HTML.
 * Structure:  <div class="fixture">
 *               <div class="fixture__teams">Brazil v Japan  </div>
 *               <div class="fixture__competition">FIFA World Cup 2026&nbsp;Round of 32</div>
 *               <div class="fixture__channel">
 *                 <span class="channel-pill" ...>ITV1</span>
 *                 ...
 *               </div>
 *             </div>
 */
function parseFixtures(html) {
  const results = []; // { homeRaw, channel }

  // Split into individual fixture blocks
  const fixtureBlocks = html.split('<div class="fixture">').slice(1);

  for (const block of fixtureBlocks) {
    // Only World Cup matches
    if (!block.includes('World Cup')) continue;

    // Extract teams
    const teamsMatch = block.match(/class="fixture__teams">([^<]+)</);
    if (!teamsMatch) continue;
    const teamsRaw = teamsMatch[1].trim();

    // Skip TBC fixtures
    if (teamsRaw.toUpperCase().includes('TBC')) continue;

    // Teams format: "Brazil v Japan" or "Germany v Paraguay"
    const vMatch = teamsRaw.match(/^(.+?)\s+v\.?\s+(.+)$/i);
    if (!vMatch) continue;
    const homeRaw = vMatch[1].trim();

    // Extract first channel-pill that is a valid UK channel
    const pillMatches = [...block.matchAll(/class="channel-pill"[^>]*>([^<]+)</g)];
    let channel = null;
    for (const pill of pillMatches) {
      const name = pill[1].trim();
      if (VALID_CHANNELS.has(name)) {
        channel = name;
        break;
      }
    }

    if (!channel) continue; // TBC or streaming-only, skip

    results.push({ homeRaw, channel });
  }

  return results;
}

async function main() {
  console.log('Fetching WC 2026 UK schedule...');

  let html;
  try {
    html = await fetchPage();
  } catch (err) {
    console.error('Fetch failed:', err.message);
    process.exit(1);
  }

  const fixtures = parseFixtures(html);

  if (fixtures.length === 0) {
    console.log('No confirmed fixtures found — page structure may have changed.');
    process.exit(1);
  }

  console.log(`Found ${fixtures.length} confirmed fixture(s).`);

  // Load channels.json
  const channels = JSON.parse(fs.readFileSync(CHANNELS_PATH, 'utf8'));

  let added   = 0;
  let changed = 0;

  for (const { homeRaw, channel } of fixtures) {
    const homeResolved = resolveTeam(homeRaw);
    const homeKey      = norm(homeResolved);
    const channelKey   = `wc2026_${homeKey}`;
    const current      = channels.GB[channelKey]?.[0];

    if (!current) {
      channels.GB[channelKey] = [channel];
      console.log(`  + GB.${channelKey} → ${channel}`);
      added++;
    } else if (current !== channel) {
      channels.GB[channelKey] = [channel];
      console.log(`  ~ GB.${channelKey}: ${current} → ${channel}`);
      changed++;
    }
  }

  if (added + changed === 0) {
    console.log('channels.json already up to date.');
    return;
  }

  fs.writeFileSync(CHANNELS_PATH, JSON.stringify(channels, null, 2) + '\n');
  console.log(`channels.json saved (${added} added, ${changed} updated).`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
