// ══════════════════════════════════════════
// PARTIDA RÁPIDA
// ══════════════════════════════════════════

let currentUniverso = null;
let currentArco = null;
let currentPersonagens = [];
let chancesRestantes = 3;
let selectedTeam = [];      // personagens confirmados (objetos, máx 7)
let currentSlotIdx = null;  // índice selecionado no slot atual
let torneioModo = false;    // true quando o loop sorteio/escolha é para o torneio
let timeA = [];
let timeB = [];

// ── Formação ──
let formacaoPR     = '1-3-3';  // formação na tela de ajuste de posições (final)
let formacaoPRModo = '1-3-3';  // formação escolhida ANTES do sorteio
let posicoesPR     = [];        // os 7 jogadores distribuídos nas posições
let posicaoSel     = null;      // índice da posição selecionada p/ trocar

function _getTiposSequencia() {
  return FORMACOES[formacaoPRModo].posicoes.map(p => p.role);
}

let _origemPRFormacao = 'rapida'; // 'rapida' | 'torneio'

// ── Timer de escolha ──
let _escolhaTimerInterval = null;
let _escolhaTimerSec      = 15;

function _iniciarTimerEscolha() {
  _pararTimerEscolha();
  _escolhaTimerSec = 15;
  const hNumEl  = document.getElementById('header-timer-num');
  const hRingEl = document.getElementById('header-timer-ring');
  const hWrap   = document.getElementById('header-escolha-timer');

  function _sync() {
    const p = _escolhaTimerSec / 15;
    if (hNumEl)  hNumEl.textContent = _escolhaTimerSec;
    if (hRingEl) hRingEl.style.setProperty('--progress', p);
    if (_escolhaTimerSec <= 5) {
      if (hRingEl) hRingEl.classList.add('urgente');
    }
  }

  if (hRingEl) { hRingEl.classList.remove('urgente'); hRingEl.style.setProperty('--progress', '1'); }
  if (hWrap)   hWrap.style.display = 'flex';
  _sync();

  _escolhaTimerInterval = setInterval(() => {
    _escolhaTimerSec--;
    _sync();
    if (_escolhaTimerSec <= 0) {
      _pararTimerEscolha();
      _autoEscolherPersonagem();
    }
  }, 1000);
}

function _pararTimerEscolha() {
  clearInterval(_escolhaTimerInterval);
  _escolhaTimerInterval = null;
  const hWrap = document.getElementById('header-escolha-timer');
  if (hWrap) hWrap.style.display = 'none';
}

function _autoEscolherPersonagem() {
  const jaUsados = new Set(selectedTeam.map(p => p.nome));
  const tipos    = _getTiposSequencia();
  const tipoReq  = tipos ? tipos[selectedTeam.length] : null;
  const disponiveis = currentPersonagens
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => !jaUsados.has(p.nome) && (!tipoReq || p.tipo === tipoReq));
  if (!disponiveis.length) return;
  const { i } = disponiveis[Math.floor(Math.random() * disponiveis.length)];
  selecionarPersonagem(i);
  confirmarEscolha();
}

// ── Escolha de formação (antes do sorteio) ──

function iniciarPartidaRapida() {
  _origemPRFormacao = 'rapida';
  formacaoPRModo = '1-3-3';
  _renderPRFormacoes();
  navigate('pg-pr-formacao', 'forward', 'Partida Rápida');
}

function _renderPRFormacoes() {
  document.getElementById('pr-form-grid').innerHTML = Object.keys(FORMACOES).map(key => {
    const f = FORMACOES[key];
    const counts = { ataque: 0, suporte: 0, tank: 0 };
    f.posicoes.forEach(p => counts[p.role]++);
    return `<div class="pr-form-card${formacaoPRModo === key ? ' active' : ''}" onclick="selecionarFormacaoPRModo('${key}')">
      <div class="pr-form-key">${key}</div>
      <div class="pr-form-desc">${f.desc}</div>
      <div class="pr-form-badges">
        ${counts.ataque ? `<span class="char-tipo char-tipo-ataque">⚔️ ${counts.ataque}</span>` : ''}
        ${counts.suporte ? `<span class="char-tipo char-tipo-suporte">✨ ${counts.suporte}</span>` : ''}
        ${counts.tank ? `<span class="char-tipo char-tipo-tank">🛡️ ${counts.tank}</span>` : ''}
      </div>
    </div>`;
  }).join('');
}

function selecionarFormacaoPRModo(key) {
  formacaoPRModo = key;
  _renderPRFormacoes();
}

