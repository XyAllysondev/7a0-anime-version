// ══════════════════════════════════════════
// SOCIAL — AMIGOS + CHAT
// ══════════════════════════════════════════

var _amigosCache     = {};
var _chatListenerRef = null;
var _chatAmigoUid    = null;
var _chatAmigoNick   = null;

// ─ Abrir página de amigos ─
async function abrirAmigos() {
  if (!_currentUser) {
    document.getElementById('auth-overlay').classList.add('show');
    mostrarAuthTab('login');
    return;
  }
  navigate('pg-amigos', 'forward', 'Amigos');
  await _carregarAmigos();
}

async function _carregarAmigos() {
  const db  = _getDb(), uid = _currentUser.uid;
  const snap = await db.ref('friends/' + uid).once('value');
  _amigosCache = snap.val() || {};
  _renderAmigos();
}

function _renderAmigos() {
  const pendentes = [], aceitos = [];
  Object.entries(_amigosCache).forEach(function([fuid, f]) {
    if (f.status === 'aceito')                               aceitos.push([fuid, f]);
    else if (f.status === 'pending' && f.tipo === 'recebido') pendentes.push([fuid, f]);
  });

  // Pedidos recebidos
  const pendWrap = document.getElementById('amigos-pendentes');
  pendWrap.innerHTML = pendentes.length
    ? pendentes.map(function([fuid, f]) {
        return '<div class="amigo-card pendente">' +
          '<div class="amigo-avatar">' + (f.avatar || '⚽') + '</div>' +
          '<div class="amigo-info"><div class="amigo-nick">' + _esc(f.nickname) + '</div>' +
          '<div class="amigo-email">' + _esc(f.email) + '</div></div>' +
          '<div class="amigo-acoes">' +
            '<button class="btn-amigo aceitar" onclick="responderAmizade(\'' + fuid + '\',true)">✅ Aceitar</button>' +
            '<button class="btn-amigo recusar" onclick="responderAmizade(\'' + fuid + '\',false)">❌ Recusar</button>' +
          '</div></div>';
      }).join('')
    : '';

  document.getElementById('amigos-pendentes-titulo').style.display = pendentes.length ? 'block' : 'none';

  // Lista de amigos
  const listWrap = document.getElementById('amigos-lista');
  listWrap.innerHTML = aceitos.length
    ? aceitos.map(function([fuid, f]) {
        return '<div class="amigo-card">' +
          '<div class="amigo-avatar">' + (f.avatar || '⚽') + '</div>' +
          '<div class="amigo-info"><div class="amigo-nick">' + _esc(f.nickname) + '</div>' +
          '<div class="amigo-email">' + _esc(f.email) + '</div></div>' +
          '<div class="amigo-acoes">' +
            '<button class="btn-amigo chat" onclick="abrirChat(\'' + fuid + '\',\'' + _esc(f.nickname) + '\')">💬 Chat</button>' +
            '<button class="btn-amigo remover" onclick="removerAmigo(\'' + fuid + '\')">🗑️</button>' +
          '</div></div>';
      }).join('')
    : '<div class="amigos-vazio">Nenhum amigo ainda. Adicione pelo e-mail!</div>';
}

