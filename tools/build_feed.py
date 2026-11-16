#!/usr/bin/env python3
"""Buduje kanał RSS feed.xml z rund sezonu domyślnego: python3 tools/build_feed.py

Jeden wpis na rundę (najnowsze pierwsze): lider (przy remisie wszyscy liderzy), TOP 10
z punktami z rundy, największe awanse w TOP 100 i aktywność. Uruchamiany też przez add_round.py.
"""
import datetime
import email.utils
import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = "https://patrykw-labs.github.io/parcferme-ranking/"
MAX_ITEMS = 30


def round_number(name):
    m = re.search(r"R(\d+)$", name)
    return int(m.group(1)) if m else None


def shared_place(standings, points):
    """Wspólne miejsce przy remisie: pierwsze miejsce grupy z tą samą liczbą punktów, z „=”."""
    group = [s["pos"] for s in standings if s["points"] == points]
    return f"{min(group)}=" if len(group) > 1 else str(group[0])


def place_num(standings, points):
    return min(s["pos"] for s in standings if s["points"] == points)


def partial(rnd):
    """Runda z samą czołówką (pole „top”, np. Spa R10 — TOP 30)."""
    return rnd.get("top") is not None


def names(group, limit=3):
    """„A, B i C” albo „A, B, C i 4 innych” — nicki osób z tym samym wynikiem."""
    n = [f"<b>{html.escape(s['name'])}</b>" for s in group[:limit]]
    rest = len(group) - limit
    if rest > 0:
        return ", ".join(n) + f" i {rest} {'inny' if rest == 1 else 'innych'}"
    return ", ".join(n[:-1]) + " i " + n[-1] if len(n) > 1 else n[0]


def leaders(standings):
    return [s for s in standings if s["points"] == standings[0]["points"]]


def published(rnd):
    """Moment publikacji wpisu: chwila pobrania rundy (captured_at), a dla starszych rund — południe dnia „date”."""
    if rnd.get("captured_at"):
        return datetime.datetime.fromisoformat(rnd["captured_at"].replace("Z", "+00:00"))
    d = datetime.date.fromisoformat(rnd.get("date", "2026-01-01"))
    return datetime.datetime(d.year, d.month, d.day, 12, tzinfo=datetime.timezone.utc)


def item_html(rnd, prev):
    st = rnd["standings"]
    consecutive = prev is not None and round_number(rnd["name"]) - round_number(prev["name"]) == 1
    before = {s["id"]: s for s in prev["standings"]} if consecutive else {}
    # aktywność tylko wtedy, gdy obie rundy mają pełny ranking (z czołówki nie wiadomo, kto zdobył punkty)
    full_both = consecutive and not partial(prev) and not partial(rnd)

    def gain(s):
        p = before.get(s["id"])
        return s["points"] - p["points"] if p else None

    rows = []
    for s in st[:10]:
        g = gain(s)
        rows.append(f"<li>P{shared_place(st, s['points'])} <b>{html.escape(s['name'])}</b> — {s['points']} pkt"
                    + (f" ({g:+d} w rundzie)" if g is not None else "") + "</li>")
    ld = leaders(st)
    lead = (f"<p>Lider: <b>{html.escape(st[0]['name'])}</b>, {st[0]['points']} pkt.</p>" if len(ld) == 1 else
            f"<p>Liderzy ex aequo: {names(ld, 10)} — po {st[0]['points']} pkt.</p>")
    parts = [lead,
             "<p><b>TOP 10</b></p><ol>" + "".join(rows) + "</ol>"]
    if before:
        # awanse liczone ze wspólnych miejsc (ex aequo), tak jak na stronie
        pst = prev["standings"]
        climbs = sorted(((place_num(pst, before[s["id"]]["points"]) - place_num(st, s["points"]), s)
                         for s in st if s["id"] in before and place_num(st, s["points"]) <= 100), key=lambda x: -x[0])[:3]
        climbs = [(c, s) for c, s in climbs if c > 0]
        if climbs:
            parts.append("<p><b>Największe awanse w TOP 100:</b> "
                         + ", ".join(f"{html.escape(s['name'])} ▲{c} (P{shared_place(st, s['points'])})" for c, s in climbs) + "</p>")
        gains = [(gain(s), s) for s in st if gain(s) is not None]
        if gains:
            g = max(x[0] for x in gains)
            parts.append(f"<p><b>Najwięcej punktów w rundzie:</b> {names([s for x, s in gains if x == g])} ({g:+d}).</p>")
        if full_both:
            active = sum(1 for g, _ in gains if g > 0) + sum(1 for s in st if s["id"] not in before and s["points"] > 0)
            parts.append(f"<p><b>Aktywność:</b> punkty zdobyło {active} z {len(st)} uczestników.</p>")
    parts.append(f'<p><a href="{SITE}">Pełna tabela, historia graczy i pojedynki →</a></p>')
    return "".join(parts)


def main():
    seasons = json.loads((ROOT / "data/seasons.json").read_text(encoding="utf-8"))
    season = seasons["default"]
    d = json.loads((ROOT / f"data/{season}.json").read_text(encoding="utf-8"))
    rounds = d["rounds"]
    sprints = set(seasons.get("sprints", {}).get(str(season), []))
    items = []
    for i in range(len(rounds) - 1, max(-1, len(rounds) - 1 - MAX_ITEMS), -1):
        r = rounds[i]
        prev = rounds[i - 1] if i > 0 else None
        pub = email.utils.format_datetime(published(r))
        sprint = " ⚡ sprint" if round_number(r["name"]) in sprints else ""
        ld = leaders(r["standings"])
        who = f"lider {ld[0]['name']}" if len(ld) == 1 else "liderzy ex aequo " + ", ".join(s["name"] for s in ld)
        title = f"{r['name']}{sprint} — {who} ({ld[0]['points']} pkt)"
        guid = f"{SITE}#{season}-{r['name'].replace(' ', '-')}"
        items.append(
            "    <item>\n"
            f"      <title>{html.escape(title)}</title>\n"
            f"      <link>{SITE}</link>\n"
            f'      <guid isPermaLink="false">{html.escape(guid)}</guid>\n'
            f"      <pubDate>{pub}</pubDate>\n"
            f"      <description><![CDATA[{item_html(r, prev)}]]></description>\n"
            "    </item>")
    build = email.utils.format_datetime(max(published(r) for r in rounds) if rounds else datetime.datetime.now(datetime.timezone.utc))
    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n'
        "  <channel>\n"
        f"    <title>Klasyfikacja typerów parcfer.me — F1 {season}</title>\n"
        f"    <link>{SITE}</link>\n"
        f'    <atom:link href="{SITE}feed.xml" rel="self" type="application/rss+xml"/>\n'
        "    <description>Nieoficjalny ranking typerów parcfer.me: nowa runda po każdym rozliczonym GP.</description>\n"
        "    <language>pl</language>\n"
        f"    <lastBuildDate>{build}</lastBuildDate>\n"
        + "\n".join(items) + "\n"
        "  </channel>\n"
        "</rss>\n")
    (ROOT / "feed.xml").write_text(xml, encoding="utf-8")
    print(f"feed.xml: {len(items)} wpisów")


if __name__ == "__main__":
    main()