function confirmarFormacaoPRInicio() {
  selectedTeam     = [];
  currentSlotIdx   = null;
  chancesRestantes = 3;
  torneioModo      = _origemPRFormacao === 'torneio';
  document.getElementById('sorteio-result').classList.remove('show');
  document.getElementById('btn-rolar').style.display       = '';
  document.getElementById('btn-swap-wrap').style.display   = 'none';
  document.getElementById('sorteio-chances').style.display = 'none';
  document.getElementById('slot-progress').style.display   = 'none';
  const titulo = torneioModo ? 'Torneio — Monte seu Time'
              : (typeof mpModo !== 'undefined' && mpModo) ? 'Monte seu Time'
              : 'Partida Rápida';
  if (typeof iniciarTimerPartida === 'function') iniciarTimerPartida();
  navigate('pg-sorteio', 'forward', titulo);
}

// ── Sorteio de arco ──

function _universosComTipo(tipoReq) {
  return Object.keys(DATABASE).filter(uni =>
    Object.values(DATABASE[uni].sagas).some(chars => chars.some(p => p.tipo === tipoReq))
  );
}

function _arcosComTipo(uni, tipoReq) {
  const todos = Object.keys(DATABASE[uni].sagas);
  if (!tipoReq) return todos;
  const validos = todos.filter(arco => DATABASE[uni].sagas[arco].some(p => p.tipo === tipoReq));
  return validos.length > 0 ? validos : todos;
}

function _atualizarDisplayArco() {
  const db = DATABASE[currentUniverso];
  document.getElementById('universo-emoji').textContent = db.emoji;
  document.getElementById('universo-nome').textContent = currentUniverso;
  document.getElementById('arco-nome').textContent = currentArco;
}

function _sortearArco() {
  const tipos   = _getTiposSequencia();
  const tipoReq = tipos ? tipos[selectedTeam.length] : null;
  let universos = tipoReq ? _universosComTipo(tipoReq) : Object.keys(DATABASE);
  currentUniverso   = universos[Math.floor(Math.random() * universos.length)];
  const arcos       = _arcosComTipo(currentUniverso, tipoReq);
  currentArco       = arcos[Math.floor(Math.random() * arcos.length)];
  currentPersonagens = DATABASE[currentUniverso].sagas[currentArco];
  _atualizarDisplayArco();
}


function _atualizarChances() {
  const pips = document.getElementById('chances-pips');
  const label = document.getElementById('chances-label');
  pips.innerHTML = Array(3).fill(0).map((_, i) =>
    `<span class="chance-pip ${i < chancesRestantes ? 'active' : 'used'}"></span>`
  ).join('');
  const sem = chancesRestantes === 0;
  label.textContent = sem
    ? 'Nenhuma troca restante'
    : `${chancesRestantes} troca${chancesRestantes !== 1 ? 's' : ''} restante${chancesRestantes !== 1 ? 's' : ''}`;
  document.getElementById('btn-trocar-arco').disabled = sem;
}

function _atualizarProgressoSlot() {
  const slot  = selectedTeam.length + 1;
  const tipos = _getTiposSequencia();
  document.getElementById('slot-num').textContent = slot;
  document.getElementById('mini-team').innerHTML = Array(7).fill(0).map((_, i) => {
    const p = selectedTeam[i];
    if (p) return `<div class="mini-slot filled" title="${p.nome}">${p.emoji}</div>`;
    if (tipos) {
      const { icon } = ROLE_META[tipos[i]] || {};
      const isCurrent = i === selectedTeam.length;
      return `<div class="mini-slot ${isCurrent ? 'current' : 'empty'}" title="${tipos[i] || ''}">${icon || ''}</div>`;
    }
    return `<div class="mini-slot empty"></div>`;
  }).join('');
}

function rolarDado() {
  _sortearArco();
  document.getElementById('sorteio-result').classList.add('show');
  document.getElementById('btn-rolar').style.display = 'none';
  document.getElementById('btn-swap-wrap').style.display = 'block';
  document.getElementById('sorteio-chances').style.display = 'flex';
  document.getElementById('slot-progress').style.display = 'block';
  _atualizarChances();
  _atualizarProgressoSlot();
}

function trocarArco() {
  if (chancesRestantes <= 0) return;
  chancesRestantes--;
  _sortearArco();
  _atualizarChances();
}

function confirmarSorteio() {
  const db    = DATABASE[currentUniverso];
  const tipos = _getTiposSequencia();
  const tipoReq = tipos ? tipos[selectedTeam.length] : null;
  const tipoInfo = tipoReq ? ROLE_META[tipoReq] : null;
  document.getElementById('escolha-saga-badge').innerHTML = `
    <div class="universo-badge">
      <span class="universo-emoji">${db.emoji}</span>
      <span class="universo-nome">${currentUniverso}</span>
    </div>
    <div class="arco-label">Saga: <strong>${currentArco}</strong></div>
    ${tipoInfo ? `<div class="escolha-tipo-req char-tipo char-tipo-${tipoReq}">${tipoInfo.icon} Escolher: ${tipoInfo.label}</div>` : ''}
  `;
  currentSlotIdx = null;
  document.getElementById('btn-confirmar').disabled = true;
  renderPersonagens();
  navigate('pg-escolha', 'forward', `Jogador ${selectedTeam.length + 1}/7`);
  _iniciarTimerEscolha();
}

