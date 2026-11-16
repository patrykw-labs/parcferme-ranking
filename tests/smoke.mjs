// Test strony w przeglądarce: node tests/smoke.mjs http://127.0.0.1:8000/
// Otwiera stronę na komputerze i telefonie, przechodzi przez wszystkie widoki i funkcje
// i kończy się błędem przy wyjątku JS, nieudanym pliku albo niespełnionym warunku.
import { chromium } from 'playwright';
import fs from 'fs';

const BASE = process.argv[2] || 'http://127.0.0.1:8000/';
const EXE = process.env.CHROMIUM_PATH; // lokalnie można wskazać własną przeglądarkę
const failures = [];
const check = (ok, msg) => { console.log((ok ? '  ✓ ' : '  ✗ ') + msg); if (!ok) failures.push(msg); };

// nicki do testów bierzemy z danych (bez wpisywania na sztywno)
const seasons = JSON.parse(fs.readFileSync('data/seasons.json', 'utf8'));
const season = JSON.parse(fs.readFileSync(`data/${seasons.default}.json`, 'utf8'));
const last = season.rounds[season.rounds.length - 1].standings;
const A = last[0].name, B = last[1].name, FAR = last[Math.min(last.length - 1, 150)].name;
// TOP 100 = miejsce ex aequo ≤ 100 (remis na granicy w całości)
const place = s => Math.min(...last.filter(x => x.points === s.points).map(x => x.pos));
const TOP = last.filter(s => place(s) <= 100).length;
// nick, który ma kilka osób (wybór „to ja” z listy)
const cnt = {}; for (const r of season.rounds) for (const s of r.standings) (cnt[s.name] ||= new Set()).add(s.id);
const DUP = Object.keys(cnt).find(n => cnt[n].size > 1 && last.some(s => s.name === n));

const browser = await chromium.launch(EXE ? { executablePath: EXE } : {});

async function open(url, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true, ...opts });
  const page = await ctx.newPage();
  page.errs = [];
  page.on('pageerror', e => page.errs.push('JS: ' + e.message));
  // „Failed to load resource” pomijamy: to celowo zablokowane usługi zewnętrzne, a brakujące pliki strony łapie nasłuch odpowiedzi niżej
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|goatcounter|zgo\.at|fonts\.g|api\.github/.test(m.text())) page.errs.push('console: ' + m.text()); });
  page.on('response', r => { if (r.status() >= 400 && !/goatcounter|zgo\.at|fonts\.g|img\.buymeacoffee|api\.github/.test(r.url())) page.errs.push(r.status() + ' ' + r.url()); });
  // zewnętrzne usługi nie są częścią testu
  await page.route(/fonts\.(googleapis|gstatic)\.com|gc\.zgo\.at|goatcounter|img\.buymeacoffee|api\.github\.com/, r => r.abort());
  await page.goto(BASE + url);
  await page.waitForSelector('#ps-table tbody tr:nth-child(5)');
  return page;
}

