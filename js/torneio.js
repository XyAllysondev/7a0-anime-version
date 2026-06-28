// ══════════════════════════════════════════
// TORNEIO
// ══════════════════════════════════════════

let T = {
  teams: [],
  groups: { A: [], B: [] },
  groupMatches: [],
  ko: { sf1: null, sf2: null, third: null, final: null },
  podium: { first: null, second: null, third: null },
};

function _gerarAutoTimes(n) {
  const universos = Object.keys(DATABASE).sort(() => Math.random() - 0.5).slice(0, n);
  return universos.map(uni => {
    const arcos = Object.keys(DATABASE[uni].sagas);
    const arco  = arcos[Math.floor(Math.random() * arcos.length)];
    const pool  = [...DATABASE[uni].sagas[arco]].sort(() => Math.random() - 0.5);
    return {
      nome: `${DATABASE[uni].emoji} ${uni}`,
      universo: uni,
      arco,
      emoji: DATABASE[uni].emoji,
      jogadores: pool.slice(0, 7),
    };
  });
}

function _setupTorneio() {
  T.groups = { A: [0, 1, 2, 3], B: [4, 5, 6, 7] };
  T.groupMatches = [];
  ['A', 'B'].forEach(g => {
    const idx = T.groups[g];
    for (let i = 0; i < idx.length; i++)
      for (let j = i + 1; j < idx.length; j++)
        T.groupMatches.push({ groupId: g, ai: idx[i], bi: idx[j], result: null });
  });

  T.ko = { sf1: null, sf2: null, third: null, final: null };
  T.podium = { first: null, second: null, third: null };

  document.getElementById('grupos-actions').innerHTML =
    `<button class="btn btn-primary btn-lg" onclick="simularTodosGrupos()">⚡ Simular Fase de Grupos</button>`;

  renderGrupos();
  navigate('pg-t-grupos', 'forward', 'Fase de Grupos');
}

function iniciarTorneio() {
  T.teams = _gerarAutoTimes(8);
  _setupTorneio();
}

function iniciarTorneioComTime(playerJogadores) {
  const playerTeam = {
    nome: '⭐ Seu Time',
    universo: 'Seu Time',
    arco: 'Personalizado',
    emoji: '⭐',
    jogadores: playerJogadores,
  };
  T.teams = [playerTeam, ..._gerarAutoTimes(7)];
  _setupTorneio();
}

function simularPartida(ta, tb) {
  let sA = 0, sB = 0;
  const rounds = [];
  for (let i = 0; i < 7; i++) {
    const pa = ta.jogadores[i], pb = tb.jogadores[i];
    const fa = pa.poder * (0.65 + Math.random() * 0.7);
    const fb = pb.poder * (0.65 + Math.random() * 0.7);
    let w;
    if (fa > fb) { sA++; w = 'a'; }
    else if (fb > fa) { sB++; w = 'b'; }
    else { w = 'd'; }
    rounds.push({ w, pa, pb, sA, sB });
  }
  return { sA, sB, rounds };
}

function simularTodosGrupos() {
  T.groupMatches.forEach(m => {
    if (!m.result) m.result = simularPartida(T.teams[m.ai], T.teams[m.bi]);
  });
  renderGrupos();
  document.getElementById('grupos-actions').innerHTML = `
    <p style="color:var(--muted);font-size:13px;margin-bottom:1rem">
      Fase de Grupos concluída! Os 2 primeiros de cada grupo avançam.
    </p>
    <button class="btn btn-primary btn-lg" onclick="avancarParaKnockout()">
      ⚡ Avançar para o Mata-Mata →
    </button>
  `;
}

function calcularClassificacao(gId) {
  const stats = T.groups[gId].map(idx => ({ idx, pts: 0, j: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0 }));
  T.groupMatches.filter(m => m.groupId === gId && m.result).forEach(m => {
    const sA = stats.find(s => s.idx === m.ai);
    const sB = stats.find(s => s.idx === m.bi);
    const { sA: gA, sB: gB } = m.result;
    sA.j++; sA.gp += gA; sA.gc += gB;
    sB.j++; sB.gp += gB; sB.gc += gA;
    if (gA > gB) { sA.v++; sA.pts += 3; sB.d++; }
    else if (gB > gA) { sB.v++; sB.pts += 3; sA.d++; }
    else { sA.e++; sA.pts += 1; sB.e++; sB.pts += 1; }
  });
  return stats.sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    const sgA = a.gp - a.gc, sgB = b.gp - b.gc;
    if (sgB !== sgA) return sgB - sgA;
    return b.gp - a.gp;
  });
}

function renderGrupos() {
  ['A', 'B'].forEach(g => {
    renderStandings(g);
    renderMatches(g);
  });
}

