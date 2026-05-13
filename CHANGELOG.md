# CHANGELOG — Stile Hero Colosseum

> **Per la chat di implementazione:** ogni volta che completi un task significativo, aggiungi qui una voce **in cima** (più recente in alto).
> Formato consigliato: `## YYYY-MM-DD — titolo breve` + bullet di cosa è stato fatto + eventuale nota su file toccati / decisioni prese.

---

## 2026-05-11 — Redesign Summon + Index

**Summon page — redesign completo:**
- Banner dinamico: 4 Pokémon rari in evidenza (Gengar, Gyarados, Dragonite, Lapras) con sprite caricati da PokeAPI, floating animation, fade laterale per leggibilità
- Pull animation: orb pulsante → tap → carte face-down → flip sequenziale (CSS `rotateY`) → golden glow per rari con flash schermo
- Modal "Vedi probabilità": lista completa di tutti i Pokémon del pool divisi per rarità, con sprite, nome e % individuale calcolata (es. rare = 6%/15 = 0.40% ciascuno)
- Rate pills compatte sotto i pulsanti (★★★ 6% / ★★ 24% / ★ 70%)
- Pull button redesign: ×1 neutro, ×10 golden con tag "★★ garantito"
- File toccati: `summon.html`, `css/summon.css`, `js/summon.js`

**Home page — redesign:**
- Barra sinistra colorata fissa su Gioca (dorata) e Summon (blu), hover con glow
- Sprite Pokémon di sfondo: 8 Pokémon iconici come silhouette animate (fade + drift), caricati dinamicamente dopo loadAllPokemon
- Logo Pokéball pulsante con box-shadow animato
- Titolo gradient bianco→oro più grande e pulito
- Rimosso badge "In arrivo" da Summon (ora funzionante)
- File toccati: `index.html`, `css/home.css`, `js/home.js`

---

## 2026-05-11 — Summon pool Gen 1 reale (da file Excel)