// ── Seleção do time (1 por arco) ──

function renderPersonagens() {
  const jaUsados   = new Set(selectedTeam.map(p => p.nome));
  const tipos      = _getTiposSequencia();
  const tipoReq    = tipos ? tipos[selectedTeam.length] : null;
  document.getElementById('personagens-grid').innerHTML = currentPersonagens.map((p, i) => {
    const usado      = jaUsados.has(p.nome);
    const tipoErrado = tipoReq && p.tipo && p.tipo !== tipoReq;
    const bloqueado  = usado || tipoErrado;
    const sel        = currentSlotIdx === i;
    return `<div class="char-option${sel ? ' selected' : ''}${usado ? ' char-usado' : ''}${tipoErrado ? ' char-tipo-errado' : ''}"
              id="char-${i}" onclick="${bloqueado ? '' : `selecionarPersonagem(${i})`}">
      ${sel ? '<div class="char-check">✓</div>' : ''}
      ${usado ? '<div class="char-used-badge">No time</div>' : ''}
      <div class="char-emoji">${p.emoji}</div>
      <div class="char-name">${p.nome}</div>
      ${p.tipo ? `<div class="char-tipo char-tipo-${p.tipo}">${p.tipo.toUpperCase()}</div>` : ''}
    </div>`;
  }).join('');
}

function selecionarPersonagem(idx) {
  currentSlotIdx = idx;
  document.getElementById('btn-confirmar').disabled = false;
  renderPersonagens();
}

function confirmarEscolha() {
  _pararTimerEscolha();
  const p = { ...currentPersonagens[currentSlotIdx], destaque: selectedTeam.length === 0 };
  selectedTeam.push(p);
  currentSlotIdx = null;

  if (selectedTeam.length < 7) {
    document.getElementById('sorteio-result').classList.remove('show');
    document.getElementById('btn-rolar').style.display = '';
    document.getElementById('btn-swap-wrap').style.display = 'none';
    document.getElementById('sorteio-chances').style.display = 'none';
    _atualizarProgressoSlot();
    const titulo = mpModo ? 'Monte seu Time' : torneioModo ? 'Torneio — Monte seu Time' : 'Partida Rápida';
    navigate('pg-sorteio', 'back', titulo);
  } else {
    // Time completo → tela de formação (todos os modos)
    _abrirFormacao(selectedTeam.slice());
  }
}

function iniciarSorteioTorneio() {
  _origemPRFormacao = 'torneio';
  formacaoPRModo = '1-3-3';
  _renderPRFormacoes();
  navigate('pg-pr-formacao', 'forward', 'Torneio');
}

// ── Formação (compartilhada por todos os modos) ──

function _abrirFormacao(team) {
  posicoesPR = team;
  formacaoPR = formacaoPRModo || '1-3-3';
  posicaoSel = null;

  document.getElementById('sorteio-result').classList.remove('show');
  document.getElementById('btn-rolar').style.display       = '';
  document.getElementById('btn-swap-wrap').style.display   = 'none';
  document.getElementById('sorteio-chances').style.display = 'none';
  document.getElementById('slot-progress').style.display   = 'none';

  _renderFormacaoPR();
  navigate('pg-formacao', 'forward', 'Formação');
}

function selecionarFormacaoPR(key) {
  formacaoPR = key;
  posicaoSel = null;
  _renderFormacaoPR();
}

function selecionarPosicaoPR(idx) {
  if (posicaoSel === null) {
    posicaoSel = idx;
  } else if (posicaoSel === idx) {
    posicaoSel = null;
  } else {
    const tmp = posicoesPR[posicaoSel];
    posicoesPR[posicaoSel] = posicoesPR[idx];
    posicoesPR[idx] = tmp;
    posicaoSel = null;
  }
  _renderFormacaoPR();
}

