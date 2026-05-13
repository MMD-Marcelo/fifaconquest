// Battle modal, swap reward, revives, eliminations, and win condition.

// ============================================================
// BATTLE
// ============================================================
function startBattle() {
  const pl = currentPlayerObj();
  const targetTerr = G.territories[G.attackTarget];
  const targetCountry = COUNTRY_BY_ID.get(G.attackTarget);
  const attackerTeam = G.selectedAttackTeam;
  const isHome = !!G.homeOf[G.attackTarget];
  const baseDefenderTeams = isHome ? [...(G.homeTeams[G.attackTarget] || [])] : [];
  const defenderTeam = isHome ? (baseDefenderTeams[0] || targetTerr.team) : targetTerr.team;

  // Find which territory we're attacking FROM (for team consumption)
  const teams = getTeamsForAttack(G.selectedCountry, G.attackTarget, pl.id);
  const attackTeamInfo = teams.find(t => t.team === attackerTeam);
  const fromTerritoryId = attackTeamInfo?.via || G.selectedCountry;

  G.pendingBattle = {
    attackerId: pl.id,
    attackerTeam,
    defenderTeam,
    baseDefenderTeams,
    targetId: G.attackTarget,
    fromId: fromTerritoryId,
    isHome,
    neutralDefenderId: !targetTerr.owner ? (G.revive?.lastNeutralDefenderId || '') : ''
  };

  document.getElementById('battle-attacker-team').textContent = attackerTeam;
  document.getElementById('battle-attacker-country').textContent = pl.name;
  document.getElementById('battle-defender-team').textContent = defenderTeam;
  document.getElementById('battle-defender-country').textContent = targetCountry?.name;

  let ctx = '';
  const targetOwner = targetTerr.owner ? G.players.find(p => p.id === targetTerr.owner) : null;
  if (targetOwner) ctx = `${targetOwner.name} defende ${targetCountry?.name}`;
  else ctx = `Territorio neutro: ${targetCountry?.name}`;
  if (G.pendingBattle.isHome) ctx += ` (Base - ${G.homeLives[G.attackTarget]} vida${G.homeLives[G.attackTarget]!==1?'s':''})`;
  document.getElementById('battle-context').textContent = ctx;
  renderDefenderTeamPicker();
  renderNeutralDefenderPicker();

  document.getElementById('battle-modal').classList.add('active');
  const sa = document.getElementById('score-attacker');
  const sd = document.getElementById('score-defender');
  if (sa) sa.focus();
}

function renderDefenderTeamPicker() {
  const wrap = document.getElementById('defender-team-select');
  if (!wrap) return;
  const b = G.pendingBattle;
  if (!b?.isHome || !b.baseDefenderTeams?.length) {
    wrap.classList.remove('active');
    wrap.innerHTML = '';
    return;
  }

  wrap.classList.add('active');
  wrap.innerHTML = b.baseDefenderTeams.map(team => `
    <button class="defender-team-option ${team === b.defenderTeam ? 'selected' : ''}" onclick="selectDefenderTeam('${team.replace(/'/g, "\\'")}')">${team}</button>
  `).join('');
}

function selectDefenderTeam(team) {
  if (!G.pendingBattle?.isHome) return;
  G.pendingBattle.defenderTeam = team;
  document.getElementById('battle-defender-team').textContent = team;
  renderDefenderTeamPicker();
}

function getNeutralDefenseStreak(playerId) {
  return Number(G.revive?.neutralDefenseStreaks?.[playerId] || 0);
}

function getEligibleNeutralDefenders() {
  const attackerId = G.pendingBattle?.attackerId;
  return (G.players || []).filter(pl => pl.id !== attackerId);
}

