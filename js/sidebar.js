// Sidebar panels, team directory, logs, exports, and stats.

// ============================================================
// SIDEBAR RENDERING
// ============================================================
function switchTab(tab) {
  ['players','teams','map','log','stats'].forEach(t => {
    const tabEl = document.getElementById(`tab-${t}`);
    const panelEl = document.getElementById(`sidebar-${t}`);
    if (tabEl) tabEl.classList.toggle('active', t === tab);
    if (panelEl) panelEl.classList.toggle('active', t === tab);
  });
  document.getElementById('sidebar')?.classList.toggle('players-tab-active', tab === 'players');
  renderSidebarPanel(tab);
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;
  sidebar.classList.toggle('collapsed');
  sidebar.classList.toggle('players-tab-active', document.getElementById('tab-players')?.classList.contains('active'));
}

function renderSidebar() {
  const activeTab = document.querySelector('.tab-panel.active')?.id?.replace('sidebar-', '') || 'players';
  renderSidebarPanel(activeTab);
}

function renderSidebarPanel(tab) {
  if (tab === 'map') renderAttackPanel();
  if (tab === 'players') renderPlayersPanel();
  if (tab === 'teams') renderTeamsPanel();
  if (tab === 'log') renderLogPanel();
  if (tab === 'stats') renderStatsPanel();
}

function renderPlayersPanel() {
  const el = document.getElementById('sidebar-players');
  el.innerHTML = '';
  G.players.forEach((pl, i) => {
    const homeId = Object.keys(G.homeOf).find(id => G.homeOf[id] === pl.id);
    const homeCountry = homeId ? COUNTRY_BY_ID.get(homeId) : null;
    const lives = homeId ? G.homeLives[homeId] : 0;
    const neutralStreak = getNeutralDefenseStreak(pl.id);
    const canRevive = pl.eliminated && neutralStreak >= 3 && getNeutralReviveTerritories().length > 0;
    const div = document.createElement('div');
    div.className = 'player-card' + (pl.eliminated ? ' eliminated-card' : '') + (canRevive ? ' can-revive' : '');
    div.style.borderLeftColor = pl.color;

    const isCurrent = G.players[G.currentPlayer].id === pl.id && !pl.eliminated;
    const liveDots = homeId ? `<span style="font-family:Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:1px;color:var(--home-color)">${lives}/3 vida${lives!==1?'s':''}</span>` : '';

    div.innerHTML = `
      <div class="player-card-header">
        <div class="player-card-dot" style="background:${pl.color}"></div>
        <span class="player-card-name">${pl.name}</span>
        ${isCurrent ? '<span class="current-turn-tag">VEZ</span>' : ''}
        ${pl.eliminated ? '<span class="eliminated-tag">ELIMINADO</span>' : ''}
      </div>
      ${pl.eliminated ? '<div class="eliminated-status">Territorios neutralizados. Pode defender neutros para tentar reviver.</div>' : ''}
      ${homeCountry ? `
        <div class="home-territory-name" style="font-size:12px;color:var(--muted);margin-bottom:6px;">Base: <strong style="color:var(--text)">${homeCountry?.name||''}</strong><span style="margin-left:8px;color:var(--accent3)">${liveDots}</span></div>
      ` : ''}
      <div class="teams-label">Times da base (${pl.teams.length})</div>
      <div class="team-list">
        ${pl.teams.length === 0
          ? '<span class="empty-base-teams" style="font-size:11px;color:var(--muted)">Sem times de base</span>'
          : pl.teams.map(t => '<div class="team-chip home-team"><span class="chip-name">' + t + '</span><span class="chip-league">' + (TEAM_LEAGUE[t]||'') + '</span></div>').join('')}
      </div>
      ${pl.territories.filter(tid => tid !== homeId && !G.homeOf[tid]).length > 0 ? '<div class="teams-label" style="margin-top:6px">Times conquistados</div><div class="team-list">' + pl.territories.filter(tid => tid !== homeId && !G.homeOf[tid]).map(tid => { const t = G.territories[tid]?.team || ''; const cn = COUNTRY_BY_ID.get(tid)?.name || tid; return '<div class="team-chip" title="' + cn + '"><span class="chip-name">' + t + '</span><span class="chip-league">' + (TEAM_LEAGUE[t]||'') + '</span></div>'; }).join('') + '</div>' : ''}
      <div style="margin-top:8px;font-size:12px;color:var(--muted);">
        ${pl.territories.length} territorio${pl.territories.length !== 1 ? 's' : ''}
      </div>
    `;
    const headerState = div.querySelector('.current-turn-tag, .eliminated-tag');
    if (isCurrent && headerState) headerState.textContent = t('turn_tag');
    if (pl.eliminated && headerState) headerState.textContent = t('eliminated');
    const eliminatedStatus = div.querySelector('.eliminated-status');
    if (eliminatedStatus) eliminatedStatus.textContent = t('eliminated_status');
    const homeName = div.querySelector('.home-territory-name');
    if (homeName && homeCountry) {
      homeName.innerHTML = `${t('base')}: <strong style="color:var(--text)">${homeCountry?.name||''}</strong><span style="margin-left:8px;color:var(--accent3)">${lives}/3</span>`;
    }
    const teamLabels = div.querySelectorAll('.teams-label');
    if (teamLabels[0]) teamLabels[0].textContent = `${t('base_teams')} (${pl.teams.length})`;
    if (teamLabels[1]) teamLabels[1].textContent = t('conquered_teams');
    const emptyBase = div.querySelector('.empty-base-teams');
    if (emptyBase) emptyBase.textContent = t('no_base_teams');
    const territoryCount = div.querySelector('div[style*="margin-top:8px"]');
    if (territoryCount) territoryCount.textContent = `${pl.territories.length} ${t('territories')}`;
    if (pl.eliminated) {
      div.insertAdjacentHTML('beforeend', `
        <div class="revive-row">
          <span>${t('neutral_defenses')}: ${neutralStreak}/3</span>
          ${canRevive ? `<button class="btn-revive" type="button" onclick="revivePlayer('${pl.id}')">${t('revive')}</button>` : ''}
        </div>
      `);
    }
    el.appendChild(div);
  });
}