function _renderFormacaoPR() {
  // Barra de formações
  document.getElementById('fr-formations-bar').innerHTML =
    Object.keys(FORMACOES).map(key => {
      const f = FORMACOES[key];
      return `<button class="mf-form-btn${formacaoPR === key ? ' active' : ''}" onclick="selecionarFormacaoPR('${key}')">
        <span class="mf-form-name">${key}</span>
        <span class="mf-form-desc">${f.desc}</span>
      </button>`;
    }).join('');

  // Campo
  const posicoes = FORMACOES[formacaoPR].posicoes;
  const horizontal = window.innerWidth <= 600;
  document.getElementById('fr-positions').innerHTML = posicoes.map((pos, i) => {
    const cx   = horizontal ? (100 - pos.y) : pos.x;
    const cy   = horizontal ? pos.x : pos.y;
    const char = posicoesPR[i];
    const sel  = posicaoSel === i;
    const firstName = char.nome.split(' ')[0];
    return `<div class="mf-pos filled ${pos.role}${sel ? ' fr-selected' : ''}"
                 style="left:${cx}%;top:${cy}%"
                 onclick="selecionarPosicaoPR(${i})">
      <div class="mf-pos-emoji">${char.emoji}</div>
      <div class="mf-pos-name">${firstName}</div>
      ${char.destaque ? '<div class="fr-craque-dot"></div>' : ''}
    </div>`;
  }).join('');

  // Lista escalação
  document.getElementById('fr-squad-list').innerHTML = posicoes.map((pos, i) => {
    const char = posicoesPR[i];
    const { icon } = ROLE_META[pos.role];
    const sel = posicaoSel === i;
    return `<div class="mf-squad-row filled fr-squad-row${sel ? ' fr-selected' : ''}"
                 onclick="selecionarPosicaoPR(${i})">
      <span class="mf-squad-role-icon">${icon}</span>
      <span class="mf-squad-emoji">${char.emoji}</span>
      <span class="mf-squad-name">${char.nome}</span>
      ${char.destaque ? '<span class="destaque-badge" style="font-size:9px;padding:1px 6px">CRAQUE</span>' : ''}
    </div>`;
  }).join('');
}

function confirmarFormacaoPR() {
  const teamOrdenado = posicoesPR.slice();
  const era_mp       = typeof mpModo !== 'undefined' && mpModo;
  const era_torneio  = torneioModo;

  // Reset state
  selectedTeam     = [];
  currentSlotIdx   = null;
  chancesRestantes = 3;
  torneioModo      = false;
  posicoesPR       = [];
  posicaoSel       = null;

  if (era_mp) {
    if (typeof mpModo !== 'undefined') mpModo = false;
    _finalizarTimeMpComFormacao(teamOrdenado);
  } else if (era_torneio) {
    iniciarTorneioComTime(teamOrdenado);
  } else {
    timeA = teamOrdenado;
    timeB = montarAdversario();
    renderTime('lista-time-a', timeA);
    renderTime('lista-time-b', timeB);
    document.getElementById('placar-a').textContent = '0';
    document.getElementById('placar-b').textContent = '0';
    document.getElementById('placar-a').classList.remove('winning');
    document.getElementById('placar-b').classList.remove('winning');
    document.getElementById('rounds-log').innerHTML = '';
    document.getElementById('resultado-banner').classList.remove('show');
    document.getElementById('btn-simular').disabled = false;
    navigate('pg-confronto', 'forward', 'Confronto');
  }
}

// Resize listener para o campo de formação
window.addEventListener('resize', () => {
  if (document.getElementById('pg-formacao')?.classList.contains('active')) {
    _renderFormacaoPR();
  }
});

function montarAdversario() {
  const todos = Object.keys(DATABASE);
  const pool = currentUniverso ? todos.filter(u => u !== currentUniverso) : todos;
  const uAdv = pool[Math.floor(Math.random() * pool.length)];
  const arcosAdv = Object.keys(DATABASE[uAdv].sagas);
  const arcoAdv = arcosAdv[Math.floor(Math.random() * arcosAdv.length)];
  return [...DATABASE[uAdv].sagas[arcoAdv]].sort(() => Math.random() - 0.5).slice(0, 7);
}

function renderTime(id, time) {
  document.getElementById(id).innerHTML = time.map(p => `
    <div class="jogador-row ${p.destaque ? 'destaque' : ''}">
      <div class="jogador-emoji">${p.emoji}</div>
      <div class="jogador-info">
        <div class="jogador-nome">${p.nome}</div>
      </div>
      ${p.destaque ? '<div class="destaque-badge">SEU CRAQUE</div>' : ''}
    </div>
  `).join('');
}

