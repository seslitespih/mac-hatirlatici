#!/usr/bin/env python3
"""
scrape_channels.py
19 ulke icin futbol maci -> TV kanali eslestirmesi.
UTC 05:00 ve 14:00'de calisir, assets/channels-daily.json uretir.
"""

import requests
from bs4 import BeautifulSoup
import json, re, sys
from datetime import datetime, timezone, date

try:
    import schedule, time as _time
    HAS_SCHEDULE = True
except ImportError:
    HAS_SCHEDULE = False

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/125.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
}
OUTPUT_FILE = "assets/channels-daily.json"


def get_soup(url, encoding=None):
    try:
        r = requests.get(url, headers=HEADERS, timeout=15)
        r.raise_for_status()
        if encoding:
            r.encoding = encoding
        return BeautifulSoup(r.text, "html.parser")
    except Exception as e:
        print(f"  [ERR] {url}: {e}")
        return None


def split_match(match_str: str) -> tuple:
    """'Team A - Team B' -> ('Team A', 'Team B')"""
    for sep in [" - ", " x ", " vs ", " gegen ", " v ", " × ", " – "]:
        if sep in match_str:
            parts = match_str.split(sep, 1)
            return parts[0].strip(), parts[1].strip()
    m = re.match(r"^(.+?)\s+(?:vs?\.?|x)\s+(.+)$", match_str, re.IGNORECASE)
    if m:
        return m.group(1).strip(), m.group(2).strip()
    return match_str.strip(), ""


# ─── Global result ────────────────────────────────────────────────────────────

result: dict = {}

def add(cc: str, date_str: str, time_str: str, match_str: str, channels: list):
    home, away = split_match(match_str)
    if not home:
        return
    channels = [str(c).strip() for c in channels if c and str(c).strip()]
    result.setdefault(cc, {}).setdefault(date_str, []).append({
        "home": home, "away": away,
        "channels": channels, "time": (time_str or "").strip(),
    })


# ─── BRAZIL: futebolnatv.com.br ───────────────────────────────────────────────

def scrape_BR(today: str):
    soup = get_soup("https://www.futebolnatv.com.br/")
    if not soup:
        return
    for card in soup.select("a.link"):
        time_el = card.select_one("div.time-slot")
        channels_el = card.select_one("p")
        teams = [t.get_text(strip=True) for t in card.select("span") if t.get_text(strip=True)]
        if not (time_el and channels_el and len(teams) >= 2):
            continue
        add("BR", today, time_el.get_text(strip=True),
            f"{teams[0]} x {teams[1]}", channels_el.get_text().split())


# ─── LATAM family: AR / MX / CO / CL / UY / PE ───────────────────────────────

def scrape_latam(cc: str, url: str, today: str):
    soup = get_soup(url)
    if not soup:
        return
    for p in soup.select("div.partido"):
        hora = p.select_one("div.hora")
        local = p.select_one("div.equipo-local a") or p.select_one("div.equipo-local span")
        visit = p.select_one("div.equipo-visitante a") or p.select_one("div.equipo-visitante span")
        canales = [c.get_text(strip=True) for c in p.select("div.canales a") if c.get_text(strip=True)]
        if not (hora and local and visit):
            continue
        add(cc, today, hora.get_text(strip=True),
            f"{local.get_text(strip=True)} - {visit.get_text(strip=True)}", canales)


# ─── SPAIN: futbolenlatv.es ───────────────────────────────────────────────────

def scrape_ES(today: str):
    soup = get_soup("https://www.futbolenlatv.es/")
    if not soup:
        return
    for row in soup.select("tr, div.partido, article"):
        equipos = row.select("a[href*='/equipo/']")
        canales = row.select("a[href*='/canal/']")
        time_el = row.select_one("time")
        if not time_el:
            text = row.get_text()
            m = re.search(r"\b(\d{2}:\d{2})\b", text)
            if not m:
                continue
            hora = m.group(1)
        else:
            hora = time_el.get_text(strip=True)
        if len(equipos) < 2 or not canales:
            continue
        add("ES", today, hora,
            f"{equipos[0].get_text(strip=True)} - {equipos[1].get_text(strip=True)}",
            [c.get_text(strip=True) for c in canales])


