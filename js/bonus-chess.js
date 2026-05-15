// Bonus chess mode. Isolated from the world conquest state.

const CHESS_FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const CHESS_BACK_RANK = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
const CHESS_SAVE_KEY = 'fifaconquest.chess.save.v1';
const CHESS_PIECES = {
  k: { labelKey: 'chess_piece_king', icon: { w: '&#9812;', b: '&#9818;' } },
  q: { labelKey: 'chess_piece_queen', icon: { w: '&#9813;', b: '&#9819;' } },
  r: { labelKey: 'chess_piece_rook', icon: { w: '&#9814;', b: '&#9820;' } },
  b: { labelKey: 'chess_piece_bishop', icon: { w: '&#9815;', b: '&#9821;' } },
  n: { labelKey: 'chess_piece_knight', icon: { w: '&#9816;', b: '&#9822;' } },
  p: { labelKey: 'chess_piece_pawn', icon: { w: '&#9817;', b: '&#9823;' } }
};

let CHESS = {
  board: {},
  turn: 'w',
  selected: null,
  pending: null,
  finishingKing: null,
  lastMove: null,
  nameFadeSquare: null,
  viewColor: 'w',
  animating: false,
  log: [],
  captured: [],
  players: { w: 'Player 1', b: 'Player 2' },
  over: false
};

function openChessMode() {
  showScreen('chess');
  showChessSetup();
  renderChessManualTeams();
  refreshChessContinueButton();
}

function backToSetupFromChess() {
  showChessSetup();
  showScreen('setup');
}

function resetChessMode() {
  CHESS = {
    board: {},
    turn: 'w',
    selected: null,
    pending: null,
    finishingKing: null,
    lastMove: null,
    nameFadeSquare: null,
    viewColor: 'w',
    animating: false,
    log: [],
    captured: [],
    players: { w: 'Player 1', b: 'Player 2' },
    over: false
  };
  document.getElementById('chess-game').classList.remove('active');
  document.getElementById('chess-setup').style.display = 'grid';
  setChessScreenMode('setup');
  clearSavedChessGame();
  renderChessManualTeams();
}

function showChessSetup() {
  document.getElementById('chess-game')?.classList.remove('active');
  const setup = document.getElementById('chess-setup');
  if (setup) setup.style.display = 'grid';
  document.getElementById('chess-battle-modal')?.classList.remove('active');
  setChessScreenMode('setup');
  refreshChessContinueButton();
}

function buildChessSavePayload() {
  return {
    type: 'fifaconquest-chess',
    version: 1,
    savedAt: Date.now(),
    chess: {
      ...CHESS,
      animating: false,
      pending: null,
      nameFadeSquare: null
    }
  };
}

function validateChessSavePayload(payload) {
  if (payload?.type !== 'fifaconquest-chess' || !payload.chess?.board) return false;
  if (!['w', 'b'].includes(payload.chess.turn)) return false;
  return Object.values(payload.chess.board).every(piece => (
    piece &&
    ['w', 'b'].includes(piece.color) &&
    Object.prototype.hasOwnProperty.call(CHESS_PIECES, piece.type) &&
    typeof piece.team === 'string'
  ));
}

function hasActiveChessGame() {
  return !!Object.keys(CHESS.board || {}).length;
}

function saveChessGameState() {
  if (!hasActiveChessGame()) return;
  try {
    localStorage.setItem(CHESS_SAVE_KEY, JSON.stringify(buildChessSavePayload()));
    refreshChessContinueButton();
  } catch (err) {
    console.warn('Nao foi possivel salvar o xadrez.', err);
  }
}

function loadSavedChessPayload() {
  try {
    const raw = localStorage.getItem(CHESS_SAVE_KEY);
    if (!raw) return null;
    const payload = JSON.parse(raw);
    return validateChessSavePayload(payload) ? payload : null;
  } catch {
    return null;
  }
}

function clearSavedChessGame() {
  try {
    localStorage.removeItem(CHESS_SAVE_KEY);
  } catch {}
  refreshChessContinueButton();
}

function refreshChessContinueButton() {
  const btn = document.getElementById('btn-continue-chess');
  if (!btn) return;
  const payload = loadSavedChessPayload();
  btn.style.display = payload ? 'block' : 'none';
  if (payload?.savedAt) {
    const date = new Date(payload.savedAt);
    const locale = currentLanguage === 'pt' ? 'pt-BR' : currentLanguage;
    const stamp = `${date.toLocaleDateString(locale)} ${date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}`;
    btn.textContent = t('continue_chess_date', { date: stamp });
  } else {
    btn.textContent = t('continue_chess');
  }
}