function renderAttackPanel() {
  const el = document.getElementById('sidebar-map');
  el.innerHTML = '';
  const pl = currentPlayerObj();
  if (pl.eliminated) return;

  // Instructions
  const instr = document.createElement('div');
  instr.className = 'instruction-box';
  instr.innerHTML = `<strong>${t('turn_of', { name: pl.name })}</strong><br>
    ${t('attack_step_1')}<br>
    ${t('attack_step_2')}<br>
    ${t('attack_step_3')}`;
  el.appendChild(instr);

  if (G.selectedCountry) {
    const srcCountry = COUNTRY_BY_ID.get(G.selectedCountry);
    const srcInfo = document.createElement('div');
    srcInfo.style.cssText = 'font-size:13px;color:var(--muted);margin-bottom:12px;';
    srcInfo.innerHTML = `${t('from')} <strong style="color:var(--text)">${srcCountry?.name}</strong>`;
    el.appendChild(srcInfo);
  }

  if (G.selectedCountry && G.attackTarget) {
    const panel = document.createElement('div');
    panel.id = 'attack-panel';
    panel.className = 'player-card';
    panel.style.borderLeftColor = 'var(--accent3)';

    const targetCountry = COUNTRY_BY_ID.get(G.attackTarget);
    const targetTerr = G.territories[G.attackTarget];
    const targetOwner = targetTerr?.owner ? G.players.find(p => p.id === targetTerr.owner) : null;
    const isHomeTarget = !!G.homeOf[G.attackTarget];
    const homeDefenderLives = isHomeTarget ? G.homeLives[G.attackTarget] : null;

    panel.innerHTML = `<h3>${t('attack_target')}</h3>
      <div class="attack-country-name">${targetCountry?.name}</div>
      <div class="attack-team-name">${targetTerr?.team}</div>
      <div class="attack-owner">${targetOwner ? `<span style="color:${targetOwner.color}">${escapeHtml(t('controlled_by', { name: targetOwner.name }))}</span>` : t('neutral_territory')}
        ${isHomeTarget ? `<span style="color:var(--home-color)">  ${t('base')}! (${homeDefenderLives}/3)</span>` : ''}</div>
    `;

    const teams = getTeamsForAttack(G.selectedCountry, G.attackTarget, pl.id);
    if (G.selectedAttackTeam && !G.selectedAttackFrom) {
      const current = teams.find(t => t.team === G.selectedAttackTeam);
      if (current) G.selectedAttackFrom = current.via;
    }
    if (G.selectedAttackTeam && !teams.some(t => t.team === G.selectedAttackTeam && t.via === G.selectedAttackFrom)) {
      G.selectedAttackTeam = null;
      G.selectedAttackFrom = null;
    }
    if (teams.length === 0) {
      const msg = document.createElement('div');
      msg.className = 'no-attack-msg';
      msg.textContent = t('no_team_attack');
      panel.appendChild(msg);
    } else {
      const lbl = document.createElement('div');
      lbl.className = 'select-team-label';
      lbl.textContent = t('choose_team');
      panel.appendChild(lbl);

      const opts = document.createElement('div');
      opts.className = 'attack-team-options';
      teams.forEach(t => {
        const btn = document.createElement('button');
        const selected = G.selectedAttackTeam === t.team && G.selectedAttackFrom === t.via;
        btn.className = 'attack-team-btn' + (selected ? ' selected' : '');
        btn.innerHTML = `${t.team} <span class="attack-team-via">${TEAM_LEAGUE[t.team]||''} &mdash; via ${COUNTRY_BY_ID.get(t.via)?.name||t.via}</span>`;
        btn.onclick = () => {
          G.selectedAttackTeam = t.team;
          G.selectedAttackFrom = t.via;
          renderAttackPanel();
          saveGameState();
        };
        opts.appendChild(btn);
      });
      panel.appendChild(opts);
    }

    const btns = document.createElement('div');
    btns.className = 'attack-buttons';
    const attackBtn = document.createElement('button');
    attackBtn.className = 'btn-attack';
    attackBtn.textContent = t('attack');
    attackBtn.disabled = !G.selectedAttackTeam;
    attackBtn.onclick = startBattle;
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn-cancel';
    cancelBtn.textContent = t('cancel');
    cancelBtn.onclick = () => {
      G.selectedCountry = null; G.attackTarget = null; G.selectedAttackTeam = null; G.selectedAttackFrom = null;
      updateMapColors(); renderSidebar(); switchTab('map');
      saveGameState();
    };
    btns.appendChild(attackBtn);
    btns.appendChild(cancelBtn);
    panel.appendChild(btns);
    el.appendChild(panel);
  } else if (!G.selectedCountry) {
    if (pl.teams.length === 0) {
      const msg = document.createElement('div');
      msg.className = 'no-attack-msg';
      msg.innerHTML = `<strong style="color:var(--accent2)">${t('no_teams_eliminated', { name: pl.name })}</strong>`;
      el.appendChild(msg);
    }
  }

}

