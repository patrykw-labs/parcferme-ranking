# parcferme-ranking

<a href="https://www.buymeacoffee.com/patrykw"><img src="assets/banner.jpg" alt="Klasyfikacja parcfer.me — postaw mi kawę" width="100%" /></a>

<a href="https://www.buymeacoffee.com/patrykw"><img src="https://img.buymeacoffee.com/button-api/?text=Buy%20me%20a%20coffee&amp;emoji=&amp;slug=patrykw&amp;button_colour=FFDD00&amp;font_colour=000000&amp;font_family=Cookie&amp;outline_colour=000000&amp;coffee_colour=ffffff" alt="Buy me a coffee" /></a>

[![Wersja](https://img.shields.io/github/v/release/patrykw-labs/parcferme-ranking?label=wersja)](https://github.com/patrykw-labs/parcferme-ranking/releases) [![Test strony](https://github.com/patrykw-labs/parcferme-ranking/actions/workflows/check-page.yml/badge.svg)](https://github.com/patrykw-labs/parcferme-ranking/actions/workflows/check-page.yml) [![Aktualizacja rankingu](https://github.com/patrykw-labs/parcferme-ranking/actions/workflows/update-ranking.yml/badge.svg)](https://github.com/patrykw-labs/parcferme-ranking/actions/workflows/update-ranking.yml)

Nieoficjalna, fanowska klasyfikacja typerów konkursu [parcfer.me](https://parcfer.me) (F1), runda po rundzie. Ranking aktualizuje się sam po każdym rozliczonym GP.

**Strona:** https://patrykw-labs.github.io/parcferme-ranking/

> Projekt nie jest powiązany z parcfer.me ani z Formułą 1. Dane pochodzą z publicznego rankingu na [parcfer.me](https://parcfer.me) i należą do ich właścicieli.

## Funkcje

- **Tabela runda po rundzie** — suma punktów, miejsce i przyrost w każdej rundzie, strzałki zmiany miejsca (▲/▼), oznaczenia „↑100” (wejście do TOP 100) i „NOWY”. Trzy widoki: **TOP 100**, **Moja okolica** (±15 miejsc wokół Twojego nicka) i **Wszyscy** (strony po 100 osób). Tabela przewija się we własnym oknie z przyklejonym nagłówkiem. Rundy z weekendem sprinterskim mają ⚡ (legenda przy tytule tabeli). Kliknięcie nagłówka rundy sortuje po punktach zdobytych w tej rundzie, a przycisk **⬇ CSV** pobiera całą tabelę (Excel, Arkusze Google).
- **Wyszukiwarka** po wszystkich uczestnikach; po wpisaniu pełnego nicka przycisk „Pokaż w tabeli” przenosi do jego wiersza.
- **Twoja pozycja** — po wpisaniu nicka: miejsce, punkty, zmiana miejsca, punkty w rundzie i strata do lidera, podświetlenie w tabeli, „📍 Pokaż mnie” w widoku Wszyscy, przycisk „🔗 Udostępnij” i **kalkulator „ile brakuje”** do P1 / TOP 3 / TOP 10 / TOP 50 / TOP 100 (ile punktów i ile średnio na rundę do końca sezonu; liczba rund sezonu w `data/seasons.json` → `planned_rounds`).
- **Kafelki rundy** — lider i podium, największy skok w TOP 100, najwięcej punktów w rundzie, aktywność (ile osób zdobyło punkty), rozrzut punktów w TOP 100 oraz lista **TOP 10**.
- **Forma** — tabela najlepszych z ostatnich 3 rund (suma punktów, z remisami).
- **Rekordy sezonu** — najwięcej punktów i największy awans w jednej rundzie, najwięcej rund na prowadzeniu i w TOP 10, najwyższa średnia, najrówniej punktujący gracz.
- **Historia gracza** — kliknięcie dowolnego nicka otwiera wykres miejsca po każdej rundzie i tabelę wszystkich rund (obecne i najlepsze miejsce, średnia punktów na rundę).
- **Pojedynek** — dwa nicki obok siebie: różnica punktów po każdej rundzie na wykresie, bilans rund i tabela runda po rundzie.
- **Ex aequo** — przy równej liczbie punktów wspólne miejsce z „=” (np. „2=”) w całej stronie; pełny zakres miejsc w dymku po najechaniu. Strzałki zmian liczone są ze wspólnych miejsc.
- **Kanał RSS** (`feed.xml`, ikona w górnym pasku i przycisk pod tytułem) — wpis po każdej nowej rundzie: lider, TOP 10, największe awanse i aktywność.
- **Jasny i ciemny motyw**, wersja na telefon, obsługa klawiaturą (Tab / Enter), ikona i dodawanie do ekranu głównego, podgląd linku (Open Graph) przy udostępnianiu na Messengerze czy Facebooku.

### Linki

| Adres | Co robi |
|---|---|
| `?nick=Pat` | podświetla gracza i otwiera „Moją okolicę” (nie nadpisuje nicka zapisanego w przeglądarce) |
| `?nick=Pat&vs=Kapexis` | otwiera pojedynek dwóch graczy |
| `?sezon=2026` | konkretny sezon (przy ≥2 sezonach w nagłówku pojawia się przełącznik) |

## Dane

- `data/<rok>.json` — lista rund (`name`, `date` — dzień rozliczenia, `standings`), w każdej ranking `{ pos, name, points, id }`; `id` to numer użytkownika z parcfer.me. Daty rund dodanych przed 13.11.2026 odtworzono jako dzień po zamknięciu typowania; nowe rundy dostają datę pobrania.
- Zapisane rundy: **Japonia R3** i **Silverstone R9** — pełny ranking odtworzony z kopii strony w Web Archive (10.04 i 16.07.2026), **Spa R10** — TOP 30, **Węgry R11–Singapur R17** — TOP 100, od **USA R18** — pełny ranking wszystkich uczestników. Rund R1–R2 i R4–R8 nie ma. Osoby spoza zapisanej czołówki mają w starszych rundach „> 30” / „> 100”, a przez przerwę w danych (R3 → R9) strona nie pokazuje przyrostu ani strzałek zmiany miejsca.
- Uczestników rozróżnia `id`, więc powtarzające się nicki („Oskar”, „Oskar (2)”) nie mieszają się między rundami. W rundach do Singapuru R17 `id` dopisano wstecz po nicku (przy powtórzeniach po kolejności, sprawdzonej z ciągłością punktów).

## Aktualizacja po rundzie

**Automatycznie:** workflow `.github/workflows/update-ranking.yml` co 3 godziny uruchamia `python3 tools/add_round.py --auto`. Skrypt sprawdza na parcfer.me ostatnie rozliczone typowanie sezonu (numer rundy = kolejność typowania w sezonie, nazwa z `data/round_names.json`), a gdy ranking jest już przeliczony — dopisuje rundę, robi commit i zleca publikację na Pages. Nietypowe dane (spadek punktów, przyrost ponad 25 na rundę) przerywają z błędem. Rundę starszą niż ostatnia skrypt wstawia na właściwe miejsce wg numeru (R3 przed R9) i sprawdza z rundami po obu stronach. Przed zapisem automat uruchamia też `tools/check_data.py`. Ręcznie: zakładka Actions → „Aktualizacja rankingu” → Run workflow.

**Ręcznie:** po przeliczeniu punktów na parcfer.me, a przed kolejnym GP (strona pokazuje tylko stan bieżący):

```
python3 tools/add_round.py "Meksyk R19"
```

Zamiast pobierania można podać `--html zapisana_strona.html` albo `--tsv tabela.tsv` (kolumny: pozycja, nick, punkty); `--replace` podmienia ostatnią rundę, a `--date RRRR-MM-DD` ustawia datę rozliczenia.

## Struktura

- `index.html` — struktura strony; `css/style.css` — wygląd; `js/app.js` — cała logika (czysty HTML + CSS + JS, bez zależności i bez kroku budowania)
- `data/seasons.json` — lista sezonów, sezon domyślny, liczba rund (`planned_rounds`) i rundy ze sprintem (`sprints`)
- `data/<rok>.json` — dane sezonu
- `data/round_names.json` — krótkie nazwy rund (np. „Sao Paulo” → „Brazylia”)
- `tools/add_round.py` — dopisuje rundę z rankingu parcfer.me (z ponawianiem przy chwilowej awarii strony)
- `tools/build_feed.py` — buduje kanał RSS `feed.xml` (uruchamiany automatycznie po dodaniu rundy)
- `tools/check_data.py` — sprawdza spójność danych (kolejność, unikalne id, ciągłość punktów każdego gracza)
- `.github/workflows/update-ranking.yml` — automatyczne pobieranie rund
- `.github/workflows/check-data.yml` — kontrola danych przy każdej zmianie w `data/` lub `tools/`
- `.github/workflows/check-page.yml` + `tests/smoke.mjs` — test strony w przeglądarce (Playwright): widoki, historia, pojedynek, CSV, brak błędów JS
- `.github/workflows/release.yml` — wydanie na GitHubie po wypchnięciu tagu `vX.Y.Z`, z notatkami z `CHANGELOG.md`
- `.github/dependabot.yml` — cotygodniowe podbijanie wersji akcji GitHub Actions
- `.github/FUNDING.yml` — przycisk Sponsor (Buy Me a Coffee) na stronie repozytorium
- `assets/` — baner (`banner.jpg` oraz lżejsze `banner-800/1600/3200` w WebP i JPEG — przeglądarka wybiera rozmiar pod ekran), obrazek podglądu linku (`og.jpg`) i ikony strony
- `site.webmanifest` — nazwa i ikona przy dodawaniu strony do ekranu głównego telefonu

## Nowy sezon

**Automatycznie:** gdy na parcfer.me pojawią się rozliczone typowania kolejnego sezonu, `add_round.py --auto` sam zakłada `data/<rok>.json`, dopisuje rok do `data/seasons.json`, ustawia go jako domyślny i pobiera pierwszą rundę. Poprzedni sezon zostaje dostępny pod `?sezon=<rok>`.

**Konfiguracja sezonów** w `data/seasons.json`: `planned_rounds` — liczba rund (dla kalkulatora „ile brakuje”), `sprints` — numery rund z weekendem sprinterskim (oznaczenie ⚡). Na podstawie kalendarzy parcfer.me: 2026 — 23 rundy, sprinty R2, R4, R5, R9, R12, R17; 2027 — 24 rundy, sprinty R1, R3, R4, R7, R8, R10, R14, R21, R23, R24. Przy zmianach w kalendarzu (np. odwołane GP) popraw te liczby; nowe tory dopisz w `data/round_names.json`.

## Wydania

Historia wersji jest w [CHANGELOG.md](CHANGELOG.md). Nowe wydanie: dopisz sekcję `## vX.Y.Z (RRRR-MM-DD) — tytuł` na górze `CHANGELOG.md`, a potem albo `git tag vX.Y.Z && git push origin vX.Y.Z`, albo w zakładce Actions → „Wydanie” → Run workflow wpisz wersję (tag powstanie na bieżącym `main`). Workflow utworzy wydanie z treścią tej sekcji.

## Test strony lokalnie

```
cd tests && npm install && npx playwright install chromium && cd ..
python3 -m http.server 8000 &
node tests/smoke.mjs http://127.0.0.1:8000/
```

## Podgląd lokalny

Strona wczytuje JSON przez `fetch`, więc otwórz ją przez serwer, np. `python -m http.server`.

Po zmianie `css/style.css` lub `js/app.js` podbij parametr `?v=…` w ich adresach w `index.html` — GitHub Pages trzyma pliki w pamięci podręcznej przez 10 minut.

## Publikacja

GitHub Pages: Settings → Pages → Deploy from a branch → `main` / `(root)`. Plik `.nojekyll` wyłącza przetwarzanie przez Jekyll — pliki są serwowane bez zmian.

## Statystyki

Anonimowe statystyki odwiedzin (bez cookies): [parcferme.goatcounter.com](https://parcferme.goatcounter.com/). Kliknięcia w przycisk i baner Buy Me a Coffee są liczone jako zdarzenia `buymeacoffee` i `buymeacoffee-banner`.

## Wsparcie

Jeśli zestawienie Ci się przydaje: [☕ Postaw mi kawę](https://buymeacoffee.com/patrykw).

## Licencja

Kod: [MIT](LICENSE). Licencja nie obejmuje danych rankingu w `data/` — patrz uwaga na górze.