function applyChessSavePayload(payload) {
  if (!validateChessSavePayload(payload)) return false;
  CHESS = {
    ...payload.chess,
    pending: null,
    animating: false,
    nameFadeSquare: null,
    selected: null,
    log: Array.isArray(payload.chess.log) ? payload.chess.log : [],
    captured: Array.isArray(payload.chess.captured) ? payload.chess.captured : [],
    players: payload.chess.players || { w: 'Player 1', b: 'Player 2' }
  };
  document.getElementById('chess-setup').style.display = 'none';
  document.getElementById('chess-game').classList.add('active');
  setChessScreenMode('game');
  renderChessMode();
  saveChessGameState();
  return true;
}

function continueSavedChessGame() {
  const payload = loadSavedChessPayload();
  if (!payload) {
    clearSavedChessGame();
    return;
  }
  applyChessSavePayload(payload);
}

function triggerChessSaveImport() {
  document.getElementById('chess-save-import-input')?.click();
}

function importChessSaveFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const payload = JSON.parse(String(reader.result || ''));
      if (!applyChessSavePayload(payload)) throw new Error('invalid chess save');
    } catch {
      alert(t('import_error'));
    } finally {
      event.target.value = '';
    }
  };
  reader.readAsText(file);
}

function downloadChessSaveFile() {
  if (!hasActiveChessGame()) return;
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
  downloadTextFile(`fifaconquest-chess-save-${stamp}.json`, JSON.stringify(buildChessSavePayload(), null, 2), 'application/json;charset=utf-8');
}

function setChessScreenMode(mode) {
  const screen = document.getElementById('chess-screen');
  if (!screen) return;
  screen.classList.toggle('is-setup', mode === 'setup');
  screen.classList.toggle('is-game', mode === 'game');
}

function chessSquare(file, rank) {
  return `${CHESS_FILES[file]}${rank}`;
}

function chessCoords(square) {
  return {
    file: CHESS_FILES.indexOf(square[0]),
    rank: Number(square[1])
  };
}

function chessPieceLabel(piece) {
  return `${piece.color === 'w' ? t('white_pieces') : t('black_pieces')} - ${t(CHESS_PIECES[piece.type].labelKey)}`;
}

function getChessTeamMode() {
  return document.querySelector('input[name="chess-team-mode"]:checked')?.value || 'random';
}

function getChessSeed() {
  return document.getElementById('chess-seed-input')?.value.trim() || String(Date.now());
}

function getChessPieceKeys() {
  const keys = [];
  ['w', 'b'].forEach(color => {
    for (let i = 0; i < 8; i++) keys.push(`${color}-p-${i + 1}`);
    CHESS_BACK_RANK.forEach((type, i) => keys.push(`${color}-${type}-${i + 1}`));
  });
  return keys;
}

function renderChessManualTeams() {
  const wrap = document.getElementById('chess-manual-teams');
  if (!wrap) return;
  if (getChessTeamMode() !== 'manual') {
    wrap.innerHTML = '';
    wrap.classList.remove('active');
    return;
  }

  wrap.classList.add('active');
  const rows = getChessPieceKeys().map((key, index) => {
    const [color, type] = key.split('-');
    const label = `${color === 'w' ? t('white_pieces') : t('black_pieces')} ${t(CHESS_PIECES[type].labelKey)}`;
    const defaultTeam = ALL_TEAMS[index % ALL_TEAMS.length] || '';
    const options = ALL_TEAMS.map(team => `<option value="${escapeHtml(team)}"${team === defaultTeam ? ' selected' : ''}>${escapeHtml(team)}</option>`).join('');
    return `
      <label class="chess-team-select">
        <span>${escapeHtml(label)}</span>
        <select id="chess-team-${key}">
          ${options}
        </select>
      </label>
    `;
  }).join('');
  wrap.innerHTML = rows;
}

