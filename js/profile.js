// ══════════════════════════════════════════
// PERFIL — STATS, CONQUISTAS, HISTÓRICO
// ══════════════════════════════════════════

var _perfilCache      = null;
var _matchHistoryCache = [];
var _matchStartTime   = null;
var _perfilTabAtiva   = 'stats';
var _modoPartidaAtual = 'rapida';

const AVATARES = ['⚽','🏆','⚡','🔥','🌟','👑','💎','🦁','🐉','🦊','🌙','⚔️','🎯','🎮','🛡️','✨'];

const CONQUISTAS_DEF = [
  { id: 'primeira_vitoria', icon: '🏅', nome: 'Primeira Vitória',   desc: 'Vença sua primeira partida.',        check: s => s.wins >= 1 },
  { id: 'hat_trick',        icon: '🎩', nome: 'Hat Trick',          desc: 'Vença 3 partidas.',                  check: s => s.wins >= 3 },
  { id: 'veterano',         icon: '🎖️', nome: 'Veterano',           desc: 'Dispute 10 partidas.',               check: s => s.matchesPlayed >= 10 },
  { id: 'imparavel',        icon: '⚡', nome: 'Imparável',          desc: 'Vença 10 partidas no total.',        check: s => s.wins >= 10 },
  { id: 'goleador',         icon: '🎯', nome: 'Goleador',           desc: 'Marque 50 gols no total.',           check: s => s.goalsFor >= 50 },
  { id: 'sete_a_zero',      icon: '💥', nome: '7 a 0!',             desc: 'Faça um placar perfeito de 7 a 0.',  check: s => s.perfectWins >= 1 },
  { id: 'invicto',          icon: '🛡️', nome: 'Invicto',            desc: 'Vença 5 partidas seguidas.',         check: s => s.bestStreak >= 5 },
  { id: 'campeao_online',   icon: '🎮', nome: 'Campeão Online',     desc: 'Vença uma partida multiplayer.',     check: s => s.mpWins >= 1 },
  { id: 'lendario',         icon: '👑', nome: 'Lendário',           desc: 'Vença 25 partidas no total.',        check: s => s.wins >= 25 },
];

const _STATS_DEFAULT = {
  wins: 0, losses: 0, draws: 0,
  goalsFor: 0, goalsAgainst: 0, matchesPlayed: 0,
  perfectWins: 0, mpWins: 0,
  currentStreak: 0, bestStreak: 0,
  playTimeSeconds: 0, conquistas: [],
};

// ─ Inicializar perfil novo no Firebase ─
async function _initPerfil(uid, nickname, email) {
  const db = _getDb();
  const emailKey = email.replace(/\./g, ',');
  await db.ref('users/' + uid).set({
    nickname, email, teamName: 'Meu Time', avatar: '⚽',
    stats: Object.assign({}, _STATS_DEFAULT), createdAt: Date.now(),
  });
  await db.ref('emailIndex/' + emailKey).set({ uid, nickname, avatar: '⚽' });
}

// ─ Carregar perfil e histórico ─
async function _carregarPerfilFirebase(uid) {
  const db = _getDb();
  const [snapP, snapM] = await Promise.all([
    db.ref('users/' + uid).once('value'),
    db.ref('matches/' + uid).limitToLast(20).once('value'),
  ]);
  _perfilCache       = snapP.val() || {};
  _matchHistoryCache = [];
  snapM.forEach(function(c) { _matchHistoryCache.unshift(c.val()); });
  _atualizarBotaoPerfil();
}