// ─ Adicionar amigo por e-mail ─
async function adicionarAmigo() {
  if (!_currentUser) return;
  const emailInput = document.getElementById('add-amigo-email');
  const email      = emailInput.value.trim().toLowerCase();
  const erroEl     = document.getElementById('add-amigo-erro');
  erroEl.textContent = '';
  if (!email) { erroEl.textContent = 'Digite o e-mail.'; return; }
  if (email === _currentUser.email.toLowerCase()) { erroEl.textContent = 'Você não pode adicionar a si mesmo.'; return; }

  const emailKey = email.replace(/\./g, ',');
  const db = _getDb();
  const snap = await db.ref('emailIndex/' + emailKey).once('value');
  if (!snap.exists()) { erroEl.textContent = 'Nenhuma conta com esse e-mail.'; return; }

  const alvo = snap.val();
  const fuid  = alvo.uid;

  const jaAmigo = await db.ref('friends/' + _currentUser.uid + '/' + fuid).once('value');
  if (jaAmigo.exists()) { erroEl.textContent = 'Pedido já enviado ou já são amigos.'; return; }

  const mySnap = await db.ref('users/' + _currentUser.uid).once('value');
  const myData  = mySnap.val() || {};

  await db.ref('friends/' + _currentUser.uid + '/' + fuid).set({
    status: 'pending', tipo: 'enviado',
    nickname: alvo.nickname || email, email, avatar: alvo.avatar || '⚽',
  });
  await db.ref('friends/' + fuid + '/' + _currentUser.uid).set({
    status: 'pending', tipo: 'recebido',
    nickname: myData.nickname || _currentUser.email, email: _currentUser.email, avatar: myData.avatar || '⚽',
  });

  emailInput.value = '';
  erroEl.style.color = 'var(--gold)';
  erroEl.textContent  = 'Pedido enviado para ' + email + '!';
  setTimeout(function() { erroEl.textContent = ''; erroEl.style.color = ''; }, 3000);
  await _carregarAmigos();
}

async function responderAmizade(fuid, aceitar) {
  const db  = _getDb(), uid = _currentUser.uid;
  if (aceitar) {
    await db.ref('friends/' + uid + '/' + fuid + '/status').set('aceito');
    await db.ref('friends/' + fuid + '/' + uid + '/status').set('aceito');
    _amigosCache[fuid].status = 'aceito';
  } else {
    await db.ref('friends/' + uid + '/' + fuid).remove();
    await db.ref('friends/' + fuid + '/' + uid).remove();
    delete _amigosCache[fuid];
  }
  _renderAmigos();
}

async function removerAmigo(fuid) {
  if (!confirm('Remover este amigo?')) return;
  const db = _getDb(), uid = _currentUser.uid;
  await db.ref('friends/' + uid + '/' + fuid).remove();
  await db.ref('friends/' + fuid + '/' + uid).remove();
  delete _amigosCache[fuid];
  _renderAmigos();
}

// ─ Chat ─
function _chatRoomId(uid1, uid2) {
  return uid1 < uid2 ? uid1 + '_' + uid2 : uid2 + '_' + uid1;
}

function abrirChat(fuid, fnick) {
  if (!_currentUser) return;
  _chatAmigoUid  = fuid;
  _chatAmigoNick = fnick;
  document.getElementById('chat-titulo').textContent = '💬 ' + fnick;
  document.getElementById('chat-msgs').innerHTML = '';
  navigate('pg-chat', 'forward', 'Chat');

  if (_chatListenerRef) { _chatListenerRef.off(); _chatListenerRef = null; }
  const roomId = _chatRoomId(_currentUser.uid, fuid);
  const ref    = _getDb().ref('chats/' + roomId).limitToLast(60);
  _chatListenerRef = ref;
  ref.on('child_added', function(snap) { _appendChatMsg(snap.val()); });
}

function fecharChatListener() {
  if (_chatListenerRef) { _chatListenerRef.off(); _chatListenerRef = null; }
}

function _appendChatMsg(m) {
  const wrap = document.getElementById('chat-msgs');
  const isMy = m.from === _currentUser.uid;
  const div  = document.createElement('div');
  div.className = 'chat-msg ' + (isMy ? 'minha' : 'amigo');
  const hora = new Date(m.ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  div.innerHTML = '<div class="chat-bubble">' + _esc(m.text) + '<span class="chat-hora">' + hora + '</span></div>';
  wrap.appendChild(div);
  wrap.scrollTop = wrap.scrollHeight;
}

async function enviarMensagem() {
  if (!_currentUser || !_chatAmigoUid) return;
  const input = document.getElementById('chat-input');
  const text  = input.value.trim();
  if (!text) return;
  if (text.length > 400) { return; }
  input.value = '';
  const roomId = _chatRoomId(_currentUser.uid, _chatAmigoUid);
  await _getDb().ref('chats/' + roomId).push({ from: _currentUser.uid, text, ts: Date.now() });
}

function chatEnterKey(e) { if (e.key === 'Enter') enviarMensagem(); }

function _esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
