# CONTEXT — Pokémon Card Battle Game (v2 — Pokémon-faithful)

## PROGETTO
Gioco di carte/figure collezionabili a turni con Pokémon della prima generazione (151 Pokémon).
Uso privato tra amici — nessuna pubblicazione commerciale.
**Stack:** HTML/CSS/JavaScript → in futuro applicazione desktop/mobile
**PvP online** pianificato tramite WebSocket

---

## CONCEPT
Gioco ispirato a **Hero Colosseum** (posizionamento su griglia) + **Marvel Snap** (turni simultanei),
con **meccaniche di combattimento fedeli ai giochi Pokémon** (stats, tipi, STAB, mosse fisiche/speciali).
I Pokémon funzionano come figure su una griglia 3×2, non come un TCG classico.

---

## REGOLE BASE

### Deck e Griglia
- Deck da **6 Pokémon**, **3 attivi per turno** su griglia **3×2** (Front/Back × Left/Center/Right)
- Le altre 3 restano in **panchina** — protette dai danni, mantengono il PP
- Si può cambiare formazione ogni turno
- **HP Player: 3000** — sconfitta se HP=0 o tutti i Pokémon eliminati

### Turni Simultanei
- Entrambi i giocatori posizionano e scelgono mossa **blind** (contemporaneamente)
- Timer **30 secondi** — alla scadenza conferma automatica
- Risoluzione automatica in base alla **Speed**

### Sistema Speed
- Si calcola la **Speed totale** del team (somma delle 3 figure in campo)
- Team con Speed totale maggiore agisce **per primo con tutte le sue carte**
- Dentro ogni team le carte agiscono in ordine di Speed individuale
- (Possibile estensione futura: mosse con priorità tipo *Quick Attack* che ignorano la Speed)

### Regole Attacco
- Ogni Pokémon attacca il nemico nella **stessa colonna** (Front → se vuoto → Back)
- Colonna nemica vuota → **danno diretto al Player** avversario
- Back è protetto dalla Front nella stessa colonna
- (Mosse AoE / a colonna / a riga: da valutare come categoria speciale di mossa)

---

## STATISTICHE (Pokémon-style)

| Stat | Sigla | Descrizione |
|------|-------|-------------|
| Punti Salute | **HP** | A 0 il Pokémon viene eliminato |
| Attacco | **ATK** | Usato dalle **mosse fisiche** |
| Difesa | **DEF** | Riduce il danno delle **mosse fisiche** |
| Attacco Speciale | **SP.ATK** | Usato dalle **mosse speciali** |
| Difesa Speciale | **SP.DEF** | Riduce il danno delle **mosse speciali** |
| Velocità | **SPEED** | Ordine di risoluzione nel turno |
| PP | — | Risorsa per usare le mosse, personale di ogni Pokémon, si guadagna colpendo |

> Le 6 stat Pokémon sono prese **direttamente da PokeAPI** (`stats[]`) — base stats della prima generazione, eventualmente normalizzate per il bilanciamento.
> *PP* (Power Points) — naming Pokémon-style per la risorsa che alimenta le mosse. Funziona in modo custom: invece di partire pieni e calare, partono a 0 e si guadagnano colpendo.

**No CRIT** — danno deterministico, no RNG. Semplifica il bilanciamento e la lettura della partita.

---

## CATEGORIE DI MOSSE (Pokémon-style)

Ogni mossa (Basic o Finisher) ha una **categoria**:

| Categoria | Stat usate | Esempi Pokémon |
|-----------|------------|----------------|
| **Fisica** | ATK attaccante vs DEF bersaglio | Lama, Morso, Spaccaroccia, Iper Raggio (in gen 1 era speciale, qui da decidere) |
| **Speciale** | SP.ATK attaccante vs SP.DEF bersaglio | Fiammata, Idropulsar, Tuonoshock, Confusione |
| **Stato** | nessuna stat di danno | Velenpolvere, Sonnifero, Riduttore, Amnesia |

