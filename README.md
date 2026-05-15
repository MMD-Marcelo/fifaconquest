# FIFA Conquest

FIFA Conquest is a couch-style football strategy game. You pick players, get teams, fight over a world map, and settle battles by playing FIFA/EA FC matches in real life.

The idea is simple: the browser handles the territory game, the football game handles the drama.

## What you can play

### World Conquest

The main mode is a Risk-like world map. Each player starts with a base country and a few base teams. On your turn, you attack connected territories, choose one of your available teams, and play the FIFA match outside the app.

After the match, enter the result:

- Victory: you conquer the territory.
- Draw: the attack does not go through.
- Defeat: the defender holds.

There are also optional challenge cards, saves, match history, stats, neutral defenses, revives, and a swap bonus for hot streaks.

### Bonus Mode: FIFA Chess

FIFA Chess is a smaller side mode for two players.

It plays like normal chess, but every chess piece has a football team attached to it. When a piece tries to capture another piece, both players play FIFA/EA FC to decide if the capture really happens.

Suggested rule:

- Play only until the first goal.
- If the attacker scores first, the capture succeeds.
- If the defender scores first, the defender holds.
- If a piece attacks the King and loses, the attacking piece is removed.
- If checkmate would happen in normal chess, the attacking player still needs to win the FIFA capture against the King to finish the game.

You can use random teams, the locked elite pool, or manually choose the team for every chess piece.

## How to run it

### Option 1: open the HTML

The chill way:

1. Download or clone the repo.
2. Open `fifa-world-domination.html` in a modern browser.
3. Play.

This works because the app is plain HTML, CSS and JavaScript.

### Option 2: run the Electron app

Install dependencies:

```bash
npm install
```

Run the desktop version:

```bash
npm start
```

### Option 3: build the Windows executable

Build the portable Windows app:

```bash
npm run build
```

The build output is created by `electron-builder`. The current config builds a portable Windows executable.

### Option 4: download a release build

When builds are published, grab the `.exe` from the GitHub Releases page. That is the easiest option for people who just want to play and not mess with Node, npm, terminals, all that stuff.

## Editing the database

Most of the fun stuff is just data files. You can tweak a lot without touching the game logic.

### Teams

Edit `teams.js`.

That file controls:

- Team names
- Team leagues
- The full available team pool
- Which teams can appear in random drafts

Keep team names consistent. If you rename a team in one place, make sure any league mapping or references use the same exact text.

### Elite pool

The locked elite behavior is controlled in the JavaScript data and mode logic. Search for:

```txt
TEAM_POOL_MODES
ELITE
ELITE_LOCKED_LEAGUES
```

That is where you tune what counts as the stronger curated pool.

### Countries and map data

The map and territory data live mainly in:

- `map-data.js`
- `data/world-geojson.js`

Use these if you want to adjust country IDs, names, neighbors, geometry, or map behavior.

Heads up: country IDs are used by saves and game state, so changing IDs can break old saves.

### Challenge cards

Challenge cards are in the `desafios/` folder.

Each language has its own file:

- `desafios/pt.js`
- `desafios/en.js`
- `desafios/es.js`
- `desafios/fr.js`
- `desafios/it.js`

To add cards, edit the matching language file. Keep the structure the same and add new cards to the list.

### Languages

Language packs are in `lang/`.

Current languages:

- Portuguese: `lang/pt.js`
- English: `lang/en.js`
- Spanish: `lang/es.js`
- French: `lang/fr.js`
- Italian: `lang/it.js`

The available language list is controlled by:

```txt
lang/manifest.js
```

To add a new language:

1. Copy one existing language file.
2. Rename it, for example `lang/de.js`.
3. Change the language code inside the file.
4. Translate the keys.
5. Add it to `lang/manifest.js`.
6. Add challenge cards for that language in `desafios/` if you want challenge mode fully translated too.

## Saves

The app has an automatic save and also lets you download save files manually.

Manual saves are JSON files. Example saves can live in `Save/`.

Tip: download your save before starting a new game if you care about the current match.

## Project structure

```txt
fifa-world-domination.html  Main app shell
game.js                    Core setup, state, language and screen logic
js/                        Game modules
styles/                    Split CSS files
teams.js                   Team database
map-data.js                Country and territory data
data/                      Map geometry
lang/                      UI translations
desafios/                  Challenge cards by language
electron/                  Desktop wrapper
```

## Notes

This is a fan-made party tool for people who want to spice up FIFA/EA FC sessions. It is not affiliated with EA, FIFA, or any football league or club.

Have fun with it, tweak it, break your friend group for one evening, then patch the rules and run it back.
