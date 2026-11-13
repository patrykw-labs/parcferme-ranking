# Historia zmian

Format: każda wersja to nagłówek `## vX.Y.Z (RRRR-MM-DD) — tytuł`. Workflow „Wydanie” (`.github/workflows/release.yml`) po wypchnięciu tagu `vX.Y.Z` tworzy wydanie na GitHubie z treścią sekcji tej wersji.

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

### Pod spodem
- Style i skrypt w osobnych plikach (`css/style.css`, `js/app.js`).
- Kontrola spójności danych (`tools/check_data.py`) i test strony w przeglądarce (`tests/smoke.mjs`) w GitHub Actions; Dependabot dla wersji akcji.

## v1.0.0 (2026-11-11) — Pierwsza pełna wersja

- Tabela runda po rundzie (TOP 100 / Moja okolica / Wszyscy), pełny ranking od USA R18, ex aequo „=”.
- Twoja pozycja, historia gracza z wykresem, pojedynek dwóch graczy, linki `?nick=` i `?vs=` z podglądem Open Graph.
- Kafelki rundy, TOP 10, aktywność, forma z ostatnich 3 rund.
- Automatyczne pobieranie rund z parcfer.me (GitHub Actions co 3 godziny), rozróżnianie graczy po numerze użytkownika.
- Jasny i ciemny motyw, wersja na telefon, statystyki odwiedzin bez cookies.
