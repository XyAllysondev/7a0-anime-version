// ══════════════════════════════════════════
// AUTH — FIREBASE AUTHENTICATION
// ══════════════════════════════════════════

var _auth = null;
var _currentUser = null;

function _getAuth() {
  if (_auth) return _auth;
  _getDb(); // garante que o firebase está inicializado
  _auth = firebase.auth();
  return _auth;
}

function getCurrentUser() { return _currentUser; }

function initAuth() {
  _getAuth().onAuthStateChanged(async function(user) {
    _currentUser = user;
    _atualizarBotaoPerfil();
    if (user) {
      await _carregarPerfilFirebase(user.uid);
    }
  });
}

function _atualizarBotaoPerfil() {
  const btn = document.getElementById('btn-perfil-header');
  if (!btn) return;
  btn.classList.toggle('auth-logado', !!_currentUser);
  btn.title = _currentUser ? 'Meu Perfil' : 'Entrar / Criar conta';
  if (_currentUser) {
    const avatar = _perfilCache?.avatar || '👤';
    btn.textContent = avatar;
  } else {
    btn.textContent = '👤';
  }
}

// ─ Abrir auth ou perfil ─
function abrirAuthOuPerfil() {
  if (_currentUser) {
    renderPerfil();
    navigate('pg-perfil', 'forward', 'Perfil');
  } else {
    document.getElementById('auth-overlay').classList.add('show');
    mostrarAuthTab('login');
  }
}

function fecharAuth() {
  document.getElementById('auth-overlay').classList.remove('show');
  document.getElementById('auth-erro').textContent = '';
}

function mostrarAuthTab(tab) {
  ['login', 'register'].forEach(function(t) {
    document.getElementById('auth-tab-' + t).classList.toggle('active', t === tab);
    document.getElementById('auth-form-' + t).style.display = t === tab ? 'flex' : 'none';
  });
  document.getElementById('auth-erro').textContent = '';
}

// ─ Login ─
async function fazerLogin() {
  const email = document.getElementById('auth-email').value.trim();
  const senha  = document.getElementById('auth-senha').value;
  const erro   = document.getElementById('auth-erro');
  if (!email || !senha) { erro.textContent = 'Preencha e-mail e senha.'; return; }
  const btn = document.getElementById('auth-btn-login');
  btn.disabled = true; btn.textContent = 'Entrando…'; erro.textContent = '';
  try {
    await _getAuth().signInWithEmailAndPassword(email, senha);
    fecharAuth();
  } catch(e) { erro.textContent = _traduzirErroAuth(e.code); }
  finally    { btn.disabled = false; btn.textContent = 'Entrar'; }
}

function authEnterKeyLogin(e) { if (e.key === 'Enter') fazerLogin(); }
function authEnterKeyReg(e)   { if (e.key === 'Enter') fazerCadastro(); }

// ─ Cadastro ─
async function fazerCadastro() {
  const email    = document.getElementById('auth-email-reg').value.trim();
  const senha    = document.getElementById('auth-senha-reg').value;
  const nickname = document.getElementById('auth-nickname').value.trim();
  const erro     = document.getElementById('auth-erro');
  if (!email || !senha || !nickname) { erro.textContent = 'Preencha todos os campos.'; return; }
  if (nickname.length < 2 || nickname.length > 20) { erro.textContent = 'Apelido: 2 a 20 caracteres.'; return; }
  if (senha.length < 6) { erro.textContent = 'Senha: mínimo 6 caracteres.'; return; }
  const btn = document.getElementById('auth-btn-register');
  btn.disabled = true; btn.textContent = 'Criando…'; erro.textContent = '';
  try {
    const cred = await _getAuth().createUserWithEmailAndPassword(email, senha);
    await _initPerfil(cred.user.uid, nickname, email);
    fecharAuth();
  } catch(e) { erro.textContent = _traduzirErroAuth(e.code); }
  finally    { btn.disabled = false; btn.textContent = 'Criar Conta'; }
}

// ─ Logout ─
async function fazerLogout() {
  await _getAuth().signOut();
  _currentUser      = null;
  _perfilCache      = null;
  _matchHistoryCache = [];
  pageHistory = [];
  navigate('pg-home', 'back', '');
}

function _traduzirErroAuth(code) {
  return ({
    'auth/user-not-found':          'Nenhuma conta com esse e-mail.',
    'auth/wrong-password':          'Senha incorreta.',
    'auth/invalid-credential':      'E-mail ou senha incorretos.',
    'auth/email-already-in-use':    'E-mail já cadastrado.',
    'auth/invalid-email':           'E-mail inválido.',
    'auth/weak-password':           'Senha fraca (mínimo 6 caracteres).',
    'auth/too-many-requests':       'Muitas tentativas. Aguarde.',
    'auth/network-request-failed':  'Sem conexão. Verifique sua internet.',
  })[code] || 'Erro ao autenticar. Tente novamente.';
}
