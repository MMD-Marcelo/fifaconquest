// ============================================================
// SEEDED RANDOM
// ============================================================

function seededRand(seed) {
  let s = seed;
  return function() {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function strToSeed(str) {
  if (!str) return Math.floor(Math.random() * 1e9);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function shuffleArray(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ============================================================
// GAME STATE
// ============================================================
let G = {
  players: [],
  territories: {}, // countryId -> { owner: null|playerId, team: string }
  homeOf: {}, // countryId -> playerId
  homeLives: {}, // countryId -> number (3 remaining)
  homeTeams: {}, // countryId -> [team1, team2, team3]
  currentPlayer: 0,
  attackChain: 0, // how many attacks in current turn
  log: [],
  phase: 'attack', // always attack
  selectedCountry: null,
  attackTarget: null,
  selectedAttackTeam: null,
  selectedAttackFrom: null,
  pendingBattle: null,
  stats: {}, // playerId -> { wins, losses, draws, territories, scored, conceded }
  teamPoolMode: 'random',
  baseTeamMode: 'random',
  teamLabelsVisible: false,
  swapRewardAvailable: false,
  swapRewardUsedAt: 0,
  swapSelection: [],
  revive: {}
};

const SAVE_KEY = 'fifaconquest.save.v2';
const LANG_KEY = 'fifaconquest.lang';
let teamLabelsVisible = false;

const LANGUAGE_FALLBACK = 'pt';
const LANGUAGE_PACKS = window.FIFACONQUEST_LANGUAGE_PACKS || (window.FIFACONQUEST_LANGUAGE_PACKS = {});
const LANGUAGE_MANIFEST = Array.isArray(window.FIFACONQUEST_LANGUAGES) ? window.FIFACONQUEST_LANGUAGES : [
  { code: 'pt', label: 'PT', name: 'Português', file: 'pt.js' }
];
const loadedLanguageScripts = new Set(Object.keys(LANGUAGE_PACKS));

function getAvailableLanguages() {
  return LANGUAGE_MANIFEST.filter(lang => lang?.code && lang?.file);
}

function isLanguageAvailable(lang) {
  return getAvailableLanguages().some(item => item.code === lang);
}

let currentLanguage = (() => {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (isLanguageAvailable(saved)) return saved;
  } catch {}
  const nav = (navigator.language || LANGUAGE_FALLBACK).slice(0, 2).toLowerCase();
  return isLanguageAvailable(nav) ? nav : LANGUAGE_FALLBACK;
})();

function loadLanguagePack(lang) {
  if (LANGUAGE_PACKS[lang]) return Promise.resolve(true);
  const item = getAvailableLanguages().find(entry => entry.code === lang);
  if (!item || loadedLanguageScripts.has(lang)) return Promise.resolve(!!LANGUAGE_PACKS[lang]);

  loadedLanguageScripts.add(lang);
  return new Promise(resolve => {
    const script = document.createElement('script');
    script.src = `lang/${item.file}`;
    script.onload = () => resolve(!!LANGUAGE_PACKS[lang]);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

function t(key, vars = {}) {
  const text = LANGUAGE_PACKS[currentLanguage]?.[key] || LANGUAGE_PACKS[LANGUAGE_FALLBACK]?.[key] || key;
  return text.replace(/\{(\w+)\}/g, (_, name) => vars[name] ?? '');
}

function plural(count, suffix = 's') {
  return Number(count) === 1 ? '' : suffix;
}

function populateLanguageSelects() {
  const languages = getAvailableLanguages();
  document.querySelectorAll('.language-select').forEach(select => {
    const currentValue = select.value || currentLanguage;
    select.innerHTML = languages.map(lang => `<option value="${escapeHtml(lang.code)}">${escapeHtml(lang.label || lang.code.toUpperCase())}</option>`).join('');
    select.value = isLanguageAvailable(currentValue) ? currentValue : currentLanguage;
  });
}

function applyTranslations() {
  document.documentElement.lang = currentLanguage === 'pt' ? 'pt-BR' : currentLanguage;
  populateLanguageSelects();
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('.language-select').forEach(el => {
    el.value = currentLanguage;
  });
  refreshContinueButton();
  updateChainInfo();
  updateSwapRewardButton();
  updateTeamLabelButton();
  renderPlayerSetup();
  if (G.players?.length) {
    renderSidebar();
    renderDefenderTeamPicker();
    renderNeutralDefenderPicker();
  }
  if (document.getElementById('chess-screen')?.classList.contains('active')) {
    if (typeof renderChessManualTeams === 'function') renderChessManualTeams();
    if (typeof renderChessMode === 'function') renderChessMode();
  }
  if (typeof refreshChessContinueButton === 'function') refreshChessContinueButton();
}

async function setLanguage(lang) {
  if (!isLanguageAvailable(lang)) return;
  const loaded = await loadLanguagePack(lang);
  if (!loaded) return;
  currentLanguage = lang;
  try { localStorage.setItem(LANG_KEY, lang); } catch {}
  applyTranslations();
}

function initLanguage() {
  populateLanguageSelects();
  if (!LANGUAGE_PACKS[currentLanguage]) {
    loadLanguagePack(currentLanguage).then(loaded => {
      if (!loaded) currentLanguage = LANGUAGE_FALLBACK;
      applyTranslations();
    });
    return;
  }
  applyTranslations();
}
function buildSavePayload() {
  G.teamLabelsVisible = teamLabelsVisible;
  G.teamPoolMode = teamPoolMode;
  G.baseTeamMode = baseTeamMode;
  return {
    version: 2,
    savedAt: Date.now(),
    playerCount,
    logCount,
    teamPoolMode,
    baseTeamMode,
    teamLabelsVisible,
    G
  };
}

function validateSavePayload(payload) {
  if (!payload?.G?.players?.length || !payload.G.territories) return false;
  const savedIds = new Set(Object.keys(payload.G.territories));
  return savedIds.size > 0 && [...savedIds].some(id => COUNTRY_ID_SET.has(id));
}

function hydrateMissingSaveTerritories() {
  if (!G.territories) G.territories = {};
  const usedTeams = new Set(Object.values(G.territories).map(t => t?.team).filter(Boolean));
  const availableTeams = ALL_TEAMS.filter(team => !usedTeams.has(team));
  let nextTeam = 0;

  COUNTRIES.forEach(country => {
    if (G.territories[country.id]) return;
    const team = availableTeams[nextTeam % availableTeams.length] || ALL_TEAMS[nextTeam % ALL_TEAMS.length] || '';
    nextTeam++;
    G.territories[country.id] = { owner: null, team };
  });
}

function defaultReviveState() {
  return { neutralDefenseStreaks: {}, lastNeutralDefenderId: '' };
}

function ensurePlayerShape(pl) {
  if (!Array.isArray(pl.territories)) pl.territories = [];
  if (!Array.isArray(pl.teams)) pl.teams = [];
  pl.eliminated = !!pl.eliminated;
}

function ensureStatsShape(playerId) {
  G.stats = G.stats || {};
  G.stats[playerId] = {
    wins: 0,
    losses: 0,
    draws: 0,
    conquests: 0,
    defenses: 0,
    scored: 0,
    conceded: 0,
    eliminations: 0,
    neutralDefenses: 0,
    revives: 0,
    ...(G.stats[playerId] || {})
  };
}

function hydrateMissingSaveFields(payload = {}) {
  G.players = G.players || [];
  G.players.forEach(pl => {
    ensurePlayerShape(pl);
    ensureStatsShape(pl.id);
  });
  G.homeOf = G.homeOf || {};
  G.homeLives = G.homeLives || {};
  G.homeTeams = G.homeTeams || {};
  G.log = G.log || [];
  G.revive = { ...defaultReviveState(), ...(G.revive || {}) };
  G.revive.neutralDefenseStreaks = G.revive.neutralDefenseStreaks || {};
  G.players.forEach(pl => {
    if (!Number.isFinite(Number(G.revive.neutralDefenseStreaks[pl.id]))) {
      G.revive.neutralDefenseStreaks[pl.id] = 0;
    }
  });
  G.players.forEach(pl => {
    if (pl.eliminated && pl.territories.length > 0) neutralizePlayerTerritories(pl.id);
  });
  G.baseTeamMode = payload.baseTeamMode || G.baseTeamMode || 'random';
  G.swapRewardAvailable = !!G.swapRewardAvailable;
  G.swapRewardUsedAt = G.swapRewardUsedAt || 0;
}

function hasSavedGame() {
  try {
    return !!localStorage.getItem(SAVE_KEY);
  } catch {
    return false;
  }
}

function saveGameState() {
  if (!G.players?.length || !G.territories || Object.keys(G.territories).length === 0) return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(buildSavePayload()));
    refreshContinueButton();
  } catch (err) {
    console.warn('Nao foi possivel salvar a partida.', err);
  }
}

function loadSavedPayload() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const payload = JSON.parse(raw);
    if (!validateSavePayload(payload)) return null;
    return payload;
  } catch {
    return null;
  }
}

function clearSavedGame() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {}
  refreshContinueButton();
}

function refreshContinueButton() {
  const btn = document.getElementById('btn-continue-game');
  if (!btn) return;
  const payload = loadSavedPayload();
  btn.style.display = payload ? 'block' : 'none';
  if (payload?.savedAt) {
    const date = new Date(payload.savedAt);
    const locale = currentLanguage === 'pt' ? 'pt-BR' : currentLanguage;
    const stamp = `${date.toLocaleDateString(locale)} ${date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}`;
    btn.textContent = t('continue_game_date', { date: stamp });
  } else {
    btn.textContent = t('continue_game');
  }
}

function continueSavedGame() {
  const payload = loadSavedPayload();
  if (!payload) {
    clearSavedGame();
    return;
  }

  applySavePayload(payload);
}

function applySavePayload(payload) {
  if (!validateSavePayload(payload)) return false;
  G = payload.G;
  hydrateMissingSaveTerritories();
  hydrateMissingSaveFields(payload);
  playerCount = Math.max(2, Math.min(5, payload.playerCount || G.players.length || 3));
  logCount = payload.logCount || G.log?.length || 0;
  teamPoolMode = payload.teamPoolMode || G.teamPoolMode || 'random';
  baseTeamMode = payload.baseTeamMode || G.baseTeamMode || 'random';
  teamLabelsVisible = !!G.teamLabelsVisible;
  G.pendingBattle = null;
  G.swapSelection = G.swapSelection || [];
  document.getElementById('count-display').textContent = playerCount;
  renderPlayerSetup();
  updateTeamPoolModeUI();
  updateBaseTeamModeUI();
  showScreen('game');
  renderMap();
  renderSidebar();
  updateTurnBar();
  updateSwapRewardButton();
  updateChainInfo();
  switchTab('players');
  saveGameState();
  return true;
}

function newTournamentSetup() {
  if (hasSavedGame() && !confirm(t('save_preserved_confirm'))) return;
  showScreen('setup');
  refreshContinueButton();
}

function triggerSaveImport() {
  document.getElementById('save-import-input')?.click();
}

function importSaveFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const payload = JSON.parse(String(reader.result || ''));
      if (!applySavePayload(payload)) throw new Error('invalid save');
    } catch {
      alert(t('import_error'));
    } finally {
      event.target.value = '';
    }
  };
  reader.readAsText(file);
}