// ─ Render principal do perfil ─
function renderPerfil() {
  if (!_currentUser || !_perfilCache) return;
  const p = _perfilCache;
  const s = p.stats || _STATS_DEFAULT;

  document.getElementById('perfil-avatar').textContent         = p.avatar  || '⚽';
  document.getElementById('perfil-nickname').textContent        = p.nickname || 'Jogador';
  document.getElementById('perfil-teamname').textContent        = p.teamName || 'Meu Time';
  document.getElementById('perfil-email-display').textContent   = _currentUser.email;

  const total = s.matchesPlayed || 0;
  document.getElementById('stat-wins').textContent     = s.wins     || 0;
  document.getElementById('stat-losses').textContent   = s.losses   || 0;
  document.getElementById('stat-draws').textContent    = s.draws    || 0;
  document.getElementById('stat-goals-f').textContent  = s.goalsFor || 0;
  document.getElementById('stat-goals-a').textContent  = s.goalsAgainst || 0;
  document.getElementById('stat-matches').textContent  = total;
  document.getElementById('stat-winrate').textContent  = total > 0 ? Math.round(((s.wins||0)/total)*100) + '%' : '—';
  document.getElementById('stat-streak').textContent   = s.bestStreak  || 0;
  document.getElementById('stat-perfect').textContent  = s.perfectWins || 0;
  document.getElementById('stat-playtime').textContent = _formatTime(s.playTimeSeconds || 0);

  _renderConquistas(s);
  _renderHistorico();
  mudarTabPerfil('stats');
}

function mudarTabPerfil(tab) {
  _perfilTabAtiva = tab;
  ['stats', 'conquistas', 'historico'].forEach(function(t) {
    document.getElementById('ptab-btn-' + t).classList.toggle('active', t === tab);
    document.getElementById('ptab-' + t).style.display = t === tab ? 'block' : 'none';
  });
}

function _formatTime(sec) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return h > 0 ? h + 'h ' + m + 'm' : m + 'm';
}

function _renderConquistas(s) {
  document.getElementById('conquistas-grid').innerHTML = CONQUISTAS_DEF.map(function(c) {
    const ok = (s.conquistas || []).includes(c.id);
    return '<div class="conquista-card' + (ok ? ' desbloqueada' : ' bloqueada') + '">' +
      '<div class="conquista-icon">' + (ok ? c.icon : '🔒') + '</div>' +
      '<div class="conquista-nome">' + c.nome + '</div>' +
      '<div class="conquista-desc">' + (ok ? c.desc : '???') + '</div>' +
    '</div>';
  }).join('');
}