function buildChessTeamAssignments() {
  const mode = getChessTeamMode();
  if (mode === 'manual') {
    return getChessPieceKeys().map(key => document.getElementById(`chess-team-${key}`)?.value || ALL_TEAMS[0]);
  }

  const rng = seededRand(strToSeed(`chess-${mode}-${getChessSeed()}`));
  const pool = buildTeamPool(rng, mode === 'elite' ? TEAM_POOL_MODES.ELITE : TEAM_POOL_MODES.RANDOM);
  return shuffleArray(pool, rng);
}

function startChessMode() {
  const whiteName = document.getElementById('chess-white-name')?.value.trim() || 'Player 1';
  const blackName = document.getElementById('chess-black-name')?.value.trim() || 'Player 2';
  const teams = buildChessTeamAssignments();
  let teamIndex = 0;

  CHESS = {
    board: {},
    turn: 'w',
    selected: null,
    pending: null,
    finishingKing: null,
    lastMove: null,
    nameFadeSquare: null,
    viewColor: 'w',
    animating: false,
    log: [t('chess_log_started')],
    captured: [],
    players: { w: whiteName, b: blackName },
    over: false
  };

  for (let file = 0; file < 8; file++) {
    CHESS.board[chessSquare(file, 2)] = makeChessPiece('w', 'p', teams[teamIndex++]);
    CHESS.board[chessSquare(file, 7)] = makeChessPiece('b', 'p', teams[teamIndex++]);
    CHESS.board[chessSquare(file, 1)] = makeChessPiece('w', CHESS_BACK_RANK[file], teams[teamIndex++]);
    CHESS.board[chessSquare(file, 8)] = makeChessPiece('b', CHESS_BACK_RANK[file], teams[teamIndex++]);
  }

  document.getElementById('chess-setup').style.display = 'none';
  document.getElementById('chess-game').classList.add('active');
  setChessScreenMode('game');
  renderChessMode();
  saveChessGameState();
}

function makeChessPiece(color, type, team) {
  return { color, type, team };
}

function renderChessMode() {
  renderChessBoard();
  renderChessSidePanel();
}

function renderChessBoard() {
  const board = document.getElementById('chess-board');
  if (!board) return;
  const legalTargets = CHESS.selected ? getLegalMovesForSquare(CHESS.selected) : [];
  const checkedKing = getCheckedKingSquare();
  let html = '';
  for (let rank = 8; rank >= 1; rank--) {
    for (let file = 0; file < 8; file++) {
      const square = chessSquare(file, rank);
      const piece = CHESS.board[square];
      const isLight = (file + rank) % 2 === 1;
      const classes = [
        'chess-square',
        isLight ? 'light' : 'dark',
        CHESS.selected === square ? 'selected' : '',
        legalTargets.includes(square) ? 'legal' : '',
        legalTargets.includes(square) && piece ? 'legal-capture' : '',
        CHESS.lastMove?.from === square ? 'last-from' : '',
        CHESS.lastMove?.to === square ? 'last-to' : '',
        CHESS.nameFadeSquare === square ? 'name-enter' : '',
        checkedKing === square ? 'in-check' : '',
        piece ? `piece-${piece.color}` : ''
      ].filter(Boolean).join(' ');
      html += `<button class="${classes}" type="button" data-square="${square}" onclick="handleChessSquareClick('${square}')">
        <span class="chess-coord">${file === 0 ? rank : ''}${rank === 1 ? CHESS_FILES[file] : ''}</span>
        ${piece ? `<span class="chess-piece">${CHESS_PIECES[piece.type].icon[piece.color]}</span><span class="chess-piece-team">${escapeHtml(piece.team)}</span>` : ''}
      </button>`;
    }
  }
  board.innerHTML = html;
  if (CHESS.nameFadeSquare) {
    window.setTimeout(() => {
      CHESS.nameFadeSquare = null;
    }, 220);
  }
}