function downloadSaveFile() {
  if (!G.players?.length) return;
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
  downloadTextFile(`fifaconquest-save-${stamp}.json`, JSON.stringify(buildSavePayload(), null, 2), 'application/json;charset=utf-8');
}

// ============================================================
// PLAYER COUNT SETUP
// ============================================================
const PLAYER_COLORS = ['--p1','--p2','--p3','--p4','--p5'];
const PLAYER_COLORS_VAL = ['#00e5ff','#ff3d5a','#a3ff4e','#c084fc','#fb923c'];
const DEFAULT_NAMES = ['Player 1','Player 2','Player 3','Player 4','Player 5'];
let playerCount = 3;
let teamPoolMode = 'random';
let baseTeamMode = 'random';

const TEAM_POOL_MODES = {
  RANDOM: 'random',
  ELITE: 'elite'
};

const BASE_TEAM_MODES = {
  RANDOM: 'random',
  MANUAL: 'manual'
};

const ELITE_LOCKED_LEAGUES = new Set([
  'Premier League',
  'La Liga',
  'Bundesliga',
  'Serie A',
  'Ligue 1'
]);

const ELITE_LOCKED_TEAMS = [
  'River Plate', 'Boca Juniors', 'Racing Club', 'Independiente',
  'Benfica', 'Sporting CP', 'FC Porto', 'Braga',
  'Inter Miami CF',
  'Ajax', 'PSV', 'AZ Alkmaar', 'Feyenoord',
  'Al Nassr', 'Al Hilal', 'Al Ahli',
  'FenerbahÃ§e', 'BeÅŸiktaÅŸ', 'Galatasaray', 'Trabzonspor',
  'Anderlecht', 'Club Brugge', 'Antwerp',
  'Celtic', 'Rangers', 'Heart of Midlothian',
  'FC KÃ¸benhavn', 'FC Midtjylland', 'BrÃ¸ndby IF',
  'FerencvÃ¡rosi TC',
  'Legia Warszawa', 'Lech PoznaÅ„', 'RakÃ³w CzÄ™stochowa',
  'FCSB', 'CFR Cluj', 'Rapid BucureÈ™ti',
  'MalmÃ¶ FF', 'AIK', 'Hammarby IF',
  'BSC Young Boys', 'FC Basel', 'FC ZÃ¼rich',
  'BodÃ¸/Glimt', 'Molde', 'Rosenborg'
];

