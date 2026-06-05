export interface CountryInfo {
  code: string;
  name: string;
  flag: string;
  timezone: string;
  language: string;   // i18n dil kodu
}

export const SUPPORTED_COUNTRIES: CountryInfo[] = [
  // Mevcut
  { code: 'TR', name: 'Türkiye',        flag: '🇹🇷', timezone: 'Europe/Istanbul', language: 'tr' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧', timezone: 'Europe/London',   language: 'en' },
  { code: 'ES', name: 'España',         flag: '🇪🇸', timezone: 'Europe/Madrid',   language: 'es' },
  { code: 'PT', name: 'Portugal',       flag: '🇵🇹', timezone: 'Europe/Lisbon',   language: 'pt' },
  { code: 'FR', name: 'France',         flag: '🇫🇷', timezone: 'Europe/Paris',    language: 'fr' },
  { code: 'DE', name: 'Deutschland',    flag: '🇩🇪', timezone: 'Europe/Berlin',   language: 'de' },
  { code: 'IT', name: 'Italia',         flag: '🇮🇹', timezone: 'Europe/Rome',     language: 'it' },
  { code: 'SA', name: 'العربية',        flag: '🇸🇦', timezone: 'Asia/Riyadh',     language: 'ar' },
  // Yeni
  { code: 'BR', name: 'Brasil',         flag: '🇧🇷', timezone: 'America/Sao_Paulo',      language: 'pt' },
  { code: 'AR', name: 'Argentina',      flag: '🇦🇷', timezone: 'America/Argentina/Buenos_Aires', language: 'es' },
  { code: 'MX', name: 'México',         flag: '🇲🇽', timezone: 'America/Mexico_City',    language: 'es' },
  { code: 'EG', name: 'مصر',            flag: '🇪🇬', timezone: 'Africa/Cairo',            language: 'ar' },
  { code: 'NG', name: 'Nigeria',        flag: '🇳🇬', timezone: 'Africa/Lagos',            language: 'en' },
  { code: 'MA', name: 'المغرب',         flag: '🇲🇦', timezone: 'Africa/Casablanca',       language: 'ar' },
  { code: 'SN', name: 'Sénégal',        flag: '🇸🇳', timezone: 'Africa/Dakar',            language: 'fr' },
];

export const COUNTRY_CHANNEL_MAP: Record<string, Record<string, string[]>> = {
  // ─── Türkiye ────────────────────────────────────────────────────────────────
  TR: {
    superlig:      ['beIN Sports 1', 'beIN Sports 2', 'beIN Sports 3', 'TV8', 'A Spor'],
    lig1:          ['TRT Spor', 'beIN Sports 2'],
    lig2:          ['Yaay'],
    champions:     ['beIN Sports MAX', 'beIN Sports 1'],
    europa:        ['beIN Sports 2'],
    conference:    ['beIN Sports 3'],
    premier:       ['beIN Sports 1', 'beIN Sports 4'],
    laliga:        ['Tivibu Spor 2', 'S Sport Plus'],
    bundesliga:    ['S Sport 2', 'S Sport'],
    seriea:        ['beIN Sports 2', 'beIN Sports 3'],
    ligue1:        ['beIN Sports 3'],
    saudi:         ['S Sport Plus'],
    liganos:       ['Tivibu Spor 1', 'S Sport Plus'],
    national:      ['TRT Spor', 'TRT Spor 2', 'TV8'],
    euroleague:    ['S Sport', 'S Sport 2', 'S Sport Plus'],
    eurocup:       ['TRT Spor Yıldız', 'tabii Spor'],
    bsl:           ['HT Spor'],
    nba:           ['NBA TV', 'beIN Sports'],
    efeler:        ['TRT Spor 2', 'Spor Smart'],
    sultansliga:   ['TRT Spor 2', 'Spor Smart'],
    tvfkadin:      ['TRT Spor Yıldız', 'tabii Spor'],
    f1:            ['S Sport 2', 'S Sport'],
  },

  // ─── United Kingdom ─────────────────────────────────────────────────────────
  GB: {
    superlig:    ['TRT World'],
    lig1:        ['TRT World'],
    champions:   ['TNT Sports 1', 'Channel 5'],
    europa:      ['TNT Sports 2', 'Channel 5'],
    conference:  ['TNT Sports 3'],
    premier:     ['Sky Sports Main Event', 'Sky Sports PL', 'TNT Sports 1', 'Amazon Prime'],
    laliga:      ['Sky Sports Football', 'Premier Sports'],
    bundesliga:  ['Sky Sports Football', 'TNT Sports'],
    seriea:      ['TNT Sports 1', 'TNT Sports 2'],
    ligue1:      ['Sky Sports Football'],
    saudi:       ['Sky Sports'],
    liganos:     ['Premier Sports'],
    national:    ['ITV', 'BBC One'],
    euroleague:  ['TNT Sports'],
    eurocup:     ['TNT Sports'],
    bsl:         [],
    nba:         ['Sky Sports Arena', 'TNT Sports'],
    efeler:      [],
    sultansliga: [],
    tvfkadin:    [],
    f1:          ['Sky Sports F1'],
  },

  // ─── España ─────────────────────────────────────────────────────────────────
  ES: {
    superlig:    ['DAZN'],
    lig1:        ['DAZN'],
    champions:   ['Movistar+ Champions', 'DAZN'],
    europa:      ['DAZN', 'Movistar+'],
    conference:  ['DAZN'],
    premier:     ['DAZN', 'Movistar+'],
    laliga:      ['DAZN LaLiga', 'Movistar+ LaLiga'],
    bundesliga:  ['DAZN'],
    seriea:      ['DAZN', 'Movistar+'],
    ligue1:      ['DAZN'],
    saudi:       ['DAZN'],
    liganos:     ['DAZN'],
    national:    ['La 1 (RTVE)', 'Telecinco'],
    euroleague:  ['DAZN'],
    eurocup:     ['DAZN'],
    bsl:         [],
    nba:         ['Movistar+', 'DAZN'],
    efeler:      [],
    sultansliga: [],
    tvfkadin:    [],
    f1:          ['DAZN F1'],
  },

  // ─── Portugal ───────────────────────────────────────────────────────────────
  PT: {
    superlig:    ['Sport TV+'],
    lig1:        ['Sport TV+'],
    champions:   ['Sport TV 1', 'RTP 1'],
    europa:      ['Sport TV 1'],
    conference:  ['Sport TV 2'],
    premier:     ['Sport TV 1', 'Sport TV 2'],
    laliga:      ['Sport TV 3'],
    bundesliga:  ['Sport TV 4'],
    seriea:      ['Sport TV 2'],
    ligue1:      ['Sport TV 3'],
    saudi:       ['Sport TV'],
    liganos:     ['Sport TV 1', 'Sport TV 2'],
    national:    ['RTP 1', 'SIC'],
    euroleague:  ['Sport TV'],
    eurocup:     ['Sport TV'],
    bsl:         [],
    nba:         ['Sport TV'],
    efeler:      [],
    sultansliga: [],
    tvfkadin:    [],
    f1:          ['Canal+', 'Sport TV'],
  },

  // ─── France ─────────────────────────────────────────────────────────────────
  FR: {
    superlig:    ['beIN Sports 1'],
    lig1:        ['beIN Sports 1'],
    champions:   ['Canal+', 'M6', 'TF1'],
    europa:      ['Canal+', 'beIN Sports'],
    conference:  ['Canal+'],
    premier:     ['Canal+'],
    laliga:      ['Canal+', 'beIN Sports 1'],
    bundesliga:  ['Canal+', 'beIN Sports 1'],
    seriea:      ['Canal+', 'beIN Sports 1'],
    ligue1:      ['DAZN 1', 'DAZN 2', 'beIN Sports 1', 'Canal+'],
    saudi:       ['beIN Sports'],
    liganos:     ['Canal+'],
    national:    ['TF1', 'France 2'],
    euroleague:  ['beIN Sports'],
    eurocup:     ['beIN Sports'],
    bsl:         [],
    nba:         ['beIN Sports'],
    efeler:      [],
    sultansliga: [],
    tvfkadin:    [],
    f1:          ['Canal+'],
  },

  // ─── Deutschland ────────────────────────────────────────────────────────────
  DE: {
    superlig:    ['DAZN'],
    lig1:        ['DAZN'],
    champions:   ['DAZN', 'Amazon Prime', 'ZDF'],
    europa:      ['RTL', 'DAZN'],
    conference:  ['DAZN'],
    premier:     ['Sky Sport', 'DAZN'],
    laliga:      ['DAZN', 'Sky Sport'],
    bundesliga:  ['Sky Sport Bundesliga', 'DAZN', 'SAT.1'],
    seriea:      ['DAZN', 'Sky Sport'],
    ligue1:      ['DAZN'],
    saudi:       ['DAZN'],
    liganos:     ['DAZN'],
    national:    ['ARD', 'ZDF', 'RTL'],
    euroleague:  ['MagentaSport'],
    eurocup:     ['MagentaSport'],
    bsl:         [],
    nba:         ['Sky Sport'],
    efeler:      [],
    sultansliga: [],
    tvfkadin:    [],
    f1:          ['RTL', 'Sky Sport F1'],
  },

  // ─── Italia ─────────────────────────────────────────────────────────────────
  IT: {
    superlig:    ['Sky Sport', 'DAZN'],
    lig1:        ['DAZN'],
    champions:   ['Canale 5', 'Sky Sport', 'Amazon Prime'],
    europa:      ['Sky Sport', 'TV8'],
    conference:  ['Sky Sport', 'TV8'],
    premier:     ['Sky Sport Football'],
    laliga:      ['DAZN', 'Sky Sport'],
    bundesliga:  ['Sky Sport', 'DAZN'],
    seriea:      ['DAZN', 'Sky Sport Calcio'],
    ligue1:      ['Sky Sport', 'DAZN'],
    saudi:       ['DAZN'],
    liganos:     ['DAZN'],
    national:    ['RAI 1', 'RAI 2'],
    euroleague:  ['Sky Sport'],
    eurocup:     ['Sky Sport'],
    bsl:         [],
    nba:         ['Sky Sport'],
    efeler:      [],
    sultansliga: [],
    tvfkadin:    [],
    f1:          ['Sky Sport F1'],
  },

  // ─── Arapça / Orta Doğu (Suudi Arabistan) ───────────────────────────────────
  SA: {
    superlig:    ['beIN Sports Arabia 1'],
    lig1:        ['beIN Sports Arabia'],
    champions:   ['beIN Sports Arabia 1', 'beIN Sports Arabia HD 1'],
    europa:      ['beIN Sports Arabia 2'],
    conference:  ['beIN Sports Arabia 3'],
    premier:     ['beIN Sports Arabia 1', 'beIN Sports Arabia 2'],
    laliga:      ['beIN Sports Arabia 2', 'beIN Sports Arabia 3'],
    bundesliga:  ['beIN Sports Arabia 3'],
    seriea:      ['beIN Sports Arabia 2'],
    ligue1:      ['beIN Sports Arabia 4'],
    saudi:       ['SSC Sport 1', 'SSC Sport 2'],
    liganos:     ['beIN Sports Arabia'],
    national:    ['beIN Sports Arabia 1', 'MBC Sport 1'],
    euroleague:  ['beIN Sports Arabia'],
    eurocup:     ['beIN Sports Arabia'],
    bsl:         [],
    nba:         ['beIN Sports Arabia'],
    efeler:      [],
    sultansliga: [],
    tvfkadin:    [],
    f1:          ['beIN Sports Arabia'],
  },

  // ─── Brasil ─────────────────────────────────────────────────────────────────
  BR: {
    superlig:    ['ESPN', 'DAZN'],
    lig1:        [],
    champions:   ['SBT', 'TNT Sports', 'Max', 'ESPN'],
    europa:      ['ESPN', 'TNT Sports'],
    conference:  ['DAZN'],
    premier:     ['ESPN', 'Star+'],
    laliga:      ['ESPN', 'Star+'],
    bundesliga:  ['OneFootball', 'DAZN'],
    seriea:      ['ESPN', 'Star+'],
    ligue1:      ['CazéTV', 'DAZN'],
    saudi:       ['DAZN'],
    liganos:     [],
    national:    ['Globo', 'SporTV', 'Band'],
    brasileirao: ['Globo', 'SporTV', 'Cazé TV', 'Amazon Prime'],
    euroleague:  ['ESPN'],
    eurocup:     ['ESPN'],
    bsl:         [],
    nba:         ['ESPN', 'NBA League Pass', 'Max'],
    efeler:      [],
    sultansliga: [],
    tvfkadin:    [],
    f1:          ['Globo', 'Band', 'F1 TV'],
  },

  // ─── Argentina ──────────────────────────────────────────────────────────────
  AR: {
    superlig:    ['DirecTV Sports', 'ESPN'],
    lig1:        [],
    champions:   ['ESPN', 'Fox Sports', 'TNT Sports'],
    europa:      ['ESPN', 'Fox Sports'],
    conference:  ['ESPN'],
    premier:     ['ESPN', 'Star+'],
    laliga:      ['ESPN', 'Star+'],
    bundesliga:  ['DirecTV Sports', 'ESPN'],
    seriea:      ['ESPN', 'Star+'],
    ligue1:      ['ESPN', 'Star+'],
    saudi:       ['DirecTV Sports'],
    liganos:     [],
    national:    ['TyC Sports', 'TV Pública', 'Canal 9'],
    ligaprofesional: ['TNT Sports', 'ESPN', 'TyC Sports'],
    euroleague:  ['ESPN'],
    eurocup:     ['ESPN'],
    bsl:         [],
    nba:         ['NBA League Pass', 'ESPN', 'DirecTV Sports'],
    efeler:      [],
    sultansliga: [],
    tvfkadin:    [],
    f1:          ['ESPN', 'Fox Sports'],
  },

  // ─── México ─────────────────────────────────────────────────────────────────
  MX: {
    superlig:    ['DAZN', 'DirecTV Sports'],
    lig1:        [],
    champions:   ['HBO Max', 'TUDN', 'Canal 5'],
    europa:      ['TUDN', 'ESPN'],
    conference:  ['DAZN'],
    premier:     ['ESPN', 'Star+', 'Sky Sports'],
    laliga:      ['ESPN', 'Sky Sports'],
    bundesliga:  ['DAZN', 'Sky Sports'],
    seriea:      ['ESPN', 'Sky Sports'],
    ligue1:      ['DAZN'],
    saudi:       ['DAZN'],
    liganos:     [],
    national:    ['Azteca', 'TUDN', 'Canal 5'],
    ligamx:      ['TUDN', 'Fox Sports', 'Azteca Deportes', 'Canal 5'],
    euroleague:  ['ESPN'],
    eurocup:     ['ESPN'],
    bsl:         [],
    nba:         ['ESPN', 'NBA League Pass', 'Sky Sports'],
    efeler:      [],
    sultansliga: [],
    tvfkadin:    [],
    f1:          ['Sky Sports', 'ESPN', 'TUDN'],
  },

  // ─── Mısır ──────────────────────────────────────────────────────────────────
  EG: {
    superlig:    ['beIN Sports Arabia 1'],
    lig1:        [],
    champions:   ['beIN Sports Arabia 1', 'beIN Sports Arabia 2'],
    europa:      ['beIN Sports Arabia 2'],
    conference:  ['beIN Sports Arabia 3'],
    premier:     ['beIN Sports Arabia 1'],
    laliga:      ['beIN Sports Arabia 2'],
    bundesliga:  ['beIN Sports Arabia 3'],
    seriea:      ['beIN Sports Arabia 2'],
    ligue1:      ['beIN Sports Arabia 4'],
    saudi:       ['beIN Sports Arabia'],
    liganos:     ['beIN Sports Arabia'],
    national:    ['ON Sport', 'Al Kahera Wal Nas', 'CBC Sport'],
    premiereg:   ['ON Sport', 'beIN Sports Arabia'],
    euroleague:  ['beIN Sports Arabia'],
    eurocup:     [],
    bsl:         [],
    nba:         ['beIN Sports Arabia'],
    efeler:      [],
    sultansliga: [],
    tvfkadin:    [],
    f1:          ['beIN Sports Arabia'],
  },

  // ─── Nigeria ────────────────────────────────────────────────────────────────
  NG: {
    superlig:    ['SuperSport', 'DSTV'],
    lig1:        [],
    champions:   ['SuperSport', 'DSTV', 'CNN Sport'],
    europa:      ['SuperSport', 'DSTV'],
    conference:  ['SuperSport'],
    premier:     ['SuperSport Premier League', 'DSTV'],
    laliga:      ['SuperSport', 'DSTV'],
    bundesliga:  ['SuperSport', 'DSTV'],
    seriea:      ['SuperSport', 'DSTV'],
    ligue1:      ['SuperSport'],
    saudi:       ['SuperSport'],
    liganos:     [],
    national:    ['NTA Sports', 'SuperSport', 'Africa Magic'],
    euroleague:  ['SuperSport'],
    eurocup:     [],
    bsl:         [],
    nba:         ['SuperSport', 'DSTV'],
    efeler:      [],
    sultansliga: [],
    tvfkadin:    [],
    f1:          ['SuperSport', 'DSTV'],
  },

  // ─── Fas / Maroc ────────────────────────────────────────────────────────────
  MA: {
    superlig:    ['beIN Sports Arabia 1'],
    lig1:        [],
    champions:   ['beIN Sports Arabia 1', 'beIN Sports Arabia 2', '2M'],
    europa:      ['beIN Sports Arabia 2'],
    conference:  ['beIN Sports Arabia 3'],
    premier:     ['beIN Sports Arabia 1', 'Canal+'],
    laliga:      ['beIN Sports Arabia 2', 'Canal+'],
    bundesliga:  ['beIN Sports Arabia 3'],
    seriea:      ['beIN Sports Arabia 2'],
    ligue1:      ['beIN Sports Arabia 4', 'Canal+'],
    saudi:       ['beIN Sports Arabia'],
    liganos:     [],
    national:    ['2M', 'Arryadia', 'Al Aoula'],
    euroleague:  ['beIN Sports Arabia'],
    eurocup:     [],
    bsl:         [],
    nba:         ['beIN Sports Arabia'],
    efeler:      [],
    sultansliga: [],
    tvfkadin:    [],
    f1:          ['beIN Sports Arabia', 'Canal+'],
  },

  // ─── Sénégal ────────────────────────────────────────────────────────────────
  SN: {
    superlig:    ['Canal+ Afrique'],
    lig1:        [],
    champions:   ['Canal+ Afrique', 'RTS'],
    europa:      ['Canal+ Afrique'],
    conference:  ['Canal+ Afrique'],
    premier:     ['Canal+ Afrique'],
    laliga:      ['Canal+ Afrique'],
    bundesliga:  ['Canal+ Afrique'],
    seriea:      ['Canal+ Afrique'],
    ligue1:      ['Canal+ Afrique'],
    saudi:       ['Canal+ Afrique'],
    liganos:     [],
    national:    ['RTS', 'TFM', 'Canal+ Afrique'],
    euroleague:  ['Canal+ Afrique'],
    eurocup:     [],
    bsl:         [],
    nba:         ['Canal+ Afrique'],
    efeler:      [],
    sultansliga: [],
    tvfkadin:    [],
    f1:          ['Canal+ Afrique'],
  },
};

export function getChannelForCountry(
  countryCode: string,
  leagueId: string,
  homeTeamId?: string,
): string {
  const countryMap = COUNTRY_CHANNEL_MAP[countryCode] ?? COUNTRY_CHANNEL_MAP['TR'];
  const channels = countryMap[leagueId] ?? [];

  // Türkiye Süper Lig rotasyonu
  if (leagueId === 'superlig' && countryCode === 'TR') {
    if (homeTeamId === 'galatasaray' || homeTeamId === 'fenerbahce') return 'beIN Sports 1';
    if (homeTeamId === 'besiktas' || homeTeamId === 'trabzonspor') return 'beIN Sports 2';
    const freeTeams = ['adanademirspor', 'gaziantepfk', 'eyupspor', 'rizespor',
                       'sivasspor', 'kayserispor', 'ankaragucu'];
    if (homeTeamId && freeTeams.includes(homeTeamId)) return 'TV8';
  }

  return channels[0] ?? '';
}

export function getAllChannelsForCountry(countryCode: string, leagueId: string): string[] {
  const countryMap = COUNTRY_CHANNEL_MAP[countryCode] ?? COUNTRY_CHANNEL_MAP['TR'];
  return countryMap[leagueId] ?? [];
}

export function guessCountryFromLanguage(langCode: string): string {
  const map: Record<string, string> = {
    tr: 'TR',
    en: 'GB',
    es: 'ES',
    pt: 'PT',
    fr: 'FR',
    de: 'DE',
    it: 'IT',
    ar: 'SA',
    // Bölgesel dil etiketleri
    'pt-BR': 'BR',
    'es-AR': 'AR',
    'es-MX': 'MX',
    'ar-EG': 'EG',
    'ar-MA': 'MA',
    'fr-SN': 'SN',
    'en-NG': 'NG',
  };
  return map[langCode] ?? map[langCode.split('-')[0]] ?? 'TR';
}

export function getLanguageForCountry(countryCode: string): string {
  return SUPPORTED_COUNTRIES.find((c) => c.code === countryCode)?.language ?? 'tr';
}

export function getTimezoneForCountry(countryCode: string): string {
  return SUPPORTED_COUNTRIES.find((c) => c.code === countryCode)?.timezone ?? 'Europe/Istanbul';
}
