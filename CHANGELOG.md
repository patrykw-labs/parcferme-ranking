# Historia zmian

Format: każda wersja to nagłówek `## vX.Y.Z (RRRR-MM-DD) — tytuł`. Workflow „Wydanie” (`.github/workflows/release.yml`) po wypchnięciu na `main` nowej wersji (bez tagu) sam zakłada tag i tworzy wydanie na GitHubie z treścią sekcji tej wersji.

## v1.2.0 (2026-11-16) — Tożsamość graczy, remisy, odporny automat i dostępność

### Nowe funkcje
- **Linki po numerze gracza** (`?id=`, w pojedynku `&vsid=`) — zawsze otwierają tę samą osobę; stare linki `?nick=` i `?vs=` nadal działają.
- **Wybór siebie przy powtórzonym nicku** — np. 7 × „Michał”: lista z miejscem i punktami, wybór zapamiętany. Numery „(2)”, „(3)” nie zmieniają się już po kolejnych rundach.
- **Remisy wszędzie** — lider, skok rundy i najwięcej punktów w rundzie (na stronie i w RSS) pokazują wszystkich z tym samym wynikiem.
- **TOP 100 z remisem na granicy** — widok obejmuje wszystkich z miejscem do 100.
- **Wyszukiwarka bez polskich znaków** („lukasz” znajdzie „Łukasz”) i podpowiedzi nicków w polu „Twoja pozycja”.

### Dane i wyliczenia
- Średnia w historii gracza = punkty / rozegrane rundy sezonu; rekordy średniej i równości liczone na wspólnym zakresie rund (R12–R20).
- Data rundy to dzień wyścigu (poprawione Silverstone, Zandvoort, Singapur), nowe pole `captured_at` z momentem pobrania; rundy z samą czołówką mają jawne pole `top`.
- RSS: aktywność tylko przy dwóch pełnych rundach (bez błędnego wpisu przy Spa R10).

### Automat
- Numer rundy z kalendarza GP sezonu (`data/seasons.json` → `calendar`); typowania spoza rankingu pomijane, nieznane GP zatrzymuje automat z błędem.
- Korekty punktów na parcfer.me po zapisie rundy są pobierane automatycznie (commit „Korekta rundy …”).
- Alarm e-mailem, gdy typowanie jest rozliczone od 96 h, a ranking się nie zmienił.
- Keepalive — harmonogram nie wygaśnie w przerwie zimowej.
- `check_data.py` pilnuje, żeby w danych nie było pól spoza `{pos, name, points, id}` (w tym `ids2` z parcfer.me).

### Wygoda i wygląd
- Kontrast zgodny z WCAG AA w obu motywach, nicki jako przyciski (klawiatura, czytniki ekranu), większe cele dotykowe.
- Font z własnego serwera zamiast Google Fonts; tabela na telefonie zawsze przewinięta do kolumny „Suma”.
- Pole „Twoja pozycja” przelicza stronę po skończeniu pisania, a nie po każdym znaku.
- Eksport CSV chroni przed formułami, rozwijana notka „O danych”, neutralny tytuł podglądu linku.

## v1.1.0 (2026-11-13) — Rekordy, RSS, sprinty i historia od kwietnia

### Nowe funkcje
- **Rekordy sezonu** — najwięcej punktów i największy awans w jednej rundzie, najwięcej rund na prowadzeniu i w TOP 10, najwyższa średnia, najrówniej punktujący gracz.
- **Kalkulator „ile brakuje”** w karcie Twoja pozycja — ile punktów do P1 / TOP 3 / TOP 10 / TOP 50 / TOP 100 i ile średnio na rundę do końca sezonu.
- **Kanał RSS** (`feed.xml`) — wpis po każdej nowej rundzie; ikona w górnym pasku i przycisk pod tytułem.
- **Oznaczenie rund sprinterskich ⚡** w tabelach, na wykresach, w CSV i RSS, z legendą przy tabeli.
- **Sortowanie tabeli** po punktach zdobytych w wybranej rundzie i **eksport CSV** całej tabeli.
- **Automatyczny start nowego sezonu** — gdy parcfer.me rozliczy pierwsze typowanie 2027, sezon zakłada się sam.

### Dane
- **Japonia R3 i Silverstone R9** — pełne rankingi odtworzone z kopii strony w Web Archive; historia graczy sięga teraz kwietnia.
- Kalendarze 2026 (23 rundy) i 2027 (24 rundy) z listą sprintów w `data/seasons.json`; daty rozliczenia rund w danych.
- `add_round.py` wstawia starsze rundy na właściwe miejsce i sprawdza je z rundami po obu stronach; ponawia pobieranie przy chwilowej awarii parcfer.me.

### Wygoda i wygląd
- Ikona strony i dodawanie do ekranu głównego telefonu; obsługa klawiaturą (Tab / Enter).
- Lżejszy baner — na telefonie ok. 20–60 KB zamiast 360 KB.
- Kolor medalu na podium wg miejsca (remis „2=” — oba srebrne).
- Nowy baner i obrazek podglądu linku — „wszyscy typerzy” zamiast „TOP 100”.

### Pod spodem
- Style i skrypt w osobnych plikach (`css/style.css`, `js/app.js`).
- Kontrola spójności danych (`tools/check_data.py`) i test strony w przeglądarce (`tests/smoke.mjs`) w GitHub Actions; Dependabot dla wersji akcji.

## v1.0.0 (2026-11-11) — Pierwsza pełna wersja

- Tabela runda po rundzie (TOP 100 / Moja okolica / Wszyscy), pełny ranking od USA R18, ex aequo „=”.
- Twoja pozycja, historia gracza z wykresem, pojedynek dwóch graczy, linki `?nick=` i `?vs=` z podglądem Open Graph.
- Kafelki rundy, TOP 10, aktywność, forma z ostatnich 3 rund.
- Automatyczne pobieranie rund z parcfer.me (GitHub Actions co 3 godziny), rozróżnianie graczy po numerze użytkownika.
- Jasny i ciemny motyw, wersja na telefon, statystyki odwiedzin bez cookies.