function _renderHistorico() {
  const wrap = document.getElementById('historico-lista');
  if (!_matchHistoryCache.length) {
    wrap.innerHTML = '<div class="historico-vazio">Nenhuma partida registrada ainda.<br>Jogue uma partida!</div>';
    return;
  }
  const MODES = { rapida: 'Partida Rápida', torneio: 'Torneio', multiplayer: 'Multiplayer', montar: 'Montar Time' };
  wrap.innerHTML = _matchHistoryCache.map(function(m) {
    const cls   = m.result === 'win' ? 'win' : m.result === 'loss' ? 'loss' : 'draw';
    const icon  = m.result === 'win' ? '✅' : m.result === 'loss' ? '💀' : '🤝';
    const label = m.result === 'win' ? 'Vitória' : m.result === 'loss' ? 'Derrota' : 'Empate';
    const date  = new Date(m.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
    return '<div class="historico-card ' + cls + '">' +
      '<div class="hist-result-icon">' + icon + '</div>' +
      '<div class="hist-info">' +
        '<div class="hist-label ' + cls + '">' + label + '</div>' +
        '<div class="hist-mode">' + (MODES[m.mode] || m.mode) + '</div>' +
        '<div class="hist-opp">vs ' + (m.opponentLabel || 'CPU') + '</div>' +
      '</div>' +
      '<div class="hist-placar">' + m.scoreA + ' × ' + m.scoreB + '</div>' +
      '<div class="hist-date">' + date + '</div>' +
    '</div>';
  }).join('');
}

// ─ Registrar resultado de partida ─
async function registrarPartida(opts) {
  if (!_currentUser) return;
  const uid = _currentUser.uid;
  const db  = _getDb();

  const matchData = {
    mode: opts.mode, result: opts.result,
    scoreA: opts.scoreA, scoreB: opts.scoreB,
    opponentLabel: opts.opponentLabel || 'CPU',
    date: Date.now(), durationSec: opts.durationSec || 0,
  };

  _matchHistoryCache.unshift(matchData);
  if (_matchHistoryCache.length > 20) _matchHistoryCache.pop();
  await db.ref('matches/' + uid).push(matchData);

  const statsRef = db.ref('users/' + uid + '/stats');
  const snap     = await statsRef.once('value');
  const s        = snap.val() || Object.assign({}, _STATS_DEFAULT);

  s.matchesPlayed   = (s.matchesPlayed  || 0) + 1;
  s.goalsFor        = (s.goalsFor       || 0) + opts.scoreA;
  s.goalsAgainst    = (s.goalsAgainst   || 0) + opts.scoreB;
  s.playTimeSeconds = (s.playTimeSeconds|| 0) + (opts.durationSec || 0);

  if (opts.result === 'win') {
    s.wins          = (s.wins         || 0) + 1;
    s.currentStreak = (s.currentStreak|| 0) + 1;
    if (s.currentStreak > (s.bestStreak || 0)) s.bestStreak = s.currentStreak;
    if (opts.perfectWin) s.perfectWins = (s.perfectWins || 0) + 1;
    if (opts.isMp)       s.mpWins      = (s.mpWins      || 0) + 1;
  } else {
    if (opts.result === 'loss') s.losses = (s.losses || 0) + 1;
    else                        s.draws  = (s.draws  || 0) + 1;
    s.currentStreak = 0;
  }

  const novas = CONQUISTAS_DEF.filter(function(c) {
    return !(s.conquistas || []).includes(c.id) && c.check(s);
  }).map(function(c) { return c.id; });

  if (novas.length) {
    s.conquistas = (s.conquistas || []).concat(novas);
    novas.forEach(function(id) {
      const c = CONQUISTAS_DEF.find(function(x) { return x.id === id; });
      if (c) _mostrarToastConquista(c);
    });
  }

  await statsRef.set(s);
  if (_perfilCache) _perfilCache.stats = s;
}

function _mostrarToastConquista(c) {
  const el = document.createElement('div');
  el.className = 'conquista-toast';
  el.innerHTML = '<div class="ct-icon">' + c.icon + '</div>' +
    '<div><div class="ct-titulo">Conquista desbloqueada!</div>' +
    '<div class="ct-nome">' + c.nome + '</div></div>';
  document.body.appendChild(el);
  requestAnimationFrame(function() { el.classList.add('show'); });
  setTimeout(function() {
    el.classList.remove('show');
    setTimeout(function() { el.remove(); }, 500);
  }, 3500);
}

// ─ Timer de partida ─
function iniciarTimerPartida() { _matchStartTime = Date.now(); }
function getDurationSec() {
  return _matchStartTime ? Math.round((Date.now() - _matchStartTime) / 1000) : 0;
}

// ─ Editar perfil ─
function abrirEditarPerfil() {
  if (!_perfilCache) return;
  document.getElementById('edit-nickname').value = _perfilCache.nickname || '';
  document.getElementById('edit-teamname').value = _perfilCache.teamName || '';
  _renderAvatarPicker(_perfilCache.avatar || '⚽');
  document.getElementById('edit-perfil-overlay').classList.add('show');
}

function fecharEditarPerfil() {
  document.getElementById('edit-perfil-overlay').classList.remove('show');
}

function _renderAvatarPicker(atual) {
  document.getElementById('avatar-picker-grid').innerHTML = AVATARES.map(function(a) {
    return '<button class="avatar-opt' + (a === atual ? ' selected' : '') + '" onclick="_selecionarAvatar(\'' + a + '\', this)">' + a + '</button>';
  }).join('');
}

function _selecionarAvatar(emoji, btn) {
  document.querySelectorAll('.avatar-opt').forEach(function(b) { b.classList.remove('selected'); });
  btn.classList.add('selected');
}

async function salvarPerfil() {
  if (!_currentUser) return;
  const nickname = document.getElementById('edit-nickname').value.trim();
  const teamName = document.getElementById('edit-teamname').value.trim();
  const avatar   = (document.querySelector('.avatar-opt.selected') || {}).textContent || '⚽';
  if (!nickname) { alert('Digite seu apelido.'); return; }

  const db = _getDb(), uid = _currentUser.uid;
  const emailKey = _currentUser.email.replace(/\./g, ',');
  await db.ref('users/' + uid).update({ nickname, teamName, avatar });
  await db.ref('emailIndex/' + emailKey).update({ nickname, avatar });

  if (_perfilCache) {
    _perfilCache.nickname = nickname;
    _perfilCache.teamName = teamName;
    _perfilCache.avatar   = avatar;
  }
  fecharEditarPerfil();
  renderPerfil();
  _atualizarBotaoPerfil();
}
