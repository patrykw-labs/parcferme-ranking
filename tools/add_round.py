#!/usr/bin/env python3
"""Dopisuje rundę do data/<rok>.json z rankingu parcfer.me.

Użycie:
  python3 tools/add_round.py "Meksyk R19"                  # pobiera parcfer.me/typowanie-ranking/<rok>
  python3 tools/add_round.py "Meksyk R19" --html plik.html # ze strony zapisanej wcześniej
  python3 tools/add_round.py "Meksyk R19" --tsv plik.tsv   # z wklejonej tabeli: poz<TAB>nick<TAB>pkt
  python3 tools/add_round.py "USA R18" --replace           # podmienia ostatnią rundę o tej nazwie
  python3 tools/add_round.py --auto                        # sam ustala, czy jest nowa rozliczona runda

Tryb --auto (używany przez GitHub Actions): z listy typowań parcfer.me bierze ostatnie
rozliczone typowanie rankingowe sezonu. Numer rundy to miejsce GP w kalendarzu sezonu
(data/seasons.json → calendar), nazwa — z data/round_names.json (albo z nazwy na parcfer.me).
- runda już jest: dopóki następne typowanie się nie zamknęło, porównuje ją z parcfer.me
  i przy korekcie punktów podmienia (data zostaje); inaczej kończy się bez zmian (kod 0),
- ranking jeszcze nie przeliczony: bez zmian (kod 0), ale po 96 h od zamknięcia typowania
  to już błąd (kod 1) — GitHub wyśle wtedy e-mail o nieudanym workflow,
- nietypowe dane albo GP spoza kalendarza przerywają z błędem (kod 1).
Data nowej rundy to dzień wyścigu (zamknięcie typowania + 1 dzień, w weekend ze sprintem + 2),
a captured_at — moment pobrania rankingu (UTC).

Ranking na parcfer.me pokazuje tylko stan bieżący, więc rundę trzeba pobrać
po jej przeliczeniu, a przed kolejnym GP.
"""
import argparse
import datetime
import html
import json
import re
import sys
import time
import urllib.error
import urllib.request
import zoneinfo
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_feed  # noqa: E402  (kanał RSS odświeżany po każdej nowej rundzie)
import check_data  # noqa: E402  (limit punktów na rundę)
import build_history  # noqa: E402  (data/history.json — sezony każdego gracza)
URL = "https://parcfer.me/typowanie-ranking/{season}"
CONTESTS_URL = "https://parcfer.me/typowanie"
CONTEST_URL = "https://parcfer.me/typowanie/{link}"
WARSAW = zoneinfo.ZoneInfo("Europe/Warsaw")  # closeAt na parcfer.me jest w czasie polskim
STALE_AFTER = datetime.timedelta(hours=96)  # po tym czasie od zamknięcia typowania brak przeliczenia to błąd


class NothingToDo(Exception):
    """Brak nowej rundy — w trybie --auto to nie jest błąd."""


def fetch(url, tries=3, wait=60):
    """Pobiera stronę; przy chwilowym błędzie (sieć, timeout, błąd 5xx) ponawia po minucie."""
    for attempt in range(1, tries + 1):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "parcferme-ranking"})
            return urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "replace")
        except urllib.error.HTTPError as e:
            if e.code < 500 or attempt == tries:
                raise
            err = e
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            if attempt == tries:
                raise
            err = e
        print(f"Nie udało się pobrać {url} ({err}), ponawiam za {wait} s ({attempt}/{tries})")
        time.sleep(wait)


def next_data(text):
    m = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', text, re.S)
    return json.loads(m.group(1))["props"]["pageProps"] if m else None


CONTESTS = None  # lista typowań z pliku (--contests, do testów) zamiast z parcfer.me


def contests_of(season, contests=None):
    contests = contests if contests is not None else CONTESTS if CONTESTS is not None else next_data(fetch(CONTESTS_URL))["typowania"]
    out = [c for c in contests if str(c["sezon"]) == str(season)]
    out.sort(key=lambda c: c["closeAt"])
    return out


def is_done(c):
    return str(c["wyniki"]).lower() == "true"


def is_ranked(c):
    """Czy typowanie liczy się do rankingu (pole „rankingowa” ze strony typowania)."""
    if "rankingowa" not in c:
        c["rankingowa"] = next_data(fetch(CONTEST_URL.format(link=c["link"])))["typowania"]["typo"].get("rankingowa")
    return str(c["rankingowa"]).lower() == "true"


