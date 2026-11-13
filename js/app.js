function lsGet(k){try{var v=localStorage.getItem(k);return v===null?null:{key:k,value:v};}catch(e){return null;}}
function lsSet(k,v){try{localStorage.setItem(k,v);return true;}catch(e){return false;}}
var MYNAME_KEY = 'parcfer-public-myname';
var THEME_KEY = 'parcfer-theme';
var state = { rounds: [], participants: {} };
var myName = '';
var SEASON = null;
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

function buildSeedState() {
  var st = { rounds: seedRounds.slice(), participants: {}, size: {}, nick: {}, label: {}, tie: {} };
  seedRounds.forEach(function(rnd) {
    var seen = {};
    st.size[rnd] = seedRaw[rnd].length;
    seedRaw[rnd].forEach(function(row) {
      var pos = row[0], name = row[1], pts = row[2], id = row[3];
      seen[name] = (seen[name] || 0);
      // uczestnik = id z parcfer.me; bez id (stare dane) — nick i kolejność wśród takich samych nicków
      var key = id != null ? 'u' + id : (seen[name] > 0 ? name + ' (' + (seen[name]+1) + ')' : name);
      seen[name]++;
      st.nick[key] = name;
      if (!st.participants[key]) st.participants[key] = {};
      st.participants[key][rnd] = { position: pos, points: pts };
    });
  });
  return st;
}
// etykiety: powtórzony nick dostaje „(2)”, „(3)” wg miejsca w ostatniej rundzie
function psBuildLabels(order) {
  var count = {}, seen = {};
  order.forEach(function(k) { var n = state.nick[k]; count[n] = (count[n] || 0) + 1; });
  order.forEach(function(k) {
    var n = state.nick[k]; seen[n] = (seen[n] || 0) + 1;
    state.label[k] = count[n] > 1 && seen[n] > 1 ? n + ' (' + seen[n] + ')' : n;
  });
}
function psName(k) { return state.label[k] || state.nick[k] || k; }

function psSaveMyName() {
  myName = document.getElementById('ps-myname').value.trim();
  lsSet(MYNAME_KEY, myName);
  psRenderAll();
}
function psSetView(v) {
  VIEW = v; PAGE = 0;
  ['top', 'near', 'all'].forEach(function(k) { document.getElementById('seg-' + k).classList.toggle('on', k === v); });
  psRenderTable(true);
}
function psSetPage(p) { PAGE = p; psRenderTable(true); }

function psIsMe(n) {
  var me = (myName || '').toLowerCase();
  var x = psName(n).toLowerCase();
  return !!me && (x === me || x.indexOf(me + ' (') === 0);
}

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
function psRoundNo(r) { var m = /R(\d+)$/.exec(r); return m ? +m[1] : null; }
function psGap(ri) {
  var a = psRoundNo(state.rounds[ri - 1]), b = psRoundNo(state.rounds[ri]);
  return a !== null && b !== null && b - a > 1;
}
function psRoundDelta(name, ri) {
  if (ri === 0 || psGap(ri)) return null; // przez przerwę to nie jest „przyrost w rundzie”
  var d = state.participants[name][state.rounds[ri]], p = state.participants[name][state.rounds[ri - 1]];
  return d && p ? d.points - p.points : null;
}
// runda z samą czołówką (starsze dane: TOP 100, Spa TOP 30) — brak osoby nie znaczy, że jej nie było
function psPartial(round) { return state.size[round] <= 100; }
// stan względem poprzedniej rundy: liczba (zmiana), 'top' (wejście do TOP 100), 'new' (nowy uczestnik) albo null (brak danych)
function psStatus(name, ri, field) {
  if (ri < 1 || psGap(ri)) return null;
  var cur = state.participants[name][state.rounds[ri]], prevR = state.rounds[ri - 1], prev = state.participants[name][prevR];
  if (!cur) return null;
  // zmiana miejsca liczona ze wspólnych miejsc (ex aequo), tak jak są pokazywane
  if (prev) return field === 'points' ? cur.points - prev.points : psPlace(prevR, prev).place - psPlace(state.rounds[ri], cur).place;
  if (cur.position > state.size[prevR]) return null;
  return psPartial(prevR) ? 'top' : 'new';
}
function psMove(name) { return psStatus(name, state.rounds.length - 1, 'position'); }
function psPrevSize(ri) { return state.size[state.rounds[ri - 1]]; }
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