const TEAM_POOL_MODE_LABELS = {
  random: 'Aleatorio',
  elite: 'Elite cativa'
};

function getSelectedTeamPoolMode() {
  const selected = document.querySelector('input[name="team-pool-mode"]:checked')?.value;
  return Object.values(TEAM_POOL_MODES).includes(selected) ? selected : TEAM_POOL_MODES.RANDOM;
}

function updateTeamPoolModeUI() {
  const option = document.querySelector(`input[name="team-pool-mode"][value="${teamPoolMode}"]`);
  if (option) option.checked = true;
}

function getSelectedBaseTeamMode() {
  const selected = document.querySelector('input[name="base-team-mode"]:checked')?.value;
  return Object.values(BASE_TEAM_MODES).includes(selected) ? selected : BASE_TEAM_MODES.RANDOM;
}

function updateBaseTeamModeUI() {
  const option = document.querySelector(`input[name="base-team-mode"][value="${baseTeamMode}"]`);
  if (option) option.checked = true;
}

function getBaseTeamControlValue(playerIndex, slot) {
  return document.getElementById(`base-team-${playerIndex}-${slot}`)?.value || '';
}

function buildBaseTeamSelect(playerIndex, slot, value) {
  const options = [
    `<option value="">${escapeHtml(t('team_slot', { n: slot + 1 }))}</option>`,
    ...ALL_TEAMS.map(team => {
      const selected = team === value ? ' selected' : '';
      return `<option value="${escapeHtml(team)}"${selected}>${escapeHtml(team)}</option>`;
    })
  ].join('');
  return `<select class="base-team-input" id="base-team-${playerIndex}-${slot}">${options}</select>`;
}