function renderNeutralDefenderPicker() {
  const wrap = document.getElementById('neutral-defender-select');
  if (!wrap) return;
  const b = G.pendingBattle;
  const targetOwner = b?.targetId ? G.territories[b.targetId]?.owner : null;
  const options = !targetOwner ? getEligibleNeutralDefenders() : [];
  if (!b || options.length === 0) {
    wrap.classList.remove('active');
    wrap.innerHTML = '';
    return;
  }

  if (!b.neutralDefenderId || !options.some(pl => pl.id === b.neutralDefenderId)) {
    b.neutralDefenderId = '';
  }

  wrap.classList.add('active');
  wrap.innerHTML = `
    <label for="neutral-defender-picker">${t('neutral_defender')}</label>
    <select id="neutral-defender-picker" onchange="selectNeutralDefender(this.value)">
      <option value="">${t('no_player')}</option>
      ${options.map(pl => {
        const reviveInfo = pl.eliminated ? ` (${getNeutralDefenseStreak(pl.id)}/3)` : '';
        return `<option value="${pl.id}" ${pl.id === b.neutralDefenderId ? 'selected' : ''}>${escapeHtml(pl.name)}${reviveInfo}</option>`;
      }).join('')}
    </select>
  `;
}

function selectNeutralDefender(playerId) {
  if (!G.pendingBattle) return;
  G.pendingBattle.neutralDefenderId = playerId || '';
  if (playerId) G.revive.lastNeutralDefenderId = playerId;
}

function normalizeScoreInput(input) {
  input.value = input.value.replace(/\D/g, '').slice(0, 2);
}

function readScore(id) {
  const value = document.getElementById(id)?.value || '0';
  return Math.max(0, Math.min(99, parseInt(value, 10) || 0));
}

function recordNeutralDefenseResult(playerId, defended) {
  if (!playerId) return '';
  const defender = G.players.find(pl => pl.id === playerId);
  if (!defender) return '';
  G.revive = { ...defaultReviveState(), ...(G.revive || {}) };
  G.revive.neutralDefenseStreaks = G.revive.neutralDefenseStreaks || {};
  ensureStatsShape(playerId);

  if (defended) {
    G.stats[playerId].neutralDefenses = (G.stats[playerId].neutralDefenses || 0) + 1;
    if (!defender.eliminated) {
      return `<span style="color:${defender.color}">${defender.name}</span> defendeu o neutro.`;
    }
    const streak = Math.min(3, getNeutralDefenseStreak(playerId) + 1);
    G.revive.neutralDefenseStreaks[playerId] = streak;
    return `<span style="color:${defender.color}">${defender.name}</span> defendeu neutro (${streak}/3).`;
  }

  if (defender.eliminated) {
    G.revive.neutralDefenseStreaks[playerId] = 0;
    return `<span style="color:${defender.color}">${defender.name}</span> perdeu a sequencia de defesa neutra.`;
  }

  return `<span style="color:${defender.color}">${defender.name}</span> nao segurou o neutro.`;
}

