/**
 * generate-fixtures.mjs
 *
 * Her gece Türkiye saatiyle 01:00'de çalışır (GitHub Actions, 22:00 UTC).
 * Claude'a web araması açık tek bir toplu soru sorar (scripts/fixtures-prompt.md),
 * yanıtı doğrular ve assets/matches-daily.json dosyasına yazar.
 *
 * Tasarım kararları:
 *  - Maç listesi EVRENSELDİR; ülkeye göre değişen yalnızca saat ve kanaldır.
 *    Bu yüzden 37 ayrı istek değil, tek istek atılır.
 *  - Model YALNIZCA UTC saati verir. Yerel saate çevirimi uygulama yapar —
 *    modele 37 saat dilimi çevirisi yaptırmak hata kaynağıdır.
 *  - confidence === "low" olan yayıncı kayıtları yayına alınmaz.
 *
 * Çalıştırma:
 *   ANTHROPIC_API_KEY=... node scripts/generate-fixtures.mjs
 *   node scripts/generate-fixtures.mjs --date 2026-07-26   (belirli gün)
 *   node scripts/generate-fixtures.mjs --dry-run           (dosyaya yazma)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const CONFIG_PATH = path.join(HERE, 'fixtures-config.json');
const PROMPT_PATH = path.join(HERE, 'fixtures-prompt.md');
const OUT_PATH = path.join(ROOT, 'assets', 'matches-daily.json');

const MODEL = 'claude-opus-4-8';
const LANGS = ['tr', 'en', 'de', 'es', 'fr', 'it', 'pt', 'ar'];
const SPORTS = ['football', 'basketball', 'volleyball', 'motorsport'];

const args = process.argv.slice(2);
const argOf = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const DRY_RUN = args.includes('--dry-run');

// ─── Yardımcılar ─────────────────────────────────────────────────────────────

const log = (...m) => console.log(`[fixtures]`, ...m);

/** Bir IANA saat diliminde bugünün tarihi (YYYY-MM-DD). */
function dateInZone(zone, when = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(when);
}

/** Aksanları söker, slug üretir — id fallback'i için. */
const slug = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);

// ─── JSON şeması ─────────────────────────────────────────────────────────────
// Not: structured outputs `additionalProperties: false` zorunlu kılar, yani
// dinamik anahtarlı nesne (ülke kodu → kanal) kullanılamaz. Bu yüzden
// broadcasts bir DİZİ, çok dilli adlar ise sabit anahtarlı nesnedir.

const namesObject = {
  type: 'object',
  properties: Object.fromEntries(LANGS.map((l) => [l, { type: 'string' }])),
  required: LANGS,
  additionalProperties: false,
};

const SCHEMA = {
  type: 'object',
  properties: {
    date: { type: 'string', description: 'YYYY-MM-DD' },
    matches: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          sport: { type: 'string', enum: SPORTS },
          competition: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              tier: { type: 'string', enum: ['global', 'regional'] },
              names: namesObject,
            },
            required: ['id', 'tier', 'names'],
            additionalProperties: false,
          },
          home: { type: 'string' },
          away: { type: 'string' },
          home_names: namesObject,
          away_names: namesObject,
          kickoff_utc: { type: 'string', description: 'ISO 8601, Z sonekli' },
          broadcasts: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                country: { type: 'string', description: 'ISO 3166-1 alpha-2' },
                channels: { type: 'array', items: { type: 'string' } },
                confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
              },
              required: ['country', 'channels', 'confidence'],
              additionalProperties: false,
            },
          },
          sources: { type: 'array', items: { type: 'string' } },
        },
        required: [
          'id', 'sport', 'competition', 'home', 'away',
          'home_names', 'away_names', 'kickoff_utc', 'broadcasts', 'sources',
        ],
        additionalProperties: false,
      },
    },
  },
  required: ['date', 'matches'],
  additionalProperties: false,
};

// ─── İstem kurulumu ──────────────────────────────────────────────────────────

