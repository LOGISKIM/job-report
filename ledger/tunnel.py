"""cloudflared 임시 터널을 띄우고 발급된 주소를 파일로 남긴다.

임시 터널(trycloudflare)은 실행할 때마다 주소가 바뀐다. 이 스크립트는
바뀐 주소를 자동으로 찾아내 tunnel_url.txt에 기록하고, --publish를 주면
깃허브에 올려서 폰(Macrodroid)이 그 주소를 스스로 읽어가게 한다.

사용:
  python tunnel.py              # 터널 실행 + 주소를 tunnel_url.txt에 기록
  python tunnel.py --publish    # 위에 더해 깃허브에 주소 공개 (폰 자동 갱신용)

주의: --publish는 터널 주소를 공개 저장소에 올린다. /ingest와 /dashboard는
LEDGER_TOKEN으로 보호되지만, 주소 자체는 누구나 볼 수 있게 된다.
"""

from __future__ import annotations

import re
import subprocess
import sys
import threading
import urllib.request
from pathlib import Path

HERE = Path(__file__).parent
URL_FILE = HERE / "tunnel_url.txt"
PORT = 8288
URL_RE = re.compile(r"https://[a-z0-9-]+\.trycloudflare\.com")


def server_is_up() -> bool:
    try:
        with urllib.request.urlopen(f"http://localhost:{PORT}/health", timeout=3):
            return True
    except Exception:
        return False


def publish(url: str) -> None:
    """터널 주소를 깃허브에 올려 폰이 읽어갈 수 있게 한다."""
    try:
        subprocess.run(["git", "add", URL_FILE.name], cwd=HERE, check=True,
                       capture_output=True)
        r = subprocess.run(["git", "commit", "-m", f"tunnel url {url}"],
                           cwd=HERE, capture_output=True, text=True)
        if r.returncode != 0 and "nothing to commit" not in (r.stdout + r.stderr):
            print(f"  [publish] commit 실패: {r.stdout.strip()} {r.stderr.strip()}")
            return
        subprocess.run(["git", "push"], cwd=HERE, check=True, capture_output=True)
        print("  [publish] 깃허브에 주소를 올렸습니다. 폰이 자동으로 받아갑니다.")
    except subprocess.CalledProcessError as e:
        err = (e.stderr or b"").decode("utf-8", "replace").strip()
        print(f"  [publish] 실패: {err}")


def main() -> None:
    do_publish = "--publish" in sys.argv

    if not server_is_up():
        print(f"경고: localhost:{PORT} 서버가 응답하지 않습니다. "
              f"start_ledger.bat 를 먼저 실행하세요.\n")

    try:
        proc = subprocess.Popen(
            ["cloudflared", "tunnel", "--url", f"http://localhost:{PORT}",
             "--no-autoupdate"],
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            text=True, encoding="utf-8", errors="replace", bufsize=1,
        )
    except FileNotFoundError:
        sys.exit("cloudflared 를 찾을 수 없습니다. "
                 "winget install --id Cloudflare.cloudflared 로 설치하세요.")

    found: list[str] = []

    def pump() -> None:
        for line in proc.stdout:  # type: ignore[union-attr]
            if not found:
                m = URL_RE.search(line)
                if m:
                    url = m.group(0)
                    found.append(url)
                    URL_FILE.write_text(url + "\n", encoding="utf-8")
                    print("\n" + "=" * 52)
                    print("  터널 주소 (Macrodroid에 넣을 값):")
                    print(f"  {url}/ingest")
                    print("=" * 52 + "\n")
                    if do_publish:
                        publish(url)

    t = threading.Thread(target=pump, daemon=True)
    t.start()
    try:
        proc.wait()
    except KeyboardInterrupt:
        proc.terminate()


if __name__ == "__main__":
    main()
