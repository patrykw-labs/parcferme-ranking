function lsGet(k){try{var v=localStorage.getItem(k);return v===null?null:{key:k,value:v};}catch(e){return null;}}
function lsSet(k,v){try{localStorage.setItem(k,v);return true;}catch(e){return false;}}
var MYNAME_KEY = 'parcfer-public-myname';
var MYKEY_KEY = 'parcfer-public-mykey'; // wybrana osoba (klucz 'u' + id), gdy nick ma kilka osób
var THEME_KEY = 'parcfer-theme';
var WATCH_KEY = 'parcfer-watch', ACTIVE_KEY = 'parcfer-active';
var state = { rounds: [], participants: {} };
var myName = '', myKey = null;
var ME = null, ME_MULTI = []; // „ja” po rozpoznaniu nicka: klucz osoby albo lista osób z tym samym nickiem
var SEASON = null, DEFAULT_SEASON = null;
var VIEW = 'top', PAGE = 0, PAGE_SIZE = 100, NEAR = 15;

function psEsc(s) {
  return String(s).replace(/[&<>"']/g, function(c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; });
}
function psNum(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
function psSigned(n) { return (n > 0 ? '+' : n < 0 ? '−' : '±') + Math.abs(n); }

function psToggleTheme() {
  var root = document.documentElement;
  var cur = root.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  var next = cur === 'dark' ? 'light' : 'dark';
  root.setAttribute('data-theme', next);
  lsSet(THEME_KEY, next);
}

function psBuildSeasonPicker(list) {
  var el = document.getElementById('ps-seasons');
  if (list.length < 2) { el.style.display = 'none'; return; }
  el.innerHTML = list.map(function(y) { return y === SEASON ? '<b>' + y + '</b>' : '<a href="?sezon=' + y + '">' + y + '</a>'; }).join('');
}

var seedRounds = [];
var seedRaw = {};
var seedTop = {};

// upto: ile pierwszych rund wziąć (ranking „po wybranej rundzie”, ?runda=R19); domyślnie wszystkie
function buildSeedState(upto) {
  var rounds = seedRounds.slice(0, upto || seedRounds.length);
  var st = { rounds: rounds, participants: {}, size: {}, top: {}, nick: {}, label: {}, tie: {}, first: [] };
  rounds.forEach(function(rnd) {
    var seen = {};
    st.size[rnd] = seedRaw[rnd].length;
    st.top[rnd] = seedTop[rnd] || null;
    seedRaw[rnd].forEach(function(row) {
      var pos = row[0], name = row[1], pts = row[2], id = row[3];
      seen[name] = (seen[name] || 0);
      // uczestnik = id z parcfer.me; bez id (stare dane) — nick i kolejność wśród takich samych nicków
      var key = id != null ? 'u' + id : (seen[name] > 0 ? name + ' (' + (seen[name]+1) + ')' : name);
      seen[name]++;
      st.nick[key] = name;
      if (!st.participants[key]) { st.participants[key] = {}; st.first.push(key); }
      st.participants[key][rnd] = { position: pos, points: pts };
    });
  });
  return st;
}
// etykiety: powtórzony nick dostaje „(2)”, „(3)” w kolejności pojawienia się w danych sezonu
// (runda pierwszego wystąpienia, w niej miejsce) — nowi gracze dostają kolejne numery, a istniejące etykiety się nie zmieniają
function psBuildLabels() {
  var count = {}, seen = {}, order = state.first;
  order.forEach(function(k) { var n = state.nick[k]; count[n] = (count[n] || 0) + 1; });
  order.forEach(function(k) {
    var n = state.nick[k]; seen[n] = (seen[n] || 0) + 1;
    state.label[k] = count[n] > 1 && seen[n] > 1 ? n + ' (' + seen[n] + ')' : n;
  });
}
function psName(k) { return state.label[k] || state.nick[k] || k; }
// porównanie bez wielkości liter i polskich znaków („ł” nie rozkłada się w NFD) — tylko do wyszukiwania
function psFold(s) { return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l'); }

// kto jest „mną”: wybrana osoba (myKey) albo jednoznaczny nick; nick wspólny dla kilku osób → wybór z listy
function psResolveMe() {
  ME = null; ME_MULTI = [];
  if (!myName) return;
  if (myKey && state.participants[myKey] && psName(myKey) === myName) { ME = myKey; return; }
  var keys = Object.keys(state.participants), q = myName.toLowerCase();
  var same = keys.filter(function(k) { return state.nick[k].toLowerCase() === q; });
  if (same.length > 1) { ME_MULTI = psOrder(state.rounds[state.rounds.length - 1]).filter(function(k) { return same.indexOf(k) !== -1; }); return; }
  ME = same[0] || keys.find(function(k) { return psName(k) === myName; }) || keys.find(function(k) { return psName(k).toLowerCase() === q; }) || null;
}
var MYNAME_T = null;
function psSaveMyName() {
  clearTimeout(MYNAME_T);
  MYNAME_T = setTimeout(function() {
    myName = document.getElementById('ps-myname').value.trim();
    lsSet(MYNAME_KEY, myName);
    if (myKey && psName(myKey) !== myName) { myKey = null; lsSet(MYKEY_KEY, ''); }
    psRenderAll(true);
  }, 200);
}
function psPickMe(k) {
  myKey = k; myName = psName(k);
  lsSet(MYKEY_KEY, k); lsSet(MYNAME_KEY, myName);
  document.getElementById('ps-myname').value = myName;
  psRenderAll(true);
}
function psSegUpdate() {
  ['top', 'near', 'all', 'watch'].forEach(function(k) { var b = document.getElementById('seg-' + k); b.classList.toggle('on', k === VIEW); b.setAttribute('aria-pressed', k === VIEW ? 'true' : 'false'); });
}
function psSetView(v) {
  VIEW = v; PAGE = 0;
  psSegUpdate();
  psRenderTable(true);
}
function psSetPage(p) { PAGE = p; psRenderTable(true); }

function psIsMe(k) { return !!ME && k === ME; }

// kolejność w danej rundzie: punkty, przy remisie miejsce z parcfer.me
function psOrder(round) {
  return Object.keys(state.participants).sort(function(a, b) {
    var da = state.participants[a][round], db = state.participants[b][round];
    var pa = da ? da.points : -1, pb = db ? db.points : -1;
    if (pb !== pa) return pb - pa;
    return (da ? da.position : Infinity) - (db ? db.position : Infinity);
  });
}
// numer rundy z nazwy („USA R18” → 18) i przerwa w danych (np. Japonia R3 → Silverstone R9)
// weekendy ze sprintem (numery rund z data/seasons.json → sprints)
var SPRINTS = [];
function psIsSprint(r) { return SPRINTS.indexOf(psRoundNo(r)) !== -1; }
function psRoundLabel(r) { return psEsc(r) + (psIsSprint(r) ? ' <span class="spr" title="Weekend ze sprintem">⚡</span>' : ''); }
function psRoundText(r) { return r + (psIsSprint(r) ? ' (sprint)' : ''); }
function psRoundNo(r) { var m = /R(\d+)$/.exec(r); return m ? +m[1] : null; }
function psGap(ri) {
  var a = psRoundNo(state.rounds[ri - 1]), b = psRoundNo(state.rounds[ri]);
  return a !== null && b !== null && b - a > 1;
}
// przyrost przez przerwę w danych (np. Japonia R3 → Silverstone R9): {v: punkty, n: liczba rund}; tylko do pokazania,
// nie do rekordów, formy ani sortowania (psRoundDelta zwraca tam null)
function psGapDelta(name, ri) {
  if (ri === 0 || !psGap(ri)) return null;
  var d = state.participants[name][state.rounds[ri]], p = state.participants[name][state.rounds[ri - 1]];
  return d && p ? { v: d.points - p.points, n: psRoundNo(state.rounds[ri]) - psRoundNo(state.rounds[ri - 1]) } : null;
}
function psGapTitle(ri, gd) {
  var a = psRoundNo(state.rounds[ri - 1]) + 1, b = psRoundNo(state.rounds[ri]);
  return 'Przyrost z ' + gd.n + ' rund (R' + a + '–R' + b + '), średnio ' + (gd.v / gd.n).toFixed(1).replace('.', ',') + ' pkt na rundę — rund R' + a + '–R' + (b - 1) + ' nie mamy, więc to nie jest przyrost w jednej rundzie';
}
function psRoundDelta(name, ri) {
  if (ri === 0 || psGap(ri)) return null; // przez przerwę to nie jest „przyrost w rundzie”
  var d = state.participants[name][state.rounds[ri]], p = state.participants[name][state.rounds[ri - 1]];
  return d && p ? d.points - p.points : null;
}
// runda z samą czołówką (pole „top” w danych: TOP 100, Spa TOP 30) — brak osoby nie znaczy, że jej nie było
function psPartial(round) { return state.top[round] != null; }
// stan względem poprzedniej rundy: liczba (zmiana), 'top' (wejście do TOP 100), 'new' (nowy uczestnik) albo null (brak danych)
function psStatus(name, ri, field) {
  if (ri < 1 || psGap(ri)) return null;
  var cur = state.participants[name][state.rounds[ri]], prevR = state.rounds[ri - 1], prev = state.participants[name][prevR];
  if (!cur) return null;
  // zmiana miejsca liczona ze wspólnych miejsc (ex aequo), tak jak są pokazywane
  if (prev) return field === 'points' ? cur.points - prev.points : psPlace(prevR, prev).place - psPlace(state.rounds[ri], cur).place;
  if (!psPartial(prevR)) return 'new';
  return cur.position > state.top[prevR] ? null : 'top';
}
function psMove(name) { return psStatus(name, state.rounds.length - 1, 'position'); }
function psPrevSize(ri) { return state.top[state.rounds[ri - 1]]; }
function psMoveHtml(m) {
  if (m === null) return '';
  if (m === 'new') return '<span class="mv-new">NOWY</span>';
  if (m === 'top') { var t = psPrevSize(state.rounds.length - 1); return '<span class="mv-new" title="Wejście do TOP ' + t + '">↑' + t + '</span>'; }
  if (m > 0) return '<span class="mv-up">▲' + m + '</span>';
  if (m < 0) return '<span class="mv-down">▼' + (-m) + '</span>';
  return '<span class="mv-eq">–</span>';
}

// aktywni w rundzie ri: przyrost punktów > 0 (albo nowy uczestnik z punktami); null, gdy poprzednia runda to tylko czołówka
function psActivity(ri) {
  if (ri < 1 || psPartial(state.rounds[ri - 1]) || psPartial(state.rounds[ri])) return null;
  var r = state.rounds[ri], pr = state.rounds[ri - 1], total = 0, active = 0, newbies = 0;
  Object.keys(state.participants).forEach(function(k) {
    var d = state.participants[k][r], p = state.participants[k][pr];
    if (!d) return;
    total++;
    if (!p) { newbies++; if (d.points > 0) active++; }
    else if (d.points > p.points) active++;
  });
  return { total: total, active: active, newbies: newbies };
}

// ile osób ma miejsce ≤ 100 (remis na granicy wchodzi w całości) — jedna definicja „TOP 100” w całej stronie
function psTopCount(order, round) {
  var n = Math.min(100, order.length);
  while (n < order.length && state.participants[order[n]][round] && psPlace(round, state.participants[order[n]][round]).place <= 100) n++;
  return n;
}
// „A, B, C i 4 innych” — klikalne nicki osób z tym samym wynikiem
function psWho(keys, limit) {
  limit = limit || 3;
  var out = keys.slice(0, limit).map(function(k) { return '<span data-k="' + psEsc(k) + '">' + psEsc(psName(k)) + '</span>'; }).join(', ');
  return out + (keys.length > limit ? ' <span class="tie">i ' + (keys.length - limit) + ' ' + (keys.length - limit === 1 ? 'inny' : 'innych') + '</span>' : '');
}

function psRenderKpis(names) {
  var n = state.rounds.length, last = state.rounds[n - 1];
  var P = state.participants;
  document.getElementById('k-round').textContent = last;
  var lead = names[0], ld = P[lead][last];
  // przy remisie na P1 liderami są wszyscy z tą samą liczbą punktów
  var leaders = names.filter(function(k) { return P[k][last] && P[k][last].points === ld.points; });
  var kl = document.getElementById('k-leader');
  kl.classList.toggle('multi', leaders.length > 1);
  kl.innerHTML = leaders.map(function(k) { return '<span data-k="' + psEsc(k) + '">' + psEsc(psName(k)) + '</span>'; }).join(', ') + ' <small>' + ld.points + ' pkt</small>';
  var nextK = names[leaders.length], second = nextK && P[nextK][last];
  var gap = second ? ld.points - second.points : 0;
  var rd = leaders.length === 1 ? psRoundDelta(lead, n - 1) : null;
  document.getElementById('k-leader-sub').innerHTML = (leaders.length > 1 ? 'Ex aequo · ' : '') +
    (second ? 'Przewaga nad ' + psEsc(psName(nextK)) + ': <b>' + psSigned(gap) + ' pkt</b>' : '') +
    (rd !== null ? ' · w tej rundzie ' + psSigned(rd) + ' pkt' : '');
  var medals = ['#facc15', '#cbd5e1', '#e8955a'];
  document.getElementById('k-podium').innerHTML = names.slice(0, 3).map(function(x, i) {
    return '<div data-k="' + psEsc(x) + '"><i style="background:' + medals[Math.min(2, psPlace(last, P[x][last]).place - 1)] + '">' + psPlace(last, P[x][last]).txt + '</i>' + psEsc(psName(x)) + ' · ' + P[x][last].points + '</div>';
  }).join('');

  // kafelki rundy
  var jump = null, best = null;
  var keep = function(acc, k, v) { if (acc === null || v > acc.v) return { v: v, ks: [k] }; if (v === acc.v) acc.ks.push(k); return acc; };
  names.forEach(function(x) {
    var m = psMove(x), cur = P[x][last];
    // skok liczony w TOP 100 (miejsce ex aequo ≤ 100) — przy pełnym rankingu awanse z dołu tabeli byłyby nieporównywalne
    if (typeof m === 'number' && m > 0 && cur && psPlace(last, cur).place <= 100) jump = keep(jump, x, m);
    var d = psRoundDelta(x, n - 1);
    if (d !== null) best = keep(best, x, d);
  });
  // sezon z jedną rundą (archiwum): skok, najwięcej punktów i aktywność nie mają sensu
  ['t-jump', 't-best', 't-act'].forEach(function(id) { document.getElementById(id).hidden = n < 2; });
  document.getElementById('k-jump').textContent = jump ? '▲' + jump.v : '—';
  document.getElementById('k-jump-d').innerHTML = jump ? psWho(jump.ks) + ' — największy awans w TOP 100' : '';
  document.getElementById('k-best').textContent = best ? psSigned(best.v) + ' pkt' : '—';
  document.getElementById('k-best-d').innerHTML = best ? psWho(best.ks) : '';
  document.getElementById('k-top10-r').textContent = last;
  document.getElementById('k-top10').innerHTML = names.slice(0, 10).map(function(x, i) {
    var tp = psPlace(last, P[x][last]).place;
    return '<li data-k="' + psEsc(x) + '" class="' + (psIsMe(x) ? 'me ' : '') + (tp <= 3 ? 't' + tp : '') + '"><span class="r" title="' + psPlace(last, P[x][last]).title + '">' + psPlace(last, P[x][last]).txt + '</span><button type="button" class="lnk n" data-k="' + psEsc(x) + '" title="' + psEsc(psName(x)) + '">' + psEsc(psName(x)) + '</button><span class="m">' + psMoveHtml(psMove(x)) + '</span><span class="g">' + (function(d) { return d === null ? '' : '<b>' + psSigned(d) + '</b> w rundzie'; })(psRoundDelta(x, n - 1)) + '</span><span class="p">' + P[x][last].points + '</span></li>';
  }).join('');
  var p100 = names[Math.min(99, names.length - 1)];
  var cut = P[p100][last] ? P[p100][last].points : null;
  document.getElementById('k-gap').textContent = cut !== null ? (ld.points - cut) + ' pkt' : '—';
  document.getElementById('k-gap-d').textContent = cut !== null ? 'tyle dzieli P1 od P100 (' + cut + ' pkt)' : '';

  // aktywność: kto zdobył punkty w rundzie (parcfer.me nie podaje, kto wysłał typy)
  var act = psActivity(n - 1), actPrev = psActivity(n - 2);
  var bar = document.getElementById('k-act-bar');
  if (act) {
    var pct = Math.round(act.active / act.total * 100);
    document.getElementById('k-act').textContent = act.active + ' / ' + act.total;
    document.getElementById('k-act-d').textContent = pct + '% zdobyło punkty w rundzie ' + last;
    bar.style.display = ''; bar.firstChild.style.width = pct + '%';
    document.getElementById('k-act-p').textContent = (actPrev ? 'Poprzednia runda: ' + actPrev.active + ' (' + psSigned(act.active - actPrev.active) + ')' : '') +
      (act.newbies ? (actPrev ? ' · ' : '') + 'nowi: ' + act.newbies : '');
  } else {
    document.getElementById('k-act').textContent = '—';
    document.getElementById('k-act-d').textContent = 'brak pełnych danych z poprzedniej rundy';
    bar.style.display = 'none'; document.getElementById('k-act-p').textContent = '';
  }

  // moja pozycja
  var meEl = document.getElementById('k-me');
  if (!myName) {
    meEl.innerHTML = '<div class="me-hint">Wpisz nick z parcfer.me — podświetlimy Cię w tabeli i pokażemy zmianę pozycji.</div>';
    return;
  }
  if (ME_MULTI.length) {
    meEl.innerHTML = '<div class="me-hint">Nick <b>' + psEsc(myName) + '</b> ma ' + ME_MULTI.length + ' ' + (ME_MULTI.length < 5 ? 'osoby' : 'osób') + ' — wybierz siebie:</div><div class="me-pick">' +
      ME_MULTI.map(function(k) { var d = P[k][last]; return '<button type="button" class="btn" data-pick="' + psEsc(k) + '">' + psEsc(psName(k)) + ' <span class="tie">' + (d ? 'P' + psPlace(last, d).txt + ' · ' + d.points + ' pkt' : 'brak w ' + psEsc(last)) + '</span></button>'; }).join('') + '</div>';
    return;
  }
  var me = ME;
  if (!me || !P[me][last]) {
    meEl.innerHTML = '<div class="me-hint">Nie ma <b>' + psEsc(myName) + '</b> w rankingu po ' + psEsc(last) + '.</div>';
    return;
  }
  var md = P[me][last], mv = psMove(me), mr = psRoundDelta(me, n - 1);
  function plMiejsc(k) { return k === 1 ? 'miejsce' : (k % 10 >= 2 && k % 10 <= 4 && (k % 100 < 10 || k % 100 >= 20)) ? 'miejsca' : 'miejsc'; }
  var chip = mv === 'top' ? '<span class="chip blue">wejście do TOP ' + psPrevSize(n - 1) + '</span>'
    : mv === 'new' ? '<span class="chip blue">nowy w rankingu</span>'
    : mv > 0 ? '<span class="chip green">▲ ' + mv + ' ' + plMiejsc(mv) + '</span>'
    : mv < 0 ? '<span class="chip red">▼ ' + (-mv) + ' ' + plMiejsc(-mv) + '</span>'
    : mv === 0 ? '<span class="chip gold">bez zmian</span>' : '';
  var tie = psTie(last, md.points);
  var mpl = psPlace(last, md), mg = psTieGroup(last, md.points);
  meEl.innerHTML = '<div class="me-stat"' + (mpl.title ? ' title="' + mpl.title + '"' : '') + '>P' + mpl.txt + '<small>' + md.points + ' pkt' + (tie > 1 ? ' · ex aequo z ' + (tie - 1) + ' ' + (tie - 1 === 1 ? 'osobą' : 'osobami') + ' (miejsca ' + mg.a + '–' + mg.b + ')' : '') + '</small></div>' +
    '<div class="me-row" style="margin-top:10px;flex-wrap:wrap">' + chip +
    (mr !== null ? '<span class="chip blue">' + psSigned(mr) + ' pkt w rundzie</span>' : '') +
    '<span class="chip gold">' + (ld.points - md.points) + ' pkt do lidera</span>' + psActiveChip(me) + '</div>' +
    '<div class="me-actions"><button type="button" class="btn pri" data-k="' + psEsc(me) + '">📈 Historia</button>' +
    '<button type="button" class="btn" data-jump="' + psEsc(me) + '">Pokaż w tabeli</button>' +
    '<button type="button" class="btn" onclick="psShare(ME)">🔗 Udostępnij</button></div>' +
    '<div class="calc"><label for="calc-t">Ile brakuje do</label> <select id="calc-t" onchange="psCalc()">' +
    [[1, 'P1'], [3, 'TOP 3'], [10, 'TOP 10'], [50, 'TOP 50'], [100, 'TOP 100']].map(function(o) { return '<option value="' + o[0] + '">' + o[1] + '</option>'; }).join('') +
    '</select><div class="calc-out" id="calc-out"></div></div>';
  // domyślny cel: najbliższy próg powyżej obecnego miejsca
  var targets = [1, 3, 10, 50, 100], cur = mpl.place, def = targets.filter(function(t) { return t < cur; }).pop() || 1;
  document.getElementById('calc-t').value = String(CALC_T && CALC_ME === me && CALC_T < cur ? CALC_T : def);
  CALC_ME = me;
  psCalc();
}

var SEARCH_MAX = 150, SEARCH_T = null;
function psSearch() { clearTimeout(SEARCH_T); SEARCH_T = setTimeout(function() { psRenderTable(true); }, 150); }
function psRenderTable(resetScroll) {
  var tbl = document.getElementById('ps-table');
  var lastRound = state.rounds[state.rounds.length - 1];
  var names = psOrder(lastRound);
  var rankOf = {};
  names.forEach(function(n, i) { rankOf[n] = i + 1; });
  // filtr „tylko aktywni” (numer przy nicku zostaje miejscem ogólnym)
  var act = psActive(), filtered = ACTIVE_ONLY && act;
  document.getElementById('act-only-l').hidden = !act;
  if (filtered) names = names.filter(function(k) { return act.set[k]; });

  var shown = names, pager = '', hint = '';
  var meKey = ME && state.participants[ME][lastRound] && names.indexOf(ME) !== -1 ? ME : null;
  var list = psListKeys(), watched = names.filter(function(k) { return list.indexOf(k) !== -1 || k === meKey; });
  var sw = document.getElementById('seg-watch');
  sw.disabled = !list.length;
  sw.textContent = (LEAGUE ? '⭐ Liga' : '⭐ Obserwowani') + (list.length ? ' (' + list.length + ')' : '');
  if (VIEW === 'watch' && !list.length) VIEW = 'top';
  psSegUpdate();
  // „Pokaż mnie” w widoku Wszyscy: przejście na stronę z nickiem z karty „Twoja pozycja”
  var mj = document.getElementById('ps-me-jump');
  mj.style.display = VIEW === 'all' && meKey ? 'inline-flex' : 'none';
  if (meKey) { mj.title = 'Przejdź do: ' + psName(meKey); mj.onclick = function() { psJumpTo(meKey, true); }; }
  document.getElementById('seg-near').disabled = !meKey;
  if (VIEW === 'near' && !meKey) VIEW = 'top';
  if (VIEW === 'watch') {
    shown = watched;
  } else if (VIEW === 'top') {
    shown = names.slice(0, filtered ? 100 : psTopCount(names, lastRound));
    if (meKey && !shown.some(psIsMe)) shown.push(meKey);
  } else if (VIEW === 'near') {
    var mi = names.indexOf(meKey);
    shown = names.slice(Math.max(0, mi - NEAR), mi + NEAR + 1);
  } else {
    var pages = Math.ceil(names.length / PAGE_SIZE);
    PAGE = Math.min(PAGE, pages - 1);
    // przy sortowaniu po rundzie strony obejmują wszystkich posortowanych, nie tylko bieżącą setkę
    var base = SORT_RI !== null ? names.slice().sort(psSortCmp(rankOf)) : names;
    shown = base.slice(PAGE * PAGE_SIZE, (PAGE + 1) * PAGE_SIZE);
    var btns = '<button type="button" ' + (PAGE ? '' : 'disabled ') + 'onclick="psSetPage(' + (PAGE - 1) + ')" aria-label="Poprzednia strona">‹</button>';
    for (var i = 0; i < pages; i++) btns += '<button type="button" class="num' + (i === PAGE ? ' on' : '') + '" onclick="psSetPage(' + i + ')">' + (i * PAGE_SIZE + 1) + '–' + Math.min((i + 1) * PAGE_SIZE, names.length) + '</button>';
    btns += '<button type="button" ' + (PAGE < pages - 1 ? '' : 'disabled ') + 'onclick="psSetPage(' + (PAGE + 1) + ')" aria-label="Następna strona">›</button>';
    pager = btns + '<span class="info">' + names.length + (filtered ? ' aktywnych' : ' uczestników') + '</span>';
  }
  // wyszukiwanie bez wielkości liter i polskich znaków („lukasz” znajdzie „Łukasz”)
  var q = psFold((document.getElementById('ps-filter').value || '').trim());
  var jb = document.getElementById('ps-jump'), exact = q ? names.filter(function(n) { return psFold(psName(n)) === q; })[0] : null;
  jb.style.display = exact ? 'inline-flex' : 'none';
  if (exact) { jb.textContent = 'Pokaż „' + psName(exact) + '” w tabeli'; jb.onclick = function() { psJumpTo(exact); }; }
  var more = 0;
  if (q) {
    shown = names.filter(function(n) { return psFold(psName(n)).indexOf(q) !== -1; }); pager = '';
    // limit wierszy: duża tabela to głównie koszt układu strony; dokładniejszy tekst zawęża wynik
  }
  if (SORT_RI !== null && (VIEW !== 'all' || q)) shown = shown.slice().sort(psSortCmp(rankOf));
  // limit po sortowaniu: przy sortowaniu po rundzie — najlepsi w tej rundzie spośród pasujących
  if (q && shown.length > SEARCH_MAX) { more = shown.length - SEARCH_MAX; shown = shown.slice(0, SEARCH_MAX); }
  var pg = document.getElementById('ps-pager');
  pg.innerHTML = pager; pg.style.display = pager ? 'flex' : 'none';

  document.getElementById('spr-legend').style.display = state.rounds.some(psIsSprint) ? '' : 'none';
  var head = '<thead><tr><th class="c-name"><span class="rk">#</span><span class="mv"></span>Uczestnik</th>';
  state.rounds.forEach(function(r, ri) {
    var can = ri > 0 && !psGap(ri), on = SORT_RI === ri;
    head += can ? '<th class="srt' + (on ? ' on' : '') + '" data-sort="' + ri + '"' + (on ? ' aria-sort="descending"' : '') + '><button type="button" class="lnk" data-sort="' + ri + '" title="' + (on ? 'Wróć do kolejności rankingu' : 'Sortuj po punktach zdobytych w tej rundzie') + '">' + psRoundLabel(r) + (on ? ' ▼' : '') + '</button></th>' : '<th>' + psRoundLabel(r) + '</th>';
  });
  head += '<th class="srt" data-sort="-1"' + (SORT_RI === null ? ' aria-sort="descending"' : '') + '><button type="button" class="lnk" data-sort="-1" title="Kolejność rankingu">Suma' + (SORT_RI === null ? ' ▼' : '') + '</button></th></tr></thead>';

  var nR = state.rounds.length;
  var body = shown.map(function(name) {
    var P = state.participants[name];
    var lastPts = P[lastRound] ? P[lastRound].points : '—';
    var cells = state.rounds.map(function(r, ri) {
      var d = P[r];
      if (!d) return psPartial(r) ? '<td class="rc" title="Poza TOP ' + state.top[r] + ' — z tej rundy mamy tylko czołówkę"><span class="out">&gt;&nbsp;' + state.top[r] + '</span></td>' : '<td class="rc"><span>—</span></td>';
      var dl = psStatus(name, ri, 'points'), note;
      var gd = dl === null ? psGapDelta(name, ri) : null;
      if (gd) note = ' · <span class="d-gap" title="' + psGapTitle(ri, gd) + '">' + psSigned(gd.v) + ' · ' + gd.n + ' rund</span>';
      else if (dl === null) note = '';
      else if (dl === 'top') note = ' · <span class="d-new">↑ TOP ' + psPrevSize(ri) + '</span>';
      else if (dl === 'new') note = ' · <span class="d-new">nowy</span>';
      else note = ' · <span class="' + (dl > 0 ? 'd-up' : 'd-zero') + '">' + psSigned(dl) + '</span>';
      var pl = psPlace(r, d);
      return '<td class="rc' + (ri === nR - 1 ? ' last' : '') + '"' + (pl.title ? ' title="' + pl.title + '"' : '') + '><b>' + d.points + '</b><span>P' + pl.txt + note + '</span></td>';
    }).join('');
    var cur = P[lastRound], pl = cur ? psPlace(lastRound, cur) : { txt: String(rankOf[name]), place: rankOf[name], title: '' };
    var cls = (psIsMe(name) ? 'me ' : '') + (pl.place <= 3 ? 'm' + pl.place : '');
    return '<tr class="' + cls + '" data-row="' + psEsc(name) + '"><td class="c-name" data-k="' + psEsc(name) + '" title="Historia: ' + psEsc(psName(name)) + (pl.title ? ' · ' + pl.title : '') + '"><span class="rk">' + pl.txt + '</span><span class="mv">' + psMoveHtml(psMove(name)) + '</span>' + psStarHtml(name) + '<button type="button" class="lnk nm" data-k="' + psEsc(name) + '">' + psEsc(psName(name)) + '</button></td>' + cells + '<td class="c-tot">' + lastPts + '</td></tr>';
  }).join('');

  if (more) body += '<tr><td colspan="' + (nR + 2) + '" class="empty">… i ' + more + ' innych pasujących — wpisz więcej liter nicku</td></tr>';
  tbl.innerHTML = head + '<tbody>' + (body || '<tr><td colspan="' + (nR + 2) + '" class="empty">Brak uczestników pasujących do filtra</td></tr>') + '</tbody>';
  var wrap = tbl.parentNode; wrap.scrollLeft = wrap.scrollWidth;
  if (resetScroll) wrap.scrollTop = 0;
  if (VIEW === 'near' && !q) {
    var row = tbl.querySelector('tr.me');
    if (row) wrap.scrollTop = row.offsetTop - wrap.clientHeight / 2 + row.offsetHeight / 2;
  }
}

// grupy remisowe w rundzie: punkty → {n: ile osób, a: pierwsze miejsce, b: ostatnie miejsce}
function psTieGroup(round, pts) {
  var t = state.tie[round] || (state.tie[round] = (function() {
    var m = {};
    Object.keys(state.participants).forEach(function(k) {
      var d = state.participants[k][round]; if (!d) return;
      var g = m[d.points] || (m[d.points] = { n: 0, a: Infinity, b: 0 });
      g.n++; g.a = Math.min(g.a, d.position); g.b = Math.max(g.b, d.position);
    });
    return m;
  })());
  return t[pts] || { n: 0, a: 0, b: 0 };
}
function psTie(round, pts) { return psTieGroup(round, pts).n; }
// miejsce do wyświetlenia: przy remisie wspólne pierwsze miejsce grupy z „=”
function psPlace(round, d) {
  var g = psTieGroup(round, d.points);
  return g.n > 1 ? { txt: g.a + '=', place: g.a, title: 'ex aequo: miejsca ' + g.a + '–' + g.b + (psPartial(round) && g.b === state.top[round] ? '+' : '') + ' (' + d.points + ' pkt)' } : { txt: String(d.position), place: d.position, title: '' };
}

function psToast(msg) {
  var t = document.getElementById('toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(psToast.h); psToast.h = setTimeout(function() { t.classList.remove('on'); }, 2200);
}
// linki po id gracza (?id=…), bo etykieta „(2)” to nie tożsamość; bez id (stare dane) — po etykiecie
function psShareUrl(key) {
  var u = new URL(location.href); u.search = ''; u.hash = '';
  if (SEASON && (new URLSearchParams(location.search).get('sezon') || ROUND_UPTO)) u.searchParams.set('sezon', SEASON);
  if (ROUND_UPTO) u.searchParams.set('runda', (state.rounds[state.rounds.length - 1].match(/R\d+$/) || [''])[0]);
  if (/^u\d+$/.test(key)) u.searchParams.set('id', key.slice(1)); else u.searchParams.set('nick', psName(key));
  return u.toString();
}
async function psShare(key) {
  if (!key) return;
  var nick = psName(key), url = psShareUrl(key);
  if (navigator.share) { try { await navigator.share({ title: 'Klasyfikacja parcfer.me — ' + nick, url: url }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
  try { await navigator.clipboard.writeText(url); psToast('Skopiowano link: ' + url.replace(/^https?:\/\//, '')); }
  catch (e) { window.prompt('Skopiuj link:', url); }
}

// przewiń tabelę do wiersza danej osoby (TOP 100 albo właściwa strona „Wszyscy”)
function psJumpTo(key, stayAll) {
  var dlg = document.getElementById('hist'); if (dlg.open) dlg.close();
  document.getElementById('ps-filter').value = '';
  SORT_RI = null;
  var last = state.rounds[state.rounds.length - 1], order = psOrder(last), act = ACTIVE_ONLY && psActive();
  if (act && !act.set[key]) psSetActiveOnly(false, true); else if (act) order = order.filter(function(k) { return act.set[k]; });
  var idx = order.indexOf(key);
  if (idx < 0) return;
  VIEW = stayAll || idx >= (act && act.set[key] ? 100 : psTopCount(order, last)) ? 'all' : 'top'; PAGE = Math.floor(idx / PAGE_SIZE);
  psSegUpdate();
  psRenderTable();
  var wrap = document.querySelector('.board .tw'), row = [].find.call(document.querySelectorAll('#ps-table tr[data-row]'), function(r) { return r.getAttribute('data-row') === key; });
  if (!row) return;
  document.querySelector('.board').scrollIntoView({ behavior: 'smooth', block: 'start' });
  wrap.scrollTop = row.offsetTop - wrap.clientHeight / 2 + row.offsetHeight / 2;
  row.classList.remove('flash'); void row.offsetWidth; row.classList.add('flash');
}

// ---------- historia gracza ----------
var HIST = null;
function psOpenHistory(key) {
  if (!state.participants[key]) return;
  HIST = key;
  var P = state.participants[key], R = state.rounds, n = R.length, last = R[n - 1];
  document.getElementById('h-name').textContent = psName(key);
  var pts = R.map(function(r) { return P[r]; });
  var have = pts.map(function(d, i) { return d ? { i: i, d: d } : null; }).filter(Boolean);
  have.forEach(function(h) { h.pl = psPlace(R[h.i], h.d); });
  var best = have.reduce(function(a, b) { return !a || b.pl.place < a.pl.place ? b : a; }, null);
  var cur = P[last];
  // najwyższe miejsce i w ilu rundach (np. „P1 — 7 rund”); „=” tylko, gdy za każdym razem było ex aequo
  var bestHtml = '';
  if (best) {
    var at = have.filter(function(h) { return h.pl.place === best.pl.place; });
    var tied = at.every(function(h) { return h.pl.txt.slice(-1) === '='; });
    bestHtml = '<span class="chip green">Najwyżej: P' + best.pl.place + (tied ? '=' : '') + (at.length > 1 ? ' — ' + at.length + ' ' + (at.length < 5 ? 'rundy' : 'rund') : ' (' + psEsc(R[at[0].i]) + ')') + '</span>';
  }
  // średnia sezonu: suma punktów obejmuje wszystkie rundy, także niezapisane
  var lastNo = psRoundNo(last), avg = cur && lastNo ? cur.points / lastNo : null;
  document.getElementById('h-chips').innerHTML =
    (cur ? '<span class="chip blue">Teraz P' + psPlace(last, cur).txt + ' · ' + cur.points + ' pkt</span>' : '<span class="chip red">Brak w ostatniej rundzie</span>') +
    bestHtml +
    (avg !== null ? '<span class="chip gold">Średnio ' + avg.toFixed(1).replace('.', ',') + ' pkt na rundę sezonu</span>' : '');
  // tabela (dostępna wersja danych z wykresu)
  var rows = R.map(function(r, i) {
    var d = P[r];
    if (!d) return '<tr><td>' + psRoundLabel(r) + '</td><td colspan="3" class="tie">' + (psPartial(r) ? 'poza TOP ' + state.top[r] + ' (z tej rundy mamy tylko czołówkę)' : '—') + '</td></tr>';
    var g = psStatus(key, i, 'points'), t = psTie(r, d.points);
    var gd2 = g === null ? psGapDelta(key, i) : null;
    var gt = gd2 ? '<span class="d-gap" title="' + psGapTitle(i, gd2) + '">' + psSigned(gd2.v) + ' <span class="tie">(' + gd2.n + ' rund)</span></span>' : g === null ? '—' : g === 'top' ? '↑ TOP ' + psPrevSize(i) : g === 'new' ? 'nowy' : psSigned(g);
    var hp = psPlace(r, d);
    return '<tr><td>' + psRoundLabel(r) + '</td><td' + (hp.title ? ' title="' + hp.title + '"' : '') + '>P' + hp.txt + '</td><td><b>' + d.points + '</b></td><td>' + gt + '</td></tr>';
  }).reverse().join('');
  document.getElementById('h-table').innerHTML = '<thead><tr><th>Runda</th><th>Miejsce</th><th>Punkty</th><th>W rundzie</th></tr></thead><tbody>' + rows + '</tbody>';
  document.getElementById('h-actions').innerHTML = cur
    ? '<button type="button" class="btn" onclick="psJumpTo(HIST)">Pokaż w tabeli</button><button type="button" class="btn" onclick="psShare(HIST)">🔗 Link do tego gracza</button>' +
      '<button type="button" class="btn" id="h-watch" data-star="' + psEsc(key) + '" aria-pressed="' + psWatched(key) + '">' + (psWatched(key) ? '★ Obserwujesz' : '☆ Obserwuj') + '</button>' : '';
  psRenderSeasons(key);
  // opis braków w danych tylko wtedy, gdy sezon je ma (przerwy w numeracji, rundy z samą czołówką)
  var gaps = R.some(function(r, i) { return i > 0 && psGap(i); }), part = R.filter(psPartial);
  document.getElementById('h-cap').textContent = gaps || part.length ? 'Przerwa w linii = brak danych' + (gaps ? ': nie wszystkie rundy są zapisane' : '') +
    (part.length ? (gaps ? ', a' : ':') + ' w rundach ' + part[0] + (part.length > 1 ? ' – ' + part[part.length - 1] : '') + ' mamy tylko czołówkę, więc gracz mógł być poza nią' : '') + '.' :
    (n === 1 ? 'Z tego sezonu mamy tylko stan końcowy (' + R[0] + ').' : '');
  var dlg = document.getElementById('hist');
  if (!dlg.open) dlg.showModal();
  psDrawChart();
}

function psDrawChart() {
  var box = document.getElementById('h-chart'), tip = document.getElementById('h-tip');
  if (!HIST || !document.getElementById('hist').open) return;
  var P = state.participants[HIST], R = state.rounds, n = R.length;
  var W = Math.max(280, box.clientWidth), H = W < 480 ? 200 : 240;
  var m = { l: 44, r: 40, t: 16, b: 28 }, iw = W - m.l - m.r, ih = H - m.t - m.b;
  var vals = R.map(function(r) { return P[r] ? psPlace(r, P[r]).place : null; });
  var known = vals.filter(function(v) { return v !== null; });
  var lo = Math.min.apply(null, known), hi = Math.max.apply(null, known);
  var pad = Math.max(2, Math.ceil((hi - lo) * 0.15)); lo = Math.max(1, lo - pad); hi = hi + pad;
  var X = function(i) { return m.l + (n === 1 ? iw / 2 : i * iw / (n - 1)); };
  var Y = function(v) { return m.t + (v - lo) / (hi - lo) * ih; }; // odwrócona oś: P1 na górze
  // „okrągły” krok osi (1, 2, 5, 10, 20, 25, 50…), P1 zawsze podpisane, gdy mieści się w zakresie
  var raw = (hi - lo) / 4, step = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500].find(function(x) { return x >= raw; }) || 1000;
  var ticks = lo === 1 ? [1] : [];
  for (var v = Math.ceil(lo / step) * step; v <= hi; v += step) if (v > 1 && (v - (ticks[ticks.length - 1] || -1e9)) * ih / (hi - lo) >= 18) ticks.push(v);
  var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="Miejsce w rankingu po każdej rundzie">';
  svg += '<g class="grid">' + ticks.map(function(t) { return '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + Y(t) + '" y2="' + Y(t) + '"/>'; }).join('') + '</g>';
  svg += ticks.map(function(t) { return '<text class="ax" x="' + (m.l - 8) + '" y="' + (Y(t) + 4) + '" text-anchor="end">P' + t + '</text>'; }).join('');
  var every = W < 480 && n > 8 ? 2 : 1;
  svg += R.map(function(r, i) { var lab = (r.match(/R\d+$/) || [r])[0] + (psIsSprint(r) ? '⚡' : ''); return (i % every && i !== n - 1) ? '' : '<text class="ax" x="' + X(i) + '" y="' + (H - 8) + '" text-anchor="middle">' + psEsc(lab) + '</text>'; }).join('');
  // linia z przerwami tam, gdzie brak danych
  var d = '', pen = false;
  vals.forEach(function(v, i) { if (v === null || (i > 0 && psGap(i))) pen = false; if (v === null) return; d += (pen ? 'L' : 'M') + X(i) + ' ' + Y(v); pen = true; });
  svg += '<line class="cross" id="h-cross" x1="0" x2="0" y1="' + m.t + '" y2="' + (H - m.b) + '" style="display:none"/>';
  svg += '<path class="ln" d="' + d + '"/>';
  svg += vals.map(function(v, i) { return v === null ? '' : '<circle class="dot" data-i="' + i + '" cx="' + X(i) + '" cy="' + Y(v) + '" r="4.5"/>'; }).join('');
  var li = vals.length - 1; while (li >= 0 && vals[li] === null) li--;
  if (li >= 0) svg += '<text class="lbl" x="' + (X(li) + 9) + '" y="' + (Y(vals[li]) + 4) + '">P' + psPlace(R[li], P[R[li]]).txt + '</text>';
  svg += '</svg>';
  box.innerHTML = svg; box.appendChild(tip); tip.style.display = 'none';
  var el = box.querySelector('svg'), cross = el.querySelector('#h-cross');
  function show(ev) {
    var rect = el.getBoundingClientRect(), x = (ev.clientX - rect.left) * W / rect.width;
    var i = Math.max(0, Math.min(n - 1, Math.round((x - m.l) / (n === 1 ? 1 : iw / (n - 1)))));
    el.querySelectorAll('.dot.on').forEach(function(c) { c.classList.remove('on'); });
    var dt = P[R[i]], g = psStatus(HIST, i, 'points');
    cross.setAttribute('x1', X(i)); cross.setAttribute('x2', X(i)); cross.style.display = '';
    var dot = el.querySelector('.dot[data-i="' + i + '"]'); if (dot) dot.classList.add('on');
    var gd3 = psGapDelta(HIST, i);
    tip.innerHTML = '<b>' + psEsc(psRoundText(R[i])) + '</b><br>' + (dt ? 'P' + psPlace(R[i], dt).txt + ' · ' + dt.points + ' pkt' + (typeof g === 'number' ? ' (' + psSigned(g) + ')' : gd3 ? ' (' + psSigned(gd3.v) + ' z ' + gd3.n + ' rund)' : '') : (psPartial(R[i]) ? 'poza TOP ' + state.top[R[i]] : 'brak danych'));
    tip.style.display = 'block';
    var px = X(i) * rect.width / W, tw = tip.offsetWidth;
    tip.style.left = Math.max(tw / 2, Math.min(rect.width - tw / 2, px)) + 'px';
    tip.style.top = Math.max(0, (dt ? Y(psPlace(R[i], dt).place) : m.t) * rect.height / H - tip.offsetHeight - 12) + 'px';
  }
  el.addEventListener('pointermove', show);
  el.addEventListener('pointerdown', show);
  el.addEventListener('pointerleave', function() { tip.style.display = 'none'; cross.style.display = 'none'; el.querySelectorAll('.dot.on').forEach(function(c) { c.classList.remove('on'); }); });
}

document.addEventListener('click', function(e) {
  var st = e.target.closest('[data-star]');
  if (st) { psToggleWatch(st.getAttribute('data-star')); return; }
  var pk = e.target.closest('[data-pick]');
  if (pk) { psPickMe(pk.getAttribute('data-pick')); return; }
  var srt = e.target.closest('[data-sort]');
  if (srt) { psSortBy(+srt.getAttribute('data-sort')); return; }
  var j = e.target.closest('[data-jump]');
  if (j) { psJumpTo(j.getAttribute('data-jump')); return; }
  var el = e.target.closest('[data-k]');
  if (el && state.participants[el.getAttribute('data-k')]) psOpenHistory(el.getAttribute('data-k'));
});
document.getElementById('hist').addEventListener('click', function(e) { if (e.target === this) this.close(); });
// klawiatura: elementy otwierające historię dostają fokus (Tab) i działają z Enter / spacją
function psA11y(root) {
  var list = [].slice.call(root.querySelectorAll('[data-k],[data-jump],[data-sort]'));
  if (root.matches && root.matches('[data-k],[data-jump],[data-sort]')) list.push(root);
  // komórki tabeli i elementy listy mają w środku własny przycisk — nie zmieniamy ich roli
  list.forEach(function(el) {
    if (/^(BUTTON|TD|TH|LI)$/.test(el.tagName) || el.hasAttribute('tabindex')) return;
    el.tabIndex = 0; el.setAttribute('role', 'button');
  });
}
new MutationObserver(function(ms) { ms.forEach(function(m) { m.addedNodes.forEach(function(n) { if (n.nodeType === 1) psA11y(n); }); }); })
  .observe(document.body, { childList: true, subtree: true });
psA11y(document.body);
document.addEventListener('keydown', function(e) {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[role="button"][data-k],[role="button"][data-jump],[role="button"][data-sort]')) { e.preventDefault(); e.target.click(); }
});
window.addEventListener('resize', function() { psDrawChart(); psDrawDuel(); psDrawWatch(); if (DIST_RI !== null) psDrawDist(DIST_RI); });

// ---------- pojedynek ----------
var DUEL = null, duelAuto = true;
function psFind(text) {
  var t = (text || '').trim(), q = t.toLowerCase();
  if (!q) return null;
  var keys = Object.keys(state.participants);
  return keys.find(function(k) { return psName(k) === t; }) || keys.find(function(k) { return psName(k).toLowerCase() === q; }) || null;
}
function psFillNicks(order) {
  document.getElementById('nicks').innerHTML = order.map(function(k) { return '<option value="' + psEsc(psName(k)) + '">'; }).join('');
}
function psRenderDuel() {
  var ia = document.getElementById('duel-a'), ib = document.getElementById('duel-b');
  if (document.activeElement === ia) duelAuto = false;
  if (duelAuto) ia.value = ME ? psName(ME) : ME_MULTI.length ? '' : myName || ''; // dopóki A nie było edytowane, A = osoba z „Twojej pozycji”
  var a = psFind(ia.value), b = psFind(ib.value), body = document.getElementById('duel-body');
  document.getElementById('duel-share').style.display = a && b && a !== b ? '' : 'none';
  if (!a || !b || a === b) {
    DUEL = null;
    body.innerHTML = '<div class="duel-hint">' + (ia.value && !a ? 'Nie znam nicka „' + psEsc(ia.value) + '”. ' : '') + (ib.value && !b ? 'Nie znam nicka „' + psEsc(ib.value) + '”. ' : '') +
      (a && b && a === b ? 'Wybierz dwie różne osoby. ' : '') + 'Wpisz dwa nicki — np. swój i rywala — a zobaczysz, kto ile zdobył w każdej rundzie i jak zmieniała się różnica punktów.</div>';
    return;
  }
  DUEL = { a: a, b: b };
  var R = state.rounds, n = R.length, last = R[n - 1], PA = state.participants[a], PB = state.participants[b];
  var wa = 0, wb = 0, tie = 0;
  var rows = R.map(function(r, i) {
    var da = PA[r], db = PB[r], ga = psRoundDelta(a, i), gb = psRoundDelta(b, i), w = '';
    if (ga !== null && gb !== null) { if (ga > gb) { wa++; w = '<span class="win"><i style="background:var(--va)"></i>' + psEsc(psName(a)) + '</span>'; } else if (gb > ga) { wb++; w = '<span class="win"><i style="background:var(--vb)"></i>' + psEsc(psName(b)) + '</span>'; } else { tie++; w = 'remis'; } }
    var cell = function(d, g) { return d ? '<b>' + d.points + '</b> <span class="tie">P' + psPlace(r, d).txt + (g !== null ? ' · ' + psSigned(g) : '') + '</span>' : '<span class="tie">' + (psPartial(r) ? '&gt; ' + state.top[r] : '—') + '</span>'; };
    var diff = da && db ? psSigned(da.points - db.points) : '—';
    return '<tr><td>' + psRoundLabel(r) + '</td><td>' + cell(da, ga) + '</td><td>' + cell(db, gb) + '</td><td>' + diff + '</td><td class="rd2">' + (w || '—') + '</td></tr>';
  }).reverse().join('');
  var ca = PA[last], cb = PB[last];
  var gap = ca && cb ? ca.points - cb.points : null;
  var card = function(k, c, cls, col) {
    return '<div class="dp ' + cls + '"><div class="who"><span class="sw" style="background:var(' + col + ')"></span><span data-k="' + psEsc(k) + '">' + psEsc(psName(k)) + '</span></div>' +
      '<div class="big2">' + (c ? 'P' + psPlace(R[n - 1], c).txt + '<small>' + c.points + ' pkt</small>' : '—') + '</div></div>';
  };
  body.innerHTML = '<div class="duel-sum">' + card(a, ca, 'a', '--va') +
    '<div class="dmid"><div class="mb"><div class="lab">Różnica</div><div class="gapv">' + (gap === null ? '—' : gap === 0 ? 'remis' : Math.abs(gap) + ' pkt') + '</div>' +
    '<div class="tie">' + (gap ? 'prowadzi ' + psEsc(psName(gap > 0 ? a : b)) : '') + '</div></div>' +
    '<div class="mb"><div class="lab">Bilans rund</div><div class="bil"><i style="background:var(--va)"></i>' + wa + ' : ' + wb + '<i style="background:var(--vb);margin:0 0 0 6px"></i></div>' +
    '<div class="tie">' + (tie ? tie + ' ' + (tie === 1 ? 'remis' : 'remisy') : 'bez remisów') + '</div></div></div>' +
    card(b, cb, 'b', '--vb') + '</div>' +
    '<div class="legend"><span><i style="background:var(--va)"></i>prowadzi ' + psEsc(psName(a)) + '</span><span><i style="background:var(--vb)"></i>prowadzi ' + psEsc(psName(b)) + '</span></div>' +
    '<div class="label" style="margin-top:10px">Różnica punktów po każdej rundzie</div>' +
    '<div class="chart" id="duel-chart"><div class="tip" id="duel-tip"></div></div>' +
    '<div class="tw" style="max-height:none"><table><thead><tr><th>Runda</th><th>' + psEsc(psName(a)) + '</th><th>' + psEsc(psName(b)) + '</th><th>Różnica</th><th class="rd2">Lepszy w rundzie</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  psDrawDuel();
}
function psDrawDuel() {
  if (!DUEL) return;
  var box = document.getElementById('duel-chart'), tip = document.getElementById('duel-tip');
  if (!box) return;
  var R = state.rounds, n = R.length, PA = state.participants[DUEL.a], PB = state.participants[DUEL.b];
  var g = R.map(function(r) { return PA[r] && PB[r] ? PA[r].points - PB[r].points : null; });
  var W = Math.max(280, box.clientWidth), H = W < 480 ? 180 : 210, m = { l: 44, r: 12, t: 14, b: 26 }, iw = W - m.l - m.r, ih = H - m.t - m.b;
  var mx = Math.max(5, Math.max.apply(null, g.map(function(v) { return v === null ? 0 : Math.abs(v); })));
  var step = [1, 2, 5, 10, 20, 25, 50, 100].find(function(x) { return x >= mx / 2; }) || 200; mx = Math.ceil(mx / step) * step;
  var Y = function(v) { return m.t + (mx - v) / (2 * mx) * ih; }, bw = Math.min(28, iw / n * 0.6), X = function(i) { return m.l + (i + 0.5) * iw / n; };
  var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="Różnica punktów po każdej rundzie">';
  var ticks = []; for (var t = -mx; t <= mx; t += step) ticks.push(t);
  svg += '<g class="grid">' + ticks.map(function(t) { return '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + Y(t) + '" y2="' + Y(t) + '"/>'; }).join('') + '</g>';
  svg += ticks.map(function(t) { return '<text class="ax" x="' + (m.l - 8) + '" y="' + (Y(t) + 4) + '" text-anchor="end">' + (t > 0 ? '+' + t : t) + '</text>'; }).join('');
  svg += '<line class="zero" x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + Y(0) + '" y2="' + Y(0) + '"/>';
  var every = W < 480 && n > 8 ? 2 : 1;
  svg += R.map(function(r, i) { return (i % every && i !== n - 1) ? '' : '<text class="ax" x="' + X(i) + '" y="' + (H - 8) + '" text-anchor="middle">' + psEsc((r.match(/R\d+$/) || [r])[0]) + '</text>'; }).join('');
  g.forEach(function(v, i) {
    if (v === null) return;
    var y0 = Y(0), y1 = Y(v), h = Math.abs(y1 - y0), r = Math.min(4, h / 2);
    if (v === 0) { svg += '<rect class="bar-0" x="' + (X(i) - bw / 2) + '" y="' + (y0 - 1) + '" width="' + bw + '" height="2" rx="1"/>'; return; }
    // zaokrąglony tylko koniec słupka, podstawa przy zerze prosta
    var x0 = X(i) - bw / 2, x1 = X(i) + bw / 2, top = v > 0;
    var d = top
      ? 'M' + x0 + ' ' + y0 + 'V' + (y1 + r) + 'Q' + x0 + ' ' + y1 + ' ' + (x0 + r) + ' ' + y1 + 'H' + (x1 - r) + 'Q' + x1 + ' ' + y1 + ' ' + x1 + ' ' + (y1 + r) + 'V' + y0 + 'Z'
      : 'M' + x0 + ' ' + y0 + 'V' + (y1 - r) + 'Q' + x0 + ' ' + y1 + ' ' + (x0 + r) + ' ' + y1 + 'H' + (x1 - r) + 'Q' + x1 + ' ' + y1 + ' ' + x1 + ' ' + (y1 - r) + 'V' + y0 + 'Z';
    svg += '<path class="' + (top ? 'bar-a' : 'bar-b') + '" d="' + d + '"/>';
  });
  var li = n - 1; while (li >= 0 && g[li] === null) li--;
  if (li >= 0) svg += '<text class="lbl" x="' + X(li) + '" y="' + (g[li] >= 0 ? Y(g[li]) - 6 : Y(g[li]) + 14) + '" text-anchor="middle">' + (g[li] > 0 ? '+' : '') + g[li] + '</text>';
  svg += R.map(function(r, i) { return '<rect class="hit" data-i="' + i + '" x="' + (m.l + i * iw / n) + '" y="' + m.t + '" width="' + (iw / n) + '" height="' + ih + '"/>'; }).join('');
  svg += '</svg>';
  box.innerHTML = svg; box.appendChild(tip); tip.style.display = 'none';
  var el = box.querySelector('svg');
  function show(ev) {
    var rect = el.getBoundingClientRect(), x = (ev.clientX - rect.left) * W / rect.width;
    var i = Math.max(0, Math.min(n - 1, Math.floor((x - m.l) / (iw / n)))), r = R[i], v = g[i];
    tip.innerHTML = '<b>' + psEsc(psRoundText(r)) + '</b><br>' + (v === null ? 'brak danych obu graczy'
      : psEsc(psName(DUEL.a)) + ': ' + PA[r].points + ' · ' + psEsc(psName(DUEL.b)) + ': ' + PB[r].points + '<br>' + (v === 0 ? 'remis' : 'prowadzi ' + psEsc(psName(v > 0 ? DUEL.a : DUEL.b)) + ' o ' + Math.abs(v)));
    tip.style.display = 'block';
    var px = X(i) * rect.width / W, tw = tip.offsetWidth;
    tip.style.left = Math.max(tw / 2, Math.min(rect.width - tw / 2, px)) + 'px';
    tip.style.top = Math.max(0, (v === null ? m.t : Math.min(Y(v), Y(0))) * rect.height / H - tip.offsetHeight - 10) + 'px';
  }
  el.addEventListener('pointermove', show); el.addEventListener('pointerdown', show);
  el.addEventListener('pointerleave', function() { tip.style.display = 'none'; });
}
function psShareDuel() {
  if (!DUEL) return;
  var u = new URL(psShareUrl(DUEL.a));
  if (/^u\d+$/.test(DUEL.b)) u.searchParams.set('vsid', DUEL.b.slice(1)); else u.searchParams.set('vs', psName(DUEL.b));
  var url = u.toString();
  if (navigator.share) { navigator.share({ title: 'Pojedynek: ' + psName(DUEL.a) + ' vs ' + psName(DUEL.b), url: url }).catch(function() {}); return; }
  navigator.clipboard.writeText(url).then(function() { psToast('Skopiowano link do pojedynku'); }, function() { window.prompt('Skopiuj link:', url); });
}

// ---------- walka o tytuł: kto jeszcze może matematycznie wygrać sezon ----------
// szansa = punkty + najwięcej, ile da się zdobyć do końca sezonu (max_points, sprinty) ≥ punkty lidera;
// równa liczba punktów na koniec to wspólne P1 (parcfer.me nie rozstrzyga remisów)
var TITLE_TOP = 10;
function psRenderTitle(order) {
  var sec = document.getElementById('title-sec'), R = state.rounds, last = R[R.length - 1], lastNo = psRoundNo(last);
  var maxLeft = psMaxLeft(lastNo);
  if (maxLeft === null) { sec.style.display = 'none'; return; }
  sec.style.display = '';
  var P = state.participants, left = PLANNED - lastNo;
  var inLast = order.filter(function(k) { return P[k][last]; }), top = P[inLast[0]][last].points;
  var plRund = function(k) { return k === 1 ? 'runda' : k % 10 >= 2 && k % 10 <= 4 && (k % 100 < 10 || k % 100 >= 20) ? 'rundy' : 'rund'; };
  var plGr = function(k) { return k === 1 ? 'gracz' : k % 10 >= 2 && k % 10 <= 4 && (k % 100 < 10 || k % 100 >= 20) ? 'graczy' : 'graczy'; };
  var leaders = inLast.filter(function(k) { return P[k][last].points === top; });
  var body = document.getElementById('title-body');
  if (left <= 0) {
    document.getElementById('title-r').textContent = 'sezon zakończony';
    body.innerHTML = '<div class="title-sum"><div class="label">' + (leaders.length > 1 ? 'Mistrzowie ex aequo' : 'Mistrz sezonu') + '</div><div class="v">' + psWho(leaders, 5) + ' <small>' + top + ' pkt</small></div></div>';
    document.getElementById('title-cap').textContent = '';
    return;
  }
  var contenders = inLast.filter(function(k) { return P[k][last].points + maxLeft >= top; });
  var short = function(n) { return 'R' + n; };
  document.getElementById('title-r').textContent = left + ' ' + plRund(left) + ' do końca (' + short(lastNo + 1) + (left > 1 ? '–' + short(PLANNED) : '') + ')';
  var nextK = inLast[leaders.length], lead = nextK ? top - P[nextK][last].points : null;
  var sprintsLeft = SPRINTS.filter(function(r) { return r > lastNo && r <= PLANNED; }).length;
  // lider zapewnia sobie tytuł, gdy przewaga nad drugim jest większa niż punkty możliwe do zdobycia (remis = wspólne P1)
  var clinch = leaders.length === 1 && lead !== null
    ? (lead > maxLeft ? '<b>' + psEsc(psName(leaders[0])) + '</b> ma już zapewniony tytuł.' : '<b>' + psEsc(psName(leaders[0])) + '</b> zapewni sobie tytuł, gdy przewaga przekroczy punkty możliwe do zdobycia — dziś ' + lead + ' pkt, a w pozostałych rundach można zdobyć najwyżej ' + maxLeft + '.')
    : 'Na prowadzeniu ex aequo: ' + psWho(leaders, 5) + '.';
  var meLine = '';
  if (ME && P[ME][last]) {
    var md = P[ME][last].points, need = top - md;
    meLine = '<p>' + (ME && leaders.indexOf(ME) !== -1 ? 'Prowadzisz' + (leaders.length > 1 ? ' ex aequo' : '') + '.' :
      md + maxLeft >= top ? 'Masz jeszcze szansę: tracisz ' + need + ' pkt, trzeba zdobywać średnio <b>' + (Math.ceil(need / left * 10) / 10).toFixed(1).replace('.', ',') + ' pkt na rundę więcej</b> niż lider.' :
      'Nie możesz już wygrać — tracisz ' + need + ' pkt, a do zdobycia zostało najwyżej ' + maxLeft + '.') + '</p>';
  }
  var place = function(k) { return psPlace(last, P[k][last]).txt; };
  var row = function(k) {
    var pts = P[k][last].points, need = top - pts, can = pts + maxLeft >= top;
    return '<tr class="' + (psIsMe(k) ? 'me ' : '') + (can ? '' : 'out') + '"><td>P' + place(k) + '</td><td class="nm-c" data-k="' + psEsc(k) + '"><button type="button" class="lnk" data-k="' + psEsc(k) + '">' + psEsc(psName(k)) + '</button></td><td><b>' + pts + '</b></td><td>' + (need ? '−' + need : '—') + '</td>' +
      '<td class="opt">' + (need ? (Math.ceil(need / left * 10) / 10).toFixed(1).replace('.', ',') + ' / rundę' : 'prowadzi') + '</td></tr>';
  };
  var shown = contenders.slice(0, TITLE_TOP), rows = shown.map(row).join('');
  if (contenders.length > TITLE_TOP) rows += '<tr class="gap"><td colspan="5" class="tie">⋯ i ' + (contenders.length - TITLE_TOP) + ' innych z szansą</td></tr>';
  if (ME && P[ME][last] && shown.indexOf(ME) === -1) rows += row(ME);
  body.innerHTML = '<div class="title-sum"><div class="label">Szansę na tytuł ma jeszcze</div><div class="v">' + contenders.length + ' <small>' + plGr(contenders.length) + '</small></div>' +
    '<p>Do zdobycia zostało najwyżej <b>' + maxLeft + ' pkt</b> (' + left + ' ' + plRund(left) + (sprintsLeft ? ', w tym ' + sprintsLeft + ' ze sprintem' : '') + '), więc szansę ma każdy, kto traci do lidera najwyżej tyle punktów.</p>' +
    '<p>' + clinch + '</p>' + meLine + '</div>' +
    '<div class="tw" style="max-height:none"><table><thead><tr><th>#</th><th class="nm-c">Gracz</th><th>Pkt</th><th>Strata</th><th class="opt">Trzeba więcej niż lider</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  document.getElementById('title-cap').textContent = 'Maksimum za typowanie: ' + MAXPTS.race + ' pkt, w weekend ze sprintem ' + MAXPTS.sprint + ' pkt (data/seasons.json; zwykłe typowanie ma 20 pytań, liczba pytań sprinterskich to założenie). Równa liczba punktów na koniec sezonu to wspólne P1. „Trzeba więcej niż lider” — ile średnio na rundę trzeba zdobywać ponad punkty lidera. Kliknij nick, żeby zobaczyć historię.';
}

// ---------- aktywni: punkty w co najmniej jednej z ACTIVE_N ostatnich rund ----------
// liczone tylko z pełnych, kolejnych rund (z samej czołówki nie wiadomo, kto zdobył punkty)
var ACTIVE_N = 2, ACTIVE_ONLY = false, ACTIVE_CACHE = null;
function psActive() {
  var R = state.rounds, n = R.length;
  if (ACTIVE_CACHE && ACTIVE_CACHE.st === state) return ACTIVE_CACHE.v;
  var v = null;
  if (n > ACTIVE_N) {
    var ok = true;
    for (var i = n - ACTIVE_N - 1; i < n; i++) if (psPartial(R[i]) || (i > n - ACTIVE_N - 1 && psGap(i))) ok = false;
    if (ok) {
      var set = {}, cnt = 0, last = R[n - 1];
      Object.keys(state.participants).forEach(function(k) {
        var P = state.participants[k]; if (!P[last]) return;
        for (var i = n - ACTIVE_N; i < n; i++) {
          var d = P[R[i]], p = P[R[i - 1]];
          if (d && (p ? d.points > p.points : d.points > 0)) { set[k] = true; cnt++; return; }
        }
      });
      v = { set: set, n: cnt, from: R[n - ACTIVE_N] };
    }
  }
  ACTIVE_CACHE = { st: state, v: v };
  return v;
}
function psActivePlace(k) {
  var act = psActive(), last = state.rounds[state.rounds.length - 1];
  if (!act || !act.set[k]) return null;
  var pts = state.participants[k][last].points, above = 0;
  Object.keys(act.set).forEach(function(x) { if (state.participants[x][last].points > pts) above++; });
  return above + 1;
}
function psActiveChip(k) {
  var act = psActive(); if (!act) return '';
  var p = psActivePlace(k), short = function(r) { return (r.match(/R\d+$/) || [r])[0]; };
  return p ? '<span class="chip blue" title="Miejsce wśród ' + act.n + ' graczy z punktami w rundach ' + short(act.from) + '–' + short(state.rounds[state.rounds.length - 1]) + '">P' + p + ' wśród aktywnych (' + act.n + ')</span>'
    : '<span class="chip red" title="Brak punktów w ' + ACTIVE_N + ' ostatnich rundach">nieaktywny w ' + ACTIVE_N + ' ostatnich rundach</span>';
}
function psSetActiveOnly(on, quiet) {
  ACTIVE_ONLY = !!on; PAGE = 0;
  document.getElementById('act-only').checked = ACTIVE_ONLY;
  lsSet(ACTIVE_KEY, ACTIVE_ONLY ? '1' : '');
  if (!quiet) psRenderTable(true);
}

// ---------- obserwowani gracze / mini-liga (gwiazdka, widok w tabeli, wspólny wykres, link ?liga=) ----------
var WATCH = [], LEAGUE = null, WATCH_MAX_CHART = 8; // LEAGUE — lista z linku ?liga= (tylko w pamięci, nie nadpisuje WATCH)
function psListKeys() { return LEAGUE || WATCH; }
function psWatched(k) { return WATCH.indexOf(k) !== -1; }
function psStarHtml(k) { var on = psWatched(k); return '<button type="button" class="star" data-star="' + psEsc(k) + '" aria-pressed="' + on + '" aria-label="' + (on ? 'Przestań obserwować ' : 'Obserwuj ') + psEsc(psName(k)) + '" title="' + (on ? 'Przestań obserwować' : 'Obserwuj — lista „⭐ Obserwowani”') + '">' + (on ? '★' : '☆') + '</button>'; }
function psSaveWatch() { lsSet(WATCH_KEY, JSON.stringify(WATCH)); }
function psToggleWatch(k) {
  var i = WATCH.indexOf(k);
  if (i === -1) WATCH.push(k); else WATCH.splice(i, 1);
  psSaveWatch();
  psToast((i === -1 ? 'Obserwujesz: ' + psName(k) : 'Nie obserwujesz: ' + psName(k)) + (LEAGUE ? ' (Twoja lista; teraz oglądasz ligę z linku)' : ''));
  var hb = document.getElementById('h-watch');
  if (hb && hb.getAttribute('data-star') === k) { hb.setAttribute('aria-pressed', String(i === -1)); hb.textContent = i === -1 ? '★ Obserwujesz' : '☆ Obserwuj'; }
  psRenderWatch(psOrder(state.rounds[state.rounds.length - 1]));
  psRenderTable();
}
function psClearWatch() {
  if (LEAGUE) {
    // tryb ligi z linku: tylko wyjście z ligi — własna lista zostaje
    LEAGUE = null;
    var u = new URL(location.href); u.searchParams.delete('liga'); history.replaceState(null, '', u.toString());
    if (VIEW === 'watch' && !WATCH.length) VIEW = 'top';
    psToast(WATCH.length ? 'Zamknięto ligę z linku — wracasz do swoich obserwowanych' : 'Zamknięto ligę z linku');
  } else {
    if (!WATCH.length || !confirm('Usunąć wszystkich (' + WATCH.length + ') z listy obserwowanych?')) return;
    WATCH = []; psSaveWatch();
    if (VIEW === 'watch') VIEW = 'top';
    var hb = document.getElementById('h-watch'); if (hb) { hb.setAttribute('aria-pressed', 'false'); hb.textContent = '☆ Obserwuj'; }
    psToast('Wyczyszczono listę obserwowanych');
  }
  psRenderWatch();
  psRenderTable(true);
}
function psLeagueKeys() {
  // na wykresie obserwowani w kolejności dodania (kolor przypisany do osoby, nie do miejsca) + Ty na końcu
  var keys = psListKeys().filter(function(k) { return state.participants[k]; });
  if (ME && keys.indexOf(ME) === -1 && keys.length) keys.push(ME);
  return keys;
}
function psRenderWatch() {
  var sec = document.getElementById('watch-sec'), keys = psLeagueKeys();
  if (!keys.length) { sec.hidden = true; return; }
  sec.hidden = false;
  var last = state.rounds[state.rounds.length - 1], shown = keys.slice(0, WATCH_MAX_CHART);
  document.getElementById('watch-n').textContent = (LEAGUE ? 'liga z linku · ' : '') + keys.length + (keys.length === 1 ? ' gracz' : ' graczy');
  var cl = document.getElementById('watch-clear');
  cl.textContent = LEAGUE ? '✕ Zamknij ligę' : '✕ Wyczyść';
  cl.title = LEAGUE ? 'Wróć do swojej listy obserwowanych (ta liga nie jest zapisana)' : 'Usuń wszystkich z listy obserwowanych';
  document.getElementById('watch-legend').innerHTML = shown.map(function(k, i) {
    var d = state.participants[k][last];
    return '<span><i style="background:var(--s' + (i + 1) + ')"></i><span data-k="' + psEsc(k) + '">' + psEsc(psName(k)) + '</span>' + (k === ME ? ' (Ty)' : '') + (d ? ' · P' + psPlace(last, d).txt : '') + '</span>';
  }).join('');
  document.getElementById('watch-cap').textContent = (keys.length > WATCH_MAX_CHART ? 'Na wykresie pierwszych ' + WATCH_MAX_CHART + ' z ' + keys.length + ' obserwowanych (wszyscy są w tabeli). ' : '') +
    (LEAGUE ? 'Oglądasz ligę z linku — nie jest zapisana; gwiazdka ☆ dopisuje do Twojej własnej listy. ' : '') +
    'Gwiazdka ☆ przy nicku w tabeli albo w historii gracza dodaje do listy. Lista jest zapisana w tej przeglądarce; „Link do ligi” pozwala ją komuś pokazać.';
  psDrawWatch();
}
function psDrawWatch() {
  var box = document.getElementById('watch-chart'), tip = document.getElementById('watch-tip');
  if (!box || document.getElementById('watch-sec').hidden) return;
  var keys = psLeagueKeys().slice(0, WATCH_MAX_CHART), R = state.rounds, n = R.length;
  var W = Math.max(280, box.clientWidth), H = W < 480 ? 220 : 260, direct = keys.length <= 4 && W >= 480;
  var m = { l: 44, r: direct ? 96 : 16, t: 16, b: 28 }, iw = W - m.l - m.r, ih = H - m.t - m.b;
  var series = keys.map(function(k) { return R.map(function(r) { var d = state.participants[k][r]; return d ? psPlace(r, d).place : null; }); });
  var all = [].concat.apply([], series).filter(function(v) { return v !== null; });
  if (!all.length) { box.innerHTML = ''; box.appendChild(tip); return; }
  var lo = Math.min.apply(null, all), hi = Math.max.apply(null, all);
  var pad = Math.max(2, Math.ceil((hi - lo) * 0.1)); lo = Math.max(1, lo - pad); hi = hi + pad;
  var X = function(i) { return m.l + (n === 1 ? iw / 2 : i * iw / (n - 1)); };
  var Y = function(v) { return m.t + (v - lo) / (hi - lo) * ih; };
  var raw = (hi - lo) / 4, step = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000].find(function(x) { return x >= raw; }) || 2000;
  var ticks = lo === 1 ? [1] : [];
  for (var v = Math.ceil(lo / step) * step; v <= hi; v += step) if (v > 1 && (v - (ticks[ticks.length - 1] || -1e9)) * ih / (hi - lo) >= 18) ticks.push(v);
  var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="Miejsce obserwowanych graczy po każdej rundzie">';
  svg += '<g class="grid">' + ticks.map(function(t) { return '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + Y(t) + '" y2="' + Y(t) + '"/>'; }).join('') + '</g>';
  svg += ticks.map(function(t) { return '<text class="ax" x="' + (m.l - 8) + '" y="' + (Y(t) + 4) + '" text-anchor="end">P' + t + '</text>'; }).join('');
  var every = W < 480 && n > 8 ? 2 : 1;
  svg += R.map(function(r, i) { return (i % every && i !== n - 1) ? '' : '<text class="ax" x="' + X(i) + '" y="' + (H - 8) + '" text-anchor="middle">' + psEsc((r.match(/R\d+$/) || [r])[0]) + (psIsSprint(r) ? '⚡' : '') + '</text>'; }).join('');
  svg += '<line class="cross" id="watch-cross" x1="0" x2="0" y1="' + m.t + '" y2="' + (H - m.b) + '" style="display:none"/>';
  series.forEach(function(vals, si) {
    var d = '', pen = false;
    vals.forEach(function(v, i) { if (v === null || (i > 0 && psGap(i))) pen = false; if (v === null) return; d += (pen ? 'L' : 'M') + X(i) + ' ' + Y(v); pen = true; });
    svg += '<path class="wl" style="stroke:var(--s' + (si + 1) + ')" d="' + d + '"/>';
    svg += vals.map(function(v, i) { return v === null ? '' : '<circle class="wd" style="fill:var(--s' + (si + 1) + ')" cx="' + X(i) + '" cy="' + Y(v) + '" r="4"/>'; }).join('');
  });
  if (direct) {
    // podpisy na końcu linii, rozsunięte, żeby się nie nakładały
    var labs = series.map(function(vals, si) { var li = vals.length - 1; while (li >= 0 && vals[li] === null) li--; return li < 0 ? null : { si: si, y: Y(vals[li]), x: X(li) }; }).filter(Boolean).sort(function(a, b) { return a.y - b.y; });
    for (var i = 1; i < labs.length; i++) if (labs[i].y - labs[i - 1].y < 14) labs[i].y = labs[i - 1].y + 14;
    svg += labs.map(function(l) { var nm = psName(keys[l.si]); return '<text class="wlab" x="' + (l.x + 9) + '" y="' + (l.y + 4) + '">' + psEsc(nm.length > 12 ? nm.slice(0, 11) + '…' : nm) + '</text>'; }).join('');
  }
  svg += '</svg>';
  box.innerHTML = svg; box.appendChild(tip); tip.style.display = 'none';
  var el = box.querySelector('svg'), cross = el.querySelector('#watch-cross');
  function show(ev) {
    var rect = el.getBoundingClientRect(), x = (ev.clientX - rect.left) * W / rect.width;
    var i = Math.max(0, Math.min(n - 1, Math.round((x - m.l) / (n === 1 ? 1 : iw / (n - 1)))));
    cross.setAttribute('x1', X(i)); cross.setAttribute('x2', X(i)); cross.style.display = '';
    var rows = keys.map(function(k, si) { var d = state.participants[k][R[i]]; return { k: k, si: si, d: d }; })
      .sort(function(a, b) { return (a.d ? a.d.position : 1e9) - (b.d ? b.d.position : 1e9); });
    tip.innerHTML = '<b>' + psEsc(psRoundText(R[i])) + '</b>' + rows.map(function(r) {
      return '<br><span class="sw" style="background:var(--s' + (r.si + 1) + ')"></span>' + psEsc(psName(r.k)) + ': ' + (r.d ? 'P' + psPlace(R[i], r.d).txt + ' · ' + r.d.points + ' pkt' : (psPartial(R[i]) ? 'poza TOP ' + state.top[R[i]] : 'brak danych'));
    }).join('');
    tip.style.display = 'block';
    var px = X(i) * rect.width / W, tw = tip.offsetWidth;
    tip.style.left = Math.max(tw / 2, Math.min(rect.width - tw / 2, px)) + 'px';
    tip.style.top = '0px';
  }
  el.addEventListener('pointermove', show); el.addEventListener('pointerdown', show);
  el.addEventListener('pointerleave', function() { tip.style.display = 'none'; cross.style.display = 'none'; });
}
function psShareLeague() {
  var keys = psLeagueKeys().filter(function(k) { return /^u\d+$/.test(k); });
  if (!keys.length) return;
  var u = new URL(location.href); u.search = ''; u.hash = '';
  if (SEASON !== DEFAULT_SEASON) u.searchParams.set('sezon', SEASON);
  u.searchParams.set('liga', keys.map(function(k) { return k.slice(1); }).join(','));
  var url = u.toString();
  if (navigator.share) { navigator.share({ title: 'Moja liga — klasyfikacja parcfer.me', url: url }).catch(function() {}); return; }
  navigator.clipboard.writeText(url).then(function() { psToast('Skopiowano link do ligi'); }, function() { window.prompt('Skopiuj link:', url); });
}

// ---------- ranking po wybranej rundzie (?runda=R19): stan tak, jakby późniejszych rund jeszcze nie było ----------
var ROUND_UPTO = null; // liczba rund do pokazania; null = wszystkie (bieżący stan)
function psRoundIndex(text) {
  var no = parseInt(String(text || '').replace(/^R/i, ''), 10);
  if (!no) return -1;
  for (var i = 0; i < seedRounds.length; i++) if (psRoundNo(seedRounds[i]) === no) return i;
  return -1;
}
function psBuildRoundPicker() {
  var box = document.getElementById('ps-round-pick'), sel = document.getElementById('ps-round');
  if (seedRounds.length < 2) { box.hidden = true; return; }
  sel.innerHTML = seedRounds.map(function(r, i) { return '<option value="' + (i === seedRounds.length - 1 ? '' : psEsc((r.match(/R\d+$/) || [r])[0])) + '"' + (i === state.rounds.length - 1 ? ' selected' : '') + '>' + psEsc(psRoundText(r)) + (i === seedRounds.length - 1 ? ' — bieżący' : '') + '</option>'; }).reverse().join('');
  document.getElementById('ps-past').hidden = !ROUND_UPTO;
  box.hidden = false;
}
function psSetRound(text) {
  var i = psRoundIndex(text);
  ROUND_UPTO = i >= 0 && i < seedRounds.length - 1 ? i + 1 : null;
  state = buildSeedState(ROUND_UPTO);
  psBuildLabels();
  psFillNicks.done = false; HIST = null; DUEL = null; SORT_RI = null; PAGE = 0;
  var dlg = document.getElementById('hist'); if (dlg.open) dlg.close();
  var u = new URL(location.href);
  if (ROUND_UPTO) u.searchParams.set('runda', (state.rounds[state.rounds.length - 1].match(/R\d+$/) || [''])[0]); else u.searchParams.delete('runda');
  history.replaceState(null, '', u.toString());
  psBuildRoundPicker();
  psRenderAll();
}

// ---------- zwycięzcy rund i rozkład punktów w rundzie ----------
// zwycięzca rundy = najwięcej punktów zdobytych w rundzie (z remisami); full — obie rundy z pełnym rankingiem
function psRoundWinners(ri) {
  if (ri < 1 || psGap(ri)) return null;
  var best = null, keys = [], gains = [];
  Object.keys(state.participants).forEach(function(k) {
    var g = psRoundDelta(k, ri);
    if (g === null) return;
    gains.push(g);
    if (best === null || g > best) { best = g; keys = [k]; } else if (g === best) keys.push(k);
  });
  if (best === null) return null;
  var R = state.rounds, last = R[ri];
  keys.sort(function(a, b) { return state.participants[a][last].position - state.participants[b][last].position; });
  return { v: best, keys: keys, gains: gains, full: !psPartial(R[ri]) && !psPartial(R[ri - 1]) };
}
var DIST_RI = null;
function psRenderWins() {
  var sec = document.getElementById('wins-sec'), R = state.rounds, n = R.length, rows = [], fullIdx = [];
  for (var i = n - 1; i > 0; i--) {
    var w = psRoundWinners(i);
    if (!w) continue;
    if (w.full) fullIdx.push(i);
    rows.push('<tr><td>' + psRoundLabel(R[i]) + '</td><td class="w">' + psWho(w.keys, 3) + (w.full ? '' : ' <span class="tie" title="Z tej albo poprzedniej rundy mamy tylko czołówkę">(wśród zapisanej czołówki)</span>') + '</td><td><b>+' + w.v + '</b></td></tr>');
  }
  if (!rows.length) { sec.hidden = true; DIST_RI = null; return; }
  sec.hidden = false;
  document.getElementById('wins-table').innerHTML = '<thead><tr><th>Runda</th><th class="w">Najwięcej punktów</th><th>Pkt</th></tr></thead><tbody>' + rows.join('') + '</tbody>';
  var dist = document.querySelector('#wins-sec .dist');
  dist.hidden = !fullIdx.length;
  if (fullIdx.length) {
    if (fullIdx.indexOf(DIST_RI) === -1) DIST_RI = fullIdx[0];
    document.getElementById('dist-r').innerHTML = fullIdx.map(function(i) { return '<option value="' + i + '"' + (i === DIST_RI ? ' selected' : '') + '>' + psEsc(psRoundText(R[i])) + '</option>'; }).join('');
    psDrawDist(DIST_RI);
  } else DIST_RI = null;
  document.getElementById('wins-cap').textContent = 'Zwycięzca rundy — najwięcej punktów zdobytych w tej rundzie (przy remisie wszyscy). Przez przerwę w danych i dla graczy spoza zapisanej czołówki przyrostu nie liczymy. Rozkład — tylko rundy z pełnym rankingiem przed i po rundzie; Twój słupek jest żółty. Kliknij nick, żeby zobaczyć historię.';
}
function psDrawDist(ri) {
  DIST_RI = ri;
  var box = document.getElementById('dist-chart'), tip = document.getElementById('dist-tip'), w = psRoundWinners(ri);
  if (!box || !w) return;
  var R = state.rounds, mx = Math.max.apply(null, w.gains), cnt = [];
  for (var v = 0; v <= mx; v++) cnt.push(0);
  w.gains.forEach(function(g) { if (g >= 0) cnt[g]++; });
  var total = w.gains.length, sorted = w.gains.slice().sort(function(a, b) { return a - b; });
  var avg = w.gains.reduce(function(a, b) { return a + b; }, 0) / total, med = sorted[Math.floor(total / 2)];
  var myG = ME ? psRoundDelta(ME, ri) : null;
  var scorers = total - cnt[0], avgSc = scorers ? (w.gains.reduce(function(a, b) { return a + b; }, 0) / scorers) : 0;
  document.getElementById('dist-stats').innerHTML = '<b>' + psNum(total) + '</b> graczy · bez punktów <b>' + psNum(cnt[0]) + '</b> (' + Math.round(cnt[0] / total * 100) + '%) · średnio <b>' + avg.toFixed(1).replace('.', ',') + '</b> pkt, wśród punktujących <b>' + avgSc.toFixed(1).replace('.', ',') + '</b> · mediana ' + med +
    (myG !== null ? ' · Ty: <b>' + psSigned(myG) + '</b>' : '') + '<br><span class="tie">Wykres: gracze z co najmniej 1 pkt (' + psNum(scorers) + ').</span>';
  document.getElementById('dist-table').innerHTML = '<thead><tr><th>Punkty w rundzie</th><th>Graczy</th></tr></thead><tbody>' + cnt.map(function(c, v) { return c ? '<tr><td>' + v + '</td><td>' + c + '</td></tr>' : ''; }).join('') + '</tbody>';
  // wykres od 1 pkt: słupek „0 pkt” jest kilkanaście razy wyższy i spłaszczałby resztę (zera są w opisie i tabeli)
  var bars = cnt.slice(1);
  var W = Math.max(260, box.clientWidth), H = W < 480 ? 180 : 210, m = { l: 40, r: 8, t: 12, b: 26 }, iw = W - m.l - m.r, ih = H - m.t - m.b;
  var top = Math.max(1, Math.max.apply(null, bars)), step = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000].find(function(x) { return x >= top / 4; }) || 2000, ymax = Math.ceil(top / step) * step;
  var slot = iw / Math.max(1, bars.length), bw = Math.max(2, slot - 2); // 2 px odstępu między słupkami
  var X = function(v) { return m.l + (v - 1) * slot + (slot - bw) / 2; }, Y = function(c) { return m.t + ih - c / ymax * ih; };
  var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="Rozkład punktów zdobytych w rundzie (gracze z co najmniej 1 pkt) ' + psEsc(R[ri]) + '">';
  var ticks = []; for (var t = 0; t <= ymax; t += step) ticks.push(t);
  svg += '<g class="grid">' + ticks.map(function(t) { return '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + Y(t) + '" y2="' + Y(t) + '"/>'; }).join('') + '</g>';
  svg += ticks.map(function(t) { return '<text class="ax" x="' + (m.l - 8) + '" y="' + (Y(t) + 4) + '" text-anchor="end">' + t + '</text>'; }).join('');
  var lab = slot < 16 ? 2 : 1;
  svg += bars.map(function(c, b) {
    var v = b + 1, x = X(v), y = Y(c), h = m.t + ih - y, r = Math.min(4, h / 2, bw / 2), x1 = x + bw, y0 = m.t + ih;
    // zaokrąglony tylko koniec słupka, podstawa przy osi prosta
    var bar = c ? '<path class="hb' + (myG === v ? ' me' : '') + '" d="M' + x + ' ' + y0 + 'V' + (y + r) + 'Q' + x + ' ' + y + ' ' + (x + r) + ' ' + y + 'H' + (x1 - r) + 'Q' + x1 + ' ' + y + ' ' + x1 + ' ' + (y + r) + 'V' + y0 + 'Z"/>' : '';
    return bar + ((v - 1) % lab && v !== bars.length ? '' : '<text class="ax" x="' + (x + bw / 2) + '" y="' + (H - 8) + '" text-anchor="middle">' + v + '</text>');
  }).join('');
  svg += bars.map(function(c, b) { return '<rect class="hit" data-v="' + (b + 1) + '" x="' + (m.l + b * slot) + '" y="' + m.t + '" width="' + slot + '" height="' + ih + '"/>'; }).join('');
  svg += '</svg>';
  box.innerHTML = svg; box.appendChild(tip); tip.style.display = 'none';
  var el = box.querySelector('svg');
  function show(ev) {
    var rect = el.getBoundingClientRect(), x = (ev.clientX - rect.left) * W / rect.width;
    var v = 1 + Math.max(0, Math.min(bars.length - 1, Math.floor((x - m.l) / slot)));
    tip.innerHTML = '<b>' + v + ' pkt w rundzie</b><br>' + cnt[v] + ' ' + (cnt[v] === 1 ? 'gracz' : 'graczy') + ' (' + (cnt[v] / total * 100).toFixed(1).replace('.', ',') + '%)' + (myG === v ? '<br>w tym Ty' : '');
    tip.style.display = 'block';
    var px = (X(v) + bw / 2) * rect.width / W, tw = tip.offsetWidth;
    tip.style.left = Math.max(tw / 2, Math.min(rect.width - tw / 2, px)) + 'px';
    tip.style.top = Math.max(0, Y(cnt[v]) * rect.height / H - tip.offsetHeight - 8) + 'px';
  }
  el.addEventListener('pointermove', show); el.addEventListener('pointerdown', show);
  el.addEventListener('pointerleave', function() { tip.style.display = 'none'; });
}

// ---------- archiwum sezonów (data/history.json): mistrzowie i „Twoje sezony” ----------
var HISTORY = null;
function psSeasonUrl(y, id) { return '?sezon=' + y + (id ? '&id=' + id : ''); }
function psRenderChamps() {
  var el = document.getElementById('champs');
  if (!HISTORY) return;
  var ys = Object.keys(HISTORY.champions).sort().reverse();
  if (!ys.length) { el.hidden = true; return; }
  el.innerHTML = '<div class="label">🏅 Mistrzowie sezonów</div>' + ys.map(function(y) {
    var c = HISTORY.champions[y];
    var who = c.ids.map(function(id, i) { var k = 'u' + id; return state.participants[k] ? '<span data-k="' + k + '">' + psEsc(c.names[i]) + '</span>' : psEsc(c.names[i]); }).join(', ');
    return '<span class="c"><a href="' + psSeasonUrl(y) + '" title="Tabela sezonu ' + y + '">' + y + '</a><b>' + who + '</b><span class="tie">' + c.points + ' pkt</span></span>';
  }).join('');
  el.hidden = false;
}
function psRenderSeasons(key) {
  var box = document.getElementById('h-seasons'), id = /^u\d+$/.test(key) ? key.slice(1) : null;
  var mine = HISTORY && id && HISTORY.players[id];
  if (!mine || Object.keys(mine).filter(function(y) { return +y !== SEASON; }).length === 0) { box.innerHTML = ''; return; }
  var rows = Object.keys(mine).sort().reverse().map(function(y) {
    var s = HISTORY.seasons[y], v = mine[y];
    return '<tr' + (+y === SEASON ? ' class="cur"' : '') + '><td><a href="' + psSeasonUrl(y, id) + '">' + y + '</a>' + (s && !s.final ? ' <span class="tie">(trwa)</span>' : '') + '</td><td>P' + v[0] + (HISTORY.champions[y] && v[0] === 1 ? ' 🏅' : '') + '</td><td><b>' + v[1] + '</b></td><td>' + (s ? psNum(s.players) : '') + '</td></tr>';
  }).join('');
  box.innerHTML = '<div class="label" style="margin-top:16px">Sezony gracza</div><table><thead><tr><th>Sezon</th><th>Miejsce</th><th>Punkty</th><th>Graczy</th></tr></thead><tbody>' + rows + '</tbody></table>';
}

// forma: suma punktów z ostatnich FORM_N rund (tylko osoby z danymi ze wszystkich tych rund)
var FORM_N = 3, FORM_TOP = 10;
function psRenderForm(order) {
  var sec = document.getElementById('form-sec'), n = state.rounds.length, R = state.rounds;
  if (n < FORM_N + 1) { sec.style.display = 'none'; return; }
  sec.style.display = '';
  var idx = []; for (var i = n - FORM_N; i < n; i++) idx.push(i);
  var rankOf = {}; order.forEach(function(k, i) { rankOf[k] = i + 1; });
  var rows = [], missing = 0;
  order.forEach(function(k) {
    if (!state.participants[k][R[n - 1]]) return;
    var ds = idx.map(function(i) { return psRoundDelta(k, i); });
    if (ds.some(function(d) { return d === null; })) { missing++; return; }
    rows.push({ k: k, ds: ds, sum: ds.reduce(function(a, b) { return a + b; }, 0) });
  });
  rows.sort(function(a, b) { return b.sum - a.sum || rankOf[a.k] - rankOf[b.k]; });
  var short = function(r) { return (r.match(/R\d+$/) || [r])[0]; };
  document.getElementById('form-r').textContent = short(R[n - FORM_N]) + '–' + short(R[n - 1]);
  // miejsce w formie z remisami (ta sama suma = to samo miejsce)
  var place = [], prev = null;
  rows.forEach(function(r, i) { place[i] = prev !== null && rows[i - 1].sum === r.sum ? place[i - 1] : i + 1; prev = r.sum; });
  var line = function(r, i) {
    return '<tr class="' + (psIsMe(r.k) ? 'me ' : '') + (place[i] <= 3 ? 'f' + place[i] : '') + '"><td class="fr">' + place[i] + '</td><td class="nm-c" data-k="' + psEsc(r.k) + '"><button type="button" class="lnk" data-k="' + psEsc(r.k) + '">' + psEsc(psName(r.k)) + '</button></td>' +
      r.ds.map(function(d) { return '<td class="rd"><span class="' + (d > 0 ? 'd' : 'd0') + '">' + psSigned(d) + '</span></td>'; }).join('') +
      '<td class="sum">' + r.sum + '</td><td>P' + psPlace(R[n - 1], state.participants[r.k][R[n - 1]]).txt + '</td></tr>';
  };
  var body = rows.slice(0, FORM_TOP).map(line).join('');
  var mi = rows.findIndex(function(r) { return psIsMe(r.k); });
  if (mi >= FORM_TOP) body += '<tr class="gap"><td colspan="' + (FORM_N + 4) + '">⋯</td></tr>' + line(rows[mi], mi);
  document.getElementById('form-table').innerHTML = '<thead><tr><th class="fr">#</th><th class="nm-c">Uczestnik</th>' +
    idx.map(function(i) { return '<th class="rd">' + psRoundLabel(R[i]) + '</th>'; }).join('') + '<th>Suma ' + FORM_N + ' rund</th><th>Ogólnie</th></tr></thead><tbody>' + body + '</tbody>';
  // rundy bazowe z samą czołówką ograniczają, kogo da się porównać
  var partial = []; for (var j = n - FORM_N - 1; j < n - 1; j++) if (psPartial(R[j])) partial.push(R[j]);
  document.getElementById('form-cap').textContent = (partial.length
    ? 'Z rundy ' + partial.join(', ') + ' mamy tylko czołówkę (TOP ' + state.top[partial[partial.length - 1]] + '), więc na razie porównujemy tylko osoby, które w niej były (' + missing + ' os. pominięto). Pełna tabela formy — gdy wszystkie ' + FORM_N + ' rundy będą z pełnego rankingu. '
    : (missing ? 'Pominięto ' + missing + ' os. bez danych ze wszystkich ' + FORM_N + ' rund. ' : '')) + 'Kliknij nick, żeby zobaczyć historię.';
}

// ---------- rekordy sezonu (z zapisanych rund; przerwy i rundy z samą czołówką pomijane tam, gdzie nie da się liczyć) ----------
// wspólny zakres rund do średniej i równości: najdłuższy ciąg ostatnich rund bez przerwy w numeracji,
// w którym runda i poprzednia mają co najmniej 100 wierszy — wszyscy porównywani na tych samych rundach
var REC_MIN_SPAN = 3;
function psCommonSpan() {
  var R = state.rounds, idx = [];
  for (var i = R.length - 1; i > 0; i--) {
    if (psGap(i) || state.size[R[i]] < 100 || state.size[R[i - 1]] < 100) break;
    idx.unshift(i);
  }
  return idx;
}
function psRenderRecords() {
  var R = state.rounds, n = R.length, keys = Object.keys(state.participants), span = psCommonSpan();
  document.getElementById('rec-h').textContent = n < 2 ? '🏅 Mistrzowie sezonów' : '🏆 Rekordy sezonu';
  document.getElementById('champs').classList.toggle('only', n < 2);
  if (n < 2) { document.getElementById('rec-grid').innerHTML = ''; document.getElementById('rec-cap').textContent = ''; return; }
  var best = function(list, better) { // [{k, v, extra}] → zwycięzcy (z remisami)
    var top = [];
    list.forEach(function(x) { if (!top.length || better(x.v, top[0].v)) top = [x]; else if (x.v === top[0].v) top.push(x); });
    return top;
  };
  var gainList = [], climbList = [], leadList = [], top10List = [], avgList = [], steadyList = [];
  // wygrane rundy: najwięcej punktów w rundzie (remis = wygrana każdego), tylko rundy z pełnymi danymi po obu stronach
  var wins = {}, winRounds = 0;
  for (var wi = 1; wi < n; wi++) { var w = psRoundWinners(wi); if (w && w.full) { winRounds++; w.keys.forEach(function(k) { wins[k] = (wins[k] || 0) + 1; }); } }
  var winList = Object.keys(wins).map(function(k) { return { k: k, v: wins[k] }; });
  keys.forEach(function(k) {
    var P = state.participants[k], ds = [], lead = 0, t10 = 0;
    R.forEach(function(r, i) {
      var d = P[r]; if (!d) return;
      var pl = psPlace(r, d).place;
      if (pl === 1) lead++;
      if (pl <= 10) t10++;
      var g = psRoundDelta(k, i);
      if (g !== null) { ds.push(g); gainList.push({ k: k, v: g, r: r }); }
      var mv = psStatus(k, i, 'position');
      if (typeof mv === 'number' && pl <= 100) climbList.push({ k: k, v: mv, r: r });
    });
    if (lead) leadList.push({ k: k, v: lead });
    if (t10) top10List.push({ k: k, v: t10 });
    var sp = span.length >= REC_MIN_SPAN ? span.map(function(i) { return psRoundDelta(k, i); }) : [null];
    if (sp.every(function(g) { return g !== null; })) {
      var avg = sp.reduce(function(a, b) { return a + b; }, 0) / sp.length;
      var sd = Math.sqrt(sp.reduce(function(a, b) { return a + (b - avg) * (b - avg); }, 0) / sp.length);
      avgList.push({ k: k, v: Math.round(avg * 10) / 10 });
      steadyList.push({ k: k, v: Math.round(sd * 10) / 10, avg: avg });
    }
  });
  var who = function(top, fmt) {
    var lim = top.length === 3 ? 3 : 2; // trzy nicki mieszczą się bez „i 1 inny”
    var names = top.slice(0, lim).map(function(x) { return '<span data-k="' + psEsc(x.k) + '">' + psEsc(psName(x.k)) + '</span>' + (fmt ? ' <span class="tie">' + fmt(x) + '</span>' : ''); });
    return names.join(', ') + (top.length > lim ? ' <span class="tie">i ' + (top.length - lim) + ' ' + (top.length - lim === 1 ? 'inny' : 'innych') + '</span>' : '');
  };
  var hi = function(a, b) { return a > b; }, lo = function(a, b) { return a < b; };
  // równość: wśród graczy ze średnią w górnej połowie (inaczej wygrywa ktoś, kto stale ma mało punktów)
  var med = avgList.map(function(x) { return x.v; }).sort(function(a, b) { return a - b; })[Math.floor(avgList.length / 2)] || 0;
  var short = function(r) { return (r.match(/R\d+$/) || [r])[0]; };
  var spanTxt = span.length >= REC_MIN_SPAN ? short(R[span[0]]) + '–' + short(R[n - 1]) : '';
  var cards = [
    ['★ Najwięcej punktów w rundzie', best(gainList, hi), function(t) { return '+' + t[0].v + ' pkt'; }, function(x) { return x.r; }],
    ['↗ Największy awans w rundzie', best(climbList, hi), function(t) { return '▲' + t[0].v; }, function(x) { return x.r; }],
    ['👑 Najwięcej rund na prowadzeniu', best(leadList, hi), function(t) { return t[0].v + ' ' + (t[0].v === 1 ? 'runda' : t[0].v % 10 >= 2 && t[0].v % 10 <= 4 && (t[0].v % 100 < 10 || t[0].v % 100 >= 20) ? 'rundy' : 'rund'); }, null],
    ['🔟 Najwięcej rund w TOP 10', best(top10List, hi), function(t) { return t[0].v + ' z ' + n; }, null],
    ['🥇 Najwięcej wygranych rund', winRounds >= 3 ? best(winList, hi) : [], function(t) { return t[0].v + ' z ' + winRounds; }, null],
    ['Ø Najwyższa średnia na rundę' + (spanTxt ? ' (' + spanTxt + ')' : ''), best(avgList, hi), function(t) { return t[0].v.toFixed(1).replace('.', ',') + ' pkt'; }, null],
    ['≈ Najrówniej punktujący' + (spanTxt ? ' (' + spanTxt + ')' : ''), best(steadyList.filter(function(x) { return x.avg >= med; }), lo), function(t) { return '±' + t[0].v.toFixed(1).replace('.', ','); }, function(x) { return 'śr. ' + x.avg.toFixed(1).replace('.', ',') + ' pkt'; }]
  ];
  document.getElementById('rec-grid').innerHTML = cards.map(function(c) {
    var top = c[1];
    if (!top.length) return '';
    return '<div class="rec"><div class="label">' + c[0] + '</div><div class="v">' + c[2](top) + '</div><div class="who">' + who(top, c[3]) + '</div></div>';
  }).join('');
  document.getElementById('rec-cap').textContent = 'Liczone z zapisanych rund (' + R[0].replace(/ R\d+$/, '') + ' – ' + R[n - 1].replace(/ R\d+$/, '') + '). Przyrostów i awansów nie liczymy przez przerwę w danych ani dla graczy spoza zapisanej czołówki w rundach z samą czołówką. ' +
    (spanTxt ? 'Średnia i równość: wspólny zakres rund ' + spanTxt + ' (' + span.length + ' rund z pełnymi danymi), ' + avgList.length + ' graczy z kompletem punktów z tych rund; równość (najmniejsze odchylenie punktów od średniej) wśród graczy ze średnią w górnej połowie. ' : '') +
    'Kliknij nick, żeby zobaczyć historię.';
}

// ---------- kalkulator „ile mi brakuje” ----------
var CALC_T = null, CALC_ME = null, PLANNED = null, MAXPTS = null;
// najwięcej punktów do zdobycia w rundach po lastNo (seasons.json → max_points: zwykła runda / weekend ze sprintem)
function psMaxLeft(lastNo) {
  if (!MAXPTS || !PLANNED || !lastNo) return null;
  var sum = 0;
  for (var r = lastNo + 1; r <= PLANNED; r++) sum += SPRINTS.indexOf(r) !== -1 ? MAXPTS.sprint : MAXPTS.race;
  return sum;
}
function psCalc() {
  var sel = document.getElementById('calc-t'), out = document.getElementById('calc-out');
  if (!sel || !out) return;
  CALC_T = +sel.value;
  var n = state.rounds.length, last = state.rounds[n - 1], order = psOrder(last);
  var me = ME && state.participants[ME][last] ? ME : null; if (!me) return;
  var md = state.participants[me][last], target = order[Math.min(CALC_T, order.length) - 1], td = state.participants[target][last];
  var gap = td.points - md.points, label = CALC_T === 1 ? 'P1' : 'TOP ' + CALC_T;
  var lastNo = psRoundNo(last), left = PLANNED && lastNo ? Math.max(0, PLANNED - lastNo) : null;
  if (psPlace(last, md).place <= CALC_T) {
    // pierwsza osoba, której wspólne miejsce jest już poza progiem
    var out1 = order.find(function(k) { var d = state.participants[k][last]; return d && psPlace(last, d).place > CALC_T; });
    out.innerHTML = 'Jesteś w ' + label + '. ' + (out1 ? 'Przewaga nad pierwszą osobą poza ' + label + ' (' + psEsc(psName(out1)) + '): <b>' + (md.points - state.participants[out1][last].points) + ' pkt</b>.' : '');
    return;
  }
  var html = 'Do ' + label + ' brakuje <b>' + gap + ' pkt</b> (' + psEsc(psName(target)) + ', P' + psPlace(last, td).txt + ', ma ' + td.points + ' pkt). ';
  if (left === null) html += '';
  else if (left === 0) html += 'To była ostatnia runda sezonu.';
  else {
    var maxLeft = psMaxLeft(lastNo), rundy = left === 1 ? 'runda' : left % 10 >= 2 && left % 10 <= 4 && (left % 100 < 10 || left % 100 >= 20) ? 'rundy' : 'rund';
    html += maxLeft !== null && gap > maxLeft
      ? 'Zostały <b>' + left + '</b> ' + rundy + ', w których można zdobyć najwyżej ' + maxLeft + ' pkt — <b>matematycznie poza zasięgiem</b>.'
      : 'Zostały <b>' + left + '</b> ' + rundy + (maxLeft !== null ? ' (do zdobycia najwyżej ' + maxLeft + ' pkt)' : '') +
        ' — trzeba zdobywać średnio <b>' + (Math.ceil(gap / left * 10) / 10).toFixed(1).replace('.', ',') + ' pkt na rundę więcej</b> niż ten gracz.';
  }
  out.innerHTML = html;
}

// ---------- sortowanie po rundzie i eksport CSV ----------
var SORT_RI = null;
function psSortCmp(rankOf) {
  return function(a, b) {
    var ga = psRoundDelta(a, SORT_RI), gb = psRoundDelta(b, SORT_RI);
    if (ga === null && gb === null) return rankOf[a] - rankOf[b];
    if (ga === null) return 1;
    if (gb === null) return -1;
    return gb - ga || rankOf[a] - rankOf[b];
  };
}
function psSortBy(ri) {
  SORT_RI = ri < 0 || SORT_RI === ri ? null : ri;
  PAGE = 0;
  psRenderTable(true);
}
function psCsv() {
  var R = state.rounds, last = R[R.length - 1], order = psOrder(last);
  var q = function(v) { v = String(v); return /[";\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  // nick zaczynający się od =, +, - lub @ Excel uznałby za formułę
  var safe = function(v) { return /^[=+\-@]/.test(v) ? "'" + v : v; };
  var rows = [['Miejsce', 'Nick', 'Id parcfer.me'].concat([].concat.apply([], R.map(function(r) { r = psRoundText(r); return [r + ' pkt', r + ' miejsce', r + ' w rundzie']; }))).concat(['Suma'])];
  order.forEach(function(k) {
    var P = state.participants[k], cur = P[last];
    var row = [cur ? psPlace(last, cur).txt : '', safe(psName(k)), /^u\d+$/.test(k) ? k.slice(1) : ''];
    R.forEach(function(r, i) { var d = P[r], g = psRoundDelta(k, i); row.push(d ? d.points : '', d ? psPlace(r, d).txt : '', g === null ? '' : g); });
    row.push(cur ? cur.points : '');
    rows.push(row);
  });
  var csv = '﻿' + rows.map(function(r) { return r.map(q).join(';'); }).join('\r\n') + '\r\n';
  var a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = 'parcferme-ranking-' + SEASON + '-' + (last.match(/R\d+$/) || ['stan'])[0] + '.csv';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function() { URL.revokeObjectURL(a.href); }, 1000);
  psToast('Pobrano tabelę CSV (' + order.length + ' uczestników)');
}

// meOnly: zmiana „ja” (nick w Twojej pozycji) — rekordy, zwycięzcy rund i mistrzowie od niej nie zależą
function psRenderAll(meOnly) {
  if (!state.rounds.length) {
    document.getElementById('ps-empty').style.display = 'block';
    document.getElementById('ps-subtitle').textContent = 'Brak danych';
    return;
  }
  var n = state.rounds.length, last = state.rounds[n - 1];
  document.getElementById('ps-asof').textContent = 'Stan po rundzie: ' + last + '.';
  var played = psRoundNo(last);
  document.getElementById('ps-subtitle').textContent = 'Nieoficjalny ranking typerów parcfer.me runda po rundzie · ' + (played && played !== n ? n + ' z ' + played + ' rund zapisanych' : n + ' ' + (n === 1 ? 'runda' : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'rundy' : 'rund'))) + ' · ' + Object.keys(state.participants).length + ' uczestników · stan po ' + last;
  var order = psOrder(last);
  psResolveMe();
  psRenderKpis(order);
  psRenderTitle(order);
  psRenderWatch(order);
  psRenderForm(order);
  if (!meOnly) { psRenderRecords(); psRenderWins(); psRenderChamps(); }
  else if (DIST_RI !== null) psDrawDist(DIST_RI); // Twój słupek w rozkładzie
  if (!psFillNicks.done) { psFillNicks(order); psFillNicks.done = true; } // lista nicków nie zależy od „ja”
  psRenderDuel();
  psRenderTable();
}

// wersja strony w górnym pasku (bez kroku budowania): wydanie z CHANGELOG.md (pierwsza sekcja „## vX.Y.Z”),
// a liczba commitów na main po wydaniu i skrót ostatniego commita z API GitHuba (pamięć 15 min w localStorage).
// Bez odpowiedzi API — samo wydanie.
var REPO = 'patrykw-labs/parcferme-ranking', VER_KEY = 'parcfer-wersja';
async function psVersion() {
  var el = document.getElementById('ps-ver'), rel = null, gh = null;
  try { var m = /^## (v\d+\.\d+\.\d+)/m.exec(await (await fetch('CHANGELOG.md', { cache: 'no-cache' })).text()); if (m) rel = m[1]; } catch (e) {}
  if (!rel) return;
  try { var c = JSON.parse((lsGet(VER_KEY) || {}).value || 'null'); if (c && c.rel === rel && Date.now() - c.t < 15 * 60e3) gh = c; } catch (e) {}
  if (!gh) {
    try {
      // lekkie zapytania (ok. 6 KB): tag → data jego commita → commity na main po tej dacie (per_page=1; liczba z nagłówka Link)
      var api = 'https://api.github.com/repos/' + REPO;
      var get = function(u) { return fetch(u).then(function(r) { return r.ok ? r : Promise.reject(new Error(r.status)); }); };
      var ref = await (await get(api + '/git/ref/tags/' + rel)).json(), obj = ref.object;
      if (obj.type === 'tag') obj = (await (await get(api + '/git/tags/' + obj.sha)).json()).object; // tag z opisem
      var tc = await (await get(api + '/git/commits/' + obj.sha)).json();
      var since = new Date(new Date(tc.committer.date).getTime() + 1000).toISOString();
      var lr = await get(api + '/commits?sha=main&per_page=1&since=' + encodeURIComponent(since)), list = await lr.json();
      var lastPage = /[?&]page=(\d+)>; rel="last"/.exec(lr.headers.get('Link') || '');
      var ahead = lastPage ? +lastPage[1] : list.length;
      gh = { rel: rel, t: Date.now(), ahead: ahead, sha: String(ahead ? list[0].sha : obj.sha).slice(0, 7) };
      lsSet(VER_KEY, JSON.stringify(gh));
    } catch (e) { gh = null; }
  }
  var base = 'https://github.com/' + REPO;
  var relA = '<a href="' + base + '/releases/tag/' + rel + '">' + rel + '</a>';
  if (gh && gh.ahead > 0) {
    var k = gh.ahead, word = k === 1 ? 'commit' : k % 10 >= 2 && k % 10 <= 4 && (k % 100 < 10 || k % 100 >= 20) ? 'commity' : 'commitów';
    el.innerHTML = relA + '<span class="ver-c">+' + k + '<span class="ver-h"> · <a href="' + base + '/compare/' + rel + '...' + gh.sha + '">' + gh.sha + '</a></span></span>';
    el.title = 'Strona z gałęzi main: ' + k + ' ' + word + ' po wydaniu ' + rel + ' (ostatni: ' + gh.sha + ') — kliknij skrót, aby zobaczyć zmiany';
  } else {
    el.innerHTML = relA;
    el.title = gh ? 'Strona odpowiada wydaniu ' + rel + ' (commit ' + gh.sha + ')' : 'Wydanie ' + rel;
  }
  el.setAttribute('aria-label', 'Wersja strony: ' + el.title);
  el.hidden = false;
}
psVersion();

(async function psInit() {
  try {
    var idx = await (await fetch('data/seasons.json', { cache: 'no-cache' })).json();
    var qs = parseInt(new URLSearchParams(location.search).get('sezon'), 10);
    SEASON = idx.seasons.indexOf(qs) !== -1 ? qs : idx['default'];
    DEFAULT_SEASON = idx['default'];
    PLANNED = idx.planned_rounds && idx.planned_rounds[SEASON] || idx.calendar && idx.calendar[SEASON] && idx.calendar[SEASON].length || null;
    SPRINTS = idx.sprints && idx.sprints[SEASON] || [];
    MAXPTS = idx.max_points || null;
    psBuildSeasonPicker(idx.seasons);
    var json = await (await fetch('data/' + SEASON + '.json', { cache: 'no-cache' })).json();
    document.getElementById('ps-season').textContent = SEASON;
    document.title = 'Klasyfikacja parcfer.me ' + SEASON;
    json.rounds.forEach(function(r) {
      seedRounds.push(r.name);
      seedRaw[r.name] = r.standings.map(function(x) { return [x.pos, x.name, x.points, x.id]; });
      if (r.top) seedTop[r.name] = r.top;
    });
  } catch (e) {
    document.getElementById('ps-subtitle').textContent = 'Nie udało się wczytać danych.';
    return;
  }
  // obserwowani (zapisani w przeglądarce) i filtr aktywnych; ?liga=1,2,3 pokazuje cudzą ligę bez nadpisywania własnej listy
  try { WATCH = JSON.parse((lsGet(WATCH_KEY) || {}).value || '[]').filter(function(k) { return typeof k === 'string'; }); } catch (e) { WATCH = []; }
  var liga = (new URLSearchParams(location.search).get('liga') || '').split(',').map(function(x) { return x.trim(); }).filter(function(x) { return /^\d+$/.test(x); });
  if (liga.length) LEAGUE = liga.map(function(x) { return 'u' + x; });
  ACTIVE_ONLY = !!(lsGet(ACTIVE_KEY) || {}).value;
  document.getElementById('act-only').checked = ACTIVE_ONLY;
  // ?runda=R19 — ranking po wybranej rundzie
  var ri0 = psRoundIndex(new URLSearchParams(location.search).get('runda'));
  ROUND_UPTO = ri0 >= 0 && ri0 < seedRounds.length - 1 ? ri0 + 1 : null;
  state = buildSeedState(ROUND_UPTO);
  psBuildLabels();
  psBuildRoundPicker();
  // opis zapisanych rund w notce dotyczy bieżącego sezonu; archiwalne sezony mają tylko stan końcowy
  if (SEASON !== DEFAULT_SEASON && state.rounds.length === 1) document.getElementById('note-rounds').textContent = 'Sezon ' + SEASON + ': z parcfer.me mamy tylko końcowy ranking (stan po ' + state.rounds[0] + '), więc nie ma przyrostów, strzałek ani historii runda po rundzie.';
  // archiwum sezonów wczytywane w tle — nie opóźnia pierwszego widoku
  fetch('data/history.json', { cache: 'no-cache' }).then(function(r) { return r.ok ? r.json() : null; }).then(function(h) {
    if (!h) return;
    HISTORY = h; psRenderChamps();
    if (HIST && document.getElementById('hist').open) psRenderSeasons(HIST);
  }).catch(function() {});
  // ?id=… (albo starsze ?nick=…) z udostępnionego linku pokazuje tę osobę, ale nie nadpisuje zapisanej
  var qs2 = new URLSearchParams(location.search);
  var sid = 'u' + (qs2.get('id') || '').trim(), sharedKey = state.participants[sid] ? sid : null;
  var shared = sharedKey ? psName(sharedKey) : (qs2.get('nick') || '').trim();
  var saved = lsGet(MYNAME_KEY), savedKey = lsGet(MYKEY_KEY);
  if (shared) { myName = shared; myKey = sharedKey; }
  else {
    myKey = savedKey && state.participants[savedKey.value] ? savedKey.value : null;
    // zapisana osoba wygrywa z zapisaną etykietą (numer „(2)” mógł się zmienić)
    myName = myKey ? psName(myKey) : (saved && saved.value ? saved.value : '');
  }
  document.getElementById('ps-myname').value = myName;
  psRenderAll();
  var vid = 'u' + (qs2.get('vsid') || '').trim();
  var vs = state.participants[vid] ? psName(vid) : (qs2.get('vs') || '').trim();
  if (vs) {
    document.getElementById('duel-b').value = vs;
    psRenderDuel();
    document.getElementById('duel-sec').scrollIntoView({ block: 'start' });
  } else if (liga.length) {
    psSetView('watch');
    document.getElementById('watch-sec').scrollIntoView({ block: 'start' });
  } else if (shared) {
    if (ME) psSetView('near');
    document.getElementById('k-me').scrollIntoView({ block: 'center' });
  }
  // font doczytany po renderze poszerza kolumny — przewiń tabelę jeszcze raz do kolumny „Suma”
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function() { var w = document.querySelector('.board .tw'); if (w) w.scrollLeft = w.scrollWidth; });
})();