function resolveBattle(result) {
  document.getElementById('battle-modal').classList.remove('active');
  const b = G.pendingBattle;
  G.pendingBattle = null;
  const win = result === true;
  const isDraw = result === 'draw';

  // Read scores
  const scoreAtt = readScore('score-attacker');
  const scoreDef = readScore('score-defender');
  // Reset score inputs
  const sa = document.getElementById('score-attacker'); if(sa) sa.value = 0;
  const sd = document.getElementById('score-defender'); if(sd) sd.value = 0;
  const pl = G.players.find(p => p.id === b.attackerId);
  const targetCountry = COUNTRY_BY_ID.get(b.targetId);
  const prevOwner = G.territories[b.targetId].owner;
  const prevOwnerPl = prevOwner ? G.players.find(p => p.id === prevOwner) : null;
  const battleDesc = `${pl.name} x ${targetCountry?.name}`;

  // Update stats
  ensureStatsShape(b.attackerId);
  G.stats[b.attackerId].scored += scoreAtt;
  G.stats[b.attackerId].conceded += scoreDef;
  if (prevOwnerPl) {
    ensureStatsShape(prevOwnerPl.id);
    G.stats[prevOwnerPl.id].scored += scoreDef;
    G.stats[prevOwnerPl.id].conceded += scoreAtt;
  }

  if (isDraw) {
    if (G.stats[b.attackerId]) G.stats[b.attackerId].draws++;
    if (prevOwnerPl && G.stats[prevOwnerPl.id]) G.stats[prevOwnerPl.id].draws++;
    const neutralMsg = !prevOwner ? recordNeutralDefenseResult(b.neutralDefenderId, false) : '';
    const scoreStr = `${scoreAtt} x ${scoreDef}`;
    addLog('EMP', `<span style="color:${pl.color}">${pl.name}</span> empatou em <strong>${targetCountry?.name}</strong> ${scoreStr}. Vez passa.${neutralMsg ? ' ' + neutralMsg : ''}`, { score: scoreStr, battleDesc });
    updateMapColors();
    renderSidebar();
    switchTab('map');
    saveGameState();
    nextTurn();
    return;
  }

  if (win) {
    G.attackChain++;
    if (b.isHome) {
      removeHomeDefenderTeam(b.targetId, b.defenderTeam);
      G.homeLives[b.targetId] = G.homeTeams[b.targetId]?.length || 0;
      if (G.homeLives[b.targetId] <= 0) {
        // Conquered home! Defender eliminated
        const defenderPl = prevOwnerPl;
        if (defenderPl) {
          G.territories[b.targetId].team = b.defenderTeam;
          const neutralized = eliminatePlayer(defenderPl.id);
          const scoreStrElim = `${scoreAtt} x ${scoreDef}`;
          if (G.stats[b.attackerId]) G.stats[b.attackerId].wins++;
          if (G.stats[b.attackerId]) G.stats[b.attackerId].eliminations = (G.stats[b.attackerId].eliminations || 0) + 1;
          if (G.stats[defenderPl.id]) G.stats[defenderPl.id].losses++;
          addLog('ELIM', `<span class="log-win">${pl.name}</span> derrubou a base de <span class="log-lose">${defenderPl.name}</span>. ${neutralized.length} territorio${neutralized.length!==1?'s':''} virou${neutralized.length!==1?'am':''} neutro${neutralized.length!==1?'s':''}. ${scoreStrElim}`, { score: scoreStrElim, battleDesc });
        }
        // WIN: do NOT remove attacker's team on victory
      } else {
        const scoreStrAtk = `${scoreAtt} x ${scoreDef}`;
        if (G.stats[b.attackerId]) { G.stats[b.attackerId].wins++; G.stats[b.attackerId].conquests++; }
        if (prevOwnerPl && G.stats[prevOwnerPl.id]) G.stats[prevOwnerPl.id].losses++;
        addLog('ATK', `<span class="log-win">${pl.name}</span> venceu ${b.defenderTeam} em <strong>${targetCountry?.name}</strong>! Base com ${G.homeLives[b.targetId]} time${G.homeLives[b.targetId]!==1?'s':''} restante${G.homeLives[b.targetId]!==1?'s':''}. ${scoreStrAtk}`, { score: scoreStrAtk, battleDesc });
        // WIN: do NOT remove attacker's team on victory
      }
    } else {
      // Gain territory
      if (prevOwnerPl) {
        prevOwnerPl.territories = prevOwnerPl.territories.filter(t => t !== b.targetId);
        // Loser does NOT lose territory team - it stays with the territory
      }
      G.territories[b.targetId].owner = pl.id;
      if (!pl.territories.includes(b.targetId)) pl.territories.push(b.targetId);
      // Winner gets the territory's team (added to conquered teams)
      // Note: territory teams are NOT in pl.teams - they're accessed via pl.territories
      // WIN: do NOT remove attacker's team on victory
      
      const scoreStrWin = `${scoreAtt} x ${scoreDef}`;
      if (G.stats[b.attackerId]) { G.stats[b.attackerId].wins++; G.stats[b.attackerId].conquests++; }
      if (prevOwnerPl && G.stats[prevOwnerPl.id]) { G.stats[prevOwnerPl.id].losses++; G.stats[prevOwnerPl.id].defenses = Math.max(0, (G.stats[prevOwnerPl.id].defenses||0)); }
      const neutralMsg = !prevOwner ? recordNeutralDefenseResult(b.neutralDefenderId, false) : '';
      addLog('WIN', `<span class="log-win">${pl.name}</span> conquistou <strong>${targetCountry?.name}</strong>! Time ${b.defenderTeam}. ${scoreStrWin}${neutralMsg ? ' ' + neutralMsg : ''}`, { score: scoreStrWin, battleDesc });

      // Check if prev owner is eliminated (no base teams AND no territories to fight from)
      if (prevOwnerPl && prevOwnerPl.teams.length === 0 && prevOwnerPl.territories.length === 0 && !prevOwnerPl.eliminated) {
        eliminatePlayer(prevOwnerPl.id);
        addLog('ELIM', `<span class="log-lose">${prevOwnerPl.name}</span> ficou sem times e foi eliminado!`);
      }
    }

    // Check win condition
    checkWinCondition();

    // Continue attacking
    G.selectedCountry = G.territories[b.targetId]?.owner === pl.id
      ? b.targetId
      : (G.territories[b.fromId]?.owner === pl.id ? b.fromId : null);
    G.attackTarget = null;
    G.selectedAttackTeam = null;
    updateChainInfo();
    maybeShowSwapReward(pl);
  } else {
    // LOSS
    removeTeamFromPlayer(pl, b.attackerTeam, b.fromId);

    // If attacking from a conquered (non-home) territory, it reverts to neutral on loss
    const homeId_loss = Object.keys(G.homeOf).find(id => G.homeOf[id] === pl.id);
    if (b.fromId && b.fromId !== homeId_loss) {
      G.territories[b.fromId].owner = null;
      pl.territories = pl.territories.filter(t => t !== b.fromId);
      addLog('RET', '<strong>' + (COUNTRY_BY_ID.get(b.fromId)?.name||b.fromId) + '</strong> voltou a ser neutro');
    }
    const scoreStrDef = `${scoreAtt} x ${scoreDef}`;
    if (G.stats[b.attackerId]) G.stats[b.attackerId].losses++;
    if (prevOwnerPl && G.stats[prevOwnerPl.id]) G.stats[prevOwnerPl.id].defenses = (G.stats[prevOwnerPl.id].defenses||0)+1;
    const neutralMsg = !prevOwner ? recordNeutralDefenseResult(b.neutralDefenderId, true) : '';
    addLog('DEF', `<span class="log-lose">${pl.name}</span> perdeu em <strong>${targetCountry?.name}</strong> com ${b.attackerTeam}. ${scoreStrDef}${neutralMsg ? ' ' + neutralMsg : ''}`, { score: scoreStrDef, battleDesc });

    if (pl.teams.length === 0) {
      const neutralized = eliminatePlayer(pl.id);
      addLog('ELIM', `<span class="log-lose">${pl.name}</span> ficou sem times e foi eliminado. ${neutralized.length} territorio${neutralized.length!==1?'s':''} virou${neutralized.length!==1?'am':''} neutro${neutralized.length!==1?'s':''}.`);
    }

    checkWinCondition();
    // End turn on loss
    nextTurn();
  }

  updateMapColors();
  renderSidebar();
  switchTab('map');
  saveGameState();
}