async function simularJogo() {
  document.getElementById('btn-simular').disabled = true;
  document.getElementById('resultado-banner').classList.remove('show');
  document.getElementById('rounds-log').innerHTML = '';
  document.getElementById('placar-a').textContent = '0';
  document.getElementById('placar-b').textContent = '0';
  document.getElementById('placar-a').classList.remove('winning');
  document.getElementById('placar-b').classList.remove('winning');

  navigate('pg-simulacao', 'forward', 'Simulação');

  let ponA = 0, ponB = 0;
  const rounds = [];

  for (let i = 0; i < 7; i++) {
    const pa = timeA[i], pb = timeB[i];
    const fa = pa.poder * (0.65 + Math.random() * 0.7);
    const fb = pb.poder * (0.65 + Math.random() * 0.7);
    let cls, desc;
    if (fa > fb) {
      ponA++; cls = 'a';
      desc = `<strong>${pa.emoji} ${pa.nome}</strong> derrota ${pb.emoji} ${pb.nome}`;
    } else if (fb > fa) {
      ponB++; cls = 'b';
      desc = `<span class="win-b"><strong>${pb.emoji} ${pb.nome}</strong></span> derrota ${pa.emoji} ${pa.nome}`;
    } else {
      cls = 'd';
      desc = `Empate entre ${pa.emoji} ${pa.nome} e ${pb.emoji} ${pb.nome}`;
    }
    rounds.push({ cls, desc, ponA, ponB });
  }

  for (let i = 0; i < rounds.length; i++) {
    await delay(700);
    const r = rounds[i];
    const log = document.getElementById('rounds-log');
    const el = document.createElement('div');
    el.className = 'round-entry';
    el.innerHTML = `
      <div class="round-bar ${r.cls}"></div>
      <div class="round-num">Round ${i + 1}</div>
      <div class="round-desc">${r.desc}</div>
      <div class="round-result ${r.cls}">${r.ponA} × ${r.ponB}</div>
    `;
    log.appendChild(el);
    requestAnimationFrame(() => {
      el.classList.add('visible');
      el.scrollIntoView({ behavior: 'smooth', block: 'end' });
    });
    const elA = document.getElementById('placar-a');
    const elB = document.getElementById('placar-b');
    if (String(r.ponA) !== elA.textContent) {
      elA.textContent = r.ponA;
      elA.classList.remove('score-bump');
      void elA.offsetWidth;
      elA.classList.add('score-bump');
    }
    if (String(r.ponB) !== elB.textContent) {
      elB.textContent = r.ponB;
      elB.classList.remove('score-bump');
      void elB.offsetWidth;
      elB.classList.add('score-bump');
    }
  }

  await delay(600);
  mostrarResultado(rounds[6].ponA, rounds[6].ponB);
  document.getElementById('btn-simular').disabled = false;
}

function mostrarResultado(a, b) {
  const emoji  = document.getElementById('resultado-emoji');
  const titulo = document.getElementById('resultado-titulo');
  const sub    = document.getElementById('resultado-sub');

  if (a > b) {
    if (a === 7) {
      emoji.textContent  = '🏆';
      titulo.textContent = 'SEU TIME FEZ 7 A 0!';
      sub.textContent    = `Dominação total! Placar: ${a} × ${b}`;
    } else {
      emoji.textContent  = '✅';
      titulo.textContent = `Vitória! ${a} × ${b}`;
      sub.textContent    = 'Seu time venceu, mas sem o 7 a 0 completo.';
    }
    document.getElementById('placar-a').classList.add('winning');
  } else if (b > a) {
    emoji.textContent  = '💀';
    titulo.textContent = `Derrota. ${a} × ${b}`;
    sub.textContent    = 'O adversário foi mais forte dessa vez. Tenta de novo!';
    document.getElementById('placar-b').classList.add('winning');
  } else {
    emoji.textContent  = '🤝';
    titulo.textContent = `Empate! ${a} × ${b}`;
    sub.textContent    = 'Forças equilibradas. Caiu pra prorrogação!';
  }

  document.getElementById('resultado-banner').classList.add('show');
  document.getElementById('resultado-banner').scrollIntoView({ behavior: 'smooth', block: 'end' });

  if (typeof registrarPartida === 'function' && !torneioModo && !(typeof mpModo !== 'undefined' && mpModo)) {
    const result = a > b ? 'win' : b > a ? 'loss' : 'draw';
    registrarPartida({
      mode: 'rapida', result, scoreA: a, scoreB: b,
      perfectWin: a === 7 && b === 0,
      durationSec: typeof getDurationSec === 'function' ? getDurationSec() : 0,
    });
  }
}

// ══════════════════════════════════════════
// MONTAR TIME — SISTEMA DE FORMAÇÃO
// ══════════════════════════════════════════

const FORMACOES = {
  '1-3-3': {
    desc: 'Equilibrado',
    posicoes: [
      { role: 'ataque',  x: 18, y: 14 },
      { role: 'ataque',  x: 50, y: 14 },
      { role: 'ataque',  x: 82, y: 14 },
      { role: 'suporte', x: 18, y: 49 },
      { role: 'suporte', x: 50, y: 49 },
      { role: 'suporte', x: 82, y: 49 },
      { role: 'tank',    x: 50, y: 82 },
    ]
  },
  '1-2-4': {
    desc: 'Ofensivo',
    posicoes: [
      { role: 'ataque',  x: 14, y: 14 },
      { role: 'ataque',  x: 38, y: 14 },
      { role: 'ataque',  x: 62, y: 14 },
      { role: 'ataque',  x: 86, y: 14 },
      { role: 'suporte', x: 32, y: 49 },
      { role: 'suporte', x: 68, y: 49 },
      { role: 'tank',    x: 50, y: 82 },
    ]
  },
  '1-4-2': {
    desc: 'Defensivo',
    posicoes: [
      { role: 'ataque',  x: 33, y: 14 },
      { role: 'ataque',  x: 67, y: 14 },
      { role: 'suporte', x: 12, y: 49 },
      { role: 'suporte', x: 38, y: 49 },
      { role: 'suporte', x: 62, y: 49 },
      { role: 'suporte', x: 88, y: 49 },
      { role: 'tank',    x: 50, y: 82 },
    ]
  },
  '2-2-3': {
    desc: 'Balanceado',
    posicoes: [
      { role: 'ataque',  x: 20, y: 14 },
      { role: 'ataque',  x: 50, y: 14 },
      { role: 'ataque',  x: 80, y: 14 },
      { role: 'suporte', x: 30, y: 49 },
      { role: 'suporte', x: 70, y: 49 },
      { role: 'tank',    x: 28, y: 80 },
      { role: 'tank',    x: 72, y: 80 },
    ]
  },
  '2-3-2': {
    desc: 'Clássico',
    posicoes: [
      { role: 'ataque',  x: 32, y: 14 },
      { role: 'ataque',  x: 68, y: 14 },
      { role: 'suporte', x: 18, y: 49 },
      { role: 'suporte', x: 50, y: 49 },
      { role: 'suporte', x: 82, y: 49 },
      { role: 'tank',    x: 30, y: 80 },
      { role: 'tank',    x: 70, y: 80 },
    ]
  },
};

