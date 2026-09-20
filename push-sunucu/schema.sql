-- Mac Hatirlatici push sunucusu — D1 semasi
-- Uygula: npx wrangler d1 execute mac-hatirlatici-push --remote --file=schema.sql

CREATE TABLE IF NOT EXISTS aboneler (
  token      TEXT PRIMARY KEY,      -- ExponentPushToken[...]
  dil        TEXT NOT NULL,
  ulke       TEXT NOT NULL,         -- uygulamanin listeyi kurdugu ulke (kanal secimi)
  tz         TEXT NOT NULL,         -- bildirimdeki saat bu dilimde yazilir
  platform   TEXT NOT NULL,
  -- Bildirim istenen spor dallari (JSON dizi). NULL/bos = hepsi; eski kayitlar boyle.
  dallar     TEXT,
  guncelleme INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS abone_takim (
  token TEXT NOT NULL,
  takim TEXT NOT NULL,              -- UYGULAMA takim kimligi (fenerbahce, mancity...)
  PRIMARY KEY (token, takim)
);
CREATE INDEX IF NOT EXISTS idx_abone_takim_takim ON abone_takim(takim);

CREATE TABLE IF NOT EXISTS plan (
  mac_id   TEXT PRIMARY KEY,
  kickoff  INTEGER NOT NULL,        -- ms, UTC
  takimlar TEXT NOT NULL,           -- JSON: bu maci takip edebilecek uygulama kimlikleri
  veri     TEXT NOT NULL            -- JSON: bildirim metni icin gereken alanlar
);
CREATE INDEX IF NOT EXISTS idx_plan_kickoff ON plan(kickoff);

-- Sabah ozeti gunde bir kez gitsin (gun = abonenin YEREL tarihi, YYYY-MM-DD)
CREATE TABLE IF NOT EXISTS gunluk_ozet (
  token TEXT NOT NULL,
  gun   TEXT NOT NULL,
  ts    INTEGER NOT NULL,
  PRIMARY KEY (token, gun)
);

-- Ayni maci ayni cihaza iki kez gondermemek icin
CREATE TABLE IF NOT EXISTS gonderilen (
  mac_id TEXT NOT NULL,
  token  TEXT NOT NULL,
  ts     INTEGER NOT NULL,
  PRIMARY KEY (mac_id, token)
);