def closed_at(c):
    return datetime.datetime.fromisoformat(c["closeAt"][:19]).replace(tzinfo=WARSAW)


def now():
    return datetime.datetime.now(datetime.timezone.utc)


def gp_of(c, season):
    """„Typowanie GP Sao Paulo 2026” → „Sao Paulo”."""
    return re.sub(rf"^Typowanie\s+(GP\s+|Grand\s+Prix\s+)?|\s+{season}$", "", c["name"].strip())


def config():
    return json.loads((ROOT / "data/seasons.json").read_text(encoding="utf-8"))


def maybe_start_next_season(season):
    """Gdy parcfer.me ma rozliczone typowania następnego sezonu, zakłada jego plik i ustawia go jako domyślny."""
    nxt = int(season) + 1
    path = ROOT / f"data/{nxt}.json"
    if path.exists():
        return season
    done = [c for c in contests_of(nxt) if str(c["wyniki"]).lower() == "true"]
    if not done:
        return season
    path.write_text(json.dumps({"source": URL.format(season=nxt), "season": nxt, "rounds": []}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    sp = ROOT / "data/seasons.json"
    cfg = json.loads(sp.read_text(encoding="utf-8"))
    if nxt not in cfg["seasons"]:
        cfg["seasons"].append(nxt)
    cfg["default"] = nxt
    sp.write_text(json.dumps(cfg, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Nowy sezon {nxt}: utworzono {path.relative_to(ROOT)} i ustawiono go jako domyślny")
    return nxt


def auto_round(season):
    """Ostatnie rozliczone typowanie rankingowe sezonu → (nazwa rundy, np. „Brazylia R20”, typowanie, następne typowanie albo None).

    Numer rundy to miejsce GP w kalendarzu (seasons.json → calendar), więc dodatkowe typowanie
    na liście parcfer.me nie przesuwa numerów. Bez kalendarza — kolejność typowania w sezonie.
    """
    contests = contests_of(season)
    cal = config().get("calendar", {}).get(str(season))
    if cal:
        known = [cal.index(gp_of(c, season)) for c in contests if gp_of(c, season) in cal]
        if len(set(known)) != len(known) or known != sorted(known):
            sys.exit("Kolejność typowań na parcfer.me nie zgadza się z kalendarzem w data/seasons.json: "
                     + str([gp_of(c, season) for c in contests]))
    else:
        print(f"UWAGA: brak kalendarza {season} w data/seasons.json (calendar) — numer rundy wg kolejności typowań")
    for i in reversed([i for i, c in enumerate(contests) if is_done(c)]):
        c, gp = contests[i], gp_of(contests[i], season)
        if not is_ranked(c):
            print(f"Pomijam typowanie spoza rankingu: {c['name']}")
            continue
        if cal and gp not in cal:
            sys.exit(f"GP „{gp}” ({c['name']}) nie ma w kalendarzu {season} — dopisz je do data/seasons.json (calendar)")
        num = cal.index(gp) + 1 if cal else i + 1
        names_path = ROOT / "data/round_names.json"
        names = json.loads(names_path.read_text(encoding="utf-8")) if names_path.exists() else {}
        return f"{names.get(gp, gp)} R{num}", c, (contests[i + 1] if i + 1 < len(contests) else None)
    raise NothingToDo("Brak rozliczonych typowań w sezonie")


def race_day(contest, num, season):
    """Dzień wyścigu: typowanie zamyka się przed kwalifikacjami — dzień później, a w weekend ze sprintem (piątek) dwa dni później."""
    sprint = num in config().get("sprints", {}).get(str(season), [])
    return (closed_at(contest).date() + datetime.timedelta(days=2 if sprint else 1)).isoformat()


def parse_html(text):
    """Zwraca listę (pozycja, nick, punkty, id). Id użytkownika (uId) jest w danych strony (__NEXT_DATA__)."""
    data = next_data(text)
    if data:
        wyniki = data["wyniki"]
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


def round_number(name):
    m = re.search(r"R(\d+)$", name or "")
    return int(m.group(1)) if m else None


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


ROUND_FIELDS = ("date", "top", "captured_at")  # pola rundy obok name i standings (check_data.py zna tę samą listę)


def write(path, d):
    out = ["{", f'  "source": {json.dumps(d["source"], ensure_ascii=False)},', f'  "season": {d["season"]},', '  "rounds": [']
    for i, rnd in enumerate(d["rounds"]):
        extra = "".join(f', "{f}": {json.dumps(rnd[f])}' for f in ROUND_FIELDS if rnd.get(f) is not None)
        out.append(f'    {{"name": {json.dumps(rnd["name"], ensure_ascii=False)}{extra}, "standings": [')
        n = len(rnd["standings"])
        out += ["      " + json.dumps(s, ensure_ascii=False) + ("," if j < n - 1 else "") for j, s in enumerate(rnd["standings"])]
        out.append("    ]}" + ("," if i < len(d["rounds"]) - 1 else ""))
    out += ["  ]", "}"]
    path.write_text("\n".join(out) + "\n", encoding="utf-8")


def main():
    try:
        run()
    except NothingToDo as e:
        print("Bez zmian:", e)


def run():
    ap = argparse.ArgumentParser()
    ap.add_argument("round", nargs="?")
    ap.add_argument("--auto", action="store_true", help="ustal rundę z parcfer.me; brak nowej rundy to nie błąd")
    ap.add_argument("--season", type=int)
    src = ap.add_mutually_exclusive_group()
    src.add_argument("--html")
    src.add_argument("--tsv")
    ap.add_argument("--replace", action="store_true", help="podmień istniejącą rundę o tej nazwie")
    ap.add_argument("--date", help="data rundy (dzień wyścigu) RRRR-MM-DD; domyślnie dziś, w --auto wg zamknięcia typowania")
    ap.add_argument("--contests", help="lista typowań z pliku JSON zamiast z parcfer.me (do testów)")
    ap.add_argument("--raw-out", help="przy zapisie rundy zachowaj surowy ranking z parcfer.me w tym pliku (kopia zapasowa, bez ids2)")
    a = ap.parse_args()
    if bool(a.round) == a.auto:
        ap.error("podaj nazwę rundy albo --auto")
    if a.contests:
        global CONTESTS
        CONTESTS = json.loads(Path(a.contests).read_text(encoding="utf-8"))

    season = a.season or json.loads((ROOT / "data/seasons.json").read_text(encoding="utf-8"))["default"]
    if a.auto and not a.season:
        season = maybe_start_next_season(season)
    path = ROOT / f"data/{season}.json"
    d = json.loads(path.read_text(encoding="utf-8"))

    contest = refresh = None
    if a.auto:
        a.round, contest, following = auto_round(season)
        have = [r["name"] for r in d["rounds"]]
        if a.round in have:
            # korekty na parcfer.me (np. kara po wyścigu) — sprawdzamy ostatnią rundę, dopóki trwa przerwa przed kolejnym GP
            if have[-1] != a.round or (following and closed_at(following) <= now()):
                raise NothingToDo(f"runda {a.round} już jest w danych")
            refresh = d["rounds"][-1]
            print("Sprawdzam, czy parcfer.me nie poprawił rundy", a.round)
        else:
            print("Nowa rozliczona runda:", a.round)

    raw = None
    if a.tsv:
        rows = parse_tsv(Path(a.tsv).read_text(encoding="utf-8"))
    elif a.html:
        text = Path(a.html).read_text(encoding="utf-8", errors="replace")
        rows = parse_html(text)
        raw = next_data(text)
    else:
        page = fetch(URL.format(season=season))
        rows = parse_html(page)
        raw = next_data(page)

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

    if refresh:
        old = keyed(refresh["standings"])
        new_k = keyed(standings)
        changed = [(s["name"], old[k]["points"] if k in old else None, s["points"]) for k, s in new_k.items()
                   if k not in old or old[k]["points"] != s["points"] or old[k]["name"] != s["name"] or old[k]["pos"] != s["pos"]]
        gone = [old[k]["name"] for k in old if k not in new_k]
        if not changed and not gone:
            raise NothingToDo(f"runda {a.round} już jest w danych i zgadza się z parcfer.me")
        pts = [x for x in changed if x[1] is not None and x[1] != x[2]]
        print(f"parcfer.me poprawił rundę {a.round}: zmiana punktów u {len(pts)} graczy {pts[:10]}, "
              f"innych zmian (miejsce, nick, nowi) {len(changed) - len(pts)}, zniknęło {len(gone)} {gone[:10]}")
        a.replace = True

    names = [r["name"] for r in d["rounds"]]
    if a.round in names:
        if not (a.replace and names[-1] == a.round):
            sys.exit(f"Runda {a.round!r} już jest (podmiana tylko ostatniej rundy, z --replace)")
        d["rounds"].pop()
    elif a.replace:
        sys.exit(f"Nie ma rundy {a.round!r} do podmiany")

    # miejsce wstawienia wg numeru rundy (R3 trafi przed R10), domyślnie na koniec
    num = round_number(a.round)
    at = len(d["rounds"])
    if num is not None:
        at = next((i for i, r in enumerate(d["rounds"]) if (round_number(r["name"]) or 0) > num), at)
    before = d["rounds"][at - 1] if at > 0 else None
    after = d["rounds"][at] if at < len(d["rounds"]) else None

    new = keyed(standings)
    if before:
        prev = keyed(before["standings"])
        limit = check_data.max_gain(config(), season, round_number(before["name"]), num)
        cut = len(before["standings"])
        if all(prev.get(k) and prev[k]["points"] == s["points"] for k, s in list(new.items())[:cut]):
            msg = "ranking identyczny jak w poprzedniej rundzie — parcfer.me jeszcze nie przeliczył punktów"
            if a.auto and contest and now() - closed_at(contest) > STALE_AFTER:
                h = int((now() - closed_at(contest)).total_seconds() // 3600)
                sys.exit(f"{contest['name']}: rozliczone od {h} h, a {msg}. Sprawdź parcfer.me "
                         "i w razie potrzeby dodaj rundę ręcznie (--html / --tsv).")
            if a.auto:
                raise NothingToDo(msg)
            sys.exit(msg[0].upper() + msg[1:])
        odd = [(s["name"], s["points"] - prev[k]["points"]) for k, s in new.items() if k in prev and not 0 <= s["points"] - prev[k]["points"] <= limit]
        if odd:
            if a.auto:
                sys.exit(f"Nietypowe przyrosty punktów, przerywam: {odd[:20]}")
            print("UWAGA, nietypowe przyrosty:", odd[:20])
        top_new = [s["name"] for k, s in new.items() if s["pos"] <= 100 and k not in prev]
        print("Nowi w TOP 100:", top_new)
        print("Nowi uczestnicy:", [s["name"] for k, s in new.items() if k not in prev and s["pos"] > 100][:20])
    if after:
        # wstawiana starsza runda: punkty nie mogą przewyższać punktów z następnej rundy
        nxt = keyed(after["standings"])
        limit = check_data.max_gain(config(), season, num, round_number(after["name"]))
        odd = [(s["name"], nxt[k]["points"] - s["points"]) for k, s in new.items() if k in nxt and not 0 <= nxt[k]["points"] - s["points"] <= limit]
        if odd:
            sys.exit(f"Niespójne z następną rundą {after['name']}: {odd[:20]}")

    if refresh:
        rnd = dict(refresh, standings=standings)  # data i moment pierwszego pobrania zostają
    else:
        rnd = {"name": a.round, "date": a.date or (race_day(contest, num, season) if contest and num else datetime.date.today().isoformat())}
        if not (a.html or a.tsv):
            rnd["captured_at"] = now().strftime("%Y-%m-%dT%H:%M:%SZ")
        rnd["standings"] = standings
    d["rounds"].insert(at, rnd)
    write(path, d)
    if a.raw_out and raw:
        # kopia zapasowa surowych danych — tylko uId, name, suma; ids2 (skrót MD5 e-maila gracza) nigdy nie trafia do pliku
        wyniki = [{"uId": w.get("uId"), "name": w.get("name"), "suma": w.get("suma")} for w in raw.get("wyniki", [])]
        Path(a.raw_out).write_text(json.dumps({"source": URL.format(season=season), "season": season, "round": a.round,
                                               "fetched_at": now().strftime("%Y-%m-%dT%H:%M:%SZ"), "wyniki": wyniki},
                                              ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"Kopia surowego rankingu: {a.raw_out} ({len(wyniki)} wierszy)")
    build_feed.main()
    build_history.main()
    print(f"Zapisano {a.round}: {len(standings)} uczestników → {path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