const ROLE_META = {
  ataque:  { icon: '⚔️', label: 'Ataque'  },
  suporte: { icon: '✨', label: 'Suporte' },
  tank:    { icon: '🛡️', label: 'Tank'    },
};

let MT_ALL_CHARS  = [];
let formacaoAtiva = '1-3-3';
let timeFormacao  = Array(7).fill(null);

function buildMTChars() {
  const arr = [];
  Object.keys(DATABASE).forEach(uni => {
    Object.keys(DATABASE[uni].sagas).forEach(arco => {
      DATABASE[uni].sagas[arco].forEach(p => {
        arr.push({ ...p, uni, arco, mtId: arr.length });
      });
    });
  });

  // Detecta nomes repetidos no mesmo universo e adiciona sigla do arco
  const freq = {};
  arr.forEach(p => { const k = `${p.uni}|${p.nome}`; freq[k] = (freq[k] || 0) + 1; });
  arr.forEach(p => {
    if (freq[`${p.uni}|${p.nome}`] > 1) {
      const sigla = p.arco.replace(/^(saga|arco?)\s+/i, '').slice(0, 4);
      p.displayNome = `${p.nome} [${sigla}]`;
    } else {
      p.displayNome = p.nome;
    }
  });

  return arr;
}

function abrirMontarTime() {
  timeFormacao  = Array(7).fill(null);
  formacaoAtiva = '1-3-3';
  MT_ALL_CHARS  = buildMTChars();
  fecharPicker();
  renderMFFormacoes();
  renderMFField();
  renderMFSquad();
  navigate('pg-montar-time', 'forward', 'Montar Time');
}

// Re-renderiza campo ao girar o dispositivo
window.addEventListener('resize', () => {
  if (document.getElementById('pg-montar-time').classList.contains('active')) {
    renderMFField();
  }
});

function selecionarFormacao(key) {
  formacaoAtiva = key;
  timeFormacao  = Array(7).fill(null);
  fecharPicker();
  renderMFFormacoes();
  renderMFField();
  renderMFSquad();
}

function rolarPosicao(idx) {
  const tipoReq = FORMACOES[formacaoAtiva].posicoes[idx].role;
  const usados  = new Set(timeFormacao.filter((p, i) => p && i !== idx).map(p => p.mtId));
  const disponiveis = MT_ALL_CHARS.filter(p => p.tipo === tipoReq && !usados.has(p.mtId));
  if (!disponiveis.length) return;
  timeFormacao[idx] = { ...disponiveis[Math.floor(Math.random() * disponiveis.length)] };
  renderMFField();
  renderMFSquad();
}

function rolarTimeFormacao() {
  const posicoes = FORMACOES[formacaoAtiva].posicoes;
  const usedIds  = new Set();
  timeFormacao = posicoes.map(pos => {
    const pool = MT_ALL_CHARS.filter(p => p.tipo === pos.role && !usedIds.has(p.mtId));
    if (!pool.length) return null;
    const chosen = pool[Math.floor(Math.random() * pool.length)];
    usedIds.add(chosen.mtId);
    return { ...chosen };
  });
  renderMFField();
  renderMFSquad();
}

function renderMFFormacoes() {
  document.getElementById('mf-formations-bar').innerHTML =
    Object.keys(FORMACOES).map(key => {
      const f = FORMACOES[key];
      return `<button class="mf-form-btn${formacaoAtiva === key ? ' active' : ''}" onclick="selecionarFormacao('${key}')">
        <span class="mf-form-name">${key}</span>
        <span class="mf-form-desc">${f.desc}</span>
      </button>`;
    }).join('');
}