> In Pokémon Gen 1 la categoria fisica/speciale era determinata dal **tipo della mossa**.
> Da Gen 4 in poi la categoria è una **proprietà della singola mossa**, indipendente dal tipo.
> **Questo gioco usa il sistema Gen 4+** (più moderno, più bilanciato, più chiaro per i giocatori).

---

## SISTEMA ABILITÀ

| Tipo | Costo | Corrisponde a |
|------|-------|---------------|
| Passiva | 0 (automatica) | Abilità Pokémon (es. Blaze, Torrent, Levitate) |
| Basic | 1 PP | Mossa standard del Pokémon |
| Finisher | 3 PP, **once per match** | Mossa signature / più potente (es. Iper Raggio, Stoccata Sacra) |

### PP
- **Personale** di ogni Pokémon, non condiviso
- Si guadagna **1 PP per ogni colpo a segno**
- Persiste tra i turni, anche in panchina
- In panchina **non** si guadagna PP (bisogna colpire)

### Passive (tipi implementati)
- `slot_atk` — +X% ATK se su casella dedicata
- `slot_sp_atk` — +X% SP.ATK se su casella dedicata *(nuovo)*
- `slot_def` — +X% DEF se su casella dedicata
- `slot_sp_def` — +X% SP.DEF se su casella dedicata *(nuovo)*
- `slot_speed` — +X SPEED se su casella dedicata
- `kill_atk` — +X% ATK quando elimina un Pokémon
- `kill_sp_atk` — +X% SP.ATK quando elimina un Pokémon *(nuovo)*
- Tutte supportano `bonus_sinergia` — se N Pokémon dello stesso **tipo** in campo

### Slot Dedicati
Ogni Pokémon ha 1-2 slot della griglia dove la passiva si attiva.
Es: Charizard ha slot dedicato `front_center` → passiva attiva solo lì.

---

## TIPI POKÉMON — Sistema completo (18 tipi)

Si usa il **sistema completo di 18 tipi** con tabella di efficacia ufficiale Pokémon:

Normale, Fuoco, Acqua, Erba, Elettro, Ghiaccio, Lotta, Veleno, Terra, Volante, Psico, Coleottero, Roccia, Spettro, Drago, Buio, Acciaio, Folletto.

> In gen 1 i tipi erano 15 (mancavano Buio, Acciaio, Folletto). Visto che potrebbero esserci effetti su Pokémon di gen 1 con interazioni moderne (es. Buio super-efficace su Psico, che era OP in gen 1), si usa la **tabella aggiornata moderna**.

### Moltiplicatori
- **0×** — Immunità (es. Terra contro Volante)
- **0.5×** — Non molto efficace
- **1×** — Normale
- **2×** — Super efficace
- **4×** — Doppia super-efficace (Pokémon dual-type, es. Acqua su Charizard Fuoco/Volante)

### STAB (Same Type Attack Bonus)
Se il tipo della mossa coincide con uno dei tipi del Pokémon attaccante → **danno × 1.5**.

---

## FORMULA DI DANNO (ispirata Pokémon)

Per **mosse fisiche**:
```
Danno = max(1, (ATK / DEF) * BasePower * STAB * TypeEff)
```

Per **mosse speciali**:
```
Danno = max(1, (SP.ATK / SP.DEF) * BasePower * STAB * TypeEff)
```

Dove:
- **BasePower** = potenza base della mossa (definita per ogni mossa)
- **STAB** = 1.5 se tipo mossa = tipo Pokémon, altrimenti 1.0
- **TypeEff** = prodotto degli effetti di tipo (0, 0.5, 1, 2, 4)

> Formula semplificata rispetto a quella canonica Pokémon (che include livello, IV, EV, natura, ecc.) — non servono perché qui i Pokémon non hanno livelli/IV/EV.
> Da rifinire con playtesting.

---

