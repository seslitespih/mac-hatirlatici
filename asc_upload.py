"""
App Store Connect API - metadata + screenshot uploader
Bundle: com.machatirlatici.app
"""
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

import jwt, time, json, os, hashlib, math, requests
from pathlib import Path

# ── Kimlik bilgileri ──────────────────────────────────────────────────────────
KEY_ID    = "4V8WB44R99"
ISSUER_ID = "c62db938-88be-40a4-94d5-0542ba1512ff"
KEY_FILE  = r"C:\Users\ESAT\Downloads\AuthKey_4V8WB44R99.p8"
BUNDLE_ID = "com.machatirlatici.app"

SCREENSHOTS_DIR = Path(r"C:\Users\ESAT\Desktop\Kişisel Belgeler\maç hatırlatıcı\screenshots_ios")

# ── App Store metadata (EN) ───────────────────────────────────────────────────
METADATA = {
    "description": (
        "Match Reminder is your ultimate sports TV guide for Turkey — showing you exactly "
        "which channel broadcasts each match, so you never miss a game.\n\n"
        "WHAT'S ON TV TODAY?\n"
        "Instantly see today's football, basketball, volleyball, and motorsport matches "
        "along with their broadcast channels. No more channel surfing!\n\n"
        "KEY FEATURES\n"
        "• Full match schedule organized by sport and league\n"
        "• Broadcast channel for every match (beIN Sports, TRT, EXXEN, S Sport, A Spor & more)\n"
        "• Match reminders — get notified before kickoff\n"
        "• Covers Süper Lig, Champions League, NBA, Formula 1, and much more\n\n"
        "SPORTS COVERED\n"
        "- Football — Super Lig, UEFA Champions League, Premier League, La Liga\n"
        "- Basketball — BSL, EuroLeague, NBA\n"
        "- Volleyball — Efeler Ligi\n"
        "- Motorsport — Formula 1, MotoGP\n\n"
        "PREMIUM\n"
        "Upgrade to Premium for unlimited reminders and an ad-free experience. $2.99/month."
    ),
    "keywords":        "football,tv guide,sports,match,channel,basketball,soccer,reminder,schedule,live,süper lig",
    "promotionalText": "Never miss a match! See which TV channel broadcasts each game — football, basketball, volleyball & more. Set reminders & get notified!",
    "supportUrl":      "https://seslitespih.github.io/mac-hatirlatici/",
    "marketingUrl":    "",
}

# ── JWT ───────────────────────────────────────────────────────────────────────
def make_token() -> str:
    with open(KEY_FILE, "rb") as f:
        private_key = f.read().decode("utf-8").replace("\r\n", "\n").replace("\r", "\n")
    now = int(time.time())
    payload = {
        "iss": ISSUER_ID,
        "iat": now,
        "exp": now + 1100,
        "aud": "appstoreconnect-v1",
    }
    return jwt.encode(payload, private_key, algorithm="ES256",
                      headers={"kid": KEY_ID})

# Tek token — tüm requestlerde kullan
_TOKEN = make_token()
_TOKEN_CREATED = time.time()

def headers() -> dict:
    global _TOKEN, _TOKEN_CREATED
    if time.time() - _TOKEN_CREATED > 900:   # 15 dk geçtiyse yenile
        _TOKEN = make_token()
        _TOKEN_CREATED = time.time()
    return {"Authorization": f"Bearer {_TOKEN}", "Content-Type": "application/json"}

BASE = "https://api.appstoreconnect.apple.com/v1"

def get(path, params=None):
    r = requests.get(f"{BASE}{path}", headers=headers(), params=params)
    r.raise_for_status()
    return r.json()

def post(path, body):
    r = requests.post(f"{BASE}{path}", headers=headers(), json=body)
    if not r.ok:
        print("POST error:", r.status_code, r.text)
    r.raise_for_status()
    return r.json()

def patch(path, body):
    r = requests.patch(f"{BASE}{path}", headers=headers(), json=body)
    if not r.ok:
        print("PATCH error:", r.status_code, r.text)
    r.raise_for_status()
    return r.json()

# ── 1. App ID al ─────────────────────────────────────────────────────────────
print("▶ App aranıyor...")
apps = get("/apps", {"filter[bundleId]": BUNDLE_ID})
app_id = apps["data"][0]["id"]
print(f"  App ID: {app_id}")

# ── 2. En son iOS versiyonu al ────────────────────────────────────────────────
print("▶ App Store versiyonu aranıyor...")
versions = get(f"/apps/{app_id}/appStoreVersions",
               {"filter[platform]": "IOS"})
version = versions["data"][0]
version_id = version["id"]
version_state = version["attributes"]["appStoreState"]
print(f"  Version ID: {version_id} | State: {version_state}")

# ── 3. Localization al (en-US) ────────────────────────────────────────────────
print("▶ Localization aranıyor (en-US)...")
locs = get(f"/appStoreVersions/{version_id}/appStoreVersionLocalizations")
loc = next((d for d in locs["data"] if d["attributes"]["locale"] == "en-US"), None)
if not loc:
    # en-US yoksa ilk locale'ı kullan
    loc = locs["data"][0]