**`js/summon.js` — pool aggiornato:**
- Letti i dati da `Pokemon_Fino_Quinta_Gen.ods` (foglio Gen 1)
- Rimossi dal pull gli esclusivi storia: starter (#1-9), Hitmonlee/chan (#106-107), Eeveelutions (#134-136), Porygon (#137), fossili+Aerodactyl (#138-142), Snorlax (#143), uccelli leggendari (#144-146), Mewtwo+Mew (#150-151)
- `STORIA_IDS` Set dichiarato esplicitamente per quando M12 li aggiungerà
- Rarità assegnate: Rare (15 Pokémon) — finali potenti e iconici; Uncommon (55) — evoluzioni medie e finali medi; Common — basi di linea
- Pool finale: ~124 Pokémon pullabili su 151

---

## 2026-05-11 — Milestone 11 (base) + fix gear + fix home buttons

**Milestone 11 — Summon page:**
- `summon.html`: header con portafoglio gemme, banner, pulsanti ×1/×10, tabella rate, overlay pull
- `css/summon.css`: layout completo, animazione `card-reveal` staggered, tier colori (oro/viola/grigio)
- `js/summon.js`: pool 151 Pokémon con rarità, estrazione pesata, garanzia ×10, overlay con carte rivelate
- `state.js`: `ownedIds` rinominato `owned`; aggiunto campo `gems: 0`; `isOwned()` aggiornato
- `collection.js`: aggiornato a `owned` (era `ownedIds`)
- `home.js`: pulsante Summon ora naviga a `summon.html`

**Gear → 1 oggetto per Pokémon:**
- `battle.js → renderSheetTab('gear')`: rimossi i 3 slot, ora 1 slot singolo 96×96px
- `state.js → DEFAULT_STATE.gear`: aggiornato commento a "1 oggetto per Pokémon"

**Fix home buttons:**
- `menu-btn__label` e `menu-btn__hint` ora `display: block` — label sopra, hint sotto garantiti
- Rimossa class `.menu-btn__icon` (icona integrata inline nel testo del label)

---

## 2026-05-11 — Milestone 10: Home page evoluta

**`index.html` — redesign:**
- 4 pulsanti principali: Gioca / Collezione / Summon / Impostazioni
- Popup "Gioca" aggiornato: Storia (→ battle.html) + Online (disabilitato, "In arrivo")
- Logo inline con mini Poké Ball CSS + titolo gradient
- Badge "In arrivo" su Summon e Online

**`css/home.css` — riscrittura:**
- Sfondo animato: `.home-bg__ball` (grande Poké Ball CSS con linea e bottone centrale, animazione breathe), 3 orb radiali colorati con `orb-drift`
- Bottoni con `backdrop-filter: blur`, accenti colore per Gioca (giallo) e Summon (blu)
- Animazione d'entrata `fade-up` staggered su header (0s), bottoni (0.08–0.32s), footer (0.4s)
- `.play-option` per il popup Gioca: stile consistente con i menu btn

**`js/home.js` — aggiornato:**
- Handler Summon e Impostazioni placeholder (M11/M14)
- Handler Story → `battle.html?mode=ai`

**File toccati:** `index.html`, `css/home.css`, `js/home.js`

---

## 2026-05-11 — Fix PP condivisi + redesign sistema mosse

**Bug fix: PP condivisi tra Pokémon con stesso ID nei due team (`battle.js` + `combat.js`):**
- `bs.pkmnPP` (singola Map) causava la stessa collisione di ID già risolta per gli HP: Venusaur di entrambi i team condivideva il contatore PP
- `bs.pkmnPP` e `bs.usedFinishers` rimossi; introdotti `bs.playerPkmnPP` e `bs.enemyPkmnPP` separati
- `makeCard()` aggiornato con `data-pp-side` e `data-move-side` per filtraggio side-aware
- `updateCardPP()`, `updateCardMove()`, `getMoveLabel()` aggiornati per usare la mappa corretta
- `playEvents()` aggiornato: PP del Finisher scalati e guadagnati sulla mappa del lato corretto
- `renderSheetTab('stats')` corretto per leggere da `playerPkmnPP`/`enemyPkmnPP` invece di `pkmnPP`

**Redesign sistema mosse (richiesta utente):**
- 3 opzioni invece di 2: **Auto** (gratis, derivata dalle stat) / **Basic** (gratis, mossa reale) / **Finisher** (costo 3 PP, riutilizzabile unlimited volte — rimosso il limite once-per-match)
- `combat.js → resolveMove()`: selezione 'auto'|'basic'|'finisher'; fallback a basic se PP < 3 con Finisher selezionato; AI usa Finisher quando PP ≥ 3
- Tab Mosse nella scheda: mostra tutte e 3 le opzioni con bottone Seleziona; Finisher disabilitato (opacity 0.45) se PP < 3 ma non bloccato una volta usato
- `bs.selectedMoves` ora accetta 'auto'|'basic'|'finisher' (default: 'basic')

**File toccati:** `js/battle.js`, `js/engine/combat.js`

---

## 2026-05-11 — Milestone 5: Sistema Mosse completo

**Nuovo file `js/data/movesets.js`:**
- 302 mosse definite (1 Basic + 1 Finisher × 151 Pokémon Gen 1)
- Ogni mossa: `name`, `type`, `cat` (physical/special/status), `power`
- Sistema Gen 4+: categoria è proprietà della mossa, non del tipo
- Mosse fedeli ai Pokémon reali (es. Charizard: Flamethrower / Fire Blast, Pikachu: Spark / Volt Tackle)

**`js/engine/combat.js` — riscrittura:**
- `resolveMove()` — seleziona la mossa effettiva per ogni Pokémon:
  - PP = 0 → Attacco Base (derivato da stat, power 50)
  - PP ≥ 1 → Basic (se selezionata)
  - PP ≥ 3 + not used → Finisher (se selezionato)
  - AI: usa Basic quando PP ≥ 1, altrimenti Attacco Base
- `calcDamage(attacker, move, defender)` — aggiunto STAB ×1.5, usa power della mossa
- Formula completa: `max(1, (ATK|SP.ATK / DEF|SP.DEF) × power × STAB × TypeEff)`
- Evento `attack` ora include `moveName`, `isFinisher`, `isAuto`, `stab`

**`js/battle.js` — aggiornamenti:**
- Importa `MOVESETS` da `movesets.js`
- Nuovo stato: `bs.selectedMoves: Map<id, 'basic'|'finisher'>`, `bs.usedFinishers: Set<id>`
- `getMoveLabel()` / `updateCardMove()` — aggiorna footer carta con mossa attiva
- `makeCard()` — aggiunto `<div class="card__move">` con nome mossa sotto i type badge
- `updateCardPP()` — chiama `updateCardMove()` ad ogni guadagno PP
- `playEvents()` — marca Finisher come usato in `bs.usedFinishers` quando `ev.isFinisher`
- Tab Mosse nella scheda Pokémon: mostra Basic + Finisher con tipo, categoria, power, STAB badge, bottone Seleziona; Finisher disabilitato se PP < 3 o già usato
- `resolveTurn()` ora riceve `movesets`, `selectedMoves`, `pkmnPP`, `usedFinishers`

**`css/base.css` — aggiunto:**
- `.card__move` — footer mossa sulla carta (0.6rem, text-dim, text-overflow ellipsis)
- `.moves-list`, `.move-row`, `.move-row--active`, `.move-row__header`, `.move-row__label`, `.move-row__stab`, `.move-row__name`, `.move-row__meta`, `.btn--sm`

---

## 2026-05-10 — Fix visivo animazione attacco + sprite consistency

**Fix: artefatto visivo dopo attacco (`overflow: hidden` su `.grid__slot`):**
- `.grid__slot` cambiato da `overflow: hidden` a `overflow: visible` in `battle.css`
- `overflow: hidden` clippava la carta durante l'animazione `translateY(-10px) scale(1.07)`, causando un artefatto visivo al termine
- Aggiunto `transition: none` su `.card.is-attacking` per evitare conflitti con la transition hover alla fine dell'animazione

**Sprite consistency (`base.css`):**
- `flex: 1 1 0` + `min-height: 0` su `.card__sprite` per shrink corretto in colonna flex
- `object-position: center bottom` sulle immagini sprite: il Pokémon "poggia" sul bordo inferiore della sprite area, look più consistente tra carte

---

## 2026-05-10 — UX 4c/4e: PP float, placement hint, Space shortcut + cleanup debug

**Bug fix verificato e debug rimosso:**
- Rimossi `console.log` di debug da `init()` e `playEvents()` in `battle.js`
- Rimosso `?v=3` cache-bust da `battle.html`

**+1 PP fluttuante (4c):**
- `showPPFloat(cardEl)` — animazione gialla `+1 PP` in basso sulla carta attaccante (stessa keyframe `float-up` del danno, colore accent giallo)
- Attivata sia su `attack` (se `typeEff > 0`) sia su `direct_damage`
- `.pp-float` aggiunto a `battle.css` con speed-up support

**Hint posizionamento (4e):**
- `<div id="placementHint">` aggiunto in `battle.html` sotto `#phaseLabel`
- `updatePlacementHint()` mostra `X / 3 carte posizionate`; verde quando il campo è pieno, grigio altrimenti
- Svuotato durante la fase `resolving`; ripristinato a inizio turno via `renderField()`

**Shortcut tastiera (4e):**
- `Space` nel keydown listener di `init()` chiama `confirmTurn()` (solo in fase `placement`)

**Formazione persistente (4e — già implementata):**
- `bs.playerField` non viene mai svuotato tra turni: le carte rimangono in campo, solo i morti vengono rimossi. Confermato come già funzionante.

---

## 2026-05-10 — Bug fix combattimento + Bench redesign + Debug

**Bug fix critico — Collisione ID tra team (unexpected deaths):**
- Entrambi i team usavano gli stessi ID Pokémon `[25, 6, 9, 3, 94, 65]` → una singola `Map` con chiave `id` causava sovrascriture incrociate (danno al Charizard nemico sovrascriveva HP del Charizard player)
- `combat.js` riscritto da zero: `resolveTurn()` ora riceve `playerPkmnHP`/`enemyPkmnHP` e `playerDeadIds`/`enemyDeadIds` separati per lato; tutti gli helper interni (`getHP`, `setHP`, `isDead`, `markDead`) routano sulla struttura corretta
- `battle.js` aggiornato: `bs.pkmnHP` e `bs.deadIds` sostituiti da `bs.playerPkmnHP`, `bs.enemyPkmnHP`, `bs.playerDeadIds`, `bs.enemyDeadIds`; `makeCard()`, `updateCardHP()`, `renderPlayerBench()`, `renderEnemyBench()`, `isTeamWiped()` e `playEvents()` tutti aggiornati con logica side-aware
- `data-hp-side="${side}"` aggiunto al badge HP in `makeCard()` — `updateCardHP()` filtra per questo attributo per aggiornare solo le carte del lato corretto

**Bug fix — `direct_damage` senza animazione né PP:**
- Il handler `direct_damage` in `playEvents()` mancava di `findCardEl()` + `.is-attacking` + incremento PP
- Aggiunto blocco completo speculare all'handler `attack`

**Bench redesign (evoluzione del layout 4a):**
- Panchina cambiata da colonna verticale (`flex-column`) a **griglia 2×3** (`grid-template-columns: repeat(2, 1fr); width: 180px`)
- Layout `player-block` cambiato a **3 colonne simmetriche** `grid-template-columns: 180px 1fr 180px`: griglia di gioco sempre nella colonna centrale → le due griglie (player e enemy) sono perfettamente allineate verticalmente
- Enemy bench → colonna 1 (sinistra); Player bench → colonna 3 (destra)
- `.player-block--enemy > .bench { padding-top: var(--sp-4) }` per non sovrapporsi alla HP bar
- **Panchina statica**: tutti i 6 Pokémon sempre visibili. Sconfitti → `.is-fainted` (grigio). In campo → `.is-deployed` (semitrasparente, `draggable=false`). Liberi → normali e trascinabili.

**Speed-up button spostato:**
- ⏩ rimosso dall'HUD centrale; spostato nel gruppo `.battle__top-right` con `← Home` (`position: absolute; top; right; display: flex`)

**Debug temporaneo (da rimuovere una volta confermato il fix):**
- `console.groupCollapsed` / `console.groupEnd` attorno a `playEvents()` con log per ogni evento (`🗡`, `💥`, `💀`, `🏁`)
- Log init in `init()`: `playerPkmnHP` e `enemyPkmnHP` stampati subito dopo il caricamento per verificare la separazione
- `?v=3` aggiunto a `<script src="js/battle.js?v=3">` in `battle.html` per forzare cache-bust del modulo entry-point

**Nota per Claude Code:** i log di debug e il `?v=3` sono **temporanei**. Rimuoverli una volta verificato che i bug sono risolti e la console è pulita.

---

## 2026-05-10 — Milestone 4a + 4d: Layout, UX e Speed

**Layout fix (4a):**
- `battle.css` — `height: 100dvh` (era `100vh`); `min-height: 0` su `.battle`, `.player-block`, `.grid`, `.grid__slot`; rimosso `min-height: 130px` dagli slot
- Carte nel campo: `height: 100%; aspect-ratio: 3/4; max-width: 100%` — si scalano all'altezza disponibile senza forzare overflow
- Panchine ora verticali (`display: flex; flex-direction: column; width: 72px`) sul lato **destro** di ogni griglia (stessa direzione per entrambi i giocatori, non specchiata)
- `player-block--enemy/self` ridefiniti con `grid-template-columns: 1fr auto` + grid-placement esplicita per info/grid/bench
- `← Home` spostato in alto a **destra** (`right: var(--sp-3)`)
- Modal di conferma uscita (`#exitModal`): appare se `bs.phase !== 'ended' && bs.turn > 1`

**Stat bar colori (4a-3):**
- Aggiunte classi `.stat-list__bar-fill--{hp|atk|def|spatk|spdef|speed}` in `battle.css`
- `renderSheetTab` in `battle.js` aggiornato per passare la classe corretta a ogni riga

**UX (4d):**
- **Preview targeting** (`setupTargetPreview()`): hover su carta player in campo → slot nemico evidenziato (arancio = bersaglio con carta, rosso tratteggiato = colonna vuota → danno diretto)
- **Speed preview** (`updateSpeedPreview()`): `⚡ X vs Y — ▶/◀ chi va prima` nell'HUD centrale, aggiornato live ad ogni `renderField()`
- **Speed-up toggle** (⏩ 1×/2×): `speedMultiplier` divide tutti i `sleep()`, classe `.speed-up` sul body dimezza le animation-duration via CSS; persistito in localStorage

---

## 2026-05-10 — Bug fix + Navigazione tra pagine

**Bug fix:**
- `const cap` spostata in cima a `battle.js` — era usata da `buildGrid` prima di essere inizializzata (temporal dead zone), causava `ReferenceError` bloccante
- Aggiunto `try/catch` in `init()` di `battle.js`: se `loadAllPokemon()` fallisce, l'overlay mostra il messaggio di errore specifico + bottoni Riprova / ← Home invece di restare bloccato a caricamento infinito
- Aggiunto timeout di 15 secondi per ogni singola fetch in `pokeapi.js` tramite `AbortController` — evita stalli su reti lente

**Navigazione e UX:**
- `index.html` e `collection.html` — rimossi script tag ridondanti (`pokeapi.js` e `state.js` erano importati due volte)
- `collection.html` — aggiunto bottone **"⚔ Vai in Battaglia (N/6)"** nell'header: appare appena c'è almeno 1 Pokémon nel team, si aggiorna in tempo reale ad ogni aggiunta/rimozione
- `collection.css` — aggiunto `.collection__header-right` per allineare count + bottone
- `battle.html` — aggiunto overlay di caricamento con spinner e testo progressivo ("Caricamento Pokémon: X / 151") che scompare con fade una volta pronti i dati

---

## 2026-05-10 — Sistema PP

- `bs.pkmnPP: Map<id, number>` aggiunto al battle state; tutti i Pokémon partono a 0
- Guadagno +1 PP per ogni colpo a segno (`typeEff > 0`) durante `playEvents → attack`
- PP persistono nella Map indipendentemente dalla posizione (campo / panchina)
- Badge `PP X` (giallo) in alto a sinistra di ogni carta
- PP aggiunto come settima riga nella scheda Pokémon tab Stat (barra si riempie fino a 3 = soglia Finisher)
- `.card__pp` aggiunto a `base.css`, `.stat-list__bar-fill--pp` aggiunto a `battle.css`
- Q4 (PP iniziali 0 o 1) risolta: 0, coerente con CONTEXT.md

---

## 2026-05-10 — Drag & Drop + Motore Combattimento

**Nuovi file:**
- `js/data/types.js` — tabella efficacia tipi 18×18 (`getTypeEffectiveness`), solo entrate non-1×
- `js/engine/combat.js` — `getBasicAttack()`, `calcDamage()`, `calcDirectDamage()`, `findTarget()`, `resolveTurn()`. Restituisce array di eventi da animare sequenzialmente.
- `js/engine/ai.js` — `aiPlaceCards()`: schiera i primi 3 Pokémon vivi in `front-left/center/right`

**`js/battle.js` — riscritto da zero:**
- Drag & drop HTML5 (draggable, dragstart/dragend/dragover/drop): panchina → griglia, griglia → griglia, griglia → panchina
- Limite 3 carte in campo contemporaneamente con messaggio di avviso
- Timer 30s con auto-conferma al termine
- `confirmTurn()`: AI posiziona → `resolveTurn()` → animazioni sequenziali → check vittoria/sconfitta
- Animazioni: speed check (testo fase), attacco (classe `.is-attacking`), danno fluttuante (`.damage-float` con varianti colore per ×2/×½/immune), HP bar aggiornata evento per evento
- Carte KO → `.is-fainted`; turno successivo le rimuove dal campo
- Fine partita → bottone torna alla Home

**`css/battle.css` — aggiunte:**
- `.card[draggable]`, `.card.is-dragging`, `.grid__slot.is-drop-target`
- `@keyframes card-attack`, `.damage-float` (+ `.is-super`, `.is-weak`, `.is-immune`)
- `@keyframes float-up`, `.hp-bar.is-shaking`, `@keyframes hp-shake`

**Decisioni di design adottate:**
- **No STAB** per ora — rimosso consapevolmente perché le mosse sono fisse e non personalizzabili
- Formula danno: `max(1, round((ATK|SP.ATK / DEF|SP.DEF) × 50 × TypeEff))`
- Danno diretto su colonna vuota: `max(1, round(ATK|SP.ATK / 100 × 150))`
- Mossa base derivata automaticamente: tipo = tipo primario del Pokémon; categoria = Fisica se ATK ≥ SP.ATK, Speciale altrimenti
- PP **non ancora implementati** — i Pokémon attaccano sempre (nessun costo mossa per ora)

---

## 2026-05-09 — Scheletro web iniziale

**Cosa è stato creato:**
- Struttura multi-file: `index.html`, `battle.html`, `collection.html` + cartelle `css/` e `js/`
- Tema CSS condiviso in `css/base.css` (variabili, reset, palette dark con accenti Pokémon, badge dei 18 tipi, componenti modal/btn/hp-bar/card)
- **Home** (`index.html` + `js/home.js`): menù con 3 pulsanti, popup "Gioca" con scelta vs AI / Online (Online disabilitato)
- **Battle** (`battle.html` + `js/battle.js`): layout completo con griglia 3×2 player + 3×2 enemy, panchine, HP bar (3000), HUD centrale (turno + timer + fase), scheda Pokémon su tasto destro con 3 tab (Stat/Mosse/Gear) e 6 stat reali da PokeAPI
- **Collection** (`collection.html` + `js/collection.js`): 3 tab (Team/Pokémon/Oggetti). Team builder cliccabile (max 6). Tab Pokémon mostra tutti i 151.
- **Data layer**:
  - `js/data/pokeapi.js` — fetch dei 151 Pokémon con pool di concorrenza (12 parallel) e cache localStorage (`pkmn_gen1_v1`)
  - `js/data/state.js` — stato giocatore in localStorage (`pkmn_player_state_v1`): owned, stars, team, gear

**Decisioni di design adottate (riflesse in CONTEXT.md):**
- Stat a 6 (HP/ATK/DEF/SP.ATK/SP.DEF/SPEED) — Pokémon-faithful
- Categoria mosse Fisica/Speciale/Stato — sistema Gen 4+
- "Mana" rinominato in **PP**
- No CRIT, niente RNG nel danno
- Sistema 18 tipi confermato (con STAB e tabella efficacia moderna)

**Note tecniche:**
- Tutti gli script sono `type="module"` — necessario aprire i file da un server locale (es. `python -m http.server`) o usare un'estensione tipo Live Server, NON da `file://` diretto, altrimenti gli ESM non caricano.
- Per il prototipo, tutti i 151 Pokémon sono "owned" di default (vedi `state.js`).
- Sprite presi da `raw.githubusercontent.com/PokeAPI/sprites` (gen 1 base + shiny + official artwork).

**Cosa NON è stato implementato (parcheggiato in ROADMAP):**
- Drag & drop dalla panchina alla griglia
- Engine combattimento (formula danno, speed check, risoluzione)
- Sistema mosse (Basic / Finisher con tipo, categoria, base power)
- AI
- Animazioni di combattimento

---

<!-- Le voci sopra sono le più recenti. Aggiungi nuove voci IN CIMA. -->