function getSwappableTerritories(playerId) {
  const pl = G.players.find(p => p.id === playerId);
  if (!pl) return [];
  return pl.territories
    .filter(id => G.territories[id]?.team)
    .map(id => ({
      id,
      country: COUNTRY_BY_ID.get(id)?.name || id,
      team: G.territories[id].team,
      isHome: G.homeOf[id] === playerId
    }));
}

function maybeShowSwapReward(pl) {
  if (!pl || pl.eliminated) return;
  if (G.swapRewardAvailable) return;
  if (G.attackChain < 3) return;
  if (G.attackChain % 3 !== 0) return;
  if (G.swapRewardUsedAt === G.attackChain) return;
  const options = getSwappableTerritories(pl.id);
  if (options.length < 2) return;

  G.swapRewardAvailable = true;
  G.swapRewardUsedAt = G.attackChain;
  G.swapSelection = [];
  updateSwapRewardButton();
  addLog('BONUS', `<span style="color:${pl.color}">${pl.name}</span> liberou uma troca de times ate perder ou passar a vez.`);
}

function openSwapReward() {
  const pl = currentPlayerObj();
  if (!G.swapRewardAvailable || getSwappableTerritories(pl.id).length < 2) return;
  G.swapSelection = [];
  renderSwapModal();
  document.getElementById('swap-modal')?.classList.add('active');
}