function getEliteLockedTeams() {
  const byLeague = ALL_TEAMS.filter(team => ELITE_LOCKED_LEAGUES.has(TEAM_LEAGUE[team]));
  const byName = ELITE_LOCKED_TEAMS.filter(team => ALL_TEAMS.includes(team));
  return [...new Set([...byLeague, ...byName])];
}

function buildTeamPool(rng, mode) {
  if (mode !== TEAM_POOL_MODES.ELITE) return shuffleArray([...ALL_TEAMS], rng);

  const locked = getEliteLockedTeams();
  const rest = shuffleArray(ALL_TEAMS.filter(team => !locked.includes(team)), rng);
  const firstSliceSize = Math.max(COUNTRIES.length, locked.length);
  const fillerCount = Math.max(0, firstSliceSize - locked.length);
  const firstSlice = shuffleArray([...locked, ...rest.slice(0, fillerCount)], rng);
  return [...firstSlice, ...rest.slice(fillerCount)];
}

const SEA_ROUTE_PAIRS = [
  // Atlantico Norte
  ['US','GB'], ['US','FR'], ['US','ES'], ['US','MA'], ['CA','GB'], ['CA','IS'], ['CA','GL'], ['GL','IS'],
  ['MX','ES'], ['CU','ES'], ['CU','MA'],
  ['US','BS'], ['US','PR'], ['BS','CU'], ['BS','DO'], ['BS','PR'], ['CU','DO'], ['CU','JM'],
  ['HT','DO'], ['HT','JM'], ['DO','PR'], ['DO','JM'], ['JM','PR'],
  // Atlantico Sul
  ['BR','SN'], ['BR','NG'], ['BR','AO'], ['BR','ZA'], ['BR','PT'], ['BR','ES'],
  ['AR','ZA'], ['UY','ZA'],
  // Mediterraneo e Mar Vermelho
  ['ES','MA'], ['IT','TN'], ['GR','EG'], ['TR','EG'], ['EG','SA'], ['EG','YE'],
  ['TR','CY'], ['TR','NCY'], ['CY','NCY'], ['CY','SY'], ['CY','LB'], ['CY','IL'], ['CY','EG'],
  // Indico
  ['ZA','AU'], ['ZA','MG'], ['MZ','MG'], ['MG','KM'], ['MG','MU'],
  ['SA','IN'], ['AE','IN'], ['OM','IN'], ['IN','ID'], ['IN','MY'], ['IN','LK'], ['LK','MY'], ['LK','ID'],
  ['SO','YE'], ['SO','OM'],
  // Pacifico
  ['US','JP'], ['US','PH'], ['MX','JP'], ['MX','PH'], ['JP','KR'], ['JP','KP'], ['JP','AU'], ['JP','PG'],
  ['AU','ID'], ['AU','TL'], ['AU','PG'], ['AU','NZ'], ['NZ','PG'],
  ['AU','NC'], ['NZ','NC'], ['NZ','FJ'], ['NC','VU'], ['NC','FJ'], ['NC','SB'],
  ['VU','FJ'], ['VU','SB'], ['SB','PG'], ['SB','FJ'],
  ['ID','PH'], ['ID','PG'], ['MY','SG'], ['SG','ID'], ['BN','ID'],
  // Artico / Extremo Norte
  ['RU','CA'], ['RU','US'], ['RU','JP']
];

function buildSeaRoutes(pairs) {
  return pairs.reduce((routes, [a, b]) => {
    routes[a] = routes[a] || [];
    routes[b] = routes[b] || [];
    if (!routes[a].includes(b)) routes[a].push(b);
    if (!routes[b].includes(a)) routes[b].push(a);
    return routes;
  }, {});
}

const OCEAN_ROUTES = buildSeaRoutes(SEA_ROUTE_PAIRS);
const COUNTRY_BY_ID = new Map(COUNTRIES.map(country => [country.id, country]));
const COUNTRY_ID_SET = new Set(COUNTRIES.map(country => country.id));
const COUNTRY_IDS = COUNTRIES.map(country => country.id);
const COUNTRY_CONNECTIONS = new Map(COUNTRIES.map(country => [
  country.id,
  [...new Set([...(country.n || []), ...(OCEAN_ROUTES[country.id] || [])])]
    .filter(id => COUNTRY_ID_SET.has(id))
]));

