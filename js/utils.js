// ══════════════════════════════════════════
// UTILITÁRIOS — NAVEGAÇÃO E HELPERS
// ══════════════════════════════════════════

// ── CURSOR CUSTOMIZADO (apenas em dispositivos com mouse) ──
(function initCursor() {
  if (window.matchMedia('(pointer: coarse)').matches) return;
  const dot  = document.createElement('div');
  const ring = document.createElement('div');
  dot.className  = 'cursor-dot';
  ring.className = 'cursor-ring';
  document.body.appendChild(dot);
  document.body.appendChild(ring);

  let mx = -200, my = -200;
  let rx = -200, ry = -200;
  let rafId = null;

  document.addEventListener('mousemove', e => {
    mx = e.clientX;
    my = e.clientY;
    // Dot segue o mouse instantaneamente via transform (GPU, sem layout recalc)
    dot.style.transform = `translate3d(${mx}px,${my}px,0)`;
  }, { passive: true });

  // Anel: lerp mais rápido (0.18) também via transform
  (function loop() {
    rx += (mx - rx) * 0.18;
    ry += (my - ry) * 0.18;
    ring.style.transform = `translate3d(${rx}px,${ry}px,0)`;
    rafId = requestAnimationFrame(loop);
  })();

  document.addEventListener('mousedown', () => {
    dot.classList.add('is-click');
    ring.classList.add('is-click');
  });
  document.addEventListener('mouseup', () => {
    dot.classList.remove('is-click');
    ring.classList.remove('is-click');
  });

  document.addEventListener('mouseleave', () => {
    dot.classList.add('is-out');
    ring.classList.add('is-out');
  });
  document.addEventListener('mouseenter', () => {
    dot.classList.remove('is-out');
    ring.classList.remove('is-out');
  });

  const HOVER_SEL = 'button, a, [onclick], .mode-card, .char-option, .mf-pos, .mf-form-btn, .bracket-match, .grupo-card';
  document.addEventListener('mouseover', e => {
    if (e.target.closest(HOVER_SEL)) {
      dot.classList.add('is-hover');
      ring.classList.add('is-hover');
    }
  });
  document.addEventListener('mouseout', e => {
    if (e.target.closest(HOVER_SEL)) {
      dot.classList.remove('is-hover');
      ring.classList.remove('is-hover');
    }
  });
})();

// ── TEMA ──
(function initTheme() {
  const saved = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  localStorage.setItem('theme', saved);
  document.addEventListener('DOMContentLoaded', () => _syncThemeBtn(saved));
})();

function _syncThemeBtn(theme) {
  const btn = document.getElementById('btn-theme');
  if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  _syncThemeBtn(next);
}

let pageHistory = [];

const PAGE_TITLES = {
  'pg-home':          '',
  'pg-montar-time':   'Montar Time',
  'pg-pr-formacao':   'Partida Rápida',
  'pg-sorteio':       'Partida Rápida',
  'pg-escolha':       'Escolha o Craque',
  'pg-formacao':      'Formação',
  'pg-confronto':     'Confronto',
  'pg-mp-lobby':      'Multiplayer',
  'pg-mp-sala':       'Sala',
  'pg-mp-confronto':  'Confronto',
  'pg-simulacao':     'Simulação',
  'pg-t-setup':       'Torneio',
  'pg-t-grupos':      'Fase de Grupos',
  'pg-t-knockout':    'Mata-Mata',
  'pg-t-campeao':     'Campeão',
};

function navigate(toId, direction = 'forward', title) {
  const from = document.querySelector('.app-page.active');
  const to   = document.getElementById(toId);
  if (!to || to === from) return;

  if (from && from.id === 'pg-chat' && typeof fecharChatListener === 'function') fecharChatListener();

  if (from) {
    pageHistory.push(from.id);
    // Mantém visível durante animação de saída
    from.classList.add('page-exiting', `page-exit-${direction}`);
    from.classList.remove('active');
    setTimeout(() => {
      from.classList.remove('page-exiting', `page-exit-${direction}`);
    }, 380);
  }

  to.classList.add('active', `page-enter-${direction}`);
  setTimeout(() => to.classList.remove(`page-enter-${direction}`), 380);

  window.scrollTo({ top: 0, behavior: 'instant' });
  _updateHeader(toId, title);
}

function goBack() {
  const prevId = pageHistory.length > 0 ? pageHistory.pop() : 'pg-home';

  const from = document.querySelector('.app-page.active');
  const to   = document.getElementById(prevId);
  if (!to || to === from) return;

  if (from) {
    from.classList.add('page-exiting', 'page-exit-back');
    from.classList.remove('active');
    setTimeout(() => {
      from.classList.remove('page-exiting', 'page-exit-back');
    }, 380);
  }

  to.classList.add('active', 'page-enter-back');
  setTimeout(() => to.classList.remove('page-enter-back'), 380);

  window.scrollTo({ top: 0, behavior: 'instant' });
  _updateHeader(prevId);
}

const GAME_PAGES = new Set([
  'pg-pr-formacao', 'pg-sorteio', 'pg-escolha', 'pg-formacao',
  'pg-confronto', 'pg-simulacao', 'pg-montar-time',
  'pg-mp-lobby', 'pg-mp-sala', 'pg-mp-confronto',
  'pg-t-setup', 'pg-t-grupos', 'pg-t-knockout', 'pg-t-campeao',
]);

function _updateHeader(pageId, customTitle) {
  const title = customTitle !== undefined ? customTitle : (PAGE_TITLES[pageId] || '');
  document.getElementById('header-page-title').textContent = title;
  const notHome = pageId !== 'pg-home';
  const isGame  = GAME_PAGES.has(pageId);
  document.getElementById('btn-back').style.display = (notHome && !isGame) ? 'flex' : 'none';
  document.getElementById('btn-home').style.display = notHome ? 'flex' : 'none';
  const mobileBar = document.getElementById('mobile-home-bar');
  if (mobileBar) mobileBar.style.display = (notHome && isGame) ? 'flex' : 'none';
}

function delay(ms) {
  return new Promise(res => setTimeout(res, ms));
}

// ── 3D Tilt em mode-cards ──
(function initTilt() {
  if (window.matchMedia('(pointer: coarse)').matches) return;

  document.addEventListener('mousemove', e => {
    const card = e.target.closest('.mode-card');
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const cx   = rect.left + rect.width / 2;
    const cy   = rect.top  + rect.height / 2;
    const dx   = (e.clientX - cx) / (rect.width  / 2);
    const dy   = (e.clientY - cy) / (rect.height / 2);
    card.style.transform = `perspective(700px) rotateY(${dx * 8}deg) rotateX(${-dy * 8}deg) translateY(-8px)`;
  });

  document.addEventListener('mouseleave', e => {
    const card = e.target.closest && e.target.closest('.mode-card');
    if (card) card.style.transform = '';
  }, true);

  document.addEventListener('mouseover', e => {
    if (!e.target.closest('.mode-card')) {
      document.querySelectorAll('.mode-card').forEach(c => {
        if (!c.matches(':hover')) c.style.transform = '';
      });
    }
  });
})();

// ── Ripple em botões ──
(function initRipple() {
  document.addEventListener('click', e => {
    const btn = e.target.closest('.btn');
    if (!btn) return;
    const r    = btn.getBoundingClientRect();
    const span = document.createElement('span');
    span.className = 'btn-ripple';
    span.style.cssText = `left:${e.clientX - r.left}px;top:${e.clientY - r.top}px`;
    btn.appendChild(span);
    setTimeout(() => span.remove(), 600);
  });
})();
