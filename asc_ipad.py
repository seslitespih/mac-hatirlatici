"""
iPad screenshot uploader - APP_IPAD_PRO_3GEN_129
"""
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

import jwt, time, requests, hashlib, base64
from pathlib import Path

KEY_ID    = "4V8WB44R99"
ISSUER_ID = "c62db938-88be-40a4-94d5-0542ba1512ff"
KEY_FILE  = Path(r"C:\Users\ESAT\Downloads\AuthKey_4V8WB44R99.p8")
IPAD_DIR  = Path(__file__).parent / "screenshots_ipad"
LOC_ID    = "4150988e-84a4-4319-967b-094d7949692d"
SET_ID    = "2cd20982-ca87-490f-af2f-15e14354cb81"   # onceki adimda olusturuldu
BASE      = "https://api.appstoreconnect.apple.com/v1"

private_key = KEY_FILE.read_bytes().decode("utf-8").replace("\r\n", "\n").replace("\r", "\n")
now = int(time.time())
token = jwt.encode(
    {"iss": ISSUER_ID, "iat": now, "exp": now + 1100, "aud": "appstoreconnect-v1"},
    private_key, algorithm="ES256", headers={"kid": KEY_ID}
)
HDR = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

files = sorted(IPAD_DIR.glob("ipad_*.png"))
print(f"Bulunan dosyalar: {len(files)}")
for p in files:
    print(f"  {p.name}")

print()
for i, p in enumerate(files, 1):
    size = p.stat().st_size
    raw  = p.read_bytes()
    md5  = base64.b64encode(hashlib.md5(raw).digest()).decode()
    print(f"[{i}/{len(files)}] {p.name} ({size//1024} KB)...", flush=True)

    res = requests.post(f"{BASE}/appScreenshots", headers=HDR, json={
        "data": {
            "type": "appScreenshots",
            "attributes": {"fileName": p.name, "fileSize": size},
            "relationships": {
                "appScreenshotSet": {"data": {"type": "appScreenshotSets", "id": SET_ID}}
            },
        }
    })
    if not res.ok:
        print(f"  HATA reserve: {res.status_code} {res.text[:300]}")
        continue

    d     = res.json()["data"]
    ss_id = d["id"]
    ops   = d["attributes"]["uploadOperations"]

    for op in ops:
        chunk = raw[op["offset"]: op["offset"] + op["length"]]
        rh    = {h["name"]: h["value"] for h in op["requestHeaders"]}
        requests.request(op["method"], op["url"], headers=rh, data=chunk).raise_for_status()

    patch = requests.patch(f"{BASE}/appScreenshots/{ss_id}", headers=HDR, json={
        "data": {
            "type": "appScreenshots",
            "id": ss_id,
            "attributes": {"uploaded": True, "sourceFileChecksum": md5},
        }
    })
    if patch.ok:
        print("  OK")
    else:
        print(f"  HATA commit: {patch.status_code} {patch.text[:200]}")

print("\nTamamlandi!")
