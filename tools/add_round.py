#!/usr/bin/env python3
"""Dopisuje rundę do data/<rok>.json z rankingu parcfer.me.

Użycie:
  python3 tools/add_round.py "Meksyk R19"                  # pobiera parcfer.me/typowanie-ranking/<rok>
  python3 tools/add_round.py "Meksyk R19" --html plik.html # ze strony zapisanej wcześniej
  python3 tools/add_round.py "Meksyk R19" --tsv plik.tsv   # z wklejonej tabeli: poz<TAB>nick<TAB>pkt
  python3 tools/add_round.py "USA R18" --replace           # podmienia ostatnią rundę o tej nazwie

Ranking na parcfer.me pokazuje tylko stan bieżący, więc rundę trzeba pobrać
po jej przeliczeniu, a przed kolejnym GP.
"""
import argparse
import html
import json
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
URL = "https://parcfer.me/typowanie-ranking/{season}"


def parse_html(text):
    """Zwraca listę (pozycja, nick, punkty, id). Id użytkownika (uId) jest w danych strony (__NEXT_DATA__)."""
    m = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', text, re.S)
    if m:
        wyniki = json.loads(m.group(1))["props"]["pageProps"]["wyniki"]
        # pozycje jak w tabeli na stronie: kolejne miejsca, także przy remisie punktów
        return [(i + 1, w["name"].strip(), int(w["suma"]), int(w["uId"])) for i, w in enumerate(wyniki)]
    table = text[text.find('<table class="tabelka_ranking">'):]
    table = table[:table.find("</table>")]
    rows = re.findall(
        r'<tr><td class="poz">\s*(\d+)\s*</td><td class="name">(.*?)</td><td class="punkty">\s*(-?\d+)\s*</td></tr>',
        table, re.S)
    return [(int(p), html.unescape(re.sub(r"<[^>]+>", "", n)).strip(), int(pts), None) for p, n, pts in rows]


def parse_tsv(text):
    rows = []
    for line in text.splitlines():
        parts = [x.strip() for x in line.split("\t")]
        if len(parts) != 3 or not parts[0].isdigit():
            continue  # nagłówek albo pusta linia
        rows.append((int(parts[0]), parts[1], int(parts[2]), None))
    return rows


def keyed(standings):
    """Klucz uczestnika: id z parcfer.me, a bez id (stare dane, --tsv) nick z sufiksem „ (2)” wg kolejności."""
    seen, out = {}, {}
    for s in standings:
        if s.get("id") is not None:
            out[s["id"]] = s
            continue
        seen[s["name"]] = seen.get(s["name"], 0) + 1
        k = s["name"] if seen[s["name"]] == 1 else f'{s["name"]} ({seen[s["name"]]})'
        out[k] = s
    return out


def write(path, d):
    out = ["{", f'  "source": {json.dumps(d["source"], ensure_ascii=False)},', f'  "season": {d["season"]},', '  "rounds": [']
    for i, rnd in enumerate(d["rounds"]):
        out.append(f'    {{"name": {json.dumps(rnd["name"], ensure_ascii=False)}, "standings": [')
        n = len(rnd["standings"])
        out += ["      " + json.dumps(s, ensure_ascii=False) + ("," if j < n - 1 else "") for j, s in enumerate(rnd["standings"])]
        out.append("    ]}" + ("," if i < len(d["rounds"]) - 1 else ""))
    out += ["  ]", "}"]
    path.write_text("\n".join(out) + "\n", encoding="utf-8")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("round")
    ap.add_argument("--season", type=int)
    src = ap.add_mutually_exclusive_group()
    src.add_argument("--html")
    src.add_argument("--tsv")
    ap.add_argument("--replace", action="store_true", help="podmień istniejącą rundę o tej nazwie")
    a = ap.parse_args()

    season = a.season or json.loads((ROOT / "data/seasons.json").read_text(encoding="utf-8"))["default"]
    path = ROOT / f"data/{season}.json"
    d = json.loads(path.read_text(encoding="utf-8"))

    if a.tsv:
        rows = parse_tsv(Path(a.tsv).read_text(encoding="utf-8"))
    elif a.html:
        rows = parse_html(Path(a.html).read_text(encoding="utf-8", errors="replace"))
    else:
        req = urllib.request.Request(URL.format(season=season), headers={"User-Agent": "parcferme-ranking"})
        rows = parse_html(urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "replace"))

    # kontrole danych
    if len(rows) < 100:
        sys.exit(f"Za mało wierszy: {len(rows)} (spodziewane co najmniej 100)")
    if [r[0] for r in rows] != list(range(1, len(rows) + 1)):
        sys.exit("Pozycje nie idą po kolei od 1")
    if any(rows[i][2] < rows[i + 1][2] for i in range(len(rows) - 1)):
        sys.exit("Punkty rosną w dół tabeli")
    ids = [r[3] for r in rows if r[3] is not None]
    if len(ids) != len(set(ids)):
        sys.exit("Powtórzone id uczestnika")
    if a.tsv:
        # bez id dopasuj po nicku do poprzedniej rundy (powtórzone nicki — po kolejności)
        prev_ids = {}
        for s in (d["rounds"][-1]["standings"] if d["rounds"] else []):
            if s.get("id") is not None:
                prev_ids.setdefault(s["name"], []).append(s["id"])
        seen = {}
        for i, (p, n, pts, _) in enumerate(rows):
            k = seen.get(n, 0); seen[n] = k + 1
            ids = prev_ids.get(n, [])
            rows[i] = (p, n, pts, ids[k] if k < len(ids) else None)
    standings = [{"pos": p, "name": n, "points": pts, **({"id": i} if i is not None else {})} for p, n, pts, i in rows]

    names = [r["name"] for r in d["rounds"]]
    if a.round in names:
        if not (a.replace and names[-1] == a.round):
            sys.exit(f"Runda {a.round!r} już jest (podmiana tylko ostatniej rundy, z --replace)")
        d["rounds"].pop()
    elif a.replace:
        sys.exit(f"Nie ma rundy {a.round!r} do podmiany")

    prev = keyed(d["rounds"][-1]["standings"]) if d["rounds"] else {}
    if prev:
        new = keyed(standings)
        cut = len(d["rounds"][-1]["standings"])
        if all(prev.get(k) and prev[k]["points"] == s["points"] for k, s in list(new.items())[:cut]):
            sys.exit("Ranking identyczny jak w poprzedniej rundzie — parcfer.me chyba jeszcze nie przeliczył punktów")
        odd = [(k, s["points"] - prev[k]["points"]) for k, s in new.items() if k in prev and not 0 <= s["points"] - prev[k]["points"] <= 25]
        if odd:
            print("UWAGA, nietypowe przyrosty:", odd[:20])
        top_new = [s["name"] for k, s in new.items() if s["pos"] <= 100 and k not in prev]
        print("Nowi w TOP 100:", top_new)
        print("Nowi uczestnicy:", [s["name"] for k, s in new.items() if k not in prev and s["pos"] > 100][:20])

    d["rounds"].append({"name": a.round, "standings": standings})
    write(path, d)
    print(f"Zapisano {a.round}: {len(standings)} uczestników → {path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
