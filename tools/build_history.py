#!/usr/bin/env python3
"""Buduje data/history.json — wynik każdego gracza we wszystkich sezonach: python3 tools/build_history.py

  {"seasons": {"2025": {"round": "Abu Zabi R24", "players": 1293, "final": true}, ...},
   "champions": {"2025": {"points": 258, "ids": [123], "names": ["Pingol"]}, ...},
   "players": {"123": {"2025": [1, 258], "2026": [5, 189]}, ...}}

Miejsce jak na stronie: przy remisie wspólne (pierwsze miejsce grupy). Dla każdego sezonu
liczy się ostatnia zapisana runda; „final” — runda jest ostatnią w sezonie (planned_rounds),
więc „champions” zawiera tylko zakończone sezony. Uruchamiany też przez add_round.py
i import_season.py. Plik pozwala pokazać „Twoje sezony” bez wczytywania wszystkich sezonów.
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def main():
    cfg = json.loads((ROOT / "data/seasons.json").read_text(encoding="utf-8"))
    out = {"seasons": {}, "champions": {}, "players": {}}
    for y in sorted(cfg["seasons"]):
        path = ROOT / f"data/{y}.json"
        if not path.exists():
            continue
        rounds = json.loads(path.read_text(encoding="utf-8"))["rounds"]
        if not rounds:
            continue
        last = rounds[-1]
        st = last["standings"]
        m = re.search(r"R(\d+)$", last["name"])
        final = bool(m) and int(m.group(1)) >= cfg.get("planned_rounds", {}).get(str(y), 10 ** 9)
        out["seasons"][str(y)] = {"round": last["name"], "players": len(st), "final": final}
        first = {}
        for s in st:
            first.setdefault(s["points"], s["pos"])
            if s.get("id") is not None:
                out["players"].setdefault(str(s["id"]), {})[str(y)] = [first[s["points"]], s["points"]]
        if final:
            top = [s for s in st if s["points"] == st[0]["points"]]
            out["champions"][str(y)] = {"points": st[0]["points"], "ids": [s.get("id") for s in top], "names": [s["name"] for s in top]}
    (ROOT / "data/history.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"data/history.json: {len(out['seasons'])} sezonów, {len(out['players'])} graczy, mistrzowie: "
          + ", ".join(f"{y} {' / '.join(c['names'])}" for y, c in out["champions"].items()))


if __name__ == "__main__":
    main()
