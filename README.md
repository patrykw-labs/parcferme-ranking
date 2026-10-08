# parcferme-ranking

<a href="https://www.buymeacoffee.com/pwolszaw"><img src="https://img.buymeacoffee.com/button-api/?text=Buy%20me%20a%20coffee&amp;emoji=&amp;slug=pwolszaw&amp;button_colour=FFDD00&amp;font_colour=000000&amp;font_family=Cookie&amp;outline_colour=000000&amp;coffee_colour=ffffff" alt="Buy me a coffee" /></a>

Nieoficjalna, fanowska klasyfikacja typerów konkursu [parcfer.me](https://parcfer.me) — F1, runda po rundzie (TOP 100 po każdej rundzie). Wiele sezonów w jednym repo.

**Strona:** https://patrykw-labs.github.io/parcferme-ranking/

> Projekt nie jest powiązany z parcfer.me ani z Formułą 1. Dane pochodzą z publicznego rankingu na [parcfer.me](https://parcfer.me) i należą do ich właścicieli.

## Struktura

- `index.html` — strona (czysty HTML + JS, bez zależności i bez kroku budowania)
- `data/seasons.json` — lista sezonów i sezon domyślny
- `data/<rok>.json` — dane sezonu: lista rund, w każdej ranking `{ pos, name, points }`

Konkretny sezon: `index.html?sezon=2026`. Przy ≥2 sezonach w nagłówku pojawia się przełącznik.

## Aktualizacja po rundzie

Dopisz nowy obiekt na końcu tablicy `rounds` w `data/<rok>.json`:

```json
{"name": "Singapur R17", "standings": [
  {"pos": 1, "name": "…", "points": 0}
]}
```

Duplikaty nicków są rozróżniane po kolejności w rankingu („Oskar”, „Oskar (2)”).

## Nowy sezon

1. Utwórz `data/2027.json` (ten sam format, `"season": 2027`).
2. W `data/seasons.json` dopisz rok do `seasons` i ustaw `default`.

## Podgląd lokalny

Strona wczytuje JSON przez `fetch`, więc otwórz ją przez serwer, np. `python -m http.server`.

## Publikacja

GitHub Pages: Settings → Pages → Deploy from a branch → `main` / `(root)`. Plik `.nojekyll` wyłącza przetwarzanie przez Jekyll — pliki są serwowane bez zmian.

## Wsparcie

Jeśli zestawienie Ci się przydaje: [☕ Postaw mi kawę](https://buymeacoffee.com/pwolszaw).

## Licencja

Kod: [MIT](LICENSE). Licencja nie obejmuje danych rankingu w `data/` — patrz uwaga na górze.
