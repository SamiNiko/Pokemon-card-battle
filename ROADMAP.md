# ROADMAP — Stile Hero Colosseum

> **Per la chat di implementazione:** leggi CONTEXT.md per il design, poi prendi il primo task in stato `🔵 NEXT`.
> Quando finisci un task: spostalo in `✅ DONE`, aggiorna CHANGELOG.md, e marca il successivo come `🔵 NEXT`.
> Se hai dubbi di design o servono decisioni → **fermati**, scrivi in OPEN_QUESTIONS.md, non improvvisare.


**Legenda:**
- ✅ DONE — completato
- 🔵 NEXT — prossimo task da fare
- ⏳ TODO — da fare in futuro
- ❓ BLOCKED — bloccato da una decisione (vedi OPEN_QUESTIONS.md)

---

## Milestone 1 — Scheletro Web (in corso)

- ✅ **Struttura file** — index.html, battle.html, collection.html + css/ + js/
- ✅ **Tema visivo** — palette dark + accenti Pokémon (giallo Pikachu, blu Pokémon)
- ✅ **PokeAPI integration** — fetch dei 151 Pokémon con cache localStorage
- ✅ **Stato giocatore** — owned, team, gear in localStorage
- ✅ **Home page** — menù Gioca/Collezione/Impostazioni + popup modalità
- ✅ **Battle screen** — layout griglia 3×2 + panchine + HP bar + HUD centrale
- ✅ **Scheda Pokémon** — popup tasto destro con tab Stat/Mosse/Gear
- ✅ **Collection page** — 3 tab (Team/Pokémon/Oggetti) con team builder base

---

## Milestone 2 — Drag & Drop e Posizionamento

- ✅ Drag & drop carte panchina → griglia (lato giocatore)
- ✅ Slot validi (massimo 3 in campo)
- ✅ Rilascia su slot → posiziona carta
- ✅ Rilascia fuori (sulla bench) → torna in panchina
- ✅ Carte già in campo possono essere riposizionate
- ⏳ Animazione fluida del drag (cursor + ghost element)
- ⏳ Slot dedicati evidenziati in giallo durante il drag (`.is-dedicated-slot`) — bloccato da Q3
- ⏳ Persistenza della formazione tra refresh

---

## Milestone 3 — Engine Combattimento

- ✅ Calcolo Speed totale dei team → chi va prima
- ✅ Risoluzione attacchi sequenziale — ogni Pokémon attacca la stessa colonna del nemico
- ✅ Formula danno: `(ATK|SP.ATK / DEF|SP.DEF) × 50 × TypeEff` (no STAB per ora — mosse fisse)
- ✅ Danno diretto su colonna vuota → HP giocatore
- ✅ Game state machine — fasi: Posizionamento → Risoluzione → Cleanup → nuovo turno
- ✅ Tabella efficacia tipi 18×18 (`js/data/types.js`)
- ✅ AI base (`js/engine/ai.js`)
- ✅ Sistema PP — guadagno 1 PP per ogni colpo a segno, visualizzato sulla carta, persistente in panchina tra turni
- ✅ Mosse Basic/Finisher — PP side-aware, sistema 3 opzioni (Auto/Basic/Finisher riutilizzabile)

---

## Milestone 4 — UX, Animazioni e Feedback

### 4a — Layout fix (urgenti, bloccano l'usabilità)

- ✅ **Battle screen entra tutta in una schermata (no scroll, panchina sempre visibile)**
  - `100dvh`, `min-height: 0` su `.battle` / `.player-block` / `.grid`
  - Rimosso `min-height: 130px` da `.grid__slot`; carte nel campo usano `height: 100%; aspect-ratio: 3/4`
  - Panchine **griglia 2×3** (`grid-template-columns: repeat(2,1fr); width: 180px`) — enemy a sinistra (col 1), player a destra (col 3)
  - Layout `player-block` a **3 colonne simmetriche** `180px 1fr 180px` — griglia sempre in colonna centrale, allineata tra i due blocchi
  - Panchina **statica**: tutti i 6 Pokémon sempre visibili; `.is-deployed` (in campo, fantasma non trascinabile) e `.is-fainted` (sconfitto, grigio)
  - `padding-top: var(--sp-4)` sulla bench enemy per non sovrapporsi all'HP bar

- ✅ **Spostare "← Home" e ⏩ in alto a destra**
  - Gruppo `.battle__top-right` con `position: absolute; top; right; display: flex; gap`
  - ⏩ speed-up rimosso dall'HUD centrale, aggiunto al gruppo