function renderChessSidePanel() {
  const turn = document.getElementById('chess-turn-player');
  if (turn) {
    const suffix = isKingInCheck(CHESS.turn, CHESS.board) ? ` ${t('in_check')}` : '';
    turn.textContent = CHESS.over ? t('game_over') : `${CHESS.players[CHESS.turn]}${suffix}`;
  }

  const selected = document.getElementById('chess-selected-card');
  if (selected) {
    const piece = CHESS.selected ? CHESS.board[CHESS.selected] : null;
    selected.innerHTML = piece
      ? `<div class="chess-section-title">${escapeHtml(t('selected'))}</div><strong>${escapeHtml(chessPieceLabel(piece))}</strong><span>${escapeHtml(piece.team)}${TEAM_LEAGUE[piece.team] ? ' - ' + escapeHtml(TEAM_LEAGUE[piece.team]) : ''}</span>`
      : `<div class="chess-section-title">${escapeHtml(t('selected'))}</div><span>${escapeHtml(t('choose_your_piece'))}</span>`;
  }

  const captured = document.getElementById('chess-captured-list');
  if (captured) {
    const capturedForPlayer = CHESS.captured.filter(piece => piece.color !== CHESS.viewColor);
    captured.innerHTML = capturedForPlayer.map(piece => `<span class="chess-captured-chip">${CHESS_PIECES[piece.type].icon[piece.color]} ${escapeHtml(piece.team)}</span>`).join('') || `<span class="chess-muted">${escapeHtml(t('no_captures_yet'))}</span>`;
  }

  renderChessPlayerStats();

  const log = document.getElementById('chess-log');
  if (log) {
    log.innerHTML = CHESS.log.slice(-8).reverse().map(item => `<div class="chess-log-line">${escapeHtml(item)}</div>`).join('');
  }
}

function handleChessSquareClick(square) {
  if (CHESS.over || CHESS.pending || CHESS.animating) return;
  const piece = CHESS.board[square];
  if (!CHESS.selected) {
    if (piece?.color === CHESS.turn) {
      CHESS.selected = square;
      renderChessMode();
    }
    return;
  }

  if (piece?.color === CHESS.turn) {
    CHESS.selected = square;
    renderChessMode();
    return;
  }

  if (!getLegalMovesForSquare(CHESS.selected).includes(square)) return;
  const attacker = CHESS.board[CHESS.selected];
  const defender = CHESS.board[square];
  if (defender) {
    CHESS.pending = {
      from: CHESS.selected,
      to: square,
      attacker: { ...attacker },
      defender: { ...defender },
      kingCapture: defender.type === 'k'
    };
    openChessBattleModal();
  } else {
    const from = CHESS.selected;
    const moving = { ...CHESS.board[from] };
    animateChessAction({ type: 'move', from, to: square, attacker: moving }, () => {
      commitChessMove(from, square);
      finishChessTurn();
    });
  }
}

function openChessBattleModal() {
  const pending = CHESS.pending;
  if (!pending) return;
  document.getElementById('chess-battle-attacker').textContent = pending.attacker.team;
  document.getElementById('chess-battle-defender').textContent = pending.defender.team;
  document.getElementById('chess-battle-attacker-piece').textContent = `${CHESS.players[pending.attacker.color]} - ${t(CHESS_PIECES[pending.attacker.type].labelKey)}`;
  document.getElementById('chess-battle-defender-piece').textContent = `${CHESS.players[pending.defender.color]} - ${t(CHESS_PIECES[pending.defender.type].labelKey)}`;
  document.getElementById('chess-battle-modal').classList.add('active');
}

function resolveChessBattle(attackerWon) {
  const pending = CHESS.pending;
  if (!pending) return;
  document.getElementById('chess-battle-modal').classList.remove('active');
  if (attackerWon) {
    animateChessAction({ type: 'attacker-capture', ...pending }, () => {
      commitChessMove(pending.from, pending.to);
      CHESS.captured.push(pending.defender);
      if (pending.kingCapture) {
        CHESS.over = true;
        CHESS.selected = null;
        CHESS.pending = null;
        CHESS.finishingKing = null;
        CHESS.log.push(t('chess_log_king_captured', { team: pending.attacker.team }));
        renderChessMode();
        saveChessGameState();
        return;
      }
      CHESS.log.push(t('chess_log_captured', { attacker: pending.attacker.team, defender: pending.defender.team }));
      CHESS.pending = null;
      finishChessTurn();
    });
    return;
  }

  const type = pending.kingCapture ? 'king-defense' : 'defender-hold';
  animateChessAction({ type, ...pending }, () => {
    if (pending.kingCapture) {
      delete CHESS.board[pending.from];
      CHESS.captured.push(pending.attacker);
      CHESS.finishingKing = null;
      CHESS.log.push(t('chess_log_king_defended', { defender: pending.defender.team, attacker: pending.attacker.team }));
    } else {
      CHESS.nameFadeSquare = pending.to;
      CHESS.log.push(t('chess_log_defended', { defender: pending.defender.team, attacker: pending.attacker.team }));
    }
    CHESS.pending = null;
    finishChessTurn();
  });
}

