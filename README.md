# ⚽ 7 a 0 — Anime Version

Jogo de futebol estratégico com personagens de anime, jogável diretamente no navegador. Monte um time com 7 craques, escolha a formação e acompanhe a simulação rodada por rodada em tempo real.

🔗 **[Jogar agora](https://a-0-anime-version.web.app)**

---

## Modos de Jogo

| Modo | Descrição |
|------|-----------|
| ⚡ Partida Rápida | Sorteio ou montagem manual do time, confronto imediato contra a CPU |
| 🆚 Multiplayer 1v1 | Crie ou entre em uma sala e dispute com um amigo em tempo real |
| 👥 Multiplayer 2v2 | 4 jogadores, 2 por time — 14 rodadas de duelo simultâneo |
| 🏆 Torneio | Fase de grupos + mata-mata com até 8 times personalizados |

---

## Estrutura do Projeto

```
7 a 0 Anime Version/
│
├── index.html                  # Página principal (entrada do app)
├── 7 a 0 - Anime Versão.html   # Versão alternativa (mantida em sincronia)
├── 404.html                    # Página de erro para rotas não encontradas
│
├── css/
│   └── style.css               # Todo o visual do jogo — tema dark/light, animações,
│                               # cursor customizado, cards, telas de confronto e share
│
├── js/
│   ├── firebase.js             # Inicialização e configuração do Firebase
│   ├── utils.js                # Cursor customizado, navegação entre telas,
│   │                           # tilt 3D nos cards, ripple nos botões e tema dark/light
│   ├── database.js             # Personagens, poderes, formações e lógica de seleção
│   │                           # de time (mais de 1400 linhas — coração do jogo)
│   ├── partida.js              # Simulação de partida solo: rounds, animações,
│   │                           # resultado e placar final
│   ├── multiplayer.js          # Salas em tempo real (Firebase), modos 1v1 e 2v2,
│   │                           # sincronização de times, simulação e card de resultado
│   ├── torneio.js              # Criação de torneio, sorteio de grupos,
│   │                           # mata-mata e tela de campeão
│   ├── auth.js                 # Autenticação de usuários (login/registro)
│   ├── profile.js              # Perfil do jogador e histórico de partidas
│   └── social.js               # Funcionalidades sociais (amigos, chat)
│
├── firebase.json               # Configuração de deploy do Firebase Hosting
├── .firebaserc                 # Projeto Firebase vinculado
└── .gitignore                  # Arquivos ignorados pelo Git
```

---

## Tecnologias

- **Frontend:** HTML5, CSS3 e JavaScript puro (sem frameworks)
- **Banco de dados:** Firebase Realtime Database — sincronização de salas multiplayer em tempo real
- **Hospedagem:** Firebase Hosting

---

## Destaques Técnicos

- Cursor customizado com animação suave via `transform: translate3d()` (GPU, sem layout recalc)
- Navegação entre telas com animações de entrada/saída sem reload de página
- Multiplayer com reconexão automática — sai e volta para a mesma sala
- Perspectiva correta para cada jogador no multiplayer (host e guest veem seus próprios placares)
- Card de resultado compartilhável ao final de cada partida
- Tema dark/light persistido em `localStorage`