function getTeamDirectoryRows(query = '') {
  const q = query.trim().toLowerCase();
  return COUNTRIES.map(country => {
    const terr = G.territories[country.id] || {};
    const owner = terr.owner ? G.players.find(p => p.id === terr.owner) : null;
    const isHome = !!G.homeOf[country.id];
    const homeOwner = isHome ? G.players.find(p => p.id === G.homeOf[country.id]) : null;
    const team = terr.team || '';
    const league = TEAM_LEAGUE[team] || '';
    const status = isHome ? t('base_of', { name: homeOwner?.name || owner?.name || '-' }) : (owner ? t('controlled_by', { name: owner.name }) : t('neutral'));
    return {
      countryId: country.id,
      country: country.name,
      team,
      league,
      ownerName: owner?.name || 'Neutro',
      ownerColor: owner?.color || 'var(--muted2)',
      status,
      isHome,
      haystack: `${team} ${league} ${country.name} ${country.id} ${owner?.name || 'neutro'} ${status}`.toLowerCase()
    };
  }).filter(row => !q || row.haystack.includes(q));
}

function renderTeamsPanel(query = null) {
  const el = document.getElementById('sidebar-teams');
  if (!el) return;
  const previousSearch = query ?? (document.getElementById('team-search')?.value || '');
  const rows = getTeamDirectoryRows(previousSearch);

  el.innerHTML = `
    <div class="teams-search-card">
      <div class="teams-search-title">${t('search_map')}</div>
      <input id="team-search" class="teams-search-input" type="search" placeholder="${t('search_placeholder')}" value="${escapeHtml(previousSearch)}" oninput="renderTeamsPanel(this.value)">
      <div class="teams-search-meta">${t('result_count', { count: rows.length, plural: plural(rows.length) })}</div>
    </div>
    <div class="teams-directory">
      ${rows.map(row => `
        <button class="team-directory-row" type="button" onclick="focusTeamCountry('${row.countryId}')">
          <div class="team-directory-main">
            <span class="team-directory-team">${escapeHtml(row.team)}</span>
            <span class="team-directory-league">${escapeHtml(row.league)}</span>
          </div>
          <div class="team-directory-place">
            <span>${escapeHtml(row.country)}${row.isHome ? ' - ' + t('base') : ''}</span>
            <span class="team-directory-owner" style="color:${row.ownerColor}">${escapeHtml(row.ownerName)}</span>
          </div>
        </button>
      `).join('') || `<div class="challenge-empty">${t('no_team_found')}</div>`}
    </div>
  `;

  const input = document.getElementById('team-search');
  if (input && query !== null) {
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }
}