console.log('Komputer, motyw ciemny');
let p = await open('', { colorScheme: 'dark' });
check((await p.$$('#ps-table tbody tr')).length === TOP, `tabela TOP 100 (${TOP} wierszy z remisem na granicy)`);
check((await p.textContent('#ps-subtitle')).includes('uczestników'), 'nagłówek z liczbą uczestników');
await p.waitForSelector('#ps-ver:not([hidden])', { timeout: 5000 }).catch(() => {});
check(/^v\d+\.\d+\.\d+/.test((await p.textContent('#ps-ver')).trim()), 'wersja strony w górnym pasku: ' + (await p.textContent('#ps-ver')).trim());
check((await p.$$('#k-top10 li')).length === 10, 'kafelek TOP 10');
check((await p.$$('#rec-grid .rec')).length >= 4, 'rekordy sezonu');
// walka o tytuł: tylko gdy seasons.json ma max_points i sezon jeszcze trwa
if (seasons.max_points && (seasons.planned_rounds || {})[seasons.default]) check(/\d/.test(await p.textContent('#title-body')), 'walka o tytuł: ' + (await p.textContent('#title-sec .title-sum .v')).trim());
await p.click('#seg-all');
check(await p.isVisible('#ps-pager'), 'widok Wszyscy ze stronami');
await p.click('#ps-pager button[aria-label="Następna strona"]');
check(await p.evaluate(() => PAGE) === 1, 'przejście na kolejną stronę');
await p.click('#seg-top');
await p.fill('#ps-filter', FAR);
check(await p.isVisible('#ps-jump'), 'wyszukiwarka: przycisk „Pokaż w tabeli” dla pełnego nicka');
await p.click('#ps-jump');
check(await p.evaluate(() => VIEW) === 'all' && !!(await p.$('tr.flash')), 'skok do wiersza gracza spoza TOP 100');
// pole „Twoja pozycja” przelicza stronę z opóźnieniem (debounce) — czekamy na kartę
await p.fill('#ps-myname', A);
await p.waitForFunction(() => document.getElementById('k-me').textContent.includes('pkt'), null, { timeout: 5000 }).catch(() => {});
check((await p.textContent('#k-me')).includes('pkt'), 'karta Twoja pozycja');
check(await p.isVisible('#calc-out'), 'kalkulator „ile brakuje”');
await p.click('#seg-near');
check((await p.$$('#ps-table tbody tr')).length > 5, 'widok Moja okolica');
await p.click('#seg-top');
const sortable = await p.$$('th[data-sort]:not([data-sort="-1"])');
if (sortable.length) {
  await sortable[sortable.length - 1].click();
  check(!!(await p.$('th.srt.on')), 'sortowanie po rundzie');
  await p.click('th.srt.on');
}
const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 5000 }).catch(() => null), p.click('#ps-csv')]);
const csv = dl ? fs.readFileSync(await dl.path(), 'utf8') : '';
check(csv.split('\r\n').length > last.length, 'eksport CSV ze wszystkimi uczestnikami');
await p.click('#ps-table tbody tr:nth-child(2) td.c-name');
await p.waitForSelector('#hist[open] svg', { timeout: 5000 }).catch(() => {});
check(await p.$eval('#hist', d => d.open), 'okno historii gracza z wykresem');
await p.keyboard.press('Escape');
await p.focus('#ps-table tbody tr:nth-child(3) td.c-name button.nm');
await p.keyboard.press('Enter');
check(await p.$eval('#hist', d => d.open), 'historia otwierana z klawiatury (Enter)');
await p.keyboard.press('Escape');
if (DUP) {
  await p.fill('#ps-myname', DUP);
  await p.waitForSelector('#k-me [data-pick]', { timeout: 5000 }).catch(() => {});
  const picks = (await p.$$('#k-me [data-pick]')).length;
  check(picks === cnt[DUP].size && (await p.$$('tr.me')).length === 0, `powtórzony nick „${DUP}”: wybór ${picks} osób, nikt nie podświetlony`);
  await p.click('#k-me [data-pick]');
  check(await p.evaluate(() => !!ME && psName(ME) === document.getElementById('ps-myname').value), 'wybór osoby z listy');
}
await p.fill('#ps-filter', 'ł');
const folded = await p.$$eval('#ps-table tbody tr[data-row]', rows => rows.length);
await p.fill('#ps-filter', 'l');
check((await p.$$eval('#ps-table tbody tr[data-row]', rows => rows.length)) >= folded, 'wyszukiwarka bez polskich znaków');
await p.fill('#ps-filter', '');
check(p.errs.length === 0, 'brak błędów: ' + (p.errs.join(' | ') || 'OK'));

// archiwum sezonów: mistrzowie z data/history.json i strona zakończonego sezonu
const hist = fs.existsSync('data/history.json') ? JSON.parse(fs.readFileSync('data/history.json', 'utf8')) : null;
const pastSeason = seasons.seasons.find(y => y !== seasons.default);
if (hist && Object.keys(hist.champions).length) {
  await p.waitForSelector('#champs:not([hidden])', { timeout: 5000 }).catch(() => {});
  check(await p.isVisible('#champs'), 'mistrzowie sezonów');
}
if (pastSeason) {
  console.log(`Sezon archiwalny ${pastSeason}`);
  const pa = await open(`?sezon=${pastSeason}`);
  check((await pa.textContent('#ps-season')).trim() === String(pastSeason) && (await pa.$$('#ps-table tbody tr')).length >= 100, `tabela sezonu ${pastSeason}`);
  check(pa.errs.length === 0, 'brak błędów: ' + (pa.errs.join(' | ') || 'OK'));
}

