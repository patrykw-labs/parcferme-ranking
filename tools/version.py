#!/usr/bin/env python3
"""Zapisuje version.json — z której wersji i commita jest opublikowana strona.

Uruchamiany przez workflow publikacji (deploy-pages.yml) i test strony (check-page.yml);
lokalnie: python3 tools/version.py (wymaga tagów: git fetch --tags).

  {"version": "v1.2.0", "ahead": 3, "commit": "abc1234…", "date": "2026-11-16T10:00:00+01:00"}

version — ostatnie wydanie (tag vX.Y.Z) przed tym commitem, ahead — ile commitów po nim.
Plik nie jest w repozytorium (.gitignore) — powstaje przy każdej publikacji.
"""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def git(*args):
    return subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True).stdout.strip()


def main():
    info = {"version": None, "ahead": None, "commit": git("rev-parse", "HEAD"), "date": git("log", "-1", "--format=%cI")}
    desc = git("describe", "--tags", "--long", "--match", "v[0-9]*")  # np. v1.2.0-3-gabc1234
    if desc:
        tag, ahead, _ = desc.rsplit("-", 2)
        info["version"], info["ahead"] = tag, int(ahead)
    (ROOT / "version.json").write_text(json.dumps(info, ensure_ascii=False) + "\n", encoding="utf-8")
    print("version.json:", info)


if __name__ == "__main__":
    main()