## SISTEMA GEAR (Oggetti Tenuti)
- 3 slot per Pokémon
- Equipaggiabili solo fuori combattimento (in Collezione)
- Corrisponde agli **oggetti tenuti** Pokémon (Bacca Sindrachi, Scelta, Roccia di Re, ecc.)
- Effetti passivi condizionali (es. *"se solo in campo, +20% ATK"*)
- Possibili effetti tematici: +SP.ATK per oggetti tipo Occhiali Scelta, +DEF per Riduttore, ecc.

---

## SISTEMA COSTELLAZIONI
- Ogni Pokémon ha **1-6 stelle** (ottenute con duplicati dal gacha)
- Ogni stella sblocca un upgrade concreto — non solo stat
- Stelle cambiano il modo di giocare il Pokémon
- Duplicati oltre la 6ª stella → frammenti (valuta speciale)

> Esempi di upgrade per stella: nuova passiva, sconto PP sul Finisher, slot dedicato extra, accesso a una mossa alternativa.

---

## STATUS CONDITIONS *(da valutare per v2)*
Possibili stati alterati ispirati a Pokémon:
- **Scottatura** — danno ogni turno + ATK dimezzato
- **Veleno / Iper Veleno** — danno crescente
- **Paralisi** — Speed ridotta, possibilità di non agire
- **Sonno** — non agisce per 1-3 turni
- **Congelamento** — non agisce, eventuale sblocco

> Da implementare dopo che il core combat è stabile.

---

## GRAFICA
- **Illustrazioni carte:** fanart/AI generativa (stile artwork TCG)
- **Sprite:** PokeAPI (gratuita, uso privato)
- **Design carta:** originale, da progettare — deve mostrare 6 stat (HP, ATK, DEF, SP.ATK, SP.DEF, SPD) + tipo/i + mossa Basic + Finisher
- **Dati Pokémon:** PokeAPI (`https://pokeapi.co/api/v2/`)

---

## STRUTTURA NAVIGAZIONE

```
Home  (sfondo grafico tema Pokémon, illustrato)
├── [Gioca] → Popup
│   ├── Online (WebSocket — futuro)
│   └── Modalità Storia → mappa regione → percorso
├── [Collezione]
│   ├── Tab Team — scegli 6 Pokémon del deck
│   ├── Tab Pokémon — lista, scheda con stat + gear
│   └── Tab Oggetti — lista oggetti e effetti
├── [Summon]  ← gacha (nome provvisorio, da rinominare)
│   └── Banner per generazione (per ora solo Gen 1)
├── [Achievements] (futuro — da implementare alla fine)
└── [Impostazioni]
    └── Volume, sfondo, opzioni grafiche
```

---

## MODALITÀ DI GIOCO

### Storia (vs AI)
**Visione:** rivivere l'avventura dei giochi originali Pokémon, partendo da **Kanto** (Rosso/Blu).
Le altre regioni verranno aggiunte progressivamente nel tempo.

**Stile interfaccia — avventura punta-e-clicca esplorabile:**
- **Mappa città dall'alto** stile gioco originale Game Boy (es. Biancavilla con casa di Rosso, casa di Blu, laboratorio di Oak).
- **Hotspot cliccabili** sulla mappa: case, NPC, cestini (oggetti nascosti), uscite verso le route.
- **Cambio scena** quando si entra in una casa (interno) o si va su una route.
- **Sulle route**: Pokéball cliccabili (oggetti / carte Pokémon), allenatori cliccabili (battaglia → ricompensa), uscite verso città successive.
- **Aree gated** da progressione: alcune zone restano bloccate finché non hai compiuto un evento specifico (es. battere capopalestra, ottenere un oggetto, risolvere un evento).
- **Lega Pokémon** come climax di ogni regione.
- **Post-Lega**: si sbloccano zone speciali per i **leggendari** (es. Grotta Celeste → Mewtwo dopo aver battuto Blu campione) + **prossima regione** quando disponibile.

**Eventi canonici da preservare:**
- Scelta starter da Prof. Oak
- Primo scontro col rivale a Biancavilla
- Mt. Moon → fossili (Omanyte/Kabuto)
- 8 capipalestra in ordine: Brock → Misty → Blaine → Sabrina (ecc., ordine canonico Rosso/Blu)
- Lega Pokémon → Quattro Saggi → Blu campione
- Post-game: Grotta Celeste, Mewtwo