function commitChessMove(from, to) {
  const moving = CHESS.board[from];
  if (!moving) return;
  CHESS.board[to] = { ...moving };
  delete CHESS.board[from];
  CHESS.lastMove = { from, to };
  CHESS.nameFadeSquare = to;
  if (moving.type === 'p' && (to[1] === '8' || to[1] === '1')) {
    CHESS.board[to].type = 'q';
    CHESS.log.push(t('chess_log_promoted', { team: moving.team }));
  }
}

function finishChessTurn() {
  CHESS.selected = null;
  const previousTurn = CHESS.turn;
  CHESS.turn = CHESS.turn === 'w' ? 'b' : 'w';
  CHESS.viewColor = CHESS.turn;
  if (isCheckmate(CHESS.turn)) {
    const trapped = CHESS.turn;
    CHESS.turn = previousTurn;
    CHESS.finishingKing = trapped;
    CHESS.log.push(t('chess_log_no_escape', { player: CHESS.players[trapped] }));
  } else if (!hasAnyLegalMove(CHESS.turn)) {
    CHESS.over = true;
    CHESS.log.push(t('chess_log_stalemate'));
  }
  renderChessMode();
  saveChessGameState();
}

function setChessStatsView(color) {
  CHESS.viewColor = color;
  renderChessSidePanel();
}

function renderChessPlayerStats() {
  const toggle = document.getElementById('chess-player-toggle');
  const stats = document.getElementById('chess-player-stats');
  if (!toggle || !stats) return;
  toggle.innerHTML = ['w', 'b'].map(color => `
    <button class="${CHESS.viewColor === color ? 'active' : ''}" type="button" onclick="setChessStatsView('${color}')">
      ${escapeHtml(CHESS.players[color])}
    </button>
  `).join('');

  const pieces = Object.values(CHESS.board).filter(piece => piece.color === CHESS.viewColor);
  const capturedByPlayer = CHESS.captured.filter(piece => piece.color !== CHESS.viewColor);
  const major = pieces.filter(piece => piece.type !== 'p' && piece.type !== 'k').length;
  const pawns = pieces.filter(piece => piece.type === 'p').length;
  stats.innerHTML = `
    <div><span>${escapeHtml(t('pieces_in_play'))}</span><strong>${pieces.length}</strong></div>
    <div><span>${escapeHtml(t('pawns'))}</span><strong>${pawns}</strong></div>
    <div><span>${escapeHtml(t('major_pieces'))}</span><strong>${major}</strong></div>
    <div><span>${escapeHtml(t('captures'))}</span><strong>${capturedByPlayer.length}</strong></div>
  `;
}

function shouldReduceChessMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

function getChessSquareEl(square) {
  return document.querySelector(`.chess-square[data-square="${square}"]`);
}

function makeChessGhost(piece, rect, boardRect) {
  const ghost = document.createElement('div');
  ghost.className = `chess-ghost piece-${piece.color}`;
  ghost.style.left = `${rect.left - boardRect.left}px`;
  ghost.style.top = `${rect.top - boardRect.top}px`;
  ghost.style.width = `${rect.width}px`;
  ghost.style.height = `${rect.height}px`;
  ghost.innerHTML = `<span class="chess-piece">${CHESS_PIECES[piece.type].icon[piece.color]}</span>`;
  return ghost;
}