function psRenderKpis(names) {
  var n = state.rounds.length, last = state.rounds[n - 1];
  var P = state.participants;
  document.getElementById('k-round').textContent = last;
  var lead = names[0], ld = P[lead][last];
  document.getElementById('k-leader').innerHTML = psEsc(psName(lead)) + ' <small>' + ld.points + ' pkt</small>';
  var second = names[1] && P[names[1]][last];
  var gap = second ? ld.points - second.points : 0;
  var rd = psRoundDelta(lead, n - 1);
  document.getElementById('k-leader-sub').innerHTML =
    (second ? 'Przewaga nad ' + psEsc(psName(names[1])) + ': <b>' + psSigned(gap) + ' pkt</b>' : '') +
    (rd !== null ? ' · w tej rundzie ' + psSigned(rd) + ' pkt' : '');
  var medals = ['#facc15', '#cbd5e1', '#e8955a'];
  document.getElementById('k-podium').innerHTML = names.slice(0, 3).map(function(x, i) {
    return '<div data-k="' + psEsc(x) + '"><i style="background:' + medals[Math.min(2, psPlace(last, P[x][last]).place - 1)] + '">' + psPlace(last, P[x][last]).txt + '</i>' + psEsc(psName(x)) + ' · ' + P[x][last].points + '</div>';
  }).join('');

  // kafelki rundy
  var jump = null, best = null;
  names.forEach(function(x) {
    var m = psMove(x), cur = P[x][last];
    // skok liczony w TOP 100 — przy pełnym rankingu awanse z dołu tabeli byłyby nieporównywalne
    if (typeof m === 'number' && cur && cur.position <= 100 && (jump === null || m > jump.v)) jump = { n: x, v: m };
    var d = psRoundDelta(x, n - 1);
    if (d !== null && (best === null || d > best.v)) best = { n: x, v: d };
  });
  document.getElementById('k-jump').textContent = jump ? '▲' + jump.v : '—';
  document.getElementById('k-jump-d').textContent = jump ? psName(jump.n) + ' — największy awans w TOP 100' : '';
  document.getElementById('k-best').textContent = best ? psSigned(best.v) + ' pkt' : '—';
  document.getElementById('k-best-d').textContent = best ? psName(best.n) : '';
  document.getElementById('k-top10-r').textContent = last;
  document.getElementById('k-top10').innerHTML = names.slice(0, 10).map(function(x, i) {
    var tp = psPlace(last, P[x][last]).place;
    return '<li data-k="' + psEsc(x) + '" class="' + (psIsMe(x) ? 'me ' : '') + (tp <= 3 ? 't' + tp : '') + '"><span class="r" title="' + psPlace(last, P[x][last]).title + '">' + psPlace(last, P[x][last]).txt + '</span><span class="n" title="' + psEsc(psName(x)) + '">' + psEsc(psName(x)) + '</span><span class="m">' + psMoveHtml(psMove(x)) + '</span><span class="g">' + (function(d) { return d === null ? '' : '<b>' + psSigned(d) + '</b> w rundzie'; })(psRoundDelta(x, n - 1)) + '</span><span class="p">' + P[x][last].points + '</span></li>';
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
  var me = names.filter(psIsMe)[0];
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
    '<span class="chip gold">' + (ld.points - md.points) + ' pkt do lidera</span></div>' +
    '<div class="me-actions"><button type="button" class="btn pri" data-k="' + psEsc(me) + '">📈 Historia</button>' +
    '<button type="button" class="btn" data-jump="' + psEsc(me) + '">Pokaż w tabeli</button>' +
    '<button type="button" class="btn" onclick="psShare()">🔗 Udostępnij</button></div>' +
    '<div class="calc"><label for="calc-t">Ile brakuje do</label> <select id="calc-t" onchange="psCalc()">' +
    [[1, 'P1'], [3, 'TOP 3'], [10, 'TOP 10'], [50, 'TOP 50'], [100, 'TOP 100']].map(function(o) { return '<option value="' + o[0] + '">' + o[1] + '</option>'; }).join('') +
    '</select><div class="calc-out" id="calc-out"></div></div>';
  // domyślny cel: najbliższy próg powyżej obecnego miejsca
  var targets = [1, 3, 10, 50, 100], cur = mpl.place, def = targets.filter(function(t) { return t < cur; }).pop() || 1;
  document.getElementById('calc-t').value = String(CALC_T && CALC_ME === me && CALC_T < cur ? CALC_T : def);
  CALC_ME = me;
  psCalc();
}

function psRenderTable(resetScroll) {
  var tbl = document.getElementById('ps-table');
  var lastRound = state.rounds[state.rounds.length - 1];
  var names = psOrder(lastRound);
  var rankOf = {};
  names.forEach(function(n, i) { rankOf[n] = i + 1; });

  var shown = names, pager = '', hint = '';
  var meKey = names.find(psIsMe);
  // „Pokaż mnie” w widoku Wszyscy: przejście na stronę z nickiem z karty „Twoja pozycja”
  var mj = document.getElementById('ps-me-jump');
  mj.style.display = VIEW === 'all' && meKey ? 'inline-flex' : 'none';
  if (meKey) { mj.title = 'Przejdź do: ' + psName(meKey); mj.onclick = function() { psJumpTo(meKey, true); }; }
  document.getElementById('seg-near').disabled = !meKey;
  if (VIEW === 'near' && !meKey) VIEW = 'top';
  if (VIEW === 'top') {
    shown = names.slice(0, 100);
    if (meKey && !shown.some(psIsMe)) shown.push(meKey);
  } else if (VIEW === 'near') {
    var mi = names.indexOf(meKey);
    shown = names.slice(Math.max(0, mi - NEAR), mi + NEAR + 1);
  } else {
    var pages = Math.ceil(names.length / PAGE_SIZE);
    PAGE = Math.min(PAGE, pages - 1);
    shown = names.slice(PAGE * PAGE_SIZE, (PAGE + 1) * PAGE_SIZE);
    var btns = '<button type="button" ' + (PAGE ? '' : 'disabled ') + 'onclick="psSetPage(' + (PAGE - 1) + ')" aria-label="Poprzednia strona">‹</button>';
    for (var i = 0; i < pages; i++) btns += '<button type="button" class="num' + (i === PAGE ? ' on' : '') + '" onclick="psSetPage(' + i + ')">' + (i * PAGE_SIZE + 1) + '–' + Math.min((i + 1) * PAGE_SIZE, names.length) + '</button>';
    btns += '<button type="button" ' + (PAGE < pages - 1 ? '' : 'disabled ') + 'onclick="psSetPage(' + (PAGE + 1) + ')" aria-label="Następna strona">›</button>';
    pager = btns + '<span class="info">' + names.length + ' uczestników</span>';
  }
  var q = (document.getElementById('ps-filter').value || '').trim().toLowerCase();
  var jb = document.getElementById('ps-jump'), exact = q ? names.filter(function(n) { return psName(n).toLowerCase() === q; })[0] : null;
  jb.style.display = exact ? 'inline-flex' : 'none';
  if (exact) { jb.textContent = 'Pokaż „' + psName(exact) + '” w tabeli'; jb.onclick = function() { psJumpTo(exact); }; }
  if (q) { shown = names.filter(function(n) { return psName(n).toLowerCase().indexOf(q) !== -1; }); pager = ''; }
  var pg = document.getElementById('ps-pager');
  pg.innerHTML = pager; pg.style.display = pager ? 'flex' : 'none';

  var head = '<thead><tr><th class="c-name"><span class="rk">#</span><span class="mv"></span>Uczestnik</th>';
  state.rounds.forEach(function(r) { head += '<th>' + psEsc(r) + '</th>'; });
  head += '<th>Suma</th></tr></thead>';

  var nR = state.rounds.length;
  var body = shown.map(function(name) {
    var P = state.participants[name];
    var lastPts = P[lastRound] ? P[lastRound].points : '—';
    var cells = state.rounds.map(function(r, ri) {
      var d = P[r];
      if (!d) return psPartial(r) ? '<td class="rc" title="Poza TOP ' + state.size[r] + ' — z tej rundy mamy tylko czołówkę"><span class="out">&gt;&nbsp;' + state.size[r] + '</span></td>' : '<td class="rc"><span>—</span></td>';
      var dl = psStatus(name, ri, 'points'), note;
      if (dl === null) note = '';
      else if (dl === 'top') note = ' · <span class="d-new">↑ TOP ' + psPrevSize(ri) + '</span>';
      else if (dl === 'new') note = ' · <span class="d-new">nowy</span>';
      else note = ' · <span class="' + (dl > 0 ? 'd-up' : 'd-zero') + '">' + psSigned(dl) + '</span>';
      var pl = psPlace(r, d);
      return '<td class="rc' + (ri === nR - 1 ? ' last' : '') + '"' + (pl.title ? ' title="' + pl.title + '"' : '') + '><b>' + d.points + '</b><span>P' + pl.txt + note + '</span></td>';
    }).join('');
    var cur = P[lastRound], pl = cur ? psPlace(lastRound, cur) : { txt: String(rankOf[name]), place: rankOf[name], title: '' };
    var cls = (psIsMe(name) ? 'me ' : '') + (pl.place <= 3 ? 'm' + pl.place : '');
    return '<tr class="' + cls + '" data-row="' + psEsc(name) + '"><td class="c-name" data-k="' + psEsc(name) + '" title="Historia: ' + psEsc(psName(name)) + (pl.title ? ' · ' + pl.title : '') + '"><span class="rk">' + pl.txt + '</span><span class="mv">' + psMoveHtml(psMove(name)) + '</span><span class="nm">' + psEsc(psName(name)) + '</span></td>' + cells + '<td class="c-tot">' + lastPts + '</td></tr>';
  }).join('');

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
  return g.n > 1 ? { txt: g.a + '=', place: g.a, title: 'ex aequo: miejsca ' + g.a + '–' + g.b + (psPartial(round) && g.b === state.size[round] ? '+' : '') + ' (' + d.points + ' pkt)' } : { txt: String(d.position), place: d.position, title: '' };
}

function psToast(msg) {
  var t = document.getElementById('toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(psToast.h); psToast.h = setTimeout(function() { t.classList.remove('on'); }, 2200);
}
function psShareUrl(nick) {
  var u = new URL(location.href); u.search = ''; u.hash = '';
  if (SEASON && new URLSearchParams(location.search).get('sezon')) u.searchParams.set('sezon', SEASON);
  u.searchParams.set('nick', nick);
  return u.toString();
}
async function psShare(nick) {
  nick = nick || myName;
  var url = psShareUrl(nick);
  if (navigator.share) { try { await navigator.share({ title: 'Klasyfikacja parcfer.me — ' + nick, url: url }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
  try { await navigator.clipboard.writeText(url); psToast('Skopiowano link: ' + url.replace(/^https?:\/\//, '')); }
  catch (e) { window.prompt('Skopiuj link:', url); }
}

// przewiń tabelę do wiersza danej osoby (TOP 100 albo właściwa strona „Wszyscy”)
function psJumpTo(key, stayAll) {
  var dlg = document.getElementById('hist'); if (dlg.open) dlg.close();
  document.getElementById('ps-filter').value = '';
  var order = psOrder(state.rounds[state.rounds.length - 1]), idx = order.indexOf(key);
  if (idx < 0) return;
  VIEW = stayAll || idx >= 100 ? 'all' : 'top'; PAGE = Math.floor(idx / PAGE_SIZE);
  ['top', 'near', 'all'].forEach(function(k) { document.getElementById('seg-' + k).classList.toggle('on', k === VIEW); });
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
  var gains = [], cur = P[last];
  for (var i = 1; i < n; i++) { var g = psRoundDelta(key, i); if (g !== null) gains.push(g); }
  var avg = gains.length ? gains.reduce(function(a, b) { return a + b; }, 0) / gains.length : null;
  document.getElementById('h-chips').innerHTML =
    (cur ? '<span class="chip blue">Teraz P' + psPlace(last, cur).txt + ' · ' + cur.points + ' pkt</span>' : '<span class="chip red">Brak w ostatniej rundzie</span>') +
    (best ? '<span class="chip green">Najwyżej: P' + best.pl.txt + ' (' + psEsc(R[best.i]) + ')</span>' : '') +
    (avg !== null ? '<span class="chip gold">Średnio ' + avg.toFixed(1).replace('.', ',') + ' pkt na rundę</span>' : '');
  // tabela (dostępna wersja danych z wykresu)
  var rows = R.map(function(r, i) {
    var d = P[r];
    if (!d) return '<tr><td>' + psEsc(r) + '</td><td colspan="3" class="tie">' + (psPartial(r) ? 'poza TOP ' + state.size[r] + ' (z tej rundy mamy tylko czołówkę)' : '—') + '</td></tr>';
    var g = psStatus(key, i, 'points'), t = psTie(r, d.points);
    var gt = g === null ? '—' : g === 'top' ? '↑ TOP ' + psPrevSize(i) : g === 'new' ? 'nowy' : psSigned(g);
    var hp = psPlace(r, d);
    return '<tr><td>' + psEsc(r) + '</td><td' + (hp.title ? ' title="' + hp.title + '"' : '') + '>P' + hp.txt + '</td><td><b>' + d.points + '</b></td><td>' + gt + '</td></tr>';
  }).reverse().join('');
  document.getElementById('h-table').innerHTML = '<thead><tr><th>Runda</th><th>Miejsce</th><th>Punkty</th><th>W rundzie</th></tr></thead><tbody>' + rows + '</tbody>';
  document.getElementById('h-actions').innerHTML = cur
    ? '<button type="button" class="btn" onclick="psJumpTo(HIST)">Pokaż w tabeli</button><button type="button" class="btn" onclick="psShare(psName(HIST))">🔗 Link do tego gracza</button>' : '';
  document.getElementById('h-cap').textContent = 'Przerwa w linii = brak danych: rundy R4–R8 nie są zapisane, a w rundach Spa R10 (TOP 30) i Węgry R11–Singapur R17 (TOP 100) gracz mógł być poza zapisaną czołówką.';
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
  svg += R.map(function(r, i) { var lab = (r.match(/R\d+$/) || [r])[0]; return (i % every && i !== n - 1) ? '' : '<text class="ax" x="' + X(i) + '" y="' + (H - 8) + '" text-anchor="middle">' + psEsc(lab) + '</text>'; }).join('');
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
    tip.innerHTML = '<b>' + psEsc(R[i]) + '</b><br>' + (dt ? 'P' + psPlace(R[i], dt).txt + ' · ' + dt.points + ' pkt' + (typeof g === 'number' ? ' (' + psSigned(g) + ')' : '') : (psPartial(R[i]) ? 'poza TOP ' + state.size[R[i]] : 'brak danych'));
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
  var j = e.target.closest('[data-jump]');
  if (j) { psJumpTo(j.getAttribute('data-jump')); return; }
  var el = e.target.closest('[data-k]');
  if (el && state.participants[el.getAttribute('data-k')]) psOpenHistory(el.getAttribute('data-k'));
});
document.getElementById('hist').addEventListener('click', function(e) { if (e.target === this) this.close(); });
// klawiatura: elementy otwierające historię dostają fokus (Tab) i działają z Enter / spacją
function psA11y(root) {
  var list = [].slice.call(root.querySelectorAll('[data-k],[data-jump]'));
  if (root.matches && root.matches('[data-k],[data-jump]')) list.push(root);
  list.forEach(function(el) {
    if (el.tagName === 'BUTTON' || el.hasAttribute('tabindex')) return;
    el.tabIndex = 0; el.setAttribute('role', 'button');
  });
}
new MutationObserver(function(ms) { ms.forEach(function(m) { m.addedNodes.forEach(function(n) { if (n.nodeType === 1) psA11y(n); }); }); })
  .observe(document.body, { childList: true, subtree: true });
psA11y(document.body);
document.addEventListener('keydown', function(e) {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[role="button"][data-k],[role="button"][data-jump]')) { e.preventDefault(); e.target.click(); }
});
window.addEventListener('resize', function() { psDrawChart(); psDrawDuel(); });

// ---------- pojedynek ----------
var DUEL = null, duelAuto = true;
function psFind(text) {
  var q = (text || '').trim().toLowerCase();
  if (!q) return null;
  var keys = Object.keys(state.participants);
  return keys.find(function(k) { return psName(k).toLowerCase() === q; }) || null;
}
function psFillNicks(order) {
  document.getElementById('nicks').innerHTML = order.map(function(k) { return '<option value="' + psEsc(psName(k)) + '">'; }).join('');
}
function psRenderDuel() {
  var ia = document.getElementById('duel-a'), ib = document.getElementById('duel-b');
  if (document.activeElement === ia) duelAuto = false;
  if (duelAuto) ia.value = myName || ''; // dopóki A nie było edytowane, A = nick z „Twojej pozycji”
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
    var cell = function(d, g) { return d ? '<b>' + d.points + '</b> <span class="tie">P' + psPlace(r, d).txt + (g !== null ? ' · ' + psSigned(g) : '') + '</span>' : '<span class="tie">' + (psPartial(r) ? '&gt; ' + state.size[r] : '—') + '</span>'; };
    var diff = da && db ? psSigned(da.points - db.points) : '—';
    return '<tr><td>' + psEsc(r) + '</td><td>' + cell(da, ga) + '</td><td>' + cell(db, gb) + '</td><td>' + diff + '</td><td class="rd2">' + (w || '—') + '</td></tr>';
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
    tip.innerHTML = '<b>' + psEsc(r) + '</b><br>' + (v === null ? 'brak danych obu graczy'
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
  var u = new URL(psShareUrl(psName(DUEL.a))); u.searchParams.set('vs', psName(DUEL.b));
  var url = u.toString();
  if (navigator.share) { navigator.share({ title: 'Pojedynek: ' + psName(DUEL.a) + ' vs ' + psName(DUEL.b), url: url }).catch(function() {}); return; }
  navigator.clipboard.writeText(url).then(function() { psToast('Skopiowano link do pojedynku'); }, function() { window.prompt('Skopiuj link:', url); });
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
    return '<tr class="' + (psIsMe(r.k) ? 'me ' : '') + (place[i] <= 3 ? 'f' + place[i] : '') + '"><td class="fr">' + place[i] + '</td><td class="nm-c" data-k="' + psEsc(r.k) + '">' + psEsc(psName(r.k)) + '</td>' +
      r.ds.map(function(d) { return '<td class="rd"><span class="' + (d > 0 ? 'd' : 'd0') + '">' + psSigned(d) + '</span></td>'; }).join('') +
      '<td class="sum">' + r.sum + '</td><td>P' + psPlace(R[n - 1], state.participants[r.k][R[n - 1]]).txt + '</td></tr>';
  };
  var body = rows.slice(0, FORM_TOP).map(line).join('');
  var mi = rows.findIndex(function(r) { return psIsMe(r.k); });
  if (mi >= FORM_TOP) body += '<tr class="gap"><td colspan="' + (FORM_N + 4) + '">⋯</td></tr>' + line(rows[mi], mi);
  document.getElementById('form-table').innerHTML = '<thead><tr><th class="fr">#</th><th class="nm-c">Uczestnik</th>' +
    idx.map(function(i) { return '<th class="rd">' + psEsc(R[i]) + '</th>'; }).join('') + '<th>Suma ' + FORM_N + ' rund</th><th>Ogólnie</th></tr></thead><tbody>' + body + '</tbody>';
  // rundy bazowe z samą czołówką ograniczają, kogo da się porównać
  var partial = []; for (var j = n - FORM_N - 1; j < n - 1; j++) if (psPartial(R[j])) partial.push(R[j]);
  document.getElementById('form-cap').textContent = (partial.length
    ? 'Z rundy ' + partial.join(', ') + ' mamy tylko czołówkę (TOP ' + state.size[partial[partial.length - 1]] + '), więc na razie porównujemy tylko osoby, które w niej były (' + missing + ' os. pominięto). Pełna tabela formy — gdy wszystkie ' + FORM_N + ' rundy będą z pełnego rankingu. '
    : (missing ? 'Pominięto ' + missing + ' os. bez danych ze wszystkich ' + FORM_N + ' rund. ' : '')) + 'Kliknij nick, żeby zobaczyć historię.';
}

// ---------- rekordy sezonu (z zapisanych rund; przerwy i rundy z samą czołówką pomijane tam, gdzie nie da się liczyć) ----------
var REC_MIN_ROUNDS = 8; // średnia i równość tylko dla graczy z co najmniej tyloma znanymi przyrostami
function psRenderRecords() {
  var R = state.rounds, n = R.length, keys = Object.keys(state.participants);
  var best = function(list, better) { // [{k, v, extra}] → zwycięzcy (z remisami)
    var top = [];
    list.forEach(function(x) { if (!top.length || better(x.v, top[0].v)) top = [x]; else if (x.v === top[0].v) top.push(x); });
    return top;
  };
  var gainList = [], climbList = [], leadList = [], top10List = [], avgList = [], steadyList = [];
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
    if (ds.length >= REC_MIN_ROUNDS) {
      var avg = ds.reduce(function(a, b) { return a + b; }, 0) / ds.length;
      var sd = Math.sqrt(ds.reduce(function(a, b) { return a + (b - avg) * (b - avg); }, 0) / ds.length);
      avgList.push({ k: k, v: Math.round(avg * 10) / 10, n: ds.length });
      steadyList.push({ k: k, v: Math.round(sd * 10) / 10, avg: avg, n: ds.length });
    }
  });
  var who = function(top, fmt) {
    var names = top.slice(0, 2).map(function(x) { return '<span data-k="' + psEsc(x.k) + '">' + psEsc(psName(x.k)) + '</span>' + (fmt ? ' <span class="tie">' + fmt(x) + '</span>' : ''); });
    return names.join(', ') + (top.length > 2 ? ' <span class="tie">i ' + (top.length - 2) + ' ' + (top.length - 2 === 1 ? 'inny' : 'innych') + '</span>' : '');
  };
  var hi = function(a, b) { return a > b; }, lo = function(a, b) { return a < b; };
  // równość: wśród graczy ze średnią w górnej połowie (inaczej wygrywa ktoś, kto stale ma mało punktów)
  var med = avgList.map(function(x) { return x.v; }).sort(function(a, b) { return a - b; })[Math.floor(avgList.length / 2)] || 0;
  var cards = [
    ['★ Najwięcej punktów w rundzie', best(gainList, hi), function(t) { return '+' + t[0].v + ' pkt'; }, function(x) { return x.r; }],
    ['↗ Największy awans w rundzie', best(climbList, hi), function(t) { return '▲' + t[0].v; }, function(x) { return x.r; }],
    ['👑 Najwięcej rund na prowadzeniu', best(leadList, hi), function(t) { return t[0].v + ' ' + (t[0].v === 1 ? 'runda' : t[0].v % 10 >= 2 && t[0].v % 10 <= 4 && (t[0].v % 100 < 10 || t[0].v % 100 >= 20) ? 'rundy' : 'rund'); }, null],
    ['🔟 Najwięcej rund w TOP 10', best(top10List, hi), function(t) { return t[0].v + ' z ' + n; }, null],
    ['Ø Najwyższa średnia na rundę', best(avgList, hi), function(t) { return t[0].v.toFixed(1).replace('.', ',') + ' pkt'; }, function(x) { return x.n + ' rund'; }],
    ['≈ Najrówniej punktujący', best(steadyList.filter(function(x) { return x.avg >= med; }), lo), function(t) { return '±' + t[0].v.toFixed(1).replace('.', ','); }, function(x) { return 'śr. ' + x.avg.toFixed(1).replace('.', ',') + ' pkt'; }]
  ];
  document.getElementById('rec-grid').innerHTML = cards.map(function(c) {
    var top = c[1];
    if (!top.length) return '';
    return '<div class="rec"><div class="label">' + c[0] + '</div><div class="v">' + c[2](top) + '</div><div class="who">' + who(top, c[3]) + '</div></div>';
  }).join('');
  document.getElementById('rec-cap').textContent = 'Liczone z zapisanych rund (' + R[0].replace(/ R\d+$/, '') + ' – ' + R[n - 1].replace(/ R\d+$/, '') + '). Przyrostów i awansów nie liczymy przez przerwę w danych (R4–R8) ani dla graczy spoza zapisanej czołówki w rundach Spa–Singapur. Średnia i równość: gracze z co najmniej ' + REC_MIN_ROUNDS + ' znanymi rundami; równość (najmniejsze odchylenie punktów od średniej) wśród graczy ze średnią w górnej połowie. Kliknij nick, żeby zobaczyć historię.';
}

// ---------- kalkulator „ile mi brakuje” ----------
var CALC_T = null, CALC_ME = null, PLANNED = null;
function psCalc() {
  var sel = document.getElementById('calc-t'), out = document.getElementById('calc-out');
  if (!sel || !out) return;
  CALC_T = +sel.value;
  var n = state.rounds.length, last = state.rounds[n - 1], order = psOrder(last);
  var me = order.find(psIsMe); if (!me) return;
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
  else html += 'Zostały <b>' + left + '</b> ' + (left === 1 ? 'runda' : left % 10 >= 2 && left % 10 <= 4 && (left % 100 < 10 || left % 100 >= 20) ? 'rundy' : 'rund') +
    ' — trzeba zdobywać średnio <b>' + (Math.ceil(gap / left * 10) / 10).toFixed(1).replace('.', ',') + ' pkt na rundę więcej</b> niż ta osoba' + (gap / left > 20 ? ' (więcej, niż daje jedna runda — w praktyce poza zasięgiem)' : '') + '.';
  out.innerHTML = html;
}

function psRenderAll() {
  if (!state.rounds.length) {
    document.getElementById('ps-empty').style.display = 'block';
    document.getElementById('ps-subtitle').textContent = 'Brak danych';
    return;
  }
  var n = state.rounds.length, last = state.rounds[n - 1];
  document.getElementById('ps-asof').textContent = 'Stan po rundzie: ' + last + '.';
  document.getElementById('ps-subtitle').textContent = 'Nieoficjalny ranking typerów parcfer.me runda po rundzie · ' + n + ' ' + (n === 1 ? 'runda' : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'rundy' : 'rund')) + ' · ' + Object.keys(state.participants).length + ' uczestników · stan po ' + last;
  var order = psOrder(last);
  psBuildLabels(order);
  psRenderKpis(order);
  psRenderForm(order);
  psRenderRecords();
  psFillNicks(order);
  psRenderDuel();
  psRenderTable();
}

(async function psInit() {
  try {
    var idx = await (await fetch('data/seasons.json', { cache: 'no-cache' })).json();
    var qs = parseInt(new URLSearchParams(location.search).get('sezon'), 10);
    SEASON = idx.seasons.indexOf(qs) !== -1 ? qs : idx['default'];
    PLANNED = idx.planned_rounds && idx.planned_rounds[SEASON] || null;
    psBuildSeasonPicker(idx.seasons);
    var json = await (await fetch('data/' + SEASON + '.json', { cache: 'no-cache' })).json();
    document.getElementById('ps-season').textContent = SEASON;
    document.title = 'Klasyfikacja parcfer.me ' + SEASON;
    json.rounds.forEach(function(r) {
      seedRounds.push(r.name);
      seedRaw[r.name] = r.standings.map(function(x) { return [x.pos, x.name, x.points, x.id]; });
    });
  } catch (e) {
    document.getElementById('ps-subtitle').textContent = 'Nie udało się wczytać danych.';
    return;
  }
  state = buildSeedState();
  // ?nick=… z udostępnionego linku pokazuje tę osobę, ale nie nadpisuje zapisanego nicka
  var shared = (new URLSearchParams(location.search).get('nick') || '').trim();
  var saved = lsGet(MYNAME_KEY);
  myName = shared || (saved && saved.value ? saved.value : '');
  document.getElementById('ps-myname').value = myName;
  psRenderAll();
  var vs = (new URLSearchParams(location.search).get('vs') || '').trim();
  if (vs) {
    document.getElementById('duel-b').value = vs;
    psRenderDuel();
    document.getElementById('duel-sec').scrollIntoView({ block: 'start' });
  } else if (shared) {
    var order = psOrder(state.rounds[state.rounds.length - 1]);
    if (order.some(psIsMe)) psSetView('near');
    document.getElementById('k-me').scrollIntoView({ block: 'center' });
  }
})();