**Ricompense per progressione:**
- **Valuta pull** per i Summon
- **MT (oggetti)** dai capipalestra che potenziano un tipo specifico (vedi sezione "MT" sotto)
- **Carte Pokémon esclusive** (starter, fossili, regali NPC, leggendari) — NON ottenibili dai Summon
- **Medaglie** = badge cosmetici di progressione (8 medaglie di Kanto)
- **Oggetti vari** dai cestini / pokéball / NPC

### Sistema MT (Macchine Tecniche)
Nei giochi originali, battere un capopalestra dà **medaglia + MT**. Qui adattiamo:
- **Medaglia** = badge cosmetico di progressione (visibile in profilo / collezione)
- **MT** = **oggetto** che il giocatore può **applicare a un Pokémon** per **potenziare le mosse di un tipo specifico**.
  - Es. battere Brock → MT-Roccia → applicandola a un Pokémon, le sue mosse di tipo Roccia fanno più danno.
- L'integrazione tra MT e sistema Gear (slot oggetti tenuti) è **da definire** — vedi Q15.

### Online (PvP)
WebSocket — vedi Milestone 8. Con team di Pokémon ottenuti tra Storia e Summon.

---

## ECONOMIA DEL GIOCO — Pokémon e ottenimento

I 151 Pokémon di Gen 1 si dividono in **3 categorie di ottenibilità**:

| Categoria | Come si ottengono | Esempi (da definire) |
|-----------|-------------------|----------------------|
| **Summonabili** | Banner gacha (per ora unico, Gen 1) | Comuni, rari, evolutivi standard |
| **Esclusivi storia** | Solo come ricompensa nella modalità Storia | TBD — vedi Q6 |
| **Leggendari** | Per ora **non ottenibili** (riservati a eventi/contenuti futuri) | Mewtwo, Mew, Articuno, Zapdos, Moltres |

> La lista precisa di chi va in quale categoria è in OPEN_QUESTIONS.md (Q6).

### Summon System (gacha)
- Banner per generazione — al lancio solo Banner Gen 1 (Pokémon Gen 1 non-leggendari, non-esclusivi)
- Costo pull pagato in valute ottenute giocando (principalmente Storia)
- I duplicati alimentano il **Sistema Costellazioni** (vedi sezione dedicata)
- Modello gacha (rate, pity, banner permanenti vs a tempo) → da decidere, vedi Q7

### Risorse / valute
Da definire più precisamente, ma minimo:
- **Valuta pull** (consente di tirare nei Summon)
- **Frammenti** (da duplicati oltre 6 stelle, usabili per upgrade specifici)
- **Oggetti** dropparti dai capipalestra/eventi storia (entrano nel sistema Gear)

---

## ACHIEVEMENTS *(da implementare alla fine)*
Sistema di obiettivi cosmetici/ricompensanti:
- Catturare X Pokémon
- Completare regione storia
- Vincere N partite online
- KO con mossa di tipo specifico
- Ricompense potenziali: titoli, badge profilo, eventuali piccole valute bonus

---

## IMPOSTAZIONI *(da implementare)*
- Volume (musica + SFX separati)
- Sfondo della home (selezionabile tra varie illustrazioni)
- Opzioni grafiche / animazioni (es. velocità default 1×/2×, già implementata in battle)
- (futuro) Lingua, accessibilità, account

---

## SCHEDA POKÉMON (3 pagine)
- Aperta con **tasto destro** sulla carta
- **Pagina 1:** Stat (HP, ATK, DEF, SP.ATK, SP.DEF, SPEED, PP) con valori effettivi (bonus passiva e gear inclusi) + tipo/i Pokémon + BtnBasic + BtnFinisher (solo se in campo, disabilitati se PP insufficiente)
- **Pagina 2:** Mosse — click su nome mostra descrizione + tipo mossa + categoria (Fisica/Speciale/Stato) + base power + mini griglia slot dedicati per la passiva
- **Pagina 3:** Gear (3 slot equipaggiamento)