function renderStandings(gId) {
  const cls = calcularClassificacao(gId);
  const allPlayed = T.groupMatches.filter(m => m.groupId === gId).every(m => m.result);
  document.getElementById(`standings-${gId}`).innerHTML = `
    <table class="standings-table">
      <thead>
        <tr><th>Time</th><th>Pts</th><th>J</th><th>V</th><th>E</th><th>D</th><th>SG</th></tr>
      </thead>
      <tbody>
        ${cls.map((s, i) => {
          const t = T.teams[s.idx];
          const qualify = allPlayed && i < 2;
          return `<tr class="${qualify ? 'qualify' : ''}">
            <td><div class="st-team"><span>${t.emoji}</span><span class="st-team-name">${t.universo}</span></div></td>
            <td class="pts">${s.pts}</td>
            <td>${s.j}</td><td>${s.v}</td><td>${s.e}</td><td>${s.d}</td>
            <td>${s.gp - s.gc >= 0 ? '+' : ''}${s.gp - s.gc}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  `;
}

function renderMatches(gId) {
  const matches = T.groupMatches.filter(m => m.groupId === gId);
  document.getElementById(`matches-${gId}`).innerHTML = `
    <div class="matches-header">Resultados</div>
    ${matches.map(m => {
      const ta = T.teams[m.ai], tb = T.teams[m.bi];
      if (!m.result) return `
        <div class="match-result-item">
          <span class="mri-left">${ta.emoji} ${ta.universo}</span>
          <span class="mri-score mri-pending">vs</span>
          <span class="mri-right">${tb.emoji} ${tb.universo}</span>
        </div>`;
      const { sA, sB } = m.result;
      return `
        <div class="match-result-item">
          <span class="mri-left ${sA > sB ? 'mri-winner' : 'mri-loser'}">${ta.emoji} ${ta.universo}</span>
          <span class="mri-score">${sA} × ${sB}</span>
          <span class="mri-right ${sB > sA ? 'mri-winner' : 'mri-loser'}">${tb.emoji} ${tb.universo}</span>
        </div>`;
    }).join('')}
  `;
}

function avancarParaKnockout() {
  const clsA = calcularClassificacao('A');
  const clsB = calcularClassificacao('B');
  const [p1A, p2A] = [clsA[0].idx, clsA[1].idx];
  const [p1B, p2B] = [clsB[0].idx, clsB[1].idx];

  T.ko.sf1 = { teamA: p1A, teamB: p2B, result: null };
  T.ko.sf2 = { teamA: p1B, teamB: p2A, result: null };
  T.ko.third = { teamA: null, teamB: null, result: null };
  T.ko.final = { teamA: null, teamB: null, result: null };

  renderKnockoutBracket();
  navigate('pg-t-knockout', 'forward', 'Mata-Mata');
}

function renderBracketMatch(matchKey) {
  const m = T.ko[matchKey];
  const el = document.getElementById(`bm-${matchKey}-teams`);
  if (!m || m.teamA === null) {
    el.innerHTML = `<div style="color:var(--muted);font-size:13px">Aguardando...</div>`;
    return;
  }
  const ta = T.teams[m.teamA], tb = T.teams[m.teamB];
  let scoreA = '', scoreB = '', clsA = '', clsB = '';
  if (m.result) {
    scoreA = m.result.sA; scoreB = m.result.sB;
    if (m.result.sA > m.result.sB) { clsA = 'winner'; clsB = 'loser'; }
    else if (m.result.sB > m.result.sA) { clsB = 'winner'; clsA = 'loser'; }
    document.getElementById(`bracket-${matchKey}`).classList.add('played');
  }
  el.innerHTML = `
    <div class="bm-team-row">
      <div class="bm-team-name ${clsA}"><span>${ta.emoji}</span><span>${ta.universo}</span></div>
      <div class="bm-team-score ${clsA}">${scoreA}</div>
    </div>
    <div class="bm-sep-line"></div>
    <div class="bm-team-row">
      <div class="bm-team-name ${clsB}"><span>${tb.emoji}</span><span>${tb.universo}</span></div>
      <div class="bm-team-score ${clsB}">${scoreB}</div>
    </div>
  `;
}

function renderKnockoutBracket() {
  ['sf1', 'sf2', 'third', 'final'].forEach(k => renderBracketMatch(k));

  const sf1done = T.ko.sf1 && T.ko.sf1.result;
  const sf2done = T.ko.sf2 && T.ko.sf2.result;
  const sfAllDone = sf1done && sf2done;

  document.getElementById('btn-sf1').disabled = !!(sf1done);
  document.getElementById('btn-sf2').disabled = !!(sf2done);
  document.getElementById('btn-final').disabled = !(sfAllDone && T.ko.final && T.ko.final.teamA !== null && !T.ko.final.result);
  document.getElementById('btn-third').disabled = !(sfAllDone && T.ko.third && T.ko.third.teamA !== null && !T.ko.third.result);
}

async function simularKO(matchKey) {
  const m = T.ko[matchKey];
  if (!m || m.teamA === null) return;

  const ta = T.teams[m.teamA], tb = T.teams[m.teamB];
  const labels = { sf1: 'Semi-Final 1', sf2: 'Semi-Final 2', third: '3° Lugar', final: 'GRANDE FINAL' };

  document.getElementById('ko-label').textContent = labels[matchKey];
  document.getElementById('ko-matchup').textContent = `${ta.emoji} ${ta.universo}  ×  ${tb.emoji} ${tb.universo}`;
  document.getElementById('ko-name-a').textContent = `${ta.emoji} ${ta.universo}`;
  document.getElementById('ko-name-b').textContent = `${tb.emoji} ${tb.universo}`;
  document.getElementById('ko-score-a').textContent = '0';
  document.getElementById('ko-score-b').textContent = '0';
  document.getElementById('ko-score-a').className = 'ko-placar-num';
  document.getElementById('ko-score-b').className = 'ko-placar-num';
  document.getElementById('ko-rounds-log').innerHTML = '';
  document.getElementById('ko-close-btn').disabled = true;
  document.getElementById('ko-overlay').classList.add('show');

  const result = simularPartida(ta, tb);
  m.result = result;

  for (let i = 0; i < result.rounds.length; i++) {
    await delay(550);
    const r = result.rounds[i];
    const log = document.getElementById('ko-rounds-log');
    const cls = r.w === 'a' ? 'a' : r.w === 'b' ? 'b' : 'd';
    let desc;
    if (r.w === 'a') desc = `<strong>${r.pa.emoji} ${r.pa.nome}</strong> derrota ${r.pb.emoji} ${r.pb.nome}`;
    else if (r.w === 'b') desc = `<span class="win-b"><strong>${r.pb.emoji} ${r.pb.nome}</strong></span> derrota ${r.pa.emoji} ${r.pa.nome}`;
    else desc = `Empate: ${r.pa.emoji} ${r.pa.nome} vs ${r.pb.emoji} ${r.pb.nome}`;

    const el = document.createElement('div');
    el.className = 'round-entry';
    el.innerHTML = `
      <div class="round-bar ${cls}"></div>
      <div class="round-num">Round ${i + 1}</div>
      <div class="round-desc">${desc}</div>
      <div class="round-result ${cls}">${r.sA} × ${r.sB}</div>
    `;
    log.appendChild(el);
    requestAnimationFrame(() => el.classList.add('visible'));
    log.scrollTop = log.scrollHeight;
    document.getElementById('ko-score-a').textContent = r.sA;
    document.getElementById('ko-score-b').textContent = r.sB;
  }

  if (result.sA > result.sB) document.getElementById('ko-score-a').classList.add('winning');
  else if (result.sB > result.sA) document.getElementById('ko-score-b').classList.add('winning');

  document.getElementById('ko-close-btn').disabled = false;

  if (matchKey === 'sf1' || matchKey === 'sf2') {
    const sf1 = T.ko.sf1, sf2 = T.ko.sf2;
    if (sf1.result && sf2.result) {
      const w1 = sf1.result.sA > sf1.result.sB ? sf1.teamA : sf1.teamB;
      const l1 = sf1.result.sA > sf1.result.sB ? sf1.teamB : sf1.teamA;
      const w2 = sf2.result.sA > sf2.result.sB ? sf2.teamA : sf2.teamB;
      const l2 = sf2.result.sA > sf2.result.sB ? sf2.teamB : sf2.teamA;
      T.ko.final = { teamA: w1, teamB: w2, result: null };
      T.ko.third = { teamA: l1, teamB: l2, result: null };
    }
  }

  if (matchKey === 'final') {
    T.podium.first  = result.sA >= result.sB ? m.teamA : m.teamB;
    T.podium.second = result.sA >= result.sB ? m.teamB : m.teamA;
  }
  if (matchKey === 'third') {
    T.podium.third = result.sA >= result.sB ? m.teamA : m.teamB;
  }
}

function fecharKOModal() {
  document.getElementById('ko-overlay').classList.remove('show');
  renderKnockoutBracket();
  if (T.ko.final && T.ko.final.result && T.ko.third && T.ko.third.result) {
    mostrarCampeao();
  }
}

function mostrarCampeao() {
  const c = T.teams[T.podium.first];
  document.getElementById('champion-name').textContent = `${c.emoji} ${c.universo}`;
  document.getElementById('champion-arc').textContent = c.arco;

  const items = [
    { pos: '1°', cls: 'gold',   idx: T.podium.first  },
    { pos: '2°', cls: 'silver', idx: T.podium.second },
    { pos: '3°', cls: 'bronze', idx: T.podium.third  },
  ];
  document.getElementById('podium-row').innerHTML = items
    .filter(it => it.idx !== null && it.idx !== undefined)
    .map(it => {
      const t = T.teams[it.idx];
      return `<div class="podium-item">
        <div class="podium-pos ${it.cls}">${it.pos}</div>
        <div class="podium-name">${t.emoji} ${t.universo}</div>
      </div>`;
    }).join('');

  navigate('pg-t-campeao', 'forward', 'Campeão');
}

function resetarTorneio() {
  T = {
    teams: [],
    groups: { A: [], B: [] },
    groupMatches: [],
    ko: { sf1: null, sf2: null, third: null, final: null },
    podium: { first: null, second: null, third: null },
  };
  pageHistory = [];
  navigate('pg-home', 'back', '');
}
