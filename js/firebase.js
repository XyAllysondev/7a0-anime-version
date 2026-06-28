// ══════════════════════════════════════════
// FIREBASE — CONFIGURAÇÃO
// ══════════════════════════════════════════
//
// COMO CONFIGURAR:
//  1. Acesse https://console.firebase.google.com
//  2. Crie um projeto → Realtime Database → Criar banco → Modo de teste
//  3. ⚙️ Configurações do projeto → Seus apps → </> Web → copie os valores abaixo
//
const FIREBASE_CONFIG = {
  apiKey:            'AIzaSyB6AGmPq-VuOSVRJlSyL7DlVNkerI76CFc',
  authDomain:        'a-0-anime-version.firebaseapp.com',
  databaseURL:       'https://a-0-anime-version-default-rtdb.firebaseio.com',
  projectId:         'a-0-anime-version',
  storageBucket:     'a-0-anime-version.firebasestorage.app',
  messagingSenderId: '1022950808584',
  appId:             '1:1022950808584:web:a85611ab592c80e78705bd',
};

// ── Instância única do banco ──
let _fbDb = null;

function _getDb() {
  if (_fbDb) return _fbDb;

  if (FIREBASE_CONFIG.apiKey === 'COLOQUE_SUA_API_KEY') {
    throw new Error(
      'Firebase não configurado.\nAbra js/firebase.js e preencha FIREBASE_CONFIG com os dados do seu projeto.'
    );
  }

  if (!firebase.apps.length) {
    firebase.initializeApp(FIREBASE_CONFIG);
  }

  _fbDb = firebase.database();
  return _fbDb;
}