function changePlayerCount(delta) {
  playerCount = Math.max(2, Math.min(5, playerCount + delta));
  document.getElementById('count-display').textContent = playerCount;
  renderPlayerSetup();
}

function renderPlayerSetup() {
  const cfg = document.getElementById('players-config');
  const previousNames = Array.from({ length: playerCount }, (_, i) => document.getElementById(`pname-${i}`)?.value);
  const previousBaseTeams = Array.from({ length: playerCount }, (_, i) => [0, 1, 2]
    .map(slot => getBaseTeamControlValue(i, slot)));
  cfg.innerHTML = '';
  const manualBaseTeams = getSelectedBaseTeamMode() === BASE_TEAM_MODES.MANUAL;
  for (let i = 0; i < playerCount; i++) {
    const row = document.createElement('div');
    row.className = 'player-row' + (manualBaseTeams ? ' player-row-manual' : '');
    row.innerHTML = `
      <div class="player-dot" style="background:${PLAYER_COLORS_VAL[i]}"></div>
      <input class="player-input" id="pname-${i}" type="text" placeholder="${t('player_placeholder', { n: i + 1 })}" value="${escapeHtml(previousNames[i] || DEFAULT_NAMES[i])}">
      ${manualBaseTeams ? `
        <div class="base-team-inputs">
          ${buildBaseTeamSelect(i, 0, previousBaseTeams[i]?.[0] || '')}
          ${buildBaseTeamSelect(i, 1, previousBaseTeams[i]?.[1] || '')}
          ${buildBaseTeamSelect(i, 2, previousBaseTeams[i]?.[2] || '')}
        </div>
      ` : ''}
    `;
    cfg.appendChild(row);
  }
}

renderPlayerSetup();
refreshContinueButton();

