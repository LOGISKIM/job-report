"""대시보드를 암호화된 정적 HTML로 내보내기 (공개 저장소 게시용).

- 이번 달 + 지난 달 대시보드를 렌더링해 JSON으로 묶고
  AES-256-GCM(PBKDF2 20만회)으로 암호화한 뒤 뷰어 페이지(index.html)에 심는다.
- 게시된 파일에는 암호문만 들어가므로 공개 저장소에 올려도 내용이 노출되지 않는다.
- 뷰어는 비밀번호를 localStorage에 저장해 한 번 입력하면 다음부터 바로 열린다.

사용:
  pip install cryptography
  (이 폴더에 pass.txt 생성 — 가족과 공유할 비밀번호 한 줄, git에는 올라가지 않음)
  python publish_static.py
"""

from __future__ import annotations

import base64
import json
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path

import dashboard

OUT = Path(__file__).parent / "index.html"
PASS_FILE = Path(__file__).parent / "pass.txt"
PBKDF2_ITERS = 200_000


def load_password() -> str:
    pw = os.environ.get("LEDGER_PUBLISH_PASS", "")
    if not pw and PASS_FILE.exists():
        pw = PASS_FILE.read_text(encoding="utf-8").strip()
    if not pw:
        sys.exit("비밀번호가 없습니다. ledger/pass.txt 에 비밀번호 한 줄을 넣거나 "
                 "LEDGER_PUBLISH_PASS 환경변수를 설정하세요.")
    return pw


def encrypt(plaintext: bytes, password: str) -> str:
    try:
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM
        from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
        from cryptography.hazmat.primitives import hashes
    except ImportError:
        sys.exit("cryptography 패키지가 필요합니다: pip install cryptography")

    salt = os.urandom(16)
    iv = os.urandom(12)
    key = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt,
                     iterations=PBKDF2_ITERS).derive(password.encode("utf-8"))
    ct = AESGCM(key).encrypt(iv, plaintext, None)
    return base64.b64encode(salt + iv + ct).decode("ascii")


def main() -> None:
    password = load_password()
    now = datetime.now()
    this_ym = now.strftime("%Y-%m")
    prev_ym = (now.replace(day=1) - timedelta(days=1)).strftime("%Y-%m")

    months = []
    for ym in (this_ym, prev_ym):
        months.append({
            "ym": ym,
            "title": f"{ym[:4]}년 {ym[5:]}월",
            "html": dashboard.render(ym, static=True),
        })

    payload = json.dumps({
        "months": months,
        "generated": now.strftime("%Y-%m-%d %H:%M"),
    }, ensure_ascii=False).encode("utf-8")

    enc = encrypt(payload, password)
    OUT.write_text(VIEWER.replace("__ENC__", enc).replace("__ITERS__", str(PBKDF2_ITERS)),
                   encoding="utf-8")
    print(f"{OUT.name} 생성 완료 ({len(enc) // 1024}KB, {this_ym} + {prev_ym})")


VIEWER = r"""<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>가계부</title>
<style>
:root { color-scheme: light dark; }
* { box-sizing: border-box; }
html, body { height: 100%; }
body {
  margin: 0; display: flex; flex-direction: column;
  background: #f9f9f7; color: #0b0b0b;
  font: 14px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif;
}
@media (prefers-color-scheme: dark) { body { background: #0d0d0d; color: #fff; } }
#gate { flex: 1; display: flex; align-items: center; justify-content: center; padding: 24px; }
#gate form { text-align: center; max-width: 300px; width: 100%; }
#gate h1 { font-size: 20px; margin: 0 0 16px; }
#gate input {
  width: 100%; padding: 12px 14px; font-size: 16px; border-radius: 10px;
  border: 1px solid rgba(128,128,128,.4); background: transparent; color: inherit;
}
#gate button {
  margin-top: 12px; width: 100%; padding: 12px; font-size: 15px; font-weight: 600;
  border: 0; border-radius: 10px; background: #2a78d6; color: #fff; cursor: pointer;
}
#gate .err { color: #d03b3b; font-size: 13px; min-height: 20px; margin-top: 10px; }
#app { flex: 1; display: none; flex-direction: column; min-height: 0; }
#bar {
  display: flex; gap: 8px; align-items: center; padding: 8px 12px;
  border-bottom: 1px solid rgba(128,128,128,.25); flex-wrap: wrap;
}
#bar .tab {
  padding: 5px 14px; border-radius: 999px; border: 1px solid rgba(128,128,128,.35);
  background: transparent; color: inherit; font-size: 13px; cursor: pointer;
}
#bar .tab.on { background: #2a78d6; border-color: #2a78d6; color: #fff; font-weight: 600; }
#bar .stamp { margin-left: auto; font-size: 11px; opacity: .55; }
#bar .lock { font-size: 11px; opacity: .55; background: none; border: 0; color: inherit;
  cursor: pointer; text-decoration: underline; }
iframe { flex: 1; width: 100%; border: 0; min-height: 0; }
</style>
</head>
<body>
<div id="gate">
  <form id="form">
    <h1>💳 가계부</h1>
    <input id="pw" type="password" placeholder="비밀번호" autocomplete="current-password" autofocus>
    <button type="submit">열기</button>
    <div class="err" id="err"></div>
  </form>
</div>
<div id="app">
  <div id="bar">
    <span id="tabs"></span>
    <span class="stamp" id="stamp"></span>
    <button class="lock" id="lock" type="button">잠그기</button>
  </div>
  <iframe id="frame"></iframe>
</div>
<script>
const ENC = "__ENC__";
const ITERS = __ITERS__;
const b = atob(ENC), raw = new Uint8Array(b.length);
for (let i = 0; i < b.length; i++) raw[i] = b.charCodeAt(i);
const salt = raw.slice(0, 16), iv = raw.slice(16, 28), ct = raw.slice(28);

async function decrypt(pw) {
  const km = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: ITERS, hash: "SHA-256" },
    km, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return JSON.parse(new TextDecoder().decode(plain));
}

function show(data) {
  document.getElementById("gate").style.display = "none";
  const app = document.getElementById("app");
  app.style.display = "flex";
  document.getElementById("stamp").textContent = "발행 " + data.generated;
  const tabs = document.getElementById("tabs");
  const frame = document.getElementById("frame");
  data.months.forEach((m, i) => {
    const btn = document.createElement("button");
    btn.className = "tab" + (i === 0 ? " on" : "");
    btn.textContent = m.title;
    btn.onclick = () => {
      tabs.querySelectorAll(".tab").forEach(t => t.classList.remove("on"));
      btn.classList.add("on");
      frame.srcdoc = m.html;
    };
    tabs.appendChild(btn);
  });
  frame.srcdoc = data.months[0].html;
}

async function tryPw(pw, silent) {
  try {
    const data = await decrypt(pw);
    try { localStorage.setItem("ledger_pw", pw); } catch (e) {}
    show(data);
    return true;
  } catch (e) {
    if (!silent) document.getElementById("err").textContent = "비밀번호가 맞지 않아요";
    return false;
  }
}

document.getElementById("form").addEventListener("submit", async e => {
  e.preventDefault();
  await tryPw(document.getElementById("pw").value, false);
});
document.getElementById("lock").addEventListener("click", () => {
  try { localStorage.removeItem("ledger_pw"); } catch (e) {}
  location.reload();
});
(async () => {
  let saved = null;
  try { saved = localStorage.getItem("ledger_pw"); } catch (e) {}
  if (saved) await tryPw(saved, true);
})();
</script>
</body>
</html>
"""


if __name__ == "__main__":
    main()