# ─── PORTUGAL: ondebola.com ───────────────────────────────────────────────────

def scrape_PT(today: str):
    soup = get_soup("https://ondebola.com/")
    if not soup:
        return
    for row in soup.select("table tr"):
        cols = row.select("td")
        if len(cols) < 3:
            continue
        time_m = re.search(r"\d{2}:\d{2}", cols[0].get_text())
        if not time_m:
            continue
        match_text = cols[1].get_text(" ", strip=True)
        channels = [a.get_text(strip=True) for a in cols[2].select("a") if a.get_text(strip=True)]
        if match_text and channels:
            add("PT", today, time_m.group(), match_text, channels)


# ─── FRANCE: programmefoot.com/cesoir ────────────────────────────────────────

def scrape_FR(today: str):
    soup = get_soup("https://www.programmefoot.com/cesoir")
    if not soup:
        return
    for row in soup.select("table tr"):
        cols = row.select("td")
        if len(cols) < 3:
            continue
        time_m = re.search(r"\d{2}:\d{2}", cols[0].get_text())
        if not time_m:
            continue
        match_text = cols[1].get_text(" ", strip=True)
        channels = []
        for el in cols[-1].select("img, a"):
            name = el.get("alt") or el.get_text(strip=True)
            if name and name not in channels:
                channels.append(name)
        if match_text and channels:
            add("FR", today, time_m.group(), match_text, channels)


# ─── GERMANY: sport.de/fussball/heute-live/ ──────────────────────────────────

KNOWN_DE_CHANNELS = ["DAZN", "ARD", "ZDF", "RTL", "RTL+", "MagentaTV", "SPORT1", "Sky", "Sat.1"]

def scrape_DE(today: str):
    soup = get_soup("https://www.sport.de/fussball/heute-live/")
    if not soup:
        return
    seen = set()
    for a in soup.select("a[href*='/fussball/']"):
        text = a.get_text(strip=True)
        if " vs " not in text and " - " not in text and " gegen " not in text:
            continue
        if text in seen:
            continue
        seen.add(text)
        parent = a.find_parent()
        channels = []
        if parent:
            for link in parent.select("a"):
                lt = link.get_text(strip=True)
                for ch in KNOWN_DE_CHANNELS:
                    if ch.lower() in lt.lower() and lt not in channels:
                        channels.append(lt)
                        break
        parent_text = parent.get_text(" ") if parent else ""
        time_m = re.search(r"\b(\d{2}:\d{2})\b", parent_text)
        if channels:
            add("DE", today, time_m.group(1) if time_m else "", text, channels)


# ─── UNITED KINGDOM: wheresthematch.com ──────────────────────────────────────

def scrape_GB(today: str):
    soup = get_soup("https://www.wheresthematch.com/live-football-on-tv/")
    if not soup:
        return
    SKIP = {"football", "logo", "mobile play", "mobile-play", ""}
    for row in soup.select("div.match-row, tr.match, div.fixture, li.match"):
        time_el = row.select_one("strong, span.time, td.time")
        team_link = row.select_one("a[href*='/match/'], a[href*='/Football/']")
        channels = []
        for img in row.select("img"):
            alt = (img.get("alt") or "").strip().lower()
            src = img.get("src", "")
            if alt and alt not in SKIP:
                channels.append(img.get("alt").strip())
            elif src:
                name = re.sub(r"\.(gif|png|jpg)$", "", src.split("/")[-1])
                name = re.sub(r"^sm_", "", name).replace("_", " ").title()
                if name.lower() not in SKIP:
                    channels.append(name)
        if time_el and team_link and channels:
            add("GB", today, time_el.get_text(strip=True),
                team_link.get_text(strip=True), list(dict.fromkeys(channels)))


# ─── ITALY: calcionews24.com ─────────────────────────────────────────────────

IT_CHANNELS = r"(DAZN|RAI\s*\d*|Sky\s*Sport\s*\d*|Mediaset|Sportitalia|Amazon\s*Prime|Eurosport\s*\d*|Rai\s*\d*)"