// ranking po wybranej rundzie (?runda=R…): przedostatnia zapisana runda
if (season.rounds.length > 1) {
  const prevName = season.rounds[season.rounds.length - 2].name, prevNo = prevName.match(/R(\d+)$/)[1];
  console.log(`Ranking po rundzie ${prevName}`);
  const pr = await open(`?runda=R${prevNo}`);
  check((await pr.textContent('#ps-subtitle')).includes('stan po ' + prevName) && await pr.isVisible('#ps-past'), `?runda=R${prevNo} pokazuje stan po ${prevName}`);
  await pr.selectOption('#ps-round', '');
  check((await pr.textContent('#ps-subtitle')).includes('stan po ' + season.rounds[season.rounds.length - 1].name) && !(await pr.isVisible('#ps-past')), 'powrót do bieżącego stanu');
  check(pr.errs.length === 0, 'brak błędów: ' + (pr.errs.join(' | ') || 'OK'));
}

// filtr aktywnych (gdy ostatnie rundy są pełne) i obserwowani
if (await p.isVisible('#act-only-l')) {
  await p.click('#seg-all');
  await p.check('#act-only');
  check((await p.textContent('#ps-pager .info')).includes('aktywnych'), 'filtr „tylko aktywni”: ' + (await p.textContent('#ps-pager .info')).trim());
  await p.uncheck('#act-only');
  await p.click('#seg-top');
}
await p.click('#ps-table tbody tr:nth-child(1) .star');
await p.click('#ps-table tbody tr:nth-child(2) .star');
await p.waitForSelector('#watch-chart svg', { timeout: 5000 }).catch(() => {});
check(await p.isVisible('#watch-sec') && !!(await p.$('#watch-chart svg')), 'obserwowani: sekcja z wykresem');
await p.click('#seg-watch');
check((await p.$$('#ps-table tbody tr[data-row]')).length >= 2, 'widok „Obserwowani” w tabeli');
p.once('dialog', d => d.accept());
await p.click('#watch-clear');
check(await p.evaluate(() => WATCH.length === 0 && VIEW === 'top') && await p.isHidden('#watch-sec'), 'wyczyszczenie listy obserwowanych');
console.log('Link do ligi');
const lg = await open(`?liga=${last.slice(0, 5).map(s => s.id).join(",")}`); // open() czeka na 5 wierszy tabeli
await lg.waitForSelector('#watch-chart svg', { timeout: 5000 }).catch(() => {});
check(await lg.evaluate(() => VIEW === 'watch') && !!(await lg.$('#watch-chart svg')), 'liga z linku ?liga=');
check(lg.errs.length === 0, 'brak błędów: ' + (lg.errs.join(' | ') || 'OK'));

console.log('Link do gracza po id');
p = await open(`?id=${last[2].id}`);
check(await p.evaluate(id => ME === 'u' + id, last[2].id), 'link ?id= pokazuje właściwego gracza');
check(p.errs.length === 0, 'brak błędów: ' + (p.errs.join(' | ') || 'OK'));

console.log('Link do pojedynku, telefon, motyw jasny');
p = await open(`?id=${last[0].id}&vsid=${last[1].id}`, { viewport: { width: 390, height: 844 }, colorScheme: 'light' });
await p.waitForSelector('#duel-chart svg', { timeout: 5000 }).catch(() => {});
check(!!(await p.$('#duel-chart svg')) && await p.evaluate(ids => !!DUEL && DUEL.a === 'u' + ids[0] && DUEL.b === 'u' + ids[1], [last[0].id, last[1].id]), 'pojedynek z linku ?id=&vsid= z wykresem');
check(await p.evaluate(() => { const w = document.querySelector('.board .tw'); return Math.abs(w.scrollLeft - (w.scrollWidth - w.clientWidth)) <= 1; }), 'tabela przewinięta do kolumny „Suma”');
check(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'nic nie wystaje poza ekran telefonu');
check(p.errs.length === 0, 'brak błędów: ' + (p.errs.join(' | ') || 'OK'));

console.log('Starszy link ?nick=&vs=');
p = await open(`?nick=${encodeURIComponent(A)}&vs=${encodeURIComponent(B)}`);
await p.waitForSelector('#duel-chart svg', { timeout: 5000 }).catch(() => {});
check(!!(await p.$('#duel-chart svg')), 'pojedynek ze starego linku');

console.log('Pliki statyczne');
for (const f of ['feed.xml', 'site.webmanifest', 'assets/icon.svg', 'assets/og.jpg', 'assets/fonts/plus-jakarta-sans-latin-wght-normal.woff2']) {
  const r = await p.request.get(BASE + f);
  check(r.ok(), f);
}

await browser.close();
if (failures.length) { console.error(`\n${failures.length} problemów`); process.exit(1); }
console.log('\nStrona działa.');
