// ══════════════════════════════════════════
// MULTIPLAYER — FIREBASE REALTIME DATABASE
// ══════════════════════════════════════════

let mpModo = false;
let _mpResultadoAnimado = false;
let _mpLobbyModo = '1v1';

let MP = {
  active:       false,
  codigoSala:   null,
  isHost:       false,
  meuSlot:      null,   // '1v1': 'p1'|'p2'  /  '2v2': 'p1a'|'p2a'|'p1b'|'p2b'
  modo:         '1v1',
  salaRef:      null,
  salaListener: null,
};

// ─ Utilitários ─
function _gerarCodigo() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array(6).fill(0).map(() => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function _setMpErro(msg) {
  const el = document.getElementById('mp-erro');
  if (el) el.textContent = msg;
}

// ─ Selecionar modo no lobby ─
function _setModoMP(modo) {
  _mpLobbyModo = modo;
  document.getElementById('mp-modo-1v1')?.classList.toggle('active', modo === '1v1');
  document.getElementById('mp-modo-2v2')?.classList.toggle('active', modo === '2v2');
  const desc = document.getElementById('mp-modo-desc');
  if (desc) desc.textContent = modo === '2v2'
    ? '2 jogadores de cada lado — 14 rounds de batalha!'
    : 'Desafie um amigo em batalha 1 contra 1!';
}

// ─ Session localStorage ─
function _salvarSessaoMP() {
  localStorage.setItem('mp_sessao', JSON.stringify({
    codigo: MP.codigoSala,
    slot:   MP.meuSlot,
    modo:   MP.modo,
  }));
}

function _limparSessaoMP() {
  localStorage.removeItem('mp_sessao');
}

// ─ Abrir lobby ─
function abrirMultiplayer() {
  const nome   = document.getElementById('mp-nome-input');
  const codigo = document.getElementById('mp-codigo-input');
  if (nome)   nome.value   = '';
  if (codigo) codigo.value = '';
  _setMpErro('');
  _setModoMP(_mpLobbyModo);

  const sessRaw = localStorage.getItem('mp_sessao');
  const rejoin  = document.getElementById('mp-rejoin-banner');
  if (sessRaw && rejoin) {
    try {
      const sess = JSON.parse(sessRaw);
      const el   = document.getElementById('mp-rejoin-codigo');
      if (el) el.textContent = sess.codigo;
      rejoin.style.display = 'flex';
    } catch (_) {
      _limparSessaoMP();
      if (rejoin) rejoin.style.display = 'none';
    }
  } else if (rejoin) {
    rejoin.style.display = 'none';
  }

  navigate('pg-mp-lobby', 'forward', 'Multiplayer');
}

// ─ Reconectar sala ─
async function reconectarSala() {
  let db;
  try { db = _getDb(); } catch (e) { _setMpErro(e.message); return; }

  const sessRaw = localStorage.getItem('mp_sessao');
  if (!sessRaw) return;
  let sess;
  try { sess = JSON.parse(sessRaw); } catch (_) { _limparSessaoMP(); return; }

  try {
    const salaRef = db.ref(`salas/${sess.codigo}`);
    const snap    = await salaRef.once('value');
    const sala    = snap.val();

    if (!sala || sala.status === 'fim') {
      _limparSessaoMP();
      const rejoin = document.getElementById('mp-rejoin-banner');
      if (rejoin) rejoin.style.display = 'none';
      _setMpErro('Sala não disponível para reconexão.');
      return;
    }

    MP = {
      active:       true,
      codigoSala:   sess.codigo,
      isHost:       sess.slot === 'p1' || sess.slot === 'p1a',
      meuSlot:      sess.slot,
      modo:         sess.modo || '1v1',
      salaRef,
      salaListener: null,
    };

    _entrarNaSala();
  } catch (e) {
    _setMpErro('Erro ao reconectar.');
    console.error(e);
  }
}

function cancelarReconexao() {
  _limparSessaoMP();
  const rejoin = document.getElementById('mp-rejoin-banner');
  if (rejoin) rejoin.style.display = 'none';
}

// ─ Criar sala ─
async function criarSala() {
  let db;
  try { db = _getDb(); } catch (e) { _setMpErro(e.message); return; }

  const nome = document.getElementById('mp-nome-input').value.trim();
  if (!nome) { _setMpErro('Digite seu nome!'); return; }

  const btn = document.getElementById('mp-btn-criar');
  btn.disabled    = true;
  btn.textContent = 'Criando…';
  _setMpErro('');

  try {
    const codigo  = _gerarCodigo();
    const salaRef = db.ref(`salas/${codigo}`);
    const modo    = _mpLobbyModo;

    const dados = modo === '2v2'
      ? {
          status: 'aguardando', modo: '2v2',
          p1a: { nome, time: null, pronto: false },
          p2a: { nome: null, time: null, pronto: false },
          p1b: { nome: null, time: null, pronto: false },
          p2b: { nome: null, time: null, pronto: false },
          resultado: null, criado: Date.now(),
        }
      : {
          status: 'aguardando', modo: '1v1',
          p1: { nome, time: null, pronto: false },
          p2: { nome: null, time: null, pronto: false },
          resultado: null, criado: Date.now(),
        };

    await salaRef.set(dados);

    MP = {
      active:     true,
      codigoSala: codigo,
      isHost:     true,
      meuSlot:    modo === '2v2' ? 'p1a' : 'p1',
      modo,
      salaRef,
      salaListener: null,
    };

    _salvarSessaoMP();
    _entrarNaSala();
  } catch (e) {
    _setMpErro('Erro ao criar sala. Verifique o Firebase.');
    console.error(e);
  } finally {
    btn.disabled    = false;
    btn.textContent = '🏠 Criar Sala';
  }
}

// ─ Entrar em sala ─
async function entrarSala() {
  let db;
  try { db = _getDb(); } catch (e) { _setMpErro(e.message); return; }

  const nome   = document.getElementById('mp-nome-input').value.trim();
  const codigo = document.getElementById('mp-codigo-input').value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

  if (!nome)               { _setMpErro('Digite seu nome!'); return; }
  if (codigo.length !== 6) { _setMpErro('Código deve ter 6 caracteres.'); return; }

  const btn = document.getElementById('mp-btn-entrar');
  btn.disabled    = true;
  btn.textContent = 'Entrando…';
  _setMpErro('');

  try {
    const salaRef = db.ref(`salas/${codigo}`);
    const snap    = await salaRef.once('value');
    const sala    = snap.val();

    if (!sala)                 { _setMpErro('Sala não encontrada.'); return; }
    if (sala.status === 'fim') { _setMpErro('Esta sala já encerrou.'); return; }

    const modo = sala.modo || '1v1';
    let slotVago = null;

    if (modo === '2v2') {
      if (!sala.p1b?.nome)      slotVago = 'p1b';
      else if (!sala.p2a?.nome) slotVago = 'p2a';
      else if (!sala.p2b?.nome) slotVago = 'p2b';
      else { _setMpErro('Sala cheia!'); return; }
    } else {
      if (sala.p2?.nome) { _setMpErro('Sala cheia!'); return; }
      slotVago = 'p2';
    }

    await salaRef.child(slotVago).update({ nome });
    if (modo === '1v1') await salaRef.update({ status: 'em-jogo' });
    else {
      // 2v2: atualizar status quando última vaga preenchida
      const snap2  = await salaRef.once('value');
      const sala2  = snap2.val();
      const cheio  = ['p1a','p2a','p1b','p2b'].every(s => sala2[s]?.nome);
      if (cheio) await salaRef.update({ status: 'em-jogo' });
    }

    MP = {
      active:     true,
      codigoSala: codigo,
      isHost:     false,
      meuSlot:    slotVago,
      modo,
      salaRef,
      salaListener: null,
    };

    _salvarSessaoMP();
    _entrarNaSala();
  } catch (e) {
    _setMpErro('Erro ao entrar na sala. Verifique o código.');
    console.error(e);
  } finally {
    btn.disabled    = false;
    btn.textContent = '🔗 Entrar na Sala';
  }
}

// ─ Entrar na página da sala ─
function _entrarNaSala() {
  selectedTeam     = [];
  currentSlotIdx   = null;
  chancesRestantes = 3;
  _mpResultadoAnimado = false;

  document.getElementById('mp-sala-codigo').textContent = MP.codigoSala;

  const modoTag = document.getElementById('mp-sala-modo-tag');
  if (modoTag) {
    modoTag.textContent = MP.modo === '2v2' ? '2v2' : '1v1';
    modoTag.className   = 'mp-sala-modo-tag modo-' + MP.modo;
  }

  _renderSala({
    status: 'aguardando',
    p1: {}, p2: {}, p1a: {}, p2a: {}, p1b: {}, p2b: {},
  });
  navigate('pg-mp-sala', 'forward', 'Sala');
  _escutarSala();
}

// ─ Listener Firebase ─
function _escutarSala() {
  if (MP.salaListener) MP.salaRef.off('value', MP.salaListener);
  MP.salaListener = MP.salaRef.on('value', snap => {
    const sala = snap.val();
    if (sala) _aoMudarSala(sala);
  });
}

function _aoMudarSala(sala) {
  const pg = document.querySelector('.app-page.active')?.id;

  if (pg === 'pg-mp-sala') {
    _renderSala(sala);

    const prontos = MP.modo === '2v2'
      ? sala.p1a?.pronto && sala.p2a?.pronto && sala.p1b?.pronto && sala.p2b?.pronto
      : sala.p1?.pronto  && sala.p2?.pronto;

    if (prontos) _abrirConfrontoMP(sala);
    return;
  }

  if (pg === 'pg-mp-confronto' && sala.resultado && !_mpResultadoAnimado) {
    _mpResultadoAnimado = true;
    document.getElementById('mp-btn-simular').style.display  = 'none';
    document.getElementById('mp-aguard-simul').style.display = 'none';
    document.getElementById('mp-placar-box').style.display   = 'block';
    document.getElementById('mp-placar-a').textContent = '0';
    document.getElementById('mp-placar-b').textContent = '0';
    document.getElementById('mp-placar-a').classList.remove('winning');
    document.getElementById('mp-placar-b').classList.remove('winning');
    document.getElementById('mp-rounds-log').innerHTML = '';
    _animarResultadoMP(sala.resultado, sala);
  }
}

// ─ Render sala ─
function _renderSala(sala) {
  const statusEl  = document.getElementById('mp-sala-status');
  const btnMontar = document.getElementById('mp-btn-montar');
  if (!statusEl) return;

  if (MP.modo === '2v2') _renderSala2v2(sala, statusEl, btnMontar);
  else                   _renderSala1v1(sala, statusEl, btnMontar);
}

function _renderSala1v1(sala, statusEl, btnMontar) {
  const p2Entrou  = sala.p2?.nome;
  const meuPronto = sala[MP.meuSlot]?.pronto;

  if (!p2Entrou) {
    statusEl.innerHTML = `
      <div class="mp-aguardando">
        <div class="mp-aguardando-icon">⏳</div>
        <div>Aguardando jogador 2 entrar na sala…</div>
        <div class="mp-aguardando-dica">Compartilhe o código <strong>${MP.codigoSala}</strong> com seu amigo!</div>
      </div>`;
    if (btnMontar) btnMontar.style.display = 'none';
    return;
  }

  const p1 = sala.p1 || {}, p2 = sala.p2 || {};
  statusEl.innerHTML = `
    <div class="mp-players-row">
      <div class="mp-player-card${MP.meuSlot === 'p1' ? ' eu' : ''}">
        <div class="mp-player-emoji">${MP.meuSlot === 'p1' ? '⭐' : '👤'}</div>
        <div class="mp-player-name">${p1.nome || '—'}</div>
        <div class="mp-player-badge${p1.pronto ? ' pronto' : ''}">${p1.pronto ? '✅ Pronto' : '🔄 Montando…'}</div>
      </div>
      <div class="mp-vs-divider">VS</div>
      <div class="mp-player-card${MP.meuSlot === 'p2' ? ' eu' : ''}">
        <div class="mp-player-emoji">${MP.meuSlot === 'p2' ? '⭐' : '👤'}</div>
        <div class="mp-player-name">${p2.nome || '—'}</div>
        <div class="mp-player-badge${p2.pronto ? ' pronto' : ''}">${p2.pronto ? '✅ Pronto' : '🔄 Montando…'}</div>
      </div>
    </div>`;

  if (btnMontar) {
    btnMontar.style.display = 'block';
    btnMontar.disabled      = !!meuPronto;
    btnMontar.textContent   = meuPronto ? '✅ Time montado! Aguardando adversário…' : '⚽ Montar Meu Time →';
  }
}

function _renderSala2v2(sala, statusEl, btnMontar) {
  const slots       = ['p1a', 'p2a', 'p1b', 'p2b'];
  const totalEntrou = slots.filter(s => sala[s]?.nome).length;
  const isTeamA     = ['p1a', 'p2a'].includes(MP.meuSlot);
  const meuPronto   = sala[MP.meuSlot]?.pronto;

  function renderSlot(slot) {
    const isMe = MP.meuSlot === slot;
    const p    = sala[slot] || {};
    return `
      <div class="mp-player-card${isMe ? ' eu' : ''}${!p.nome ? ' vazio' : ''}">
        <div class="mp-player-emoji">${isMe ? '⭐' : (p.nome ? '👤' : '⬜')}</div>
        <div class="mp-player-name">${p.nome || 'Aguardando…'}</div>
        ${p.nome ? `<div class="mp-player-badge${p.pronto ? ' pronto' : ''}">${p.pronto ? '✅ Pronto' : '🔄 Montando…'}</div>` : ''}
      </div>`;
  }

  statusEl.innerHTML = `
    <div class="mp-2v2-grid">
      <div class="mp-2v2-team${isTeamA ? ' meu-time' : ''}">
        <div class="mp-2v2-team-label">🔵 TIME A</div>
        ${renderSlot('p1a')}
        ${renderSlot('p2a')}
      </div>
      <div class="mp-2v2-sep">VS</div>
      <div class="mp-2v2-team${!isTeamA ? ' meu-time' : ''}">
        <div class="mp-2v2-team-label">🔴 TIME B</div>
        ${renderSlot('p1b')}
        ${renderSlot('p2b')}
      </div>
    </div>
    ${totalEntrou < 4
      ? `<div class="mp-aguardando-dica" style="margin-top:1rem;text-align:center">Aguardando ${4 - totalEntrou} jogador${4 - totalEntrou > 1 ? 'es' : ''}… código: <strong>${MP.codigoSala}</strong></div>`
      : ''}`;

  if (btnMontar) {
    const salaCompleta = slots.every(s => sala[s]?.nome);
    btnMontar.style.display = salaCompleta ? 'block' : 'none';
    if (salaCompleta) {
      btnMontar.disabled    = !!meuPronto;
      btnMontar.textContent = meuPronto ? '✅ Time montado! Aguardando outros…' : '⚽ Montar Meu Time →';
    }
  }
}

// ─ Copiar código ─
function copiarCodigo() {
  if (!MP.codigoSala) return;
  navigator.clipboard?.writeText(MP.codigoSala).then(() => {
    const btn = document.querySelector('.mp-copy-btn');
    if (!btn) return;
    const old = btn.textContent;
    btn.textContent = '✓';
    setTimeout(() => { btn.textContent = old; }, 1500);
  });
}

// ─ Montar time MP ─
function iniciarMontarTimeMP() {
  mpModo            = true;
  _origemPRFormacao = 'mp';
  formacaoPRModo    = '1-3-3';
  _renderPRFormacoes();
  navigate('pg-pr-formacao', 'forward', 'Monte seu Time');
}

// ─ Finalizar time MP ─
async function _finalizarTimeMpComFormacao(teamOrdenado) {
  const meuTime = teamOrdenado.map(p => ({
    nome: p.nome, emoji: p.emoji, poder: p.poder, destaque: !!p.destaque,
  }));

  navigate('pg-mp-sala', 'back', 'Sala');
  await MP.salaRef.child(MP.meuSlot).update({ time: meuTime, pronto: true });

  // Verificação direta: se o outro player já estava pronto, o listener pode ter
  // disparado enquanto estávamos em pg-formacao e perdido o trigger. Abrimos aqui.
  const snap = await MP.salaRef.once('value');
  const sala  = snap.val();
  if (!sala || _mpResultadoAnimado) return;

  const prontos = sala.modo === '2v2'
    ? sala.p1a?.pronto && sala.p2a?.pronto && sala.p1b?.pronto && sala.p2b?.pronto
    : sala.p1?.pronto  && sala.p2?.pronto;

  if (prontos) _abrirConfrontoMP(sala);
}

// ─ Abrir confronto ─
function _abrirConfrontoMP(sala) {
  document.getElementById('mp-btn-simular').style.display    = MP.isHost ? 'inline-block' : 'none';
  document.getElementById('mp-aguard-simul').style.display   = MP.isHost ? 'none' : 'block';
  document.getElementById('mp-placar-box').style.display     = 'none';
  document.getElementById('mp-rounds-log').innerHTML         = '';
  document.getElementById('mp-resultado-banner').classList.remove('show');
  document.getElementById('mp-placar-a').textContent         = '0';
  document.getElementById('mp-placar-b').textContent         = '0';
  document.getElementById('mp-placar-a').classList.remove('winning');
  document.getElementById('mp-placar-b').classList.remove('winning');
  const badgeEu  = document.getElementById('mp-badge-eu');
  const badgeAdv = document.getElementById('mp-badge-adv');
  if (badgeEu)  { badgeEu.style.display  = 'none'; badgeEu.className  = 'mp-result-badge'; }
  if (badgeAdv) { badgeAdv.style.display = 'none'; badgeAdv.className = 'mp-result-badge'; }
  const btnComp = document.getElementById('mp-btn-compartilhar');
  if (btnComp) btnComp.style.display = 'none';
  _mpResultadoAnimado = false;

  if (sala.modo === '2v2') _renderConfronto2v2(sala);
  else                     _renderConfronto1v1(sala);

  navigate('pg-mp-confronto', 'forward', 'Confronto');
}

function _renderConfronto1v1(sala) {
  const meuTime  = MP.meuSlot === 'p1' ? sala.p1.time  : sala.p2.time;
  const advTime  = MP.meuSlot === 'p1' ? sala.p2.time  : sala.p1.time;
  const euNome   = MP.meuSlot === 'p1' ? sala.p1.nome  : sala.p2.nome;
  const advNome  = MP.meuSlot === 'p1' ? sala.p2.nome  : sala.p1.nome;

  document.getElementById('mp-confronto-title-eu').textContent  = euNome;
  document.getElementById('mp-confronto-title-adv').textContent = advNome;
  document.getElementById('mp-placar-nome-eu').textContent      = euNome;
  document.getElementById('mp-placar-nome-adv').textContent     = advNome;
  document.getElementById('mp-lista-time-eu').innerHTML         = _renderTimeMP(meuTime);
  document.getElementById('mp-lista-time-adv').innerHTML        = _renderTimeMP(advTime);
}

function _renderConfronto2v2(sala) {
  const isTeamA  = ['p1a', 'p2a'].includes(MP.meuSlot);
  const euNome   = `${sala.p1a.nome} + ${sala.p2a.nome}`;
  const advNome  = `${sala.p1b.nome} + ${sala.p2b.nome}`;

  document.getElementById('mp-confronto-title-eu').textContent  = isTeamA ? 'Time A' : 'Time B';
  document.getElementById('mp-confronto-title-adv').textContent = isTeamA ? 'Time B' : 'Time A';
  document.getElementById('mp-placar-nome-eu').textContent      = isTeamA ? euNome  : advNome;
  document.getElementById('mp-placar-nome-adv').textContent     = isTeamA ? advNome : euNome;

  const [eu1, eu2, adv1, adv2] = isTeamA
    ? [sala.p1a, sala.p2a, sala.p1b, sala.p2b]
    : [sala.p1b, sala.p2b, sala.p1a, sala.p2a];

  document.getElementById('mp-lista-time-eu').innerHTML = `
    <div class="mp-2v2-sub-header">${eu1.nome}</div>${_renderTimeMP(eu1.time)}
    <div class="mp-2v2-sub-header" style="margin-top:0.75rem">${eu2.nome}</div>${_renderTimeMP(eu2.time)}`;
  document.getElementById('mp-lista-time-adv').innerHTML = `
    <div class="mp-2v2-sub-header">${adv1.nome}</div>${_renderTimeMP(adv1.time)}
    <div class="mp-2v2-sub-header" style="margin-top:0.75rem">${adv2.nome}</div>${_renderTimeMP(adv2.time)}`;
}

function _renderTimeMP(time) {
  if (!time) return '<div style="opacity:.4;padding:0.5rem;font-size:13px">—</div>';
  return time.map(p => `
    <div class="jogador-row${p.destaque ? ' destaque' : ''}">
      <div class="jogador-emoji">${p.emoji}</div>
      <div class="jogador-info"><div class="jogador-nome">${p.nome}</div></div>
      ${p.destaque ? '<div class="destaque-badge">CRAQUE</div>' : ''}
    </div>`).join('');
}

// ─ Simular (host) ─
async function simularJogoMP() {
  document.getElementById('mp-btn-simular').disabled = true;

  const snap = await MP.salaRef.once('value');
  const sala = snap.val();

  let ponA = 0, ponB = 0;
  const rounds = [];

  if (sala.modo === '2v2') {
    const pares = [
      { a: sala.p1a, b: sala.p1b },
      { a: sala.p2a, b: sala.p2b },
    ];
    pares.forEach((par, pIdx) => {
      for (let i = 0; i < 7; i++) {
        const pa = par.a.time[i], pb = par.b.time[i];
        const fa = pa.poder * (0.65 + Math.random() * 0.7);
        const fb = pb.poder * (0.65 + Math.random() * 0.7);
        let cls;
        if (fa > fb)      { ponA++; cls = 'a'; }
        else if (fb > fa) { ponB++; cls = 'b'; }
        else               cls = 'd';
        rounds.push({
          cls, ponA, ponB,
          pa: { emoji: pa.emoji, nome: pa.nome },
          pb: { emoji: pb.emoji, nome: pb.nome },
          parIdx: pIdx,
          parLabel: `${par.a.nome} × ${par.b.nome}`,
        });
      }
    });
  } else {
    const meuTime = MP.meuSlot === 'p1' ? sala.p1.time : sala.p2.time;
    const advTime = MP.meuSlot === 'p1' ? sala.p2.time : sala.p1.time;
    for (let i = 0; i < 7; i++) {
      const pa = meuTime[i], pb = advTime[i];
      const fa = pa.poder * (0.65 + Math.random() * 0.7);
      const fb = pb.poder * (0.65 + Math.random() * 0.7);
      let cls;
      if (fa > fb)      { ponA++; cls = 'a'; }
      else if (fb > fa) { ponB++; cls = 'b'; }
      else               cls = 'd';
      rounds.push({ cls, ponA, ponB, pa: { emoji: pa.emoji, nome: pa.nome }, pb: { emoji: pb.emoji, nome: pb.nome } });
    }
  }

  await MP.salaRef.update({ resultado: { rounds }, status: 'fim' });
}

// ─ Animação de rounds ─
// ponA/ponB nos rounds são sempre do ponto de vista do host (p1 / Time A).
// _isEuTimeA() converte para a perspectiva de quem está assistindo.
function _isEuTimeA() {
  if (MP.modo === '2v2') return ['p1a', 'p2a'].includes(MP.meuSlot);
  return MP.meuSlot === 'p1';
}

async function _rodarAnimacaoRounds(rounds, sala) {
  const log     = document.getElementById('mp-rounds-log');
  const elA     = document.getElementById('mp-placar-a');
  const elB     = document.getElementById('mp-placar-b');
  const euTimeA = _isEuTimeA();
  let lastParIdx = -1;

  for (let i = 0; i < rounds.length; i++) {
    await delay(700);
    const r = rounds[i];

    // Do ponto de vista do jogador: "eu" = Time A se euTimeA, senão Time B
    const euCls  = euTimeA ? r.cls : (r.cls === 'a' ? 'b' : r.cls === 'b' ? 'a' : 'd');
    const euPon  = euTimeA ? r.ponA : r.ponB;
    const advPon = euTimeA ? r.ponB : r.ponA;
    const euChar = euTimeA ? r.pa : r.pb;
    const advChar= euTimeA ? r.pb : r.pa;

    if (sala?.modo === '2v2' && r.parIdx !== undefined && r.parIdx !== lastParIdx) {
      lastParIdx = r.parIdx;
      const sep = document.createElement('div');
      sep.className = 'mp-duelo-sep';
      sep.textContent = `⚔️ Duelo ${r.parIdx + 1}: ${r.parLabel}`;
      log.appendChild(sep);
      requestAnimationFrame(() => sep.classList.add('visible'));
      await delay(300);
    }

    let desc;
    if (euCls === 'a')      desc = `<strong>${euChar.emoji} ${euChar.nome}</strong> derrota ${advChar.emoji} ${advChar.nome}`;
    else if (euCls === 'b') desc = `<span class="win-b"><strong>${advChar.emoji} ${advChar.nome}</strong></span> derrota ${euChar.emoji} ${euChar.nome}`;
    else                    desc = `Empate entre ${euChar.emoji} ${euChar.nome} e ${advChar.emoji} ${advChar.nome}`;

    const el = document.createElement('div');
    el.className = 'round-entry';
    el.innerHTML = `
      <div class="round-bar ${euCls}"></div>
      <div class="round-num">Round ${i + 1}</div>
      <div class="round-desc">${desc}</div>
      <div class="round-result ${euCls}">${euPon} × ${advPon}</div>`;
    log.appendChild(el);
    requestAnimationFrame(() => {
      el.classList.add('visible');
      el.scrollIntoView({ behavior: 'smooth', block: 'end' });
    });

    if (String(euPon) !== elA.textContent) {
      elA.textContent = euPon;
      elA.classList.remove('score-bump'); void elA.offsetWidth; elA.classList.add('score-bump');
    }
    if (String(advPon) !== elB.textContent) {
      elB.textContent = advPon;
      elB.classList.remove('score-bump'); void elB.offsetWidth; elB.classList.add('score-bump');
    }
  }
}

async function _animarResultadoMP(resultado, sala) {
  await _rodarAnimacaoRounds(resultado.rounds, sala);
  await delay(600);
  const last    = resultado.rounds[resultado.rounds.length - 1];
  const euTimeA = _isEuTimeA();
  const euPon   = euTimeA ? last.ponA : last.ponB;
  const advPon  = euTimeA ? last.ponB : last.ponA;
  _mostrarBannerResultadoMP(euPon, advPon, sala);
}

function _mostrarBannerResultadoMP(ponA, ponB, sala) {
  // ponA = meu score, ponB = score do adversário (já convertido por _animarResultadoMP)
  const euNome     = document.getElementById('mp-placar-nome-eu').textContent;
  const advNome    = document.getElementById('mp-placar-nome-adv').textContent;
  const emoji      = document.getElementById('mp-resultado-emoji');
  const titulo     = document.getElementById('mp-resultado-titulo');
  const sub        = document.getElementById('mp-resultado-sub');
  const elA        = document.getElementById('mp-placar-a');
  const elB        = document.getElementById('mp-placar-b');
  const totalRounds = sala?.modo === '2v2' ? 14 : 7;
  const isPerfect   = ponA === totalRounds && ponB === 0;

  if (ponA > ponB) {
    emoji.textContent  = isPerfect ? '🏆' : '✅';
    titulo.textContent = isPerfect ? 'DOMINAÇÃO TOTAL!' : `Vitória! ${ponA} × ${ponB}`;
    sub.textContent    = isPerfect ? `${euNome} não cedeu nenhum round!` : `${euNome} venceu a batalha!`;
    elA.classList.add('winning');
  } else if (ponB > ponA) {
    emoji.textContent  = '💀';
    titulo.textContent = `Derrota. ${ponA} × ${ponB}`;
    sub.textContent    = 'O adversário foi mais forte! Revanche?';
    elB.classList.add('winning');
  } else {
    emoji.textContent  = '🤝';
    titulo.textContent = `Empate! ${ponA} × ${ponB}`;
    sub.textContent    = 'Forças equilibradas — caiu pra prorrogação!';
  }

  const badgeEu  = document.getElementById('mp-badge-eu');
  const badgeAdv = document.getElementById('mp-badge-adv');
  if (badgeEu && badgeAdv) {
    if (ponA > ponB) {
      badgeEu.textContent  = '🏆 VITÓRIA'; badgeEu.className  = 'mp-result-badge vitoria';
      badgeAdv.textContent = '💀 DERROTA'; badgeAdv.className = 'mp-result-badge derrota';
    } else if (ponB > ponA) {
      badgeEu.textContent  = '💀 DERROTA'; badgeEu.className  = 'mp-result-badge derrota';
      badgeAdv.textContent = '🏆 VITÓRIA'; badgeAdv.className = 'mp-result-badge vitoria';
    } else {
      badgeEu.textContent  = '🤝 EMPATE'; badgeEu.className  = 'mp-result-badge empate';
      badgeAdv.textContent = '🤝 EMPATE'; badgeAdv.className = 'mp-result-badge empate';
    }
    badgeEu.style.display  = 'inline-block';
    badgeAdv.style.display = 'inline-block';
  }

  const btnComp = document.getElementById('mp-btn-compartilhar');
  if (btnComp) btnComp.style.display = 'inline-block';

  window._mpUltimoResultado = { ponA, ponB, euNome, advNome, modo: sala?.modo || '1v1', totalRounds };
  _limparSessaoMP();

  const banner = document.getElementById('mp-resultado-banner');
  banner.classList.add('show');
  banner.scrollIntoView({ behavior: 'smooth', block: 'end' });

  if (typeof registrarPartida === 'function') {
    const result = ponA > ponB ? 'win' : ponB > ponA ? 'loss' : 'draw';
    registrarPartida({
      mode: 'multiplayer', result, scoreA: ponA, scoreB: ponB,
      opponentLabel: advNome, perfectWin: isPerfect, isMp: true,
      durationSec: typeof getDurationSec === 'function' ? getDurationSec() : 0,
    });
  }
}

// ─ Share Card ─
function compartilharResultadoMP() {
  const res = window._mpUltimoResultado;
  if (!res) return;

  const modal = document.getElementById('mp-share-modal');
  if (!modal) return;

  const { ponA, ponB, euNome, advNome, modo, totalRounds } = res;

  document.getElementById('sc-modo-tag').textContent  = modo === '2v2' ? '2V2' : '1V1';
  document.getElementById('sc-nome-eu').textContent   = euNome;
  document.getElementById('sc-nome-adv').textContent  = advNome;
  document.getElementById('sc-score-eu').textContent  = ponA;
  document.getElementById('sc-score-adv').textContent = ponB;

  const rEu  = document.getElementById('sc-result-eu');
  const rAdv = document.getElementById('sc-result-adv');
  if (ponA > ponB) {
    rEu.textContent  = '🏆 VITÓRIA'; rEu.className  = 'sc-result vitoria';
    rAdv.textContent = '💀 DERROTA'; rAdv.className = 'sc-result derrota';
  } else if (ponB > ponA) {
    rEu.textContent  = '💀 DERROTA'; rEu.className  = 'sc-result derrota';
    rAdv.textContent = '🏆 VITÓRIA'; rAdv.className = 'sc-result vitoria';
  } else {
    rEu.textContent  = '🤝 EMPATE'; rEu.className  = 'sc-result empate';
    rAdv.textContent = '🤝 EMPATE'; rAdv.className = 'sc-result empate';
  }

  document.getElementById('sc-rounds-info').textContent = `${totalRounds} rounds — ${ponA + ponB} decididos`;

  modal.style.display = 'flex';
  requestAnimationFrame(() => modal.classList.add('show'));
}

function fecharShareCard() {
  const modal = document.getElementById('mp-share-modal');
  if (!modal) return;
  modal.classList.remove('show');
  setTimeout(() => { modal.style.display = 'none'; }, 280);
}

function compartilharTextoMP() {
  const res = window._mpUltimoResultado;
  if (!res) return;
  const { ponA, ponB, euNome, advNome, modo } = res;

  let resultLine;
  if (ponA > ponB)      resultLine = `🏆 ${euNome} VENCEU! (${ponA} × ${ponB})`;
  else if (ponB > ponA) resultLine = `💀 ${euNome} perdeu para ${advNome} (${ponA} × ${ponB})`;
  else                  resultLine = `🤝 Empate! ${ponA} × ${ponB}`;

  const texto = `🎮 7 a 0 — Anime Version · ${modo.toUpperCase()}\n━━━━━━━━━━━━━━━━━━━━\n${resultLine}\n⭐ ${euNome}: ${ponA} pts\n⚔️ ${advNome}: ${ponB} pts\n━━━━━━━━━━━━━━━━━━━━`;

  if (navigator.share) {
    navigator.share({ title: '7 a 0 Anime Version', text: texto }).catch(() => {});
  } else {
    navigator.clipboard?.writeText(texto).then(() => {
      const btn = document.getElementById('sc-btn-share');
      if (!btn) return;
      const old = btn.textContent;
      btn.textContent = '✓ Copiado!';
      setTimeout(() => { btn.textContent = old; }, 2000);
    });
  }
}

// ─ Sair / resetar ─
async function sairDaSala() {
  if (MP.salaListener && MP.salaRef) MP.salaRef.off('value', MP.salaListener);

  try {
    if (MP.salaRef) {
      const snap = await MP.salaRef.once('value');
      if (snap.val()?.status === 'fim') await MP.salaRef.remove();
    }
  } catch (_) {}

  _limparSessaoMP();

  MP = { active: false, codigoSala: null, isHost: false, meuSlot: null, modo: '1v1', salaRef: null, salaListener: null };
  mpModo               = false;
  _mpResultadoAnimado  = false;
  window._mpUltimoResultado = null;
  selectedTeam         = [];
  currentSlotIdx       = null;
  chancesRestantes     = 3;
  posicoesPR           = [];
  posicaoSel           = null;
  formacaoPR           = '1-3-3';

  document.getElementById('sorteio-result').classList.remove('show');
  document.getElementById('btn-rolar').style.display       = '';
  document.getElementById('btn-swap-wrap').style.display   = 'none';
  document.getElementById('sorteio-chances').style.display = 'none';
  document.getElementById('slot-progress').style.display   = 'none';

  pageHistory = [];
  navigate('pg-home', 'back', '');
}