def scrape_IT(today: str):
    soup = get_soup(
        "https://www.calcionews24.com/guida-tv-le-partite-di-oggi-in-diretta-calendario-e-orari/"
    )
    if not soup:
        return
    content = soup.get_text("\n")
    pattern = re.compile(r"(\d{2}[:.]\d{2})\s+(.+?)\s+[–\-]\s+" + IT_CHANNELS, re.IGNORECASE)
    for m in pattern.finditer(content):
        hora = m.group(1).replace(".", ":")
        match_name = m.group(2).strip()
        channels_raw = content[m.start(3):].split("\n")[0]
        channels = [c.strip() for c in re.split(r"\s+e\s+|,\s*|/", channels_raw) if c.strip()]
        add("IT", today, hora, match_name, channels or [m.group(3)])


# ─── SWEDEN: tvmatchen.nu/fotboll ────────────────────────────────────────────

def scrape_SE(today: str):
    soup = get_soup("https://www.tvmatchen.nu/fotboll")
    if not soup:
        return
    for match_a in soup.select("a[href*='/match/']"):
        text = match_a.get_text(" ", strip=True)
        time_m = re.search(r"\b(\d{2}:\d{2})\b", text)
        if not time_m:
            continue
        channels = []
        nxt = match_a.find_next_sibling()
        for _ in range(5):
            if not nxt:
                break
            if hasattr(nxt, "select"):
                for ca in nxt.select("a[href*='channel=']"):
                    ch_m = re.search(r"channel=([^&]+)", ca.get("href", ""))
                    if ch_m:
                        name = ch_m.group(1).replace("_tvmatchen", "").replace("_", " ").title()
                        channels.append(name)
            nxt = nxt.find_next_sibling()
        if channels:
            match_name = re.sub(r"\d{2}:\d{2}", "", text).strip()
            add("SE", today, time_m.group(1), match_name, channels)


# ─── USA: worldsoccertalk.com ────────────────────────────────────────────────

def scrape_US(today: str):
    soup = get_soup("https://worldsoccertalk.com/upcoming-matches/")
    if not soup:
        return
    for h4 in soup.select("h4"):
        match_text = h4.get_text(strip=True)
        if not match_text:
            continue
        channels = []
        sib = h4.find_next_sibling()
        for _ in range(6):
            if not sib:
                break
            if hasattr(sib, "select"):
                for a in sib.select("a"):
                    t = a.get_text(strip=True)
                    if t and t not in channels:
                        channels.append(t)
                if channels:
                    break
            sib = sib.find_next_sibling()
        if not channels:
            continue
        parent = h4.find_parent()
        time_text = ""
        if parent:
            tm = re.search(r"\d{1,2}:\d{2}\s*(?:AM|PM)\s*ET", parent.get_text())
            if tm:
                time_text = tm.group()
        add("US", today, time_text, match_text, channels)


# ─── AUSTRALIA: ausportguide.com ─────────────────────────────────────────────

def scrape_AU(today: str):
    soup = get_soup("https://ausportguide.com/live-sports-tv-guide/soccer")
    if not soup:
        return
    for row in soup.select("tr"):
        cols = row.select("td")
        if len(cols) < 3:
            continue
        time_m = re.search(r"\d{1,2}:\d{2}", cols[0].get_text())
        if not time_m:
            continue
        match_text = cols[1].get_text(" ", strip=True)
        channels = [a.get_text(strip=True) for a in cols[2].select("a, strong, span") if a.get_text(strip=True)]
        if match_text and channels:
            add("AU", today, time_m.group(), match_text, channels)


# ─── SOUTH AFRICA: sabcsport.com ─────────────────────────────────────────────

FOOTBALL_KEYWORDS = {"football", "soccer", "world cup", "psl", "premier league", "copa"}

def scrape_ZA(today: str):
    soup = get_soup("https://www.sabcsport.com/tv/tv-schedule")
    if not soup:
        return
    for row in soup.select("tr, div.schedule-item, li"):
        text = row.get_text(" ", strip=True).lower()
        if not any(k in text for k in FOOTBALL_KEYWORDS):
            continue
        time_m = re.search(r"\b(\d{2}:\d{2})\b", text)
        if not time_m:
            continue
        add("ZA", today, time_m.group(1), row.get_text(" ", strip=True)[:80], ["SABC Sport"])