function animateChessAction(action, done) {
  const board = document.getElementById('chess-board');
  const fromEl = getChessSquareEl(action.from);
  const toEl = getChessSquareEl(action.to);
  if (!board || !fromEl || !toEl || shouldReduceChessMotion()) {
    done();
    return;
  }

  CHESS.animating = true;
  const boardRect = board.getBoundingClientRect();
  const fromRect = fromEl.getBoundingClientRect();
  const toRect = toEl.getBoundingClientRect();
  const dx = toRect.left - fromRect.left;
  const dy = toRect.top - fromRect.top;
  const attackerGhost = makeChessGhost(action.attacker, fromRect, boardRect);
  const defenderGhost = action.defender ? makeChessGhost(action.defender, toRect, boardRect) : null;
  fromEl.classList.add('animating-piece');
  if (toEl) toEl.classList.add('animating-target');
  board.appendChild(attackerGhost);
  if (defenderGhost) board.appendChild(defenderGhost);

  const finish = () => {
    attackerGhost.remove();
    defenderGhost?.remove();
    fromEl.classList.remove('animating-piece');
    toEl.classList.remove('animating-target');
    CHESS.animating = false;
    done();
  };

  const snapEase = 'cubic-bezier(.18,.88,.22,1)';
  const kickEase = 'cubic-bezier(.2,.82,.24,1)';
  const holdLastFrame = 'forwards';
  const duration = 330;
  if (action.type === 'defender-hold') {
    attackerGhost.animate([
      { transform: 'translate3d(0, 0, 0) scale(1)' },
      { transform: `translate3d(${dx * 0.86}px, ${dy * 0.86}px, 0) scale(1.06)`, offset: 0.54 },
      { transform: 'translate3d(0, 0, 0) scale(1)' }
    ], { duration: 440, easing: snapEase, fill: holdLastFrame });
    defenderGhost?.animate([
      { transform: 'translate3d(0, 0, 0) scale(1)' },
      { transform: `translate3d(${-Math.sign(dx || 1) * 12}px, ${-Math.sign(dy || 1) * 7}px, 0) scale(1.05)`, offset: 0.5 },
      { transform: 'translate3d(0, 0, 0) scale(1)' }
    ], { duration: 440, easing: kickEase, fill: holdLastFrame });
    setTimeout(finish, 460);
    return;
  }

  if (action.type === 'king-defense') {
    attackerGhost.animate([
      { transform: 'translate3d(0, 0, 0) scale(1)' },
      { transform: `translate3d(${dx * 0.86}px, ${dy * 0.86}px, 0) scale(1.06)`, offset: 0.42 },
      { transform: `translate3d(${dx * 0.86 - Math.sign(dx || 1) * 132}px, ${dy * 0.86 - 68}px, 0) rotate(-18deg) scale(.68)`, opacity: 0 }
    ], { duration: 500, easing: snapEase, fill: holdLastFrame });
    defenderGhost?.animate([
      { transform: 'scale(1)' },
      { transform: 'scale(1.13)', offset: 0.44 },
      { transform: 'scale(1)' }
    ], { duration: 500, easing: kickEase, fill: holdLastFrame });
    setTimeout(finish, 520);
    return;
  }

  attackerGhost.animate([
    { transform: 'translate3d(0, 0, 0) scale(1)' },
    { transform: `translate3d(${dx * 0.72}px, ${dy * 0.72}px, 0) scale(${action.type === 'attacker-capture' ? 1.05 : 1.015})`, offset: 0.72 },
    { transform: `translate3d(${dx}px, ${dy}px, 0) scale(${action.type === 'attacker-capture' ? 1.06 : 1})` }
  ], { duration, easing: snapEase, fill: holdLastFrame });
  if (action.type === 'attacker-capture') {
    defenderGhost?.animate([
      { transform: 'translate3d(0, 0, 0) scale(1)', opacity: 1 },
      { transform: `translate3d(${Math.sign(dx || 1) * 104}px, ${Math.sign(dy || 1) * 58}px, 0) rotate(16deg) scale(.68)`, opacity: 0 }
    ], { duration, easing: 'cubic-bezier(.55,.06,.68,.19)', fill: holdLastFrame });
  }
  setTimeout(finish, duration + 20);
}

function getCheckedKingSquare() {
  const colors = ['w', 'b'];
  for (const color of colors) {
    if (!isKingInCheck(color, CHESS.board)) continue;
    return Object.keys(CHESS.board).find(sq => CHESS.board[sq].color === color && CHESS.board[sq].type === 'k') || null;
  }
  return null;
}

function getLegalMovesForSquare(square) {
  const piece = CHESS.board[square];
  if (!piece || piece.color !== CHESS.turn) return [];
  if (CHESS.finishingKing) {
    const kingSquare = Object.keys(CHESS.board).find(sq => CHESS.board[sq].color === CHESS.finishingKing && CHESS.board[sq].type === 'k');
    if (!kingSquare) return [];
    return getPseudoMoves(square, piece, CHESS.board).includes(kingSquare) ? [kingSquare] : [];
  }
  return getPseudoMoves(square, piece, CHESS.board).filter(to => {
    const nextBoard = simulateChessMove(CHESS.board, square, to);
    return !isKingInCheck(piece.color, nextBoard);
  });
}