function focusTeamCountry(countryId) {
  if (!G.territories?.[countryId]) return;
  hoverPreviewCountry = null;
  G.selectedCountry = G.territories[countryId]?.owner === currentPlayerObj()?.id ? countryId : null;
  G.attackTarget = null;
  G.selectedAttackTeam = null;
  G.selectedAttackFrom = null;
  updateMapColors();
  centerMapOnCountry(countryId);
  switchTab('map');
  saveGameState();
}

const LOG_ICON_LABELS = {
  en: { INICIO: 'START', TURNO: 'TURN', EMP: 'DRAW', ATK: 'ATK', WIN: 'WIN', DEF: 'DEF', RET: 'RET', ELIM: 'ELIM', BONUS: 'BONUS', TROCA: 'SWAP', REV: 'REV', EXP: 'EXP' },
  es: { INICIO: 'INICIO', TURNO: 'TURNO', EMP: 'EMPATE', ATK: 'ATQ', WIN: 'VICTORIA', DEF: 'DEF', RET: 'RET', ELIM: 'ELIM', BONUS: 'BONUS', TROCA: 'CAMBIO', REV: 'REV', EXP: 'EXP' },
  it: { INICIO: 'INIZIO', TURNO: 'TURNO', EMP: 'PAREGGIO', ATK: 'ATT', WIN: 'VITTORIA', DEF: 'DIF', RET: 'RIT', ELIM: 'ELIM', BONUS: 'BONUS', TROCA: 'SCAMBIO', REV: 'RIN', EXP: 'EXP' },
  fr: { INICIO: 'DEBUT', TURNO: 'TOUR', EMP: 'NUL', ATK: 'ATQ', WIN: 'VICTOIRE', DEF: 'DEF', RET: 'RET', ELIM: 'ELIM', BONUS: 'BONUS', TROCA: 'ECHANGE', REV: 'REV', EXP: 'EXP' }
};

const LOG_PHRASES = {
  en: [
    ['conquistou', 'conquered'], ['perdeu em', 'lost in'], ['empatou em', 'drew in'], ['venceu', 'beat'],
    ['Vez de', 'Turn of'], ['voltou a ser neutro', 'became neutral again'], ['nao segurou o neutro', 'did not hold the neutral territory'],
    ['Vez passa', 'Turn passes'], ['ficou sem times e foi eliminado', 'ran out of teams and was eliminated'],
    ['territorio neutro livre', 'free neutral territory'], ['reviveu em', 'revived in'], ['dominou o mundo', 'conquered the world']
  ],
  es: [
    ['conquistou', 'conquisto'], ['perdeu em', 'perdio en'], ['empatou em', 'empato en'], ['venceu', 'vencio'],
    ['Vez de', 'Turno de'], ['voltou a ser neutro', 'volvio a ser neutral'], ['nao segurou o neutro', 'no mantuvo el neutral'],
    ['Vez passa', 'Pasa el turno'], ['ficou sem times e foi eliminado', 'se quedo sin equipos y fue eliminado'],
    ['territorio neutro livre', 'territorio neutral libre'], ['reviveu em', 'revivio en'], ['dominou o mundo', 'domino el mundo']
  ],
  it: [
    ['conquistou', 'ha conquistato'], ['perdeu em', 'ha perso in'], ['empatou em', 'ha pareggiato in'], ['venceu', 'ha battuto'],
    ['Vez de', 'Turno di'], ['voltou a ser neutro', 'e tornato neutrale'], ['nao segurou o neutro', 'non ha mantenuto il neutrale'],
    ['Vez passa', 'Il turno passa'], ['ficou sem times e foi eliminado', 'e rimasto senza squadre ed e stato eliminato'],
    ['territorio neutro livre', 'territorio neutrale libero'], ['reviveu em', 'e rinato in'], ['dominou o mundo', 'ha conquistato il mondo']
  ],
  fr: [
    ['conquistou', 'a conquis'], ['perdeu em', 'a perdu en'], ['empatou em', 'a fait nul en'], ['venceu', 'a battu'],
    ['Vez de', 'Tour de'], ['voltou a ser neutro', 'est redevenu neutre'], ['nao segurou o neutro', 'n a pas garde le neutre'],
    ['Vez passa', 'Le tour passe'], ['ficou sem times e foi eliminado', 'n a plus d equipes et est elimine'],
    ['territorio neutro livre', 'territoire neutre libre'], ['reviveu em', 'est revenu en'], ['dominou o mundo', 'a conquis le monde']
  ]
};

