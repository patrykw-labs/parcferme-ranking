#!/usr/bin/env python3
"""Sprawdza spójność danych rankingu: python3 tools/check_data.py

Kod wyjścia 1 przy błędach. Sprawdza:
- data/seasons.json: sezon domyślny jest na liście, każdy sezon ma plik,
- data/round_names.json: poprawny JSON (nazwa → krótka nazwa),
- w każdej rundzie: unikalna nazwa, rosnące numery rund, pozycje 1..n po kolei,
  punkty nie rosną w dół tabeli, unikalne id,
- dla każdego gracza (id): punkty nie maleją między rundami i nie rosną
  o więcej niż 25 na rundę (przy przerwie w danych — 25 × liczba rund).
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MAX_PER_ROUND = 25


def round_number(name):
    m = re.search(r"R(\d+)$", name)
    return int(m.group(1)) if m else None


def check_season(path, errors, warnings):
    d = json.loads(path.read_text(encoding="utf-8"))
    rounds = d.get("rounds", [])
    names = [r["name"] for r in rounds]
    if len(names) != len(set(names)):
        errors.append(f"{path.name}: powtórzone nazwy rund")
    nums = [round_number(n) for n in names]
    if None in nums:
        warnings.append(f"{path.name}: rundy bez numeru „R<n>”: {[n for n, k in zip(names, nums) if k is None]}")
    known = [k for k in nums if k is not None]
    if known != sorted(set(known)):
        errors.append(f"{path.name}: numery rund nie rosną: {known}")

    history = {}
    for r in rounds:
        st, rn = r["standings"], r["name"]
        if [s["pos"] for s in st] != list(range(1, len(st) + 1)):
            errors.append(f"{rn}: pozycje nie idą po kolei od 1")
        if any(st[i]["points"] < st[i + 1]["points"] for i in range(len(st) - 1)):
            errors.append(f"{rn}: punkty rosną w dół tabeli")
        ids = [s.get("id") for s in st]
        if None in ids:
            warnings.append(f"{rn}: {ids.count(None)} wpisów bez id")
        ids = [i for i in ids if i is not None]
        if len(ids) != len(set(ids)):
            errors.append(f"{rn}: powtórzone id uczestnika")
        for s in st:
            if s.get("id") is not None:
                history.setdefault(s["id"], []).append((round_number(rn), rn, s["points"], s["name"]))

    for pid, h in history.items():
        for (a, ra, p, _), (b, rb, q, n) in zip(h, h[1:]):
            gap = (b - a) if a is not None and b is not None else 1
            if not 0 <= q - p <= MAX_PER_ROUND * max(1, gap):
                errors.append(f"{n} (id {pid}): {ra} {p} pkt → {rb} {q} pkt")
        if len({x[3] for x in h}) > 1:
            warnings.append(f"id {pid} zmieniał nick: {sorted({x[3] for x in h})}")
    return len(rounds), len(history)


def main():
    errors, warnings = [], []
    seasons = json.loads((ROOT / "data/seasons.json").read_text(encoding="utf-8"))
    if seasons["default"] not in seasons["seasons"]:
        errors.append("seasons.json: sezon domyślny nie jest na liście sezonów")
    json.loads((ROOT / "data/round_names.json").read_text(encoding="utf-8"))
    for y in seasons["seasons"]:
        path = ROOT / f"data/{y}.json"
        if not path.exists():
            errors.append(f"brak pliku {path.relative_to(ROOT)}")
            continue
        n_rounds, n_players = check_season(path, errors, warnings)
        print(f"{path.relative_to(ROOT)}: {n_rounds} rund, {n_players} graczy")
    for w in warnings:
        print("UWAGA:", w)
    for e in errors[:50]:
        print("BŁĄD:", e)
    if errors:
        sys.exit(f"{len(errors)} błędów w danych")
    print("Dane w porządku.")


if __name__ == "__main__":
    main()