function getSetupPlayerNames() {
  return Array.from({ length: playerCount }, (_, i) => {
    const el = document.getElementById(`pname-${i}`);
    return (el?.value || el?.placeholder || DEFAULT_NAMES[i]).trim() || DEFAULT_NAMES[i];
  });
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

function drawChallenges() {
  const grid = document.getElementById('challenge-grid');
  if (!grid) return;
  const cardsByLang = window.CHALLENGE_CARDS_BY_LANG || {};
  const localizedCards = cardsByLang[currentLanguage] || cardsByLang[LANGUAGE_FALLBACK] || window.CHALLENGE_CARDS;
  const cards = Array.isArray(localizedCards) ? localizedCards.filter(c => c?.text) : [];
  if (cards.length === 0) {
    grid.innerHTML = `<div class="challenge-empty">${t('challenge_missing')}</div>`;
    return;
  }

  const seedVal = document.getElementById('seed-input')?.value.trim() || String(Date.now());
  const rng = seededRand(strToSeed(`desafios-${seedVal}-${playerCount}`));
  const shuffled = shuffleArray(cards, rng);
  const names = getSetupPlayerNames();

  grid.innerHTML = names.map((name, i) => {
    const challenge = shuffled[i % shuffled.length];
    const title = challenge.name || `Desafio ${i + 1}`;
    const text = challenge.text || '';
    return `
      <div class="challenge-item">
        <div class="challenge-player">${escapeHtml(name)}</div>
        <button class="challenge-reveal" type="button" onclick="this.closest('.challenge-item').classList.add('revealed')">
          ${t('reveal')}
        </button>
        <div class="challenge-secret">
          <div class="challenge-name">${escapeHtml(title)}</div>
          <div class="challenge-text">${escapeHtml(text)}</div>
          <button class="challenge-hide" type="button" onclick="this.closest('.challenge-item').classList.remove('revealed')">${t('hide')}</button>
        </div>
      </div>
    `;
  }).join('');
}

function clearChallenges() {
  const grid = document.getElementById('challenge-grid');
  if (!grid) return;
  grid.innerHTML = `<div class="challenge-empty">${t('challenge_empty')}</div>`;
}

function openChallengeModal() {
  document.getElementById('challenge-modal')?.classList.add('active');
}

function closeChallengeModal() {
  document.getElementById('challenge-modal')?.classList.remove('active');
}

function findTeamByInput(value) {
  const needle = String(value || '').trim().toLowerCase();
  if (!needle) return '';
  return ALL_TEAMS.find(team => team.toLowerCase() === needle) || '';
}

function getManualBaseTeamsForPlayer(index) {
  return [0, 1, 2]
    .map(slot => findTeamByInput(getBaseTeamControlValue(index, slot)))
    .filter((team, i, arr) => team && arr.indexOf(team) === i);
}

// ============================================================
// CONTINENT PICKER - prefer different continents for homes
// ============================================================
function pickHomeCountries(rng, count) {
  const continentGroups = {};
  COUNTRIES.forEach(c => {
    if (!continentGroups[c.cont]) continentGroups[c.cont] = [];
    continentGroups[c.cont].push(c.id);
  });
  const continents = Object.keys(continentGroups);
  const shuffledConts = shuffleArray(continents, rng);
  const homes = [];
  const used = new Set();

  // Try to pick one from each continent
  for (const cont of shuffledConts) {
    if (homes.length >= count) break;
    const candidates = shuffleArray(continentGroups[cont], rng);
    for (const id of candidates) {
      if (!used.has(id)) {
        homes.push(id);
        used.add(id);
        break;
      }
    }
  }
  // Fill remaining if needed
  const allShuffled = shuffleArray(COUNTRY_IDS, rng);
  for (const id of allShuffled) {
    if (homes.length >= count) break;
    if (!used.has(id)) { homes.push(id); used.add(id); }
  }
  return homes;
}

// ============================================================
// GAME START
// ============================================================
function startGame() {
  if (hasSavedGame() && !confirm(t('new_save_confirm'))) return;
  const seedVal = document.getElementById('seed-input').value.trim();
  const rng = seededRand(strToSeed(seedVal || String(Date.now())));
  teamPoolMode = getSelectedTeamPoolMode();
  baseTeamMode = getSelectedBaseTeamMode();
  const manualBaseTeams = baseTeamMode === BASE_TEAM_MODES.MANUAL
    ? Array.from({ length: playerCount }, (_, i) => getManualBaseTeamsForPlayer(i))
    : [];

  G.players = [];
  for (let i = 0; i < playerCount; i++) {
    const nameEl = document.getElementById(`pname-${i}`);
    const name = (nameEl && nameEl.value.trim()) || DEFAULT_NAMES[i];
    G.players.push({
      id: `p${i+1}`, name, color: PLAYER_COLORS_VAL[i],
      colorVar: PLAYER_COLORS[i], eliminated: false,
      territories: [], teams: []
    });
  }

  // Shuffle teams and assign one to each country
  const teamPool = buildTeamPool(rng, teamPoolMode);
  G.territories = {};
  COUNTRIES.forEach((c, i) => {
    G.territories[c.id] = { owner: null, team: teamPool[i % teamPool.length] };
  });

  // Pick home countries (different continents preferred)
  const homes = pickHomeCountries(rng, playerCount);
  G.homeOf = {};
  G.homeLives = {};
  G.homeTeams = {};

  G.players.forEach((pl, i) => {
    const homeId = homes[i];
    G.homeOf[homeId] = pl.id;
    // Assign owner
    G.territories[homeId].owner = pl.id;
    pl.territories.push(homeId);

    // Pick 3 home teams (including the country's main team)
    const mainTeam = G.territories[homeId].team;
    const chosenTeams = manualBaseTeams[i] || [];
    const pickedTeams = chosenTeams.length > 0
      ? [...chosenTeams, ...shuffleArray(teamPool.filter(t => !chosenTeams.includes(t)), rng)].slice(0, 3)
      : [mainTeam, ...shuffleArray(teamPool.filter(t => t !== mainTeam), rng).slice(0, 2)];
    if (chosenTeams.length > 0) G.territories[homeId].team = pickedTeams[0];
    G.homeTeams[homeId] = pickedTeams;
    G.homeLives[homeId] = G.homeTeams[homeId].length;
    pl.teams = [...G.homeTeams[homeId]];
  });

  G.currentPlayer = 0;
  G.attackChain = 0;
  G.log = [];
  G.teamPoolMode = teamPoolMode;
  G.baseTeamMode = baseTeamMode;
  G.teamLabelsVisible = false;
  G.stats = {};
  G.players.forEach(pl => {
    G.stats[pl.id] = { wins: 0, losses: 0, draws: 0, conquests: 0, defenses: 0, neutralDefenses: 0, revives: 0, scored: 0, conceded: 0, eliminations: 0 };
  });
  G.selectedCountry = null;
  G.attackTarget = null;
  G.selectedAttackTeam = null;
  G.selectedAttackFrom = null;
  G.pendingBattle = null;
  G.swapRewardAvailable = false;
  G.swapRewardUsedAt = 0;
  G.swapSelection = [];
  G.revive = defaultReviveState();
  G.players.forEach(pl => { G.revive.neutralDefenseStreaks[pl.id] = 0; });

  addLog('INICIO', `Jogo iniciado! ${G.players.map(p=>p.name).join(', ')} prontos para dominar o mundo.`);
  G.players.forEach(pl => {
    const homeId = Object.keys(G.homeOf).find(id => G.homeOf[id] === pl.id);
    const country = COUNTRY_BY_ID.get(homeId);
    addLog('INICIO', `<span style="color:${pl.color}">${pl.name}</span> tem base em <strong>${country.name}</strong> com times: ${G.homeTeams[homeId].join(', ')}`);
  });

  showScreen('game');
  renderMap();
  renderSidebar();
  updateTurnBar();
  saveGameState();
}

// ============================================================
// SCREEN SWITCHING
// ============================================================
function showScreen(which) {
  document.getElementById('setup-screen').style.display = (which === 'setup') ? 'flex' : 'none';
  const setupLang = document.getElementById('language-select-setup');
  const setupTopActions = document.getElementById('setup-top-actions');
  if (setupLang) setupLang.style.display = which === 'setup' ? 'block' : 'none';
  if (setupTopActions) setupTopActions.style.display = which === 'setup' ? 'flex' : 'none';
  document.getElementById('chess-screen')?.classList.toggle('active', which === 'chess');
  document.body.classList.toggle('chess-mode-open', which === 'chess');
  const gs = document.getElementById('game-screen');
  gs.classList.toggle('active', which === 'game');
  if (which === 'setup') {
    document.getElementById('winner-modal').classList.remove('active');
    document.getElementById('battle-modal').classList.remove('active');
    document.getElementById('swap-modal')?.classList.remove('active');
    refreshContinueButton();
  } else {
    closeChallengeModal();
  }
  if (which !== 'chess') document.getElementById('chess-battle-modal')?.classList.remove('active');
}

// ============================================================
// TURN
// ============================================================
function currentPlayerObj() { return G.players[G.currentPlayer]; }

function nextTurn() {
  G.attackChain = 0;
  G.swapRewardAvailable = false;
  G.swapRewardUsedAt = 0;
  G.swapSelection = [];
  document.getElementById('swap-modal')?.classList.remove('active');
  G.selectedCountry = null;
  G.attackTarget = null;
  G.selectedAttackTeam = null;
  G.selectedAttackFrom = null;
  // advance to next non-eliminated player
  let tries = 0;
  do {
    G.currentPlayer = (G.currentPlayer + 1) % G.players.length;
    tries++;
  } while (G.players[G.currentPlayer].eliminated && tries < G.players.length);

  addLog('TURNO', `Vez de <span style="color:${currentPlayerObj().color}">${currentPlayerObj().name}</span>`);
  updateTurnBar();
  renderSidebar();
  clearMapHighlights();
  saveGameState();
}

function updateTurnBar() {
  const pl = currentPlayerObj();
  document.getElementById('turn-dot').style.background = pl.color;
  document.getElementById('turn-name').textContent = pl.name;
  updateChainInfo();
  updateSwapRewardButton();
}

function updateChainInfo() {
  const el = document.getElementById('attack-chain-info');
  if (!el) return;
  if (G.attackChain > 0) {
    el.textContent = t('attack_chain', { count: G.attackChain, plural: plural(G.attackChain) });
    el.style.cssText = 'color:var(--accent3);font-weight:600;font-size:12px';
  } else {
    el.textContent = '';
  }
  updateSwapRewardButton();
}

function updateSwapRewardButton() {
  const btn = document.getElementById('btn-swap-reward');
  if (!btn) return;
  const canSwap = G.swapRewardAvailable && getSwappableTerritories(currentPlayerObj()?.id).length >= 2;
  btn.style.display = canSwap ? 'inline-flex' : 'none';
}

// ============================================================
// ATTACK LOGIC
// ============================================================
function getPlayerTerritories(playerId) {
  return G.players.find(p => p.id === playerId)?.territories || [];
}

function getCountryConnections(id) {
  return COUNTRY_CONNECTIONS.get(id) || [];
}

function isAttackable(targetId) {
  return isAttackableFrom(G.selectedCountry, targetId);
}

function getAttackableIdsFrom(sourceId) {
  const attackable = new Set();
  const pl = currentPlayerObj();
  if (!sourceId || !pl || !COUNTRY_ID_SET.has(sourceId)) return attackable;

  const reachableOwn = new Set([sourceId]);
  const stack = [sourceId];
  while (stack.length) {
    const currentId = stack.pop();
    getCountryConnections(currentId).forEach(nextId => {
      if (reachableOwn.has(nextId)) return;
      if (G.territories[nextId]?.owner !== pl.id) return;
      reachableOwn.add(nextId);
      stack.push(nextId);
    });
  }

  reachableOwn.forEach(fromId => {
    getCountryConnections(fromId).forEach(targetId => {
      if (targetId === sourceId) return;
      if (G.territories[targetId]?.owner === pl.id && !G.homeOf[targetId]) return;
      if (G.territories[targetId]?.owner === pl.id && G.homeOf[targetId] === pl.id) return;
      attackable.add(targetId);
    });
  });

  return attackable;
}

function isAttackableFrom(sourceId, targetId) {
  if (!sourceId) return false;
  const pl = currentPlayerObj();
  if (!pl || targetId === sourceId) return false;
  // Target must not be owned by current player (unless it's the home that needs 3 defeats)
  if (G.territories[targetId]?.owner === pl.id && !G.homeOf[targetId]) return false;
  if (G.territories[targetId]?.owner === pl.id && G.homeOf[targetId] === pl.id) return false;
  // Check adjacency via chain
  return isReachableFrom(sourceId, targetId, pl.id, new Set());
}

function isReachableFrom(fromId, targetId, playerId, visited) {
  if (visited.has(fromId)) return false;
  visited.add(fromId);
  if (!COUNTRY_ID_SET.has(fromId)) return false;
  for (const nId of getCountryConnections(fromId)) {
    if (nId === targetId) return true;
    // Can traverse own territories to reach target
    if (G.territories[nId]?.owner === playerId && !visited.has(nId)) {
      if (isReachableFrom(nId, targetId, playerId, visited)) return true;
    }
  }
  return false;
}

function getAttackPath(fromId, targetId, playerId) {
  // BFS to find path through own territories
  const queue = [[fromId]];
  const visited = new Set([fromId]);
  while (queue.length > 0) {
    const path = queue.shift();
    const cur = path[path.length - 1];
    if (!COUNTRY_ID_SET.has(cur)) continue;
    for (const nId of getCountryConnections(cur)) {
      if (visited.has(nId)) continue;
      const newPath = [...path, nId];
      if (nId === targetId) return newPath;
      if (G.territories[nId]?.owner === playerId) {
        visited.add(nId);
        queue.push(newPath);
      }
    }
  }
  return null;
}

function getBorderCountryForAttack(fromHome, targetId, playerId) {
  // When attacking from home territory, find which own territory borders the target
  const path = getAttackPath(fromHome, targetId, playerId);
  if (!path || path.length < 2) return null;
  // The territory just before target in path
  return path[path.length - 2];
}

function getReachableOwnTerritoriesFrom(sourceId, playerId) {
  const reachable = new Set();
  if (!sourceId || !COUNTRY_ID_SET.has(sourceId)) return reachable;
  if (G.territories[sourceId]?.owner !== playerId) return reachable;

  reachable.add(sourceId);
  const stack = [sourceId];
  while (stack.length) {
    const currentId = stack.pop();
    getCountryConnections(currentId).forEach(nextId => {
      if (reachable.has(nextId)) return;
      if (G.territories[nextId]?.owner !== playerId) return;
      reachable.add(nextId);
      stack.push(nextId);
    });
  }
  return reachable;
}

function getAttackBorderTerritories(fromId, targetId, playerId) {
  const reachable = getReachableOwnTerritoriesFrom(fromId, playerId);
  if (!reachable.size) return [];
  return getCountryConnections(targetId)
    .filter(id => G.territories[id]?.owner === playerId)
    .filter(id => reachable.has(id));
}

function handleCountryClick(id) {
  const pl = currentPlayerObj();
  if (pl.eliminated) return;

  // If clicking own territory, select it as base
  if (G.territories[id]?.owner === pl.id) {
    hoverPreviewCountry = null;
    G.selectedCountry = id;
    G.attackTarget = null;
    G.selectedAttackTeam = null;
    G.selectedAttackFrom = null;
    updateMapColors();
    renderSidebar();
    switchTab('map');
    saveGameState();
    return;
  }

  // If a source is selected and target is attackable, set attack target
  if (G.selectedCountry && isAttackable(id)) {
    hoverPreviewCountry = null;
    G.attackTarget = id;
    G.selectedAttackTeam = null;
    G.selectedAttackFrom = null;
    updateMapColors();
    renderSidebar();
    switchTab('map');
    saveGameState();
    return;
  }

  // If clicking neutral/enemy with no source, try to auto-select if player has adjacent territory
  if (!G.selectedCountry) {
    // Find if player has any territory adjacent to this
    for (const nId of getCountryConnections(id)) {
      if (G.territories[nId]?.owner === pl.id) {
        hoverPreviewCountry = null;
        G.selectedCountry = nId;
        G.attackTarget = id;
        G.selectedAttackTeam = null;
        G.selectedAttackFrom = null;
        updateMapColors();
        renderSidebar();
        switchTab('map');
        saveGameState();
        return;
      }
    }
  }
}

function getTeamsForAttack(fromId, targetId, playerId) {
  const pl = G.players.find(p => p.id === playerId);
  const homeId = Object.keys(G.homeOf).find(id => G.homeOf[id] === playerId);
  if (!pl || !targetId) return [];

  const teams = [];
  getAttackBorderTerritories(fromId, targetId, playerId).forEach(borderTerrId => {
    if (borderTerrId === homeId) {
      // From home territory: use remaining home teams (these get spent on loss)
      (G.homeTeams[homeId] || []).forEach(t => {
        teams.push({ team: t, via: homeId, isHome: true });
      });
    } else {
      // From conquered territory: use that territory team (never spent, always available)
      const team = G.territories[borderTerrId]?.team;
      if (team) teams.push({ team, via: borderTerrId, isHome: false });
    }
  });

  return teams.filter((t, i, a) => a.findIndex(x => x.team === t.team && x.via === t.via) === i);
}

// ============================================================
// LOG
// ============================================================
let logCount = 0;
function addLog(icon, msg, meta) {
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  G.log.push({ icon, msg, time, id: logCount++, ...(meta||{}) });
  if (G.log.length > 100) G.log.shift();
  // Update log panel if active
  const logPanel = document.getElementById('sidebar-log');
  if (logPanel?.classList.contains('active')) renderLogPanel();
}