function translateLogIcon(icon) {
  return LOG_ICON_LABELS[currentLanguage]?.[icon] || icon;
}

function translateLogMessage(html) {
  if (currentLanguage === 'pt') return html;
  let out = html || '';
  (LOG_PHRASES[currentLanguage] || []).forEach(([from, to]) => {
    out = out.replaceAll(from, to);
  });
  out = out.replaceAll('Time ', `${t('team_singular')} `);
  return out;
}

function renderLogPanel() {
  const el = document.getElementById('sidebar-log');
  el.innerHTML = '';
  [...G.log].reverse().forEach(entry => {
    const div = document.createElement('div');
    div.className = 'log-entry';
    div.innerHTML = `<div class="log-time">${translateLogIcon(entry.icon)} ${entry.time}</div><div>${translateLogMessage(entry.msg)}</div>`;
    el.appendChild(div);
  });
}

function stripHtml(html) {
  const div = document.createElement('div');
  div.innerHTML = html || '';
  return div.textContent || div.innerText || '';
}

function buildMatchSummaryText() {
  const alive = G.players.filter(p => !p.eliminated);
  const leader = [...G.players].sort((a, b) => b.territories.length - a.territories.length)[0];
  const lines = [
    'FIFACONQUEST - RESUMO DA PARTIDA',
    `Data: ${new Date().toLocaleString('pt-BR')}`,
    `Players: ${G.players.map(p => p.name).join(', ')}`,
    `Modo de times: ${TEAM_POOL_MODE_LABELS[G.teamPoolMode || teamPoolMode] || 'Aleatorio'}`,
    `Turno atual: ${currentPlayerObj()?.name || '-'}`,
    `Lider em territorios: ${leader ? `${leader.name} (${leader.territories.length})` : '-'}`,
    `Players vivos: ${alive.map(p => p.name).join(', ') || '-'}`,
    '',
    'PLACAR'
  ];

  G.players.forEach(pl => {
    const s = G.stats[pl.id] || {};
    lines.push(`${pl.name}${pl.eliminated ? ' (eliminado)' : ''}: ${pl.territories.length} territorios, ${s.wins||0}V ${s.draws||0}E ${s.losses||0}D, gols ${s.scored||0}x${s.conceded||0}, conquistas ${s.conquests||0}`);
  });

  const battles = G.log.filter(l => l.score).slice(-20);
  if (battles.length) {
    lines.push('', 'ULTIMAS BATALHAS');
    battles.forEach(entry => lines.push(`${entry.time} - ${stripHtml(entry.msg)}`));
  }

  if (G.log.length) {
    lines.push('', 'HISTORICO COMPLETO');
    G.log.forEach(entry => lines.push(`${entry.time} - ${entry.icon} - ${stripHtml(entry.msg)}`));
  }

  return lines.join('\n');
}

function downloadTextFile(filename, text, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function exportMatchSummary() {
  if (!G.players?.length) return;
  const text = buildMatchSummaryText();
  const modal = document.getElementById('export-modal');
  const textarea = document.getElementById('export-text');
  if (textarea) {
    textarea.value = text;
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.select();
    });
  }
  modal?.classList.add('active');
  try {
    if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
    await navigator.clipboard.writeText(text);
    addLog('EXP', 'Resumo da partida copiado para a area de transferencia.');
  } catch {
    addLog('EXP', 'Resumo da partida aberto para copiar ou baixar.');
  }
  renderSidebar();
  saveGameState();
}