function buildPrompt(config, date) {
  const template = fs.readFileSync(PROMPT_PATH, 'utf8');

  const coverage = Object.entries(config.coverage)
    .map(([sport, items]) => `### ${sport}\n${items.map((i) => `- ${i}`).join('\n')}`)
    .join('\n\n');

  const countries = Object.entries(config.countries)
    .map(([cc, c]) => `- ${cc} — ${c.name} (saat dilimi ${c.tz}, dil ${c.lang})`)
    .join('\n');

  const languages = Object.entries(config.languages)
    .map(([code, name]) => `- ${code} — ${name}`)
    .join('\n');

  const notes = (config.notes ?? []).map((n) => `- ${n}`).join('\n');

  return template
    .replace(/\{\{DATE\}\}/g, date)
    .replace(/\{\{COVERAGE\}\}/g, coverage)
    .replace(/\{\{COUNTRIES\}\}/g, countries)
    .replace(/\{\{LANGUAGES\}\}/g, languages)
    .replace(/\{\{NOTES\}\}/g, notes || '- (yok)');
}

// ─── Claude çağrısı ──────────────────────────────────────────────────────────

/** Yanıt metninden JSON çıkarır (structured output devre dışıysa yedek yol). */
function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('Yanıtta JSON bulunamadı');
  return JSON.parse(candidate.slice(start, end + 1));
}

