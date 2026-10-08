# parcfer-ranking

Nieoficjalna, fanowska klasyfikacja typerów konkursu [parcfer.me](https://parcfer.me) — F1, runda po rundzie (TOP 100 po każdej rundzie). Wiele sezonów w jednym repo.

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

GitHub Pages: Settings → Pages → Deploy from a branch → `main` / `(root)`.