function renderMFField() {
  const posicoes = FORMACOES[formacaoAtiva].posicoes;
  const horizontal = window.innerWidth <= 600;
  document.getElementById('mf-positions').innerHTML = posicoes.map((pos, i) => {
    const cx = horizontal ? (100 - pos.y) : pos.x;
    const cy = horizontal ? pos.x          : pos.y;
    const char = timeFormacao[i];
    const { icon, label } = ROLE_META[pos.role];
    if (char) {
      const firstName = char.nome.split(' ')[0];
      return `<div class="mf-pos filled ${pos.role}" style="left:${cx}%;top:${cy}%" onclick="abrirPicker(${i})" title="Clique para trocar">
        <div class="mf-pos-emoji">${char.emoji}</div>
        <div class="mf-pos-name">${firstName}</div>
        <button class="mf-pos-dice" onclick="event.stopPropagation();rolarPosicao(${i})" title="Sortear aleatório">🎲</button>
      </div>`;
    }
    return `<div class="mf-pos empty ${pos.role}" style="left:${cx}%;top:${cy}%" onclick="abrirPicker(${i})" title="Clique para escolher">
      <div class="mf-pos-role-icon">${icon}</div>
      <div class="mf-pos-role-label">${label}</div>
    </div>`;
  }).join('');
}

function renderMFSquad() {
  const posicoes = FORMACOES[formacaoAtiva].posicoes;
  const preenchidos = timeFormacao.filter(Boolean).length;
  document.getElementById('mf-count').textContent = preenchidos;

  document.getElementById('mf-squad-list').innerHTML = timeFormacao.map((char, i) => {
    const { icon, label } = ROLE_META[posicoes[i].role];
    if (char) {
      return `<div class="mf-squad-row filled" onclick="abrirPicker(${i})" title="Clique para trocar">
        <span class="mf-squad-role-icon">${icon}</span>
        <span class="mf-squad-emoji">${char.emoji}</span>
        <span class="mf-squad-name">${char.displayNome || char.nome}</span>
        <span class="mf-squad-uni">${DATABASE[char.uni].emoji}</span>
        <span class="mf-squad-poder">${char.poder.toLocaleString()}</span>
        <button class="mf-squad-dice" onclick="event.stopPropagation();rolarPosicao(${i})" title="Sortear aleatório">🎲</button>
      </div>`;
    }
    return `<div class="mf-squad-row empty" onclick="abrirPicker(${i})" title="Clique para escolher" style="cursor:pointer">
      <span class="mf-squad-role-icon">${icon}</span>
      <span class="mf-squad-placeholder">— ${label} — clique para escolher</span>
    </div>`;
  }).join('');

  if (preenchidos === 7) {
    const total = timeFormacao.reduce((s, p) => s + p.poder, 0);
    document.getElementById('mf-squad-poder').innerHTML =
      `<div class="mf-total-poder">Poder Total <strong>${total.toLocaleString()}</strong></div>`;
  } else {
    document.getElementById('mf-squad-poder').innerHTML = '';
  }

  document.getElementById('btn-confirmar-formacao').disabled = preenchidos < 7;
}

// ── Picker de personagem (Montar Time) ──

let _mtPickerSlotIdx  = null;
let _mtPickerUniFilter = null;

function abrirPicker(idx) {
  _mtPickerSlotIdx   = idx;
  _mtPickerUniFilter = null;
  const pos = FORMACOES[formacaoAtiva].posicoes[idx];
  const { icon, label } = ROLE_META[pos.role];
  document.getElementById('mt-picker-titulo').innerHTML =
    `<span class="mt-picker-tipo char-tipo char-tipo-${pos.role}">${icon} ${label}</span> — Posição ${idx + 1}`;
  document.getElementById('mt-picker-input').value = '';
  _renderPickerUnis(pos.role);
  _renderPickerGrid(pos.role);
  document.getElementById('mt-picker-overlay').classList.add('show');
  document.getElementById('mt-picker-input').focus();
}

function fecharPicker() {
  document.getElementById('mt-picker-overlay').classList.remove('show');
  _mtPickerSlotIdx = null;
}

function fecharPickerFora(e) {
  if (e.target === document.getElementById('mt-picker-overlay')) fecharPicker();
}

function _renderPickerUnis(tipoReq) {
  const unis = Object.keys(DATABASE).filter(uni =>
    Object.values(DATABASE[uni].sagas).some(chars => chars.some(p => p.tipo === tipoReq))
  );
  document.getElementById('mt-picker-unis').innerHTML =
    `<button class="mt-uni-btn${_mtPickerUniFilter === null ? ' active' : ''}" onclick="filtrarPickerUni(null)">Todos</button>` +
    unis.map(uni =>
      `<button class="mt-uni-btn${_mtPickerUniFilter === uni ? ' active' : ''}" onclick="filtrarPickerUni('${uni.replace(/'/g, "\\'")}')">
        ${DATABASE[uni].emoji} ${uni}
      </button>`
    ).join('');
}

function filtrarPickerUni(uni) {
  _mtPickerUniFilter = uni;
  const pos = FORMACOES[formacaoAtiva].posicoes[_mtPickerSlotIdx];
  _renderPickerUnis(pos.role);
  _renderPickerGrid(pos.role);
}