function textOf(message) {
  return (message.content ?? [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');
}

async function askClaude(client, prompt, { useStructured = true } = {}) {
  const tools = [{ type: 'web_search_20260209', name: 'web_search', max_uses: 40 }];
  const messages = [{ role: 'user', content: prompt }];

  let searchCount = 0;
  let lastMessage = null;

  // Sunucu taraflı araç döngüsü limitine takılırsa (pause_turn) devam ettir.
  for (let attempt = 0; attempt < 8; attempt++) {
    const params = {
      model: MODEL,
      max_tokens: 64000,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'high' },
      tools,
      messages,
    };
    if (useStructured) {
      params.output_config.format = { type: 'json_schema', schema: SCHEMA };
    }

    const stream = client.messages.stream(params);
    const message = await stream.finalMessage();
    lastMessage = message;

    searchCount += (message.content ?? []).filter(
      (b) => b.type === 'server_tool_use' && b.name === 'web_search',
    ).length;

    if (message.stop_reason === 'refusal') {
      throw new Error(
        `Model isteği reddetti (${message.stop_details?.category ?? 'bilinmiyor'})`,
      );
    }

    if (message.stop_reason === 'pause_turn') {
      log(`sunucu araç limiti — devam ediliyor (tur ${attempt + 1})`);
      messages.push({ role: 'assistant', content: message.content });
      continue;
    }

    if (message.stop_reason === 'max_tokens') {
      throw new Error('Yanıt max_tokens sınırına takıldı — çıktı eksik, yayına alınmadı');
    }

    return { message, searchCount };
  }

  throw new Error('pause_turn döngüsü 8 turda bitmedi');
}

// ─── Doğrulama ───────────────────────────────────────────────────────────────

function validate(raw, date, config) {
  const problems = [];
  const known = new Set(Object.keys(config.countries));
  const out = [];
  const seenIds = new Set();

  if (!Array.isArray(raw?.matches)) throw new Error('matches dizisi yok');

  for (const [i, m] of raw.matches.entries()) {
    const where = `matches[${i}] (${m?.home ?? '?'} - ${m?.away ?? '?'})`;

    if (!SPORTS.includes(m?.sport)) { problems.push(`${where}: geçersiz sport`); continue; }
    if (!m?.home || !m?.away) { problems.push(`${where}: takım adı eksik`); continue; }

    const kickoff = new Date(m?.kickoff_utc ?? '');
    if (Number.isNaN(kickoff.getTime())) { problems.push(`${where}: kickoff_utc okunamadı`); continue; }

    // Hedef günden ±36 saatten uzaktaki kayıt büyük olasılıkla halüsinasyon.
    const target = new Date(`${date}T12:00:00Z`);
    const driftH = Math.abs(kickoff - target) / 36e5;
    if (driftH > 36) { problems.push(`${where}: tarih ${driftH.toFixed(0)}s sapmış, elendi`); continue; }

    // Düşük güvenli yayıncıları at, bilinmeyen ülkeleri at.
    const broadcasts = {};
    for (const b of m.broadcasts ?? []) {
      const cc = String(b?.country ?? '').toUpperCase();
      if (!known.has(cc)) { problems.push(`${where}: bilinmeyen ülke ${cc}`); continue; }
      if (b?.confidence === 'low') { problems.push(`${where}: ${cc} düşük güvenli, elendi`); continue; }
      const channels = (b?.channels ?? []).map((c) => String(c).trim()).filter(Boolean);
      if (channels.length) broadcasts[cc] = channels;
    }

    let id = String(m.id ?? '').trim();
    if (!id) id = `${m.sport}-${date.replace(/-/g, '')}-${slug(m.home)}-${slug(m.away)}`;
    if (seenIds.has(id)) { problems.push(`${where}: yinelenen id ${id}, elendi`); continue; }
    seenIds.add(id);

    const pickNames = (obj, base) => {
      const r = {};
      for (const l of LANGS) {
        const v = String(obj?.[l] ?? '').trim();
        if (v && v !== base) r[l] = v;
      }
      return Object.keys(r).length ? r : undefined;
    };

    out.push({
      id,
      sport: m.sport,
      competitionId: String(m.competition?.id ?? 'other'),
      tier: m.competition?.tier === 'global' ? 'global' : 'regional',
      competition: pickNames(m.competition?.names, '') ?? { en: String(m.competition?.id ?? '') },
      home: String(m.home).trim(),
      away: String(m.away).trim(),
      homeNames: pickNames(m.home_names, String(m.home).trim()),
      awayNames: pickNames(m.away_names, String(m.away).trim()),
      kickoffUtc: kickoff.toISOString(),
      broadcasts,
      sources: (m.sources ?? []).slice(0, 4),
    });
  }

  out.sort((a, b) => a.kickoffUtc.localeCompare(b.kickoffUtc));
  return { matches: out, problems };
}

// ─── Ana akış ────────────────────────────────────────────────────────────────

async function main() {
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));

  // Actions 22:00 UTC'de tetiklenir → Türkiye'de zaten ertesi gün 01:00.
  // Hedef gün bu yüzden doğrudan Türkiye takvimindeki "bugün"dür.
  const date = argOf('--date') ?? dateInZone('Europe/Istanbul');
  log(`hedef gün: ${date} (Türkiye takvimi)`);

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY tanımlı değil');
  }
  // Tembel yükleme: SDK yalnızca gerçek üretimde gerekli, testte değil.
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic();

  const prompt = buildPrompt(config, date);
  log(`istem hazır (${prompt.length} karakter), ${Object.keys(config.countries).length} ülke`);

  let message, searchCount;
  try {
    ({ message, searchCount } = await askClaude(client, prompt));
  } catch (e) {
    // Şema kısıtı sunucu araçlarıyla reddedilirse istemle devam et.
    if (e?.status === 400 && /output_config|format|schema/i.test(e?.message ?? '')) {
      log('structured output reddedildi — şemasız moda düşülüyor');
      ({ message, searchCount } = await askClaude(client, prompt, { useStructured: false }));
    } else {
      throw e;
    }
  }

  log(`web araması: ${searchCount} çağrı, token: ${message.usage.input_tokens} giriş / ${message.usage.output_tokens} çıkış`);

  const raw = extractJson(textOf(message));
  const { matches, problems } = validate(raw, date, config);

  for (const p of problems.slice(0, 40)) log(`  uyarı — ${p}`);
  if (problems.length > 40) log(`  ...ve ${problems.length - 40} uyarı daha`);

  if (matches.length === 0) {
    throw new Error('Doğrulamadan geçen maç yok — mevcut dosya korunuyor');
  }

  const bySport = {};
  for (const m of matches) bySport[m.sport] = (bySport[m.sport] ?? 0) + 1;
  const withChannel = matches.filter((m) => Object.keys(m.broadcasts).length).length;
  log(`${matches.length} maç doğrulandı (${JSON.stringify(bySport)}), ${withChannel} tanesinde kanal bilgisi var`);

  const payload = {
    generated_at: new Date().toISOString(),
    date,
    model: MODEL,
    stats: { total: matches.length, withChannel, bySport, warnings: problems.length },
    matches,
  };

  if (DRY_RUN) {
    console.log(JSON.stringify(payload, null, 2));
    log('--dry-run: dosyaya yazılmadı');
    return;
  }

  fs.writeFileSync(OUT_PATH, JSON.stringify(payload, null, 1));
  log(`yazıldı: ${path.relative(ROOT, OUT_PATH)}`);
}

// Doğrudan çalıştırıldığında üret; import edildiğinde (test) sessiz kal.
const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  main().catch((e) => {
    console.error('[fixtures] HATA:', e.message);
    process.exitCode = 1;
  });
}

export { buildPrompt, validate, extractJson, SCHEMA, dateInZone };