function renderSwapModal(options = null) {
  const pl = currentPlayerObj();
  const list = document.getElementById('swap-options');
  const action = document.getElementById('swap-confirm');
  if (!list || !action || !pl) return;
  const data = options || getSwappableTerritories(pl.id);

  list.innerHTML = data.map(item => {
    const selected = G.swapSelection.includes(item.id);
    return `
      <button class="swap-option ${selected ? 'selected' : ''}" onclick="toggleSwapSelection('${item.id}')">
        <span class="swap-country">${item.country}${item.isHome ? ' Base' : ''}</span>
        <span class="swap-team">${item.team}</span>
      </button>
    `;
  }).join('');
  action.disabled = G.swapSelection.length !== 2;
}

function toggleSwapSelection(id) {
  if (G.swapSelection.includes(id)) {
    G.swapSelection = G.swapSelection.filter(x => x !== id);
  } else {
    if (G.swapSelection.length >= 2) G.swapSelection.shift();
    G.swapSelection.push(id);
  }
  renderSwapModal();
}

function skipSwapReward() {
  G.swapSelection = [];
  document.getElementById('swap-modal')?.classList.remove('active');
  saveGameState();
}

function confirmSwapReward() {
  if (G.swapSelection.length !== 2) return;
  const [a, b] = G.swapSelection;
  const terrA = G.territories[a];
  const terrB = G.territories[b];
  if (!terrA || !terrB) return;

  const oldTeamA = terrA.team;
  const oldTeamB = terrB.team;
  terrA.team = oldTeamB;
  terrB.team = oldTeamA;
  syncHomeTeamAfterSwap(a, oldTeamA, oldTeamB);
  syncHomeTeamAfterSwap(b, oldTeamB, oldTeamA);

  const countryA = COUNTRY_BY_ID.get(a)?.name || a;
  const countryB = COUNTRY_BY_ID.get(b)?.name || b;
  addLog('TROCA', `<span style="color:${currentPlayerObj().color}">${currentPlayerObj().name}</span> trocou os times entre <strong>${countryA}</strong> e <strong>${countryB}</strong>.`);

  G.swapRewardAvailable = false;
  skipSwapReward();
  updateMapColors();
  renderSidebar();
  updateSwapRewardButton();
  saveGameState();
}

function syncHomeTeamAfterSwap(countryId, oldTeam, newTeam) {
  const homeTeams = G.homeTeams[countryId];
  if (!homeTeams) return;
  const index = homeTeams.indexOf(oldTeam);
  if (index !== -1) homeTeams[index] = newTeam;
  const owner = G.homeOf[countryId];
  const pl = owner ? G.players.find(p => p.id === owner) : null;
  if (pl) pl.teams = [...homeTeams];
}

function removeHomeDefenderTeam(countryId, team) {
  const homeTeams = G.homeTeams[countryId];
  if (!homeTeams) return;
  const index = homeTeams.indexOf(team);
  if (index !== -1) homeTeams.splice(index, 1);
  const owner = G.homeOf[countryId];
  const pl = owner ? G.players.find(p => p.id === owner) : null;
  if (pl) pl.teams = [...homeTeams];
}

