#!/usr/bin/env python3
"""Zapisuje zakończony sezon z parcfer.me jako data/<rok>.json z jedną rundą — stanem końcowym.

Użycie:
  python3 tools/import_season.py 2025                         # pobiera ranking i listę typowań z parcfer.me
  python3 tools/import_season.py 2022 --html ranking.html     # ranking z zapisanej strony

Nazwa rundy: ostatnie rozliczone GP sezonu z numerem = jego miejscem na liście typowań
(np. „Abu Zabi R24”); data — dzień po zamknięciu typowania. Dopisuje rok do data/seasons.json
(sezon domyślny się nie zmienia) i odświeża data/history.json. Zapisuje tylko pos, name, points, id
— bez ids2 z parcfer.me.
"""
import argparse
import datetime
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import add_round as ar  # noqa: E402
import build_history  # noqa: E402

ROOT = ar.ROOT


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("season", type=int)
    ap.add_argument("--html", help="zapisana strona rankingu zamiast pobierania")
    ap.add_argument("--name", help="nazwa rundy, np. „Abu Zabi R22” (domyślnie z listy typowań)")
    a = ap.parse_args()

    contests = ar.contests_of(a.season)
    done = [i for i, c in enumerate(contests) if ar.is_done(c)]
    if not done:
        sys.exit(f"Brak rozliczonych typowań sezonu {a.season} na parcfer.me")
    i = done[-1]
    last = contests[i]
    names = json.loads((ROOT / "data/round_names.json").read_text(encoding="utf-8"))
    gp = ar.gp_of(last, a.season)
    name = a.name or f"{names.get(gp, gp)} R{i + 1}"
    date = (ar.closed_at(last).date() + datetime.timedelta(days=1)).isoformat()

    rows = ar.parse_html(Path(a.html).read_text(encoding="utf-8") if a.html else ar.fetch(ar.URL.format(season=a.season)))
    if [r[0] for r in rows] != list(range(1, len(rows) + 1)) or any(r[3] is None for r in rows):
        sys.exit("Nietypowy ranking (pozycje nie po kolei albo brak id)")
    standings = [{"pos": p, "name": n, "points": pts, "id": uid} for p, n, pts, uid in rows]
    d = {"source": ar.URL.format(season=a.season), "season": a.season,
         "rounds": [{"name": name, "date": date, "standings": standings}]}
    path = ROOT / f"data/{a.season}.json"
    ar.write(path, d)

    sp = ROOT / "data/seasons.json"
    cfg = json.loads(sp.read_text(encoding="utf-8"))
    if a.season not in cfg["seasons"]:
        cfg["seasons"] = sorted(cfg["seasons"] + [a.season])
        text = sp.read_text(encoding="utf-8")
        old = '"seasons": ' + json.dumps(sorted(set(cfg["seasons"]) - {a.season}))
        new = '"seasons": ' + json.dumps(cfg["seasons"])
        sp.write_text(text.replace(old, new, 1), encoding="utf-8")
    build_history.main()
    print(f"Zapisano {path.relative_to(ROOT)}: {name}, {len(standings)} graczy, lider {standings[0]['name']} ({standings[0]['points']} pkt)")


if __name__ == "__main__":
    main()