function getPseudoMoves(square, piece, board) {
  const { file, rank } = chessCoords(square);
  const moves = [];
  const add = (f, r, captureOnly = false, moveOnly = false) => {
    if (f < 0 || f > 7 || r < 1 || r > 8) return false;
    const target = chessSquare(f, r);
    const targetPiece = board[target];
    if (moveOnly && targetPiece) return false;
    if (captureOnly && (!targetPiece || targetPiece.color === piece.color)) return false;
    if (!captureOnly && targetPiece?.color === piece.color) return false;
    moves.push(target);
    return !targetPiece;
  };

  if (piece.type === 'p') {
    const dir = piece.color === 'w' ? 1 : -1;
    const startRank = piece.color === 'w' ? 2 : 7;
    if (add(file, rank + dir, false, true) && rank === startRank) add(file, rank + dir * 2, false, true);
    add(file - 1, rank + dir, true);
    add(file + 1, rank + dir, true);
    return moves;
  }

  if (piece.type === 'n') {
    [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]].forEach(([df, dr]) => add(file + df, rank + dr));
    return moves;
  }

  if (piece.type === 'k') {
    for (let df = -1; df <= 1; df++) {
      for (let dr = -1; dr <= 1; dr++) {
        if (df || dr) add(file + df, rank + dr);
      }
    }
    return moves;
  }

  const directions = {
    b: [[1, 1], [1, -1], [-1, 1], [-1, -1]],
    r: [[1, 0], [-1, 0], [0, 1], [0, -1]],
    q: [[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]]
  }[piece.type] || [];

  directions.forEach(([df, dr]) => {
    let f = file + df;
    let r = rank + dr;
    while (f >= 0 && f <= 7 && r >= 1 && r <= 8) {
      if (!add(f, r)) break;
      f += df;
      r += dr;
    }
  });
  return moves;
}

function simulateChessMove(board, from, to) {
  const next = {};
  Object.entries(board).forEach(([sq, piece]) => { next[sq] = { ...piece }; });
  next[to] = { ...next[from] };
  delete next[from];
  return next;
}

function isKingInCheck(color, board) {
  const kingSquare = Object.keys(board).find(sq => board[sq].color === color && board[sq].type === 'k');
  if (!kingSquare) return true;
  return Object.entries(board).some(([sq, piece]) => {
    if (piece.color === color) return false;
    return getAttackSquares(sq, piece, board).includes(kingSquare);
  });
}

function getAttackSquares(square, piece, board) {
  const { file, rank } = chessCoords(square);
  const attacks = [];
  const add = (f, r) => {
    if (f < 0 || f > 7 || r < 1 || r > 8) return false;
    const target = chessSquare(f, r);
    attacks.push(target);
    return !board[target];
  };

  if (piece.type === 'p') {
    const dir = piece.color === 'w' ? 1 : -1;
    add(file - 1, rank + dir);
    add(file + 1, rank + dir);
    return attacks;
  }

  if (piece.type === 'n') {
    [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]].forEach(([df, dr]) => add(file + df, rank + dr));
    return attacks;
  }

  if (piece.type === 'k') {
    for (let df = -1; df <= 1; df++) {
      for (let dr = -1; dr <= 1; dr++) {
        if (df || dr) add(file + df, rank + dr);
      }
    }
    return attacks;
  }

  const directions = {
    b: [[1, 1], [1, -1], [-1, 1], [-1, -1]],
    r: [[1, 0], [-1, 0], [0, 1], [0, -1]],
    q: [[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]]
  }[piece.type] || [];

  directions.forEach(([df, dr]) => {
    let f = file + df;
    let r = rank + dr;
    while (f >= 0 && f <= 7 && r >= 1 && r <= 8) {
      if (!add(f, r)) break;
      f += df;
      r += dr;
    }
  });
  return attacks;
}

function hasAnyLegalMove(color) {
  const previousTurn = CHESS.turn;
  CHESS.turn = color;
  const hasMove = Object.keys(CHESS.board).some(square => CHESS.board[square].color === color && getLegalMovesForSquare(square).length > 0);
  CHESS.turn = previousTurn;
  return hasMove;
}

function isCheckmate(color) {
  return isKingInCheck(color, CHESS.board) && !hasAnyLegalMove(color);
}