function removeTeamFromPlayer(pl, team, fromTerritoryId) {
  // Only remove HOME teams - territory teams are never removed, they stay with the territory.
  const homeId = Object.keys(G.homeOf).find(id => G.homeOf[id] === pl.id);
  if (homeId && G.homeTeams[homeId]) {
    const hi = G.homeTeams[homeId].indexOf(team);
    if (hi !== -1) {
      G.homeTeams[homeId].splice(hi, 1);
      const pi = pl.teams.indexOf(team);
      if (pi !== -1) pl.teams.splice(pi, 1);
    }
  }
  // Non-home teams: DO NOT remove. They stay with the territory permanently.
}

function neutralizePlayerTerritories(playerId) {
  const pl = G.players.find(p => p.id === playerId);
  if (!pl) return [];
  const neutralized = [];
  Object.entries(G.territories || {}).forEach(([tid, terr]) => {
    if (terr?.owner !== playerId) return;
    terr.owner = null;
    neutralized.push(tid);
  });

  Object.entries(G.homeOf || {}).forEach(([tid, ownerId]) => {
    if (ownerId !== playerId) return;
    delete G.homeOf[tid];
    delete G.homeLives[tid];
    delete G.homeTeams[tid];
  });

  pl.territories = [];
  pl.teams = [];
  return neutralized;
}

function eliminatePlayer(playerId) {
  const pl = G.players.find(p => p.id === playerId);
  if (!pl) return [];
  const neutralized = neutralizePlayerTerritories(playerId);
  pl.eliminated = true;
  G.revive = G.revive || defaultReviveState();
  G.revive.neutralDefenseStreaks = G.revive.neutralDefenseStreaks || {};
  if (!Number.isFinite(Number(G.revive.neutralDefenseStreaks[playerId]))) {
    G.revive.neutralDefenseStreaks[playerId] = 0;
  }
  return neutralized;
}

function getNeutralReviveTerritories() {
  return COUNTRIES
    .map(c => c.id)
    .filter(id => G.territories[id] && !G.territories[id].owner && !G.homeOf[id]);
}

function revivePlayer(playerId) {
  const pl = G.players.find(p => p.id === playerId);
  if (!pl || !pl.eliminated || getNeutralDefenseStreak(playerId) < 3) return;
  const options = getNeutralReviveTerritories();
  if (options.length === 0) {
    addLog('REV', `Nao ha territorio neutro livre para reviver ${pl.name}.`);
    renderSidebar();
    return;
  }

  const seed = strToSeed(`${Date.now()}-${playerId}-${options.join('|')}`);
  const rng = seededRand(seed);
  const countryId = options[Math.floor(rng() * options.length)];
  const terr = G.territories[countryId];
  const team = terr.team || ALL_TEAMS[Math.floor(rng() * ALL_TEAMS.length)] || '';

  terr.owner = pl.id;
  G.homeOf[countryId] = pl.id;
  G.homeTeams[countryId] = [team];
  G.homeLives[countryId] = 1;
  pl.territories = [countryId];
  pl.teams = [team];
  pl.eliminated = false;
  G.revive.neutralDefenseStreaks[playerId] = 0;
  ensureStatsShape(playerId);
  G.stats[playerId].revives = (G.stats[playerId].revives || 0) + 1;

  const country = COUNTRY_BY_ID.get(countryId);
  addLog('REV', `<span style="color:${pl.color}">${pl.name}</span> reviveu em <strong>${country?.name || countryId}</strong> com ${team} (1 vida).`);
  updateMapColors();
  renderSidebar();
  updateTurnBar();
  saveGameState();
}

// ============================================================
// WIN CONDITION
// ============================================================
function checkWinCondition() {
  const alive = G.players.filter(p => !p.eliminated);
  if (alive.length === 1) {
    showWinner(alive[0]);
    return;
  }
  // Also check: did all home territories fall?
  // (already handled via eliminated flag)
}

function showWinner(pl) {
  document.getElementById('winner-name').textContent = pl.name;
  document.getElementById('winner-name').style.color = pl.color;
  document.getElementById('winner-modal').classList.add('active');
  addLog('WIN', `<span style="color:${pl.color}">${pl.name}</span> dominou o mundo!`);
  saveGameState();
}