- ✅ **Lineetta colorata distinta per ogni stat** (Q5 risolta)
  - Aggiunte classi `.stat-list__bar-fill--{hp|atk|def|spatk|spdef|speed}` in battle.css
  - JS aggiornato a passare la classe nel template della scheda Pokémon

- ✅ **Modal di conferma uscita partita**
  - Modal `#exitModal` aggiunto in battle.html
  - JS intercetta click su "← Home" se `bs.phase !== 'ended' && bs.turn > 1`

### 4b — Animazioni esistenti (già fatte)

- ✅ Speed check (testo fase animato)
- ✅ Carta attaccante animata (`.is-attacking` keyframe)
- ✅ Numero danno fluttuante + colori per ×2 / ×½ / immune
- ✅ HP bar animata con transizione CSS
- ✅ KO: carta diventa grigia (`.is-fainted`)

### 4c — Animazioni pendenti

- ⏳ KO: slide animata verso panchina
- ✅ +1 PP fluttuante sulla carta che colpisce (oltre al numero danno sul bersaglio)

### 4d — UX confermate

- ✅ **Preview targeting** — hover su carta player in campo → slot nemico bersaglio evidenziato (arancio se occupato, rosso tratteggiato se colonna vuota → danno diretto)
- ✅ **Speed preview** — `⚡ TOT vs TOT — ▶ Tu prima / ◀ Loro prima` nell'HUD centrale, aggiornato live ad ogni cambio formazione
- ✅ **Speed up animazioni** — bottone ⏩ 1×/2× nell'HUD; `speedMultiplier` divide tutti i `sleep()`, classe `.speed-up` sul body dimezza `animation-duration` via CSS; stato persistito in localStorage

### 4e — UX nice-to-have (parcheggiate)

- ⏳ Type effectiveness hint — hover su nemico mostra debolezze vs le tue carte
- ⏳ Battle log laterale — pannello eventi del turno (collassabile)
- ✅ Hint posizionamento — `X/3 carte posizionate` sotto il fase label
- ✅ Formazione persistente tra turni (il campo non viene svuotato, solo i morti rimossi)
- ✅ Shortcut tastiera — Spazio per confermare il turno

---

## Milestone 5 — Sistema Mosse

- ✅ Definire 1 mossa Basic + 1 Finisher per ogni Pokémon di gen 1 (151 × 2 = 302 mosse) — `js/data/movesets.js`
- ✅ Categoria (Fisica/Speciale/Stato) + tipo + base power per ogni mossa
- ✅ STAB ×1.5 nel calcolo danno (se tipo mossa = tipo Pokémon)
- ✅ UI selezione mossa nella scheda Pokémon (tab Mosse — BtnBasic / BtnFinisher, PP check, once-per-match per Finisher)
- ✅ Footer mossa sulla carta (mostra mossa attiva: "⚔ Basic" o "★ Finisher")
- ✅ Attacco Base gratuito (PP = 0) → Basic disponibile da PP ≥ 1 → Finisher da PP ≥ 3

---

## Milestone 6 — AI base

- ✅ AI provvisoria: schiera primi 3 Pokémon vivi in front-left/center/right (`js/engine/ai.js`)
- ⏳ AI step 2: sceglie mossa basata su efficacia di tipo

---

## Milestone 7 — Costellazioni e Gear

- ⏳ Sistema stelle 1-6 per Pokémon (gacha duplicati)
- ⏳ Slot oggetti tenuti (3 per Pokémon)
- ⏳ Effetti passive `slot_atk`, `slot_def`, `kill_atk` ecc. (vedi CONTEXT.md)

---

## Milestone 8 — Online PvP

- ⏳ WebSocket server (Node + ws)
- ⏳ Matchmaking base
- ⏳ Sync stato turno tra client

---

## Milestone 9 — Persistenza e Migrazione

- ⏳ Backend per profilo giocatore (post-prototipo)
- ⏳ Migrazione a Electron / React Native per app desktop/mobile

---

## Milestone 10 — Home page evoluta

- ✅ Sfondo CSS animato: grande Poké Ball decorativa + 3 orb colori tipo con drift
- ✅ 4 pulsanti principali: Gioca / Collezione / Summon / Impostazioni (Achievements riservato per Milestone 13)
- ✅ Pulsante "Gioca" → popup con scelta **Storia** / **Online** (Online disabilitato)
- ✅ Animazione d'entrata staggered (fade-up) su header, bottoni, footer
- ⏳ Sfondo con asset illustrati reali (asset da decidere — vedi Q9)

---

## Milestone 11 — Sistema Summon (gacha)