---

## DRAG & DROP
- Click sinistro tieni → trascina sulla griglia
- Rilascia su slot → posiziona (max 3 in campo)
- Rilascia fuori → torna in panchina
- Durante drag → slot dedicati evidenziati in giallo
- Carte avversarie → solo tasto destro (non trascinabili)
- Carte eliminate → grigie in panchina, non usabili

---

## FLUSSO TURNO COMPLETO
1. Posizionamento carte + scelta mossa (timer 30s)
2. Conferma → AI/avversario genera formazione
3. Mostra formazione avversaria
4. **Speed Check** — animazione barra blu/rossa che mostra chi va primo
5. Risoluzione **sequenziale** — ogni attacco animato uno per volta:
   - Carta attaccante si muove verso bersaglio
   - Calcolo: `(ATK o SP.ATK) vs (DEF o SP.DEF)` × STAB × TypeEff
   - Numero danno appare (eventualmente con tag *"Super efficace!"* / *"Non molto efficace…"*)
   - HP bar scala
   - Carta torna in posizione
6. Pokémon eliminati → grigi in panchina
7. Aggiornamento HP barre player
8. Controllo vittoria/sconfitta
9. Nuovo turno

---

## AI (provvisoria)
- Schiera i primi 3 Pokémon vivi in FrontLeft, FrontCenter, FrontRight
- Non sceglie mossa
- Figure persistenti tra i turni
- Da migliorare in futuro (priorità: scelta mossa basata su tipo bersaglio)

---

## PRIORITÀ DI SVILUPPO
1. **HTML base** — layout combattimento funzionante
2. **Carte Pokémon** — visualizzazione con dati da PokeAPI (incluse tutte le 6 stat)
3. **Drag & drop** sulla griglia
4. **Motore combattimento** — calcolo turni, speed, danni con formula fisica/speciale
5. **Sistema tipi** — tabella efficacia 18×18 + STAB
6. **Animazioni sequenziali** — combattimento non istantaneo
7. **Scheda Pokémon** — 3 pagine
8. **AI base**
9. **Home + Collezione**
10. **Sistema gacha**
11. **PvP online** (WebSocket)
12. **Status conditions**
13. **Bilanciamento**
14. **Migrazione ad app** (Electron o React Native)

---

## NOTE TECNICHE
- Dati Pokémon da PokeAPI — no backend necessario per fase 1
- Le 6 stat di base si recuperano da `pokemon/{id}` → `stats[]` (hp, attack, defense, special-attack, special-defense, speed)
- Sprite: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/{id}.png`
- Mosse: `move/{id}` — da PokeAPI si ottengono `power`, `damage_class` (physical/special/status), `type`, `accuracy`, ecc.
- Tabella tipi: `type/{id}` → `damage_relations` (PokeAPI ha già la tabella)
- Per PvP online: WebSocket server (Node.js + ws)
- Salvataggio dati: localStorage per fase 1, database in futuro
- Prima generazione: Pokémon #1-151

---

## CHANGELOG v2 (vs v1)
- ✅ Stat divise: **ATK + SP.ATK**, **DEF + SP.DEF** (sistema Pokémon a 6 stat)
- ✅ Aggiunta **categoria mosse**: Fisica / Speciale / Stato (sistema Gen 4+)
- ✅ Formula di danno **ispirata Pokémon** (ATK/DEF o SP.ATK/SP.DEF + STAB + TypeEff)
- ✅ Sistema **18 tipi** confermato + STAB + moltiplicatori 0/0.5/1/2/4
- ✅ Passive estese a SP.ATK / SP.DEF (`slot_sp_atk`, `slot_sp_def`, `kill_sp_atk`)
- ✅ Note su PokeAPI per recuperare automaticamente stat, categoria mossa e tabella tipi
- 🔜 Status conditions (scottatura, veleno, paralisi, sonno, congelamento) rimandate a v2 dell'implementazione
