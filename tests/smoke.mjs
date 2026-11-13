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

const browser = await chromium.launch(EXE ? { executablePath: EXE } : {});

async function open(url, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true, ...opts });
  const page = await ctx.newPage();
  page.errs = [];
  page.on('pageerror', e => page.errs.push('JS: ' + e.message));
  // „Failed to load resource” pomijamy: to celowo zablokowane usługi zewnętrzne, a brakujące pliki strony łapie nasłuch odpowiedzi niżej
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|goatcounter|zgo\.at|fonts\.g/.test(m.text())) page.errs.push('console: ' + m.text()); });
  page.on('response', r => { if (r.status() >= 400 && !/goatcounter|zgo\.at|fonts\.g|img\.buymeacoffee/.test(r.url())) page.errs.push(r.status() + ' ' + r.url()); });
  // zewnętrzne usługi nie są częścią testu
  await page.route(/fonts\.(googleapis|gstatic)\.com|gc\.zgo\.at|goatcounter|img\.buymeacoffee/, r => r.abort());
  await page.goto(BASE + url);
  await page.waitForSelector('#ps-table tbody tr:nth-child(5)');
  return page;
}

console.log('Komputer, motyw ciemny');
let p = await open('', { colorScheme: 'dark' });
check((await p.$$('#ps-table tbody tr')).length >= 100, 'tabela TOP 100');
check((await p.textContent('#ps-subtitle')).includes('uczestników'), 'nagłówek z liczbą uczestników');
check((await p.$$('#k-top10 li')).length === 10, 'kafelek TOP 10');
check((await p.$$('#rec-grid .rec')).length >= 4, 'rekordy sezonu');
await p.click('#seg-all');
check(await p.isVisible('#ps-pager'), 'widok Wszyscy ze stronami');
await p.click('#ps-pager button[aria-label="Następna strona"]');
check(await p.evaluate(() => PAGE) === 1, 'przejście na kolejną stronę');
await p.click('#seg-top');
await p.fill('#ps-filter', FAR);
check(await p.isVisible('#ps-jump'), 'wyszukiwarka: przycisk „Pokaż w tabeli” dla pełnego nicka');
await p.click('#ps-jump');
check(await p.evaluate(() => VIEW) === 'all' && !!(await p.$('tr.flash')), 'skok do wiersza gracza spoza TOP 100');
await p.fill('#ps-myname', A);
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
await p.focus('#ps-table tbody tr:nth-child(3) td.c-name');
await p.keyboard.press('Enter');
check(await p.$eval('#hist', d => d.open), 'historia otwierana z klawiatury (Enter)');
await p.keyboard.press('Escape');
check(p.errs.length === 0, 'brak błędów: ' + (p.errs.join(' | ') || 'OK'));

console.log('Link do pojedynku, telefon, motyw jasny');
p = await open(`?nick=${encodeURIComponent(A)}&vs=${encodeURIComponent(B)}`, { viewport: { width: 390, height: 844 }, colorScheme: 'light' });
await p.waitForSelector('#duel-chart svg', { timeout: 5000 }).catch(() => {});
check(!!(await p.$('#duel-chart svg')), 'pojedynek z wykresem');
check(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'nic nie wystaje poza ekran telefonu');
check(p.errs.length === 0, 'brak błędów: ' + (p.errs.join(' | ') || 'OK'));

console.log('Pliki statyczne');
for (const f of ['feed.xml', 'site.webmanifest', 'assets/icon.svg', 'assets/og.jpg']) {
  const r = await p.request.get(BASE + f);
  check(r.ok(), f);
}

await browser.close();
if (failures.length) { console.error(`\n${failures.length} problemów`); process.exit(1); }
console.log('\nStrona działa.');