- ✅ Pagina `summon.html` + `css/summon.css` + `js/summon.js`
- ✅ Banner "Kanto Standard" con nome, descrizione, label
- ✅ Rate definite: Raro 6% / Non comune 24% / Comune 70%
- ✅ Costo: 💎160 ×1, 💎1600 ×10 (con garanzia 1 non-comune)
- ✅ Pool provvisorio: tutti i 151 Pokémon con rarità base — da sostituire con dati Excel
- ✅ Animazione pull: carte rivelate in sequenza con `card-reveal`, bordo colorato per rarità
- ✅ Valuta `gems` aggiunta a `state.js`; gemme debug 9999 finché non c'è un sistema di guadagno
- ⏳ Pool Pokémon reale da file Excel (liste per rarità + Pokémon esclusivi storia)
- ⏳ Logica duplicati → costellazioni / frammenti (M7)
- ⏳ Sistema guadagno gemme (M14 / progressione)
- ⏳ Pity system (garanzia raro ogni N pull)

---

## Milestone 12 — Modalità Storia (Kanto) — Avventura punta-e-clicca

> ⚠️ Milestone grossa. Va spezzata in fasi prima di iniziare.

### 12a — Infrastruttura mappa & navigazione
- ⏳ `story.html` + `js/story.js` + `css/story.css` — pagina dedicata
- ⏳ Sistema di "scene" (città, interno casa, route, grotta) — ogni scena è un set di hotspot su un'immagine di sfondo
- ⏳ Engine di navigazione tra scene (cambio scena con transizione)
- ⏳ Hotspot cliccabili: definizione dichiarativa (coords + tipo + azione)
- ⏳ Tipi di hotspot: NPC dialogo, cestino (oggetto nascosto), pokéball (oggetto/Pokémon), allenatore (battaglia), porta (cambio scena), uscita verso route/città
- ⏳ Stato globale storia (`storyState` in localStorage): scene visitate, hotspot consumati, allenatori battuti, oggetti raccolti, eventi sbloccati

### 12b — Sistema dialoghi & eventi
- ⏳ Engine dialoghi NPC (testo a finestrella stile Pokémon)
- ⏳ Sistema "trigger" su evento (es. *quando entri nel laboratorio Oak per la prima volta → trigger evento "scelta starter"*)
- ⏳ Sequenze scriptate (intro storia, scontro col rivale)

### 12c — Battaglie storia
- ⏳ Riuso del motore di combattimento esistente (battle.js / engine/combat.js)
- ⏳ Team predefiniti per allenatori/capipalestra (file dati JSON con `trainerId → team[]`)
- ⏳ Ricompense post-battaglia (valuta, oggetti, MT, eventuali carte esclusive)
- ⏳ Gestione "team della storia" vs team Online: si usa il team del giocatore (collezione) o team predefinito?

### 12d — Drop oggetti & medaglie
- ⏳ Drop oggetti dai capipalestra → entrano nel sistema **Gear** esistente (M7)
- ⏳ Ogni capopalestra droppa 1 oggetto tematico (es. Brock → potenziamento tipo Roccia)
- ⏳ Badge cosmetico medaglie (visibile in profilo / collezione)
- ⏳ Q15 risolta: niente sistema MT separato

### 12e — Asset grafici
- ⏳ Mappe città/route/interni (asset da decidere — vedi Q17)
- ⏳ Sprite NPC + personaggio giocatore (se mobile, vedi Q16)
- ⏳ Icone hotspot (cestino, pokéball, porta)

### 12f — Contenuti Kanto
- ⏳ Definire scene Biancavilla (interni: casa Rosso, casa Blu, lab Oak; esterno con uscita verso Route 1)
- ⏳ Route 1, Smeraldopoli, Foresta Smeraldo, Plumbeopoli, Mt. Moon, Celestopoli, ...
- ⏳ Eventi scriptati (scelta starter, scontro rivale, fossili Mt. Moon, Snorlax addormentato, regalo Lapras Silph Co., scelta Hitmonlee/Hitmonchan, ecc.)
- ⏳ Lega Pokémon → 4 Saggi → Blu campione
- ⏳ Post-game: Grotta Celeste con discesa scale → Mewtwo
- ⏳ Pokémon esclusivi piazzati (Q6 confermata)

---

## Milestone 13 — Achievements

- ⏳ Lista achievements (cattura, storia, online, gameplay)
- ⏳ Pagina dedicata o tab in profilo
- ⏳ Sistema notifiche di sblocco
- ⏳ Ricompense (titoli/badge/valute bonus)

---

## Milestone 14 — Impostazioni complete

- ⏳ Volume musica + SFX separati (con audio engine — Q13)
- ⏳ Selezione sfondo home
- ⏳ Velocità animazioni (già parzialmente fatto in battle)
- ⏳ Reset stato di gioco (debug)
- ⏳ Lingua (futuro)
