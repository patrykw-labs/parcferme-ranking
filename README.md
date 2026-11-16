# parcferme-ranking

<a href="https://www.buymeacoffee.com/patrykw"><img src="assets/banner.jpg" alt="Klasyfikacja parcfer.me — postaw mi kawę" width="100%" /></a>

<a href="https://www.buymeacoffee.com/patrykw"><img src="https://img.buymeacoffee.com/button-api/?text=Buy%20me%20a%20coffee&amp;emoji=&amp;slug=patrykw&amp;button_colour=FFDD00&amp;font_colour=000000&amp;font_family=Cookie&amp;outline_colour=000000&amp;coffee_colour=ffffff" alt="Buy me a coffee" /></a>

[![Wersja](https://img.shields.io/github/v/release/patrykw-labs/parcferme-ranking?label=wersja)](https://github.com/patrykw-labs/parcferme-ranking/releases) [![Test strony](https://github.com/patrykw-labs/parcferme-ranking/actions/workflows/check-page.yml/badge.svg)](https://github.com/patrykw-labs/parcferme-ranking/actions/workflows/check-page.yml) [![Aktualizacja rankingu](https://github.com/patrykw-labs/parcferme-ranking/actions/workflows/update-ranking.yml/badge.svg)](https://github.com/patrykw-labs/parcferme-ranking/actions/workflows/update-ranking.yml)

Nieoficjalna, fanowska klasyfikacja typerów konkursu [parcfer.me](https://parcfer.me) (F1), runda po rundzie. Ranking aktualizuje się sam po każdym rozliczonym GP.

**Strona:** https://patrykw-labs.github.io/parcferme-ranking/

> Projekt nie jest powiązany z parcfer.me ani z Formułą 1. Dane pochodzą z publicznego rankingu na [parcfer.me](https://parcfer.me) i należą do ich właścicieli.

## Funkcje

- **Tabela runda po rundzie** — suma punktów, miejsce i przyrost w każdej rundzie, strzałki zmiany miejsca (▲/▼), oznaczenia „↑100” (wejście do TOP 100) i „NOWY”. Trzy widoki: **TOP 100** (wszyscy z miejscem do 100, także przy remisie na granicy), **Moja okolica** (±15 miejsc wokół Twojego nicka) i **Wszyscy** (strony po 100 osób). Tabela przewija się we własnym oknie z przyklejonym nagłówkiem. Rundy z weekendem sprinterskim mają ⚡ (legenda przy tytule tabeli). Kliknięcie nagłówka rundy sortuje po punktach zdobytych w tej rundzie, a przycisk **⬇ CSV** pobiera całą tabelę (Excel, Arkusze Google).
- **Wyszukiwarka** po wszystkich uczestnikach, bez wielkości liter i polskich znaków („lukasz” znajdzie „Łukasz”); po wpisaniu pełnego nicka przycisk „Pokaż w tabeli” przenosi do jego wiersza.
- **Twoja pozycja** — pole podpowiada nicki; gdy nick ma kilka osób (np. 7 × „Michał”), strona pokazuje listę z miejscem i punktami do wybrania siebie i zapamiętuje wybór. Po wpisaniu nicka: miejsce, punkty, zmiana miejsca, punkty w rundzie i strata do lidera, podświetlenie w tabeli, „📍 Pokaż mnie” w widoku Wszyscy, przycisk „🔗 Udostępnij” i **kalkulator „ile brakuje”** do P1 / TOP 3 / TOP 10 / TOP 50 / TOP 100 (ile punktów i ile średnio na rundę do końca sezonu; liczba rund sezonu w `data/seasons.json` → `planned_rounds`).
- **Kafelki rundy** — lider (przy remisie na P1 wszyscy liderzy) i podium, największy skok w TOP 100 i najwięcej punktów w rundzie (z remisami), aktywność (ile osób zdobyło punkty), rozrzut punktów w TOP 100 oraz lista **TOP 10**.
- **Forma** — tabela najlepszych z ostatnich 3 rund (suma punktów, z remisami).
- **Rekordy sezonu** — najwięcej punktów i największy awans w jednej rundzie, najwięcej rund na prowadzeniu i w TOP 10, najwyższa średnia i najrówniej punktujący gracz (oba na wspólnym zakresie rund z pełnymi danymi, np. R12–R20, żeby wszyscy byli porównywani na tych samych rundach).
- **Historia gracza** — kliknięcie dowolnego nicka otwiera wykres miejsca po każdej rundzie i tabelę wszystkich rund (obecne i najlepsze miejsce z liczbą rund, średnia punktów na rundę sezonu).
- **Pojedynek** — dwa nicki obok siebie: różnica punktów po każdej rundzie na wykresie, bilans rund i tabela runda po rundzie.
- **Ex aequo** — przy równej liczbie punktów wspólne miejsce z „=” (np. „2=”) w całej stronie; pełny zakres miejsc w dymku po najechaniu. Strzałki zmian liczone są ze wspólnych miejsc.
- **Kanał RSS** (`feed.xml`, ikona w górnym pasku i przycisk pod tytułem) — wpis po każdej nowej rundzie: lider, TOP 10, największe awanse i aktywność.
- **Jasny i ciemny motyw**, wersja na telefon, obsługa klawiaturą (Tab / Enter), ikona i dodawanie do ekranu głównego, podgląd linku (Open Graph) przy udostępnianiu na Messengerze czy Facebooku.

### Linki

| Adres | Co robi |
|---|---|
| `?id=9684` | podświetla gracza (numer użytkownika z parcfer.me) i otwiera „Moją okolicę”; nie nadpisuje nicka zapisanego w przeglądarce. Takie linki tworzą przyciski „🔗 Udostępnij” |
| `?id=9684&vsid=1650` | otwiera pojedynek dwóch graczy |
| `?nick=Pat`, `?nick=Pat&vs=Kapexis` | starsze linki po nicku — nadal działają, ale przy powtórzonym nicku wskazują osobę wg etykiety „(2)” |
| `?sezon=2026` | konkretny sezon (przy ≥2 sezonach w nagłówku pojawia się przełącznik) |

## Dane

- `data/<rok>.json` — lista rund, w każdej:
  - `name` — nazwa z numerem rundy, np. „Brazylia R20”,
  - `date` — dzień wyścigu (zamknięcie typowania + 1 dzień, w weekend ze sprintem + 2 dni, bo typowanie zamyka się w piątek przed kwalifikacjami do sprintu),
  - `captured_at` — moment pobrania rankingu z parcfer.me (UTC; od rund pobieranych automatycznie, wcześniejsze go nie mają) — z niego RSS bierze datę wpisu,
  - `top` — tylko w rundach z samą czołówką: ile osób zapisano (Spa R10 — 30, Węgry R11–Singapur R17 — 100); brak pola = pełny ranking,
  - `standings` — ranking `{ pos, name, points, id }`; `id` to numer użytkownika z parcfer.me. Innych pól nie zapisujemy — w szczególności `ids2` z danych parcfer.me (to skrót MD5 adresu e-mail gracza); pilnuje tego `tools/check_data.py`.
- Zapisane rundy: **Japonia R3** i **Silverstone R9** — pełny ranking odtworzony z kopii strony w Web Archive (10.04 i 16.07.2026), **Spa R10** — TOP 30, **Węgry R11–Singapur R17** — TOP 100, od **USA R18** — pełny ranking wszystkich uczestników. Rund R1–R2 i R4–R8 nie ma. Osoby spoza zapisanej czołówki mają w starszych rundach „> 30” / „> 100”, a przez przerwę w danych (R3 → R9) strona nie pokazuje przyrostu ani strzałek zmiany miejsca.
- Uczestników rozróżnia `id`, więc powtarzające się nicki („Oskar”, „Oskar (2)”) nie mieszają się między rundami. Numery „(2)”, „(3)” nadawane są w kolejności pojawienia się w danych sezonu (runda pierwszego wystąpienia, w niej miejsce), więc nie zmieniają się po kolejnych rundach. W rundach do Singapuru R17 `id` dopisano wstecz po nicku (przy powtórzeniach po kolejności, sprawdzonej z ciągłością punktów).

## Aktualizacja po rundzie

**Automatycznie:** workflow `.github/workflows/update-ranking.yml` co 3 godziny uruchamia `python3 tools/add_round.py --auto`. Skrypt sprawdza na parcfer.me ostatnie rozliczone typowanie rankingowe sezonu, a gdy ranking jest już przeliczony — dopisuje rundę, robi commit i zleca publikację na Pages.

- **Numer rundy** to miejsce GP w kalendarzu sezonu (`data/seasons.json` → `calendar`, nazwy GP jak na parcfer.me), więc dodatkowe typowanie na liście nie przesuwa numerów. Typowania z `rankingowa` ≠ `true` są pomijane, a rozliczone GP spoza kalendarza przerywa z błędem („dopisz GP do data/seasons.json”). Nazwa rundy pochodzi z `data/round_names.json`.
- **Korekty po zapisie** (np. kara po wyścigu): dopóki następne typowanie się nie zamknęło, automat porównuje ostatnią rundę z parcfer.me i przy różnicy podmienia ją (commit „Korekta rundy …”, data zostaje).
- **Alarm:** gdy typowanie jest rozliczone od ponad 96 godzin, a ranking na parcfer.me wciąż się nie zmienił, workflow kończy się błędem — GitHub wysyła wtedy e-mail, a rundę można dodać ręcznie, zanim przepadnie.
- **Przerwa zimowa:** GitHub wyłącza harmonogram po 60 dniach bez commitów, więc po ok. 50 dniach ciszy workflow robi pusty commit „Keepalive harmonogramu aktualizacji” (próg w zmiennej repozytorium `KEEPALIVE_DAYS`).
- Nietypowe dane (spadek punktów, przyrost ponad 25 na rundę) przerywają z błędem. Rundę starszą niż ostatnia skrypt wstawia na właściwe miejsce wg numeru (R3 przed R9) i sprawdza z rundami po obu stronach. Przed zapisem automat uruchamia też `tools/check_data.py`.

Ręczne uruchomienie: zakładka Actions → „Aktualizacja rankingu” → Run workflow. Do testów `--auto` przyjmuje `--contests lista.json` (lista typowań z pliku) i `--html` (zapisany ranking).

**Ręcznie:** po przeliczeniu punktów na parcfer.me, a przed kolejnym GP (strona pokazuje tylko stan bieżący):

```
python3 tools/add_round.py "Meksyk R19"
```

Zamiast pobierania można podać `--html zapisana_strona.html` albo `--tsv tabela.tsv` (kolumny: pozycja, nick, punkty); `--replace` podmienia ostatnią rundę, a `--date RRRR-MM-DD` ustawia datę rundy (dzień wyścigu).

## Struktura

- `index.html` — struktura strony; `css/style.css` — wygląd; `js/app.js` — cała logika (czysty HTML + CSS + JS, bez zależności i bez kroku budowania)
- `data/seasons.json` — lista sezonów, sezon domyślny, liczba rund (`planned_rounds`), rundy ze sprintem (`sprints`) i kalendarz GP (`calendar`)
- `data/<rok>.json` — dane sezonu
- `data/round_names.json` — krótkie nazwy rund (np. „Sao Paulo” → „Brazylia”)
- `tools/add_round.py` — dopisuje rundę z rankingu parcfer.me (z ponawianiem przy chwilowej awarii strony)
- `tools/build_feed.py` — buduje kanał RSS `feed.xml` (uruchamiany automatycznie po dodaniu rundy)
- `tools/check_data.py` — sprawdza spójność danych (kolejność, unikalne id, ciągłość punktów każdego gracza)
- `.github/workflows/update-ranking.yml` — automatyczne pobieranie rund
- `.github/workflows/check-data.yml` — kontrola danych przy każdej zmianie w `data/` lub `tools/`
- `.github/workflows/check-page.yml` + `tests/smoke.mjs` — test strony w przeglądarce (Playwright): widoki, historia, pojedynek, CSV, brak błędów JS
- `.github/workflows/release.yml` — wydanie na GitHubie po dopisaniu nowej wersji do `CHANGELOG.md` (albo po tagu `vX.Y.Z`)
- `.github/dependabot.yml` — cotygodniowe podbijanie wersji akcji GitHub Actions i Playwrighta w `tests/`
- `.github/FUNDING.yml` — przycisk Sponsor (Buy Me a Coffee) na stronie repozytorium
- `assets/fonts/` — font Plus Jakarta Sans (licencja SIL OFL, `OFL.txt`) serwowany ze strony, bez Google Fonts
- `assets/` — baner (`banner.jpg` oraz lżejsze `banner-800/1600/3200` w WebP i JPEG — przeglądarka wybiera rozmiar pod ekran), obrazek podglądu linku (`og.jpg`) i ikony strony
- `site.webmanifest` — nazwa i ikona przy dodawaniu strony do ekranu głównego telefonu

## Nowy sezon

**Automatycznie:** gdy na parcfer.me pojawią się rozliczone typowania kolejnego sezonu, `add_round.py --auto` sam zakłada `data/<rok>.json`, dopisuje rok do `data/seasons.json`, ustawia go jako domyślny i pobiera pierwszą rundę. Poprzedni sezon zostaje dostępny pod `?sezon=<rok>`.

**Konfiguracja sezonów** w `data/seasons.json`: `planned_rounds` — liczba rund (dla kalkulatora „ile brakuje”), `sprints` — numery rund z weekendem sprinterskim (oznaczenie ⚡), `max_points` — najwięcej punktów za typowanie (`race` — zwykły weekend, `sprint` — weekend ze sprintem; dla kalkulatora „matematycznie poza zasięgiem” i kontroli danych; 20 i 25 to założenie zgodne z historią — zwykłe typowanie ma 20 pytań, a najwyższy przyrost w 2026 to 16 pkt w zwykłej rundzie i 17 w sprinterskiej), `calendar` — kolejne GP sezonu w formie z parcfer.me („Typowanie GP **Sao Paulo** 2026”), z których automat bierze numer rundy. Bez kalendarza danego sezonu numer rundy to kolejność typowania (z ostrzeżeniem w logu) — **przed startem nowego sezonu dopisz jego kalendarz**. Na podstawie kalendarzy parcfer.me: 2026 — 23 rundy, sprinty R2, R4, R5, R9, R12, R17; 2027 — 24 rundy, sprinty R1, R3, R4, R7, R8, R10, R14, R21, R23, R24. Przy zmianach w kalendarzu (np. odwołane GP) popraw te liczby; nowe tory dopisz w `data/round_names.json`.

## Wydania

Historia wersji jest w [CHANGELOG.md](CHANGELOG.md). Nowe wydanie: dopisz na górze `CHANGELOG.md` sekcję `## vX.Y.Z (RRRR-MM-DD) — tytuł` i wypchnij na `main` — workflow „Wydanie” sam zauważy wersję bez tagu, założy tag i utworzy wydanie z treścią tej sekcji. Działa też wypchnięcie tagu `vX.Y.Z` albo ręczne uruchomienie (Actions → „Wydanie” → Run workflow, pole wersji).

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

**Wersja w górnym pasku** (bez kroku budowania): wydanie z pierwszej sekcji `## vX.Y.Z` w `CHANGELOG.md`, a liczba commitów na `main` po nim i skrót ostatniego commita z API GitHuba (wynik pamiętany 15 minut w przeglądarce):

- `v1.2.0` — strona odpowiada wydaniu,
- `v1.2.0+3 · abc1234` — 3 commity po wydaniu (np. nowe rundy); skrót prowadzi do porównania zmian. Na telefonie sam numer i liczba commitów.

Bez odpowiedzi API (limit zapytań, brak sieci) pasek pokazuje samo wydanie.

## Statystyki

Anonimowe statystyki odwiedzin (bez cookies): [parcferme.goatcounter.com](https://parcferme.goatcounter.com/). Kliknięcia w przycisk i baner Buy Me a Coffee są liczone jako zdarzenia `buymeacoffee` i `buymeacoffee-banner`.

## Wsparcie

Jeśli zestawienie Ci się przydaje: [☕ Postaw mi kawę](https://buymeacoffee.com/patrykw).

## Licencja

Kod: [MIT](LICENSE). Licencja nie obejmuje danych rankingu w `data/` — patrz uwaga na górze.