function closeExportModal() {
  document.getElementById('export-modal')?.classList.remove('active');
}

async function copyExportText() {
  const textarea = document.getElementById('export-text');
  if (!textarea) return;
  textarea.focus();
  textarea.select();
  try {
    if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
    await navigator.clipboard.writeText(textarea.value);
  } catch {
    document.execCommand?.('copy');
  }
}

function downloadExportText() {
  const text = document.getElementById('export-text')?.value || buildMatchSummaryText();
  downloadTextFile('fifaconquest-historico.txt', text);
}

// ============================================================
// STATS PANEL
// ============================================================
function renderStatsPanel() {
  const el = document.getElementById('sidebar-stats');
  if (!el) return;
  el.innerHTML = '';

  // Overall table
  const block = document.createElement('div');
  block.className = 'stat-block';
  block.innerHTML = `<div class="stat-block-title">${t('results')}</div>`;

  G.players.forEach(pl => {
    const s = G.stats[pl.id] || {};
    const total = (s.wins||0) + (s.losses||0) + (s.draws||0);
    const wr = total > 0 ? Math.round(((s.wins||0)/total)*100) : 0;
    const div = document.createElement('div');
    div.style.cssText = 'margin-bottom:14px;';
    div.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
        <div style="width:8px;height:8px;border-radius:50%;background:${pl.color};flex-shrink:0"></div>
        <span style="font-family:Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;flex:1">${pl.name}</span>
        ${pl.eliminated ? '<span style="font-size:10px;color:var(--accent2);letter-spacing:2px;">ELIMINADO</span>' : ''}
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-bottom:6px;">
        <div style="text-align:center;background:rgba(34,197,94,0.1);border-radius:6px;padding:6px 2px;">
          <div style="font-family:'Bebas Neue',sans-serif;font-size:22px;color:#22c55e">${s.wins||0}</div>
          <div style="font-size:9px;color:var(--muted);letter-spacing:1px;">${t('wins')}</div>
        </div>
        <div style="text-align:center;background:rgba(255,214,0,0.08);border-radius:6px;padding:6px 2px;">
          <div style="font-family:'Bebas Neue',sans-serif;font-size:22px;color:var(--accent3)">${s.draws||0}</div>
          <div style="font-size:9px;color:var(--muted);letter-spacing:1px;">${t('draws')}</div>
        </div>
        <div style="text-align:center;background:rgba(255,61,90,0.1);border-radius:6px;padding:6px 2px;">
          <div style="font-family:'Bebas Neue',sans-serif;font-size:22px;color:var(--accent2)">${s.losses||0}</div>
          <div style="font-size:9px;color:var(--muted);letter-spacing:1px;">${t('losses')}</div>
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted);margin-bottom:4px;">
        <span>${t('goals')}: ${s.scored||0} x ${s.conceded||0}</span>
        <span>${wr}% ${t('efficiency')}</span>
      </div>
      <div class="stat-bar-wrap"><div class="stat-bar" style="width:${wr}%;background:${pl.color}"></div></div>
      <div style="margin-top:6px;display:flex;gap:12px;font-size:11px;color:var(--muted);">
        <span>${t('conquests')}: ${s.conquests||0}</span>
        <span>${t('defenses')}: ${s.defenses||0}</span>
        <span>${t('neutral_short')}: ${s.neutralDefenses||0}</span>
        <span>${t('revives')}: ${s.revives||0}</span>
        <span>${t('territories_short')}: ${pl.territories.length}</span>
      </div>
    `;
    block.appendChild(div);
  });
  el.appendChild(block);

  // Placar de batalhas (last 10 from log)
  const battles = G.log.filter(l => l.score).slice(-10).reverse();
  if (battles.length > 0) {
    const logBlock = document.createElement('div');
    logBlock.className = 'stat-block';
    logBlock.innerHTML = `<div class="stat-block-title">${t('last_battles')}</div>`;
    battles.forEach(b => {
      const row = document.createElement('div');
      row.className = 'stat-row';
      row.innerHTML = `<span style="font-size:11px;color:var(--muted)">${b.battleDesc}</span>
        <span style="font-family:'Bebas Neue',sans-serif;font-size:16px;color:var(--text)">${b.score}</span>`;
      logBlock.appendChild(row);
    });
    el.appendChild(logBlock);
  }
}