# ─── MOROCCO: tv-sports.fr/foot/maroc/ ───────────────────────────────────────

def scrape_MA(today: str):
    soup = get_soup("https://tv-sports.fr/foot/maroc/")
    if not soup:
        return
    for row in soup.select("tr"):
        cols = row.select("td")
        if len(cols) < 3:
            continue
        time_m = re.search(r"\d{2}:\d{2}", cols[0].get_text())
        if not time_m:
            continue
        match_text = cols[1].get_text(" ", strip=True)
        channels = []
        for el in cols[2].select("img, a, span"):
            name = el.get("alt") or el.get_text(strip=True)
            if name and name not in channels:
                channels.append(name)
        if match_text and channels:
            add("MA", today, time_m.group(), match_text, channels)


# ─── TURKEY: hangikanalda.app JSON API ────────────────────────────────────────
# Not: hangikanalda.app'in ana sayfa HTML'i degisti, eski CSS-selector tabanli
# scrape her gun 0 mac buluyordu (bkz. GH Actions loglari, 18-22 Tem 2026).
# Site zaten yapisal veriyi /api/proxy/matches ile sunuyor — dogrudan onu kullan.
# Tum sporlari kapsar (futbol, basketbol, voleybol, motor), lig bazli filtre yok.

def scrape_TR(today: str):
    try:
        r = requests.get("https://hangikanalda.app/api/proxy/matches",
                          headers=HEADERS, timeout=15)
        r.raise_for_status()
        data = r.json()
    except Exception as e:
        print(f"  [ERR] hangikanalda.app API: {e}")
        return

    for sport_data in data.values():
        for league in sport_data.get("leagues", []):
            for m in league.get("matches", []):
                home = (m.get("home") or "").strip()
                away = (m.get("away") or "").strip()
                channels = m.get("channels") or []
                time_str = m.get("time") or ""
                if not home or not channels:
                    continue
                add("TR", today, time_str, f"{home} - {away}", channels)


# ─── Runner ───────────────────────────────────────────────────────────────────

SCRAPERS = {
    "TR": scrape_TR,
    "GB": scrape_GB,
    "DE": scrape_DE,
    "FR": scrape_FR,
    "ES": scrape_ES,
    "PT": scrape_PT,
    "IT": scrape_IT,
    "SE": scrape_SE,
    "BR": scrape_BR,
    "AR": lambda d: scrape_latam("AR", "https://www.futbolenvivoargentina.com/", d),
    "MX": lambda d: scrape_latam("MX", "https://www.futbolenvivomexico.com/", d),
    "CO": lambda d: scrape_latam("CO", "https://www.futbolenvivocolombia.com/", d),
    "CL": lambda d: scrape_latam("CL", "https://www.futbolenvivochile.com/", d),
    "UY": lambda d: scrape_latam("UY", "https://www.futbolenvivouruguay.com/", d),
    "PE": lambda d: scrape_latam("PE", "https://www.futbolenvivoperu.com/", d),
    "US": scrape_US,
    "AU": scrape_AU,
    "ZA": scrape_ZA,
    "MA": scrape_MA,
}


def run_all():
    global result
    today = date.today().isoformat()
    now   = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    result = {}

    print(f"Run: {now}")
    for code, fn in SCRAPERS.items():
        print(f"  [{code}]", end=" ", flush=True)
        try:
            fn(today)
            count = len(result.get(code, {}).get(today, []))
            print(f"{count} matches")
        except Exception as e:
            print(f"ERROR: {e}")
            result.setdefault(code, {})

    output = {"generated_at": now, "data": result}
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    total = sum(len(v) for cc in result.values() for v in cc.values())
    print(f"Done: {total} matches -> {OUTPUT_FILE}")


if __name__ == "__main__":
    if "--once" in sys.argv or not HAS_SCHEDULE:
        run_all()
    else:
        import schedule, time as _time
        schedule.every().day.at("05:00").do(run_all)
        schedule.every().day.at("14:00").do(run_all)
        run_all()
        while True:
            schedule.run_pending()
            _time.sleep(30)