loc_id = loc["id"]
print(f"  Locale: {loc['attributes']['locale']} | ID: {loc_id}")

# ── 4. Metadata güncelle ──────────────────────────────────────────────────────
print("▶ Metadata güncelleniyor...")
body = {
    "data": {
        "type": "appStoreVersionLocalizations",
        "id": loc_id,
        "attributes": {
            "description":     METADATA["description"],
            "keywords":        METADATA["keywords"],
            "promotionalText": METADATA["promotionalText"],
            "supportUrl":      METADATA["supportUrl"],
        },
    }
}
if METADATA["marketingUrl"]:
    body["data"]["attributes"]["marketingUrl"] = METADATA["marketingUrl"]

patch(f"/appStoreVersionLocalizations/{loc_id}", body)
print("  ✓ Metadata güncellendi")

# ── 5. App Info (copyright) ───────────────────────────────────────────────────
print("▶ Copyright güncelleniyor...")
infos = get(f"/apps/{app_id}/appInfos")
info_id = infos["data"][0]["id"]
info_locs = get(f"/appInfos/{info_id}/appInfoLocalizations")
info_loc = next((d for d in info_locs["data"] if d["attributes"]["locale"] == "en-US"),
                info_locs["data"][0])
info_loc_id = info_loc["id"]
patch(f"/appInfoLocalizations/{info_loc_id}", {
    "data": {
        "type": "appInfoLocalizations",
        "id": info_loc_id,
        "attributes": {"privacyPolicyUrl": "https://seslitespih.github.io/mac-hatirlatici/privacy.html"},
    }
})
# Copyright version-level alanda
patch(f"/appStoreVersions/{version_id}", {
    "data": {
        "type": "appStoreVersions",
        "id": version_id,
        "attributes": {"copyright": "2026 Muhammet Esat Sağlam"},
    }
})
print("  ✓ Copyright güncellendi")

# ── 6. Screenshot'ları yükle ─────────────────────────────────────────────────
print("▶ Screenshot setleri kontrol ediliyor...")
ss_sets = get(f"/appStoreVersionLocalizations/{loc_id}/appScreenshotSets")
existing = {d["attributes"]["screenshotDisplayType"]: d["id"] for d in ss_sets["data"]}
print(f"  Mevcut setler: {list(existing.keys())}")

DISPLAY_TYPE = "APP_IPHONE_65"

if DISPLAY_TYPE in existing:
    set_id = existing[DISPLAY_TYPE]
    print(f"  Set mevcut: {set_id}")
else:
    print(f"  {DISPLAY_TYPE} seti oluşturuluyor...")
    new_set = post("/appScreenshotSets", {
        "data": {
            "type": "appScreenshotSets",
            "attributes": {"screenshotDisplayType": DISPLAY_TYPE},
            "relationships": {
                "appStoreVersionLocalization": {
                    "data": {"type": "appStoreVersionLocalizations", "id": loc_id}
                }
            },
        }
    })
    set_id = new_set["data"]["id"]
    print(f"  ✓ Set oluşturuldu: {set_id}")

png_files = sorted(SCREENSHOTS_DIR.glob("screenshot_*.png"))
print(f"\n▶ {len(png_files)} screenshot yüklenecek...")

for i, png_path in enumerate(png_files, 1):
    file_size = png_path.stat().st_size
    md5 = hashlib.md5(png_path.read_bytes()).digest()
    import base64
    md5_b64 = base64.b64encode(md5).decode()

    print(f"  [{i}/{len(png_files)}] {png_path.name} ({file_size//1024} KB)...")

    # Reserve
    reserve = post("/appScreenshots", {
        "data": {
            "type": "appScreenshots",
            "attributes": {
                "fileName": png_path.name,
                "fileSize": file_size,
            },
            "relationships": {
                "appScreenshotSet": {
                    "data": {"type": "appScreenshotSets", "id": set_id}
                }
            },
        }
    })
    ss_id = reserve["data"]["id"]
    ops = reserve["data"]["attributes"]["uploadOperations"]

    # Upload chunks
    data = png_path.read_bytes()
    for op in ops:
        url    = op["url"]
        method = op["method"]
        offset = op["offset"]
        length = op["length"]
        chunk  = data[offset: offset + length]
        req_headers = {h["name"]: h["value"] for h in op["requestHeaders"]}
        upload_r = requests.request(method, url, headers=req_headers, data=chunk)
        upload_r.raise_for_status()

    # Commit
    patch(f"/appScreenshots/{ss_id}", {
        "data": {
            "type": "appScreenshots",
            "id": ss_id,
            "attributes": {
                "uploaded": True,
                "sourceFileChecksum": md5_b64,
            },
        }
    })
    print(f"    ✓ Yüklendi")

print("\n✅ Tüm işlemler tamamlandı!")
print("App Store Connect → iOS App 1.0 sayfasını kontrol et.")
