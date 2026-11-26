# Historia zmian

Format: każda wersja to nagłówek `## vX.Y.Z (RRRR-MM-DD) — tytuł`. Workflow „Wydanie” (`.github/workflows/release.yml`) po wypchnięciu na `main` nowej wersji (bez tagu) sam zakłada tag i tworzy wydanie na GitHubie z treścią sekcji tej wersji.

## v1.4.0 (2026-11-26) — Nowy układ strony

### Nowości
- **Nowy układ na telefonie:**
  - tabela rankingu jest zaraz po „Walce o tytuł”, a nad nią rozwijany „Pojedynek”;
  - forma, rekordy sezonu, zwycięzcy rund, rozkład punktów i obserwowani to rozwijane wiersze „Statystyki sezonu” z podglądem najważniejszej liczby (np. „mediana 7 pkt”, „R21: me-to +13”). Na telefonie są zwinięte, na komputerze rozwinięte, a przeglądarka pamięta wybór;
  - linki `#forma`, `#rekordy`, `#zwyciezcy`, `#rozklad`, `#pojedynek` i `#obserwowani` otwierają wybraną sekcję.
- **Pasek kontekstu na telefonie:** po przewinięciu u góry pojawia się „sezon · runda · Twoje miejsce” z przyciskiem „Zmień”, który wysuwa wybór sezonu, rundy i RSS.
- **Pasek kafelków na telefonie:** kafelki rundy przewija się palcem w bok.
- **Komputer:** sezony, „Stan po rundzie” i „Subskrybuj RSS” są w jednej linii pod tytułem.
- **„Stan po rundzie”** jest w wyraźnej ramce, złotej przy oglądaniu wcześniejszego stanu rankingu.
- **Zwycięzcy rund:** punkty na zielonym tle, tym mocniejszym, im lepszy wynik. Najlepszy wynik sezonu ma 🔥.
- **Wygląd:** mniejsze zaokrąglenia i mniej cieni. Rekordy są listą zamiast kafelków, zwycięzcy rund i forma pokazują początek listy z „Pokaż wszystkie”, a baner „Postaw kawę” jest pod tabelą.

### Poprawki
- **Rozkład punktów** pokazuje medianę wśród punktujących. Wśród wszystkich graczy wynosiła zwykle 0, bo większość nie zdobywa punktów.
- **Notka o zapisanych rundach** jest generowana z danych dla sezonów innych niż 2026, więc w 2027 nie będzie opisywać braków z 2026.
- **Wersja w pasku:** gdy sprawdzenie zmian po wydaniu się nie uda, pasek pokazuje samo wydanie, a przyczyna jest tylko w dymku (zamiast „+?”).
- **Kontrast w ciemnym motywie:** własny wiersz w „Walce o tytuł” jest czytelny także wtedy, gdy nie masz już szans na tytuł.

### Inne
- **Licencja kodu:** zmiana z MIT na GNU AGPL-3.0.

## v1.3.2 (2026-11-17) — Wersja w pasku i drobne poprawki

### Poprawki
- **Wersja w górnym pasku** pokazuje „+N” od razu po nowym commicie (bez 15-minutowej pamięci wyniku). Gdy sprawdzenie się nie uda — np. po wyczerpaniu limitu 60 zapytań na godzinę do API GitHuba z jednego adresu IP — znacznik pokazuje „+?”, a przyczyna jest w dymku. Data wydania jest pamiętana w przeglądarce, więc kolejne wejścia to jedno lekkie zapytanie zamiast trzech.
- Wyszukiwanie przy sortowaniu po rundzie: najpierw sortowanie, potem limit 150 wierszy — widać najlepszych w tej rundzie spośród pasujących.
- Sezony archiwalne: sekcja nazywa się „Mistrzowie sezonów” zamiast „Rekordy sezonu”.

## v1.3.1 (2026-11-17) — Poprawki po przeglądzie

### Poprawki
- **Link do ligi nie nadpisuje już Twojej listy obserwowanych** — liga z `?liga=` jest tylko w pamięci strony; gwiazdka dopisuje do własnej listy, a „✕ Zamknij ligę” wraca do niej bez kasowania.
- Karty rekordów średniej i równości pokazują zakres rund (np. „R12–R20”).
- Sezony archiwalne (jedna runda) nie pokazują pustych kafelków rundy ani kart rekordów — tylko listę mistrzów.

### Wydajność
- Wyszukiwarka przelicza tabelę po krótkiej przerwie w pisaniu i pokazuje najwyżej 150 wierszy (np. „a”: ok. 55 ms zamiast 0,5 s).
- Wpisanie nicka w „Twojej pozycji” nie przelicza już rekordów ani zwycięzców rund.
- Wersja w górnym pasku pobiera z API GitHuba ok. 2 KB zamiast kilkuset KB.

## v1.3.0 (2026-11-16) — Walka o tytuł, archiwum sezonów, mini-ligi i zwycięzcy rund

### Nowe funkcje
- **Walka o tytuł** — ilu graczy może jeszcze matematycznie wygrać sezon, ile średnio na rundę trzeba zdobywać ponad lidera, Twoja sytuacja i kiedy lider zapewni sobie tytuł; po ostatniej rundzie — mistrz sezonu.
- **Archiwum sezonów 2022–2025** — końcowe rankingi poprzednich sezonów (`?sezon=2024`), lista **mistrzów sezonów** i **sezony gracza** w jego historii.
- **Ranking po wybranej rundzie** — lista „Stan po rundzie” i link `?runda=R19`: cała strona tak, jak wyglądała po danej rundzie; każdy wpis RSS prowadzi do stanu po swojej rundzie.
- **Tylko aktywni** — przełącznik przy tabeli (punkty w co najmniej jednej z 2 ostatnich rund) i miejsce wśród aktywnych w karcie „Twoja pozycja”.
- **Obserwowani / mini-liga** — gwiazdka ☆ przy nicku, widok „⭐ Obserwowani”, wspólny wykres miejsc (do 8 graczy), link do ligi `?liga=…` i przycisk „✕ Wyczyść”.
- **Zwycięzcy rund i rozkład punktów** — kto zdobył najwięcej w każdej rundzie oraz ile osób zdobyło 1, 2, 3… pkt w wybranej rundzie (z Twoim wynikiem).
- **Przyrost przez przerwę R3 → R9** — w Silverstone R9 „+66 · 6 rund” ze średnią na rundę (bez wpływu na rekordy i formę).
- **Wersja strony w górnym pasku** — `v1.3.0` albo `v1.3.0+N · commit`, gdy na main są zmiany po wydaniu.

### Dane i automat
- Maksimum punktów za typowanie w `data/seasons.json` (`max_points`: 20, w weekend ze sprintem 25) — kalkulator „ile brakuje” pisze „matematycznie poza zasięgiem”, a kontrola danych ma limit zależny od typu rundy.
- `data/history.json` — wyniki każdego gracza we wszystkich sezonach i mistrzowie; odświeżany automatycznie po każdej rundzie.
- Kopia zapasowa surowego rankingu z parcfer.me (bez `ids2`) jako artefakt przebiegu przy każdej zapisanej rundzie.

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