function filtrarPicker() {
  const pos = FORMACOES[formacaoAtiva].posicoes[_mtPickerSlotIdx];
  _renderPickerGrid(pos.role);
}

function _renderPickerGrid(tipoReq) {
  const query    = document.getElementById('mt-picker-input').value.toLowerCase().trim();
  const atualId  = timeFormacao[_mtPickerSlotIdx]?.mtId;
  const jaUsados = new Set(
    timeFormacao.filter((p, i) => p && i !== _mtPickerSlotIdx).map(p => p.mtId)
  );

  let chars = MT_ALL_CHARS.filter(p => {
    if (p.tipo !== tipoReq) return false;
    if (_mtPickerUniFilter && p.uni !== _mtPickerUniFilter) return false;
    if (query && !p.nome.toLowerCase().includes(query) && !p.uni.toLowerCase().includes(query)) return false;
    return true;
  });

  // Atual primeiro, depois disponíveis por poder desc, depois já usados
  chars.sort((a, b) => {
    if (a.mtId === atualId) return -1;
    if (b.mtId === atualId) return  1;
    const aUsado = jaUsados.has(a.mtId);
    const bUsado = jaUsados.has(b.mtId);
    if (aUsado !== bUsado) return aUsado ? 1 : -1;
    return b.poder - a.poder;
  });

  document.getElementById('mt-picker-count').textContent = `${chars.length} personagem${chars.length !== 1 ? 's' : ''}`;

  if (!chars.length) {
    document.getElementById('mt-picker-grid').innerHTML =
      `<div class="mt-picker-empty">Nenhum personagem encontrado</div>`;
    return;
  }

  document.getElementById('mt-picker-grid').innerHTML = chars.map(p => {
    const usado   = jaUsados.has(p.mtId);
    const isAtual = p.mtId === atualId;
    const pct     = Math.round((p.poder / Math.max(...chars.map(c => c.poder))) * 100);
    return `<div class="mt-picker-char${isAtual ? ' mt-pc-atual' : usado ? ' mt-pc-usado' : ''}"
              onclick="${usado ? '' : `escolherChar(${p.mtId})`}">
      ${isAtual ? '<div class="mt-pc-badge-atual">✓ Atual</div>' : ''}
      ${usado   ? '<div class="mt-pc-badge-usado">No time</div>' : ''}
      <div class="mt-pc-emoji">${p.emoji}</div>
      <div class="mt-pc-nome">${p.displayNome || p.nome}</div>
      <div class="mt-pc-uni">${DATABASE[p.uni].emoji} ${p.uni}</div>
      <div class="mt-pc-bar"><div class="mt-pc-bar-fill" style="width:${pct}%"></div></div>
      <div class="mt-pc-poder">${p.poder.toLocaleString()}</div>
    </div>`;
  }).join('');
}

function escolherChar(mtId) {
  const char = MT_ALL_CHARS.find(p => p.mtId === mtId);
  if (!char || _mtPickerSlotIdx === null) return;
  timeFormacao[_mtPickerSlotIdx] = { ...char };
  fecharPicker();
  renderMFField();
  renderMFSquad();
}

function rolarPosicaoAtual() {
  if (_mtPickerSlotIdx === null) return;
  rolarPosicao(_mtPickerSlotIdx);
  fecharPicker();
}

function confirmarFormacao() {
  currentUniverso = null;
  timeA = timeFormacao.filter(Boolean).map(p => ({ ...p, destaque: false }));
  timeB = montarAdversario();

  renderTime('lista-time-a', timeA);
  renderTime('lista-time-b', timeB);

  document.getElementById('placar-a').textContent = '0';
  document.getElementById('placar-b').textContent = '0';
  document.getElementById('placar-a').classList.remove('winning');
  document.getElementById('placar-b').classList.remove('winning');
  document.getElementById('rounds-log').innerHTML = '';
  document.getElementById('resultado-banner').classList.remove('show');
  document.getElementById('btn-simular').disabled = false;

  navigate('pg-confronto', 'forward', 'Confronto');
}

function resetarJogo() {
  document.getElementById('sorteio-result').classList.remove('show');
  document.getElementById('btn-rolar').style.display = '';
  document.getElementById('btn-swap-wrap').style.display = 'none';
  document.getElementById('sorteio-chances').style.display = 'none';
  document.getElementById('resultado-banner').classList.remove('show');
  document.getElementById('placar-a').classList.remove('winning');
  document.getElementById('placar-b').classList.remove('winning');
  selectedTeam   = [];
  currentSlotIdx = null;
  chancesRestantes = 3;
  torneioModo    = false;
  posicoesPR     = [];
  posicaoSel     = null;
  formacaoPR     = '1-3-3';
  document.getElementById('slot-progress').style.display = 'none';
  timeA = [];
  timeB = [];
  pageHistory = [];
  navigate('pg-home', 'back', '');
}
