# parcferme-ranking

<a href="https://www.buymeacoffee.com/patrykw"><img src="assets/banner.jpg" alt="Klasyfikacja parcfer.me — postaw mi kawę" width="100%" /></a>

<a href="https://www.buymeacoffee.com/patrykw"><img src="https://img.buymeacoffee.com/button-api/?text=Buy%20me%20a%20coffee&amp;emoji=&amp;slug=patrykw&amp;button_colour=FFDD00&amp;font_colour=000000&amp;font_family=Cookie&amp;outline_colour=000000&amp;coffee_colour=ffffff" alt="Buy me a coffee" /></a>

Nieoficjalna, fanowska klasyfikacja typerów konkursu [parcfer.me](https://parcfer.me) — F1, runda po rundzie. Do Singapuru R17 zapisany jest TOP 100 po każdej rundzie, od USA R18 pełny ranking wszystkich uczestników. Wiele sezonów w jednym repo.

**Strona:** https://patrykw-labs.github.io/parcferme-ranking/

> Projekt nie jest powiązany z parcfer.me ani z Formułą 1. Dane pochodzą z publicznego rankingu na [parcfer.me](https://parcfer.me) i należą do ich właścicieli.

## Struktura

- `index.html` — strona (czysty HTML + JS, bez zależności i bez kroku budowania)
- `data/seasons.json` — lista sezonów i sezon domyślny
- `assets/` — grafiki (baner)
- `tools/add_round.py` — dopisuje rundę z rankingu parcfer.me
- `data/round_names.json` — krótkie nazwy rund (np. „Sao Paulo” → „Brazylia”)
- `data/<rok>.json` — dane sezonu: lista rund, w każdej ranking `{ pos, name, points, id }` (`id` to numer użytkownika z parcfer.me)

Konkretny sezon: `index.html?sezon=2026`. Przy ≥2 sezonach w nagłówku pojawia się przełącznik.

## Aktualizacja po rundzie

**Automatycznie:** workflow `.github/workflows/update-ranking.yml` co 3 godziny uruchamia `python3 tools/add_round.py --auto`. Skrypt sprawdza na parcfer.me ostatnie rozliczone typowanie sezonu (numer rundy = kolejność typowania w sezonie, nazwa z `data/round_names.json`), a gdy ranking jest już przeliczony — dopisuje rundę, robi commit i zleca publikację na Pages. Ręcznie można go uruchomić w zakładce Actions („Run workflow”).

**Ręcznie:**

Po przeliczeniu punktów na parcfer.me (a przed kolejnym GP — strona pokazuje tylko stan bieżący):

```
python3 tools/add_round.py "Meksyk R19"
```

Skrypt pobiera pełny ranking z `parcfer.me/typowanie-ranking/<rok>`, sprawdza kolejność pozycji i punktów, odrzuca ranking identyczny z poprzednią rundą (punkty jeszcze nieprzeliczone) i dopisuje rundę na końcu `rounds` w `data/<rok>.json`. Zamiast pobierania można podać `--html zapisana_strona.html` albo `--tsv tabela.tsv` (kolumny: pozycja, nick, punkty).

Uczestników rozróżnia `id` z parcfer.me, więc powtarzające się nicki („Oskar”, „Oskar (2)”) nie mieszają się między rundami. W rundach do Singapuru R17 `id` dopisano wstecz po nicku (przy powtórzeniach po kolejności, sprawdzonej z ciągłością punktów).

## Nowy sezon

1. Utwórz `data/2027.json` (ten sam format, `"season": 2027`).
2. W `data/seasons.json` dopisz rok do `seasons` i ustaw `default`.

## Podgląd lokalny

Strona wczytuje JSON przez `fetch`, więc otwórz ją przez serwer, np. `python -m http.server`.

## Publikacja

GitHub Pages: Settings → Pages → Deploy from a branch → `main` / `(root)`. Plik `.nojekyll` wyłącza przetwarzanie przez Jekyll — pliki są serwowane bez zmian.

## Statystyki

Anonimowe statystyki odwiedzin (bez cookies): [parcferme.goatcounter.com](https://parcferme.goatcounter.com/). Kliknięcia w przycisk i baner Buy Me a Coffee są liczone jako zdarzenia `buymeacoffee` i `buymeacoffee-banner`.

## Wsparcie

Jeśli zestawienie Ci się przydaje: [☕ Postaw mi kawę](https://buymeacoffee.com/patrykw).

## Licencja

Kod: [MIT](LICENSE). Licencja nie obejmuje danych rankingu w `data/` — patrz uwaga na górze.
