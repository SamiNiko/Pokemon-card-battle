# OPEN QUESTIONS — Stile Hero Colosseum

> File di scambio tra **planning chat** e **implementation chat** (e Samuel).
> Quando una chat ha un dubbio di design o decisione che richiede input umano, lo scrive qui e si ferma sul task bloccato.
> Quando la domanda viene risolta, sposta la voce nella sezione `## Risolte` con la decisione presa.

---

## Aperte

### Q1 — Mosse di ogni Pokémon
**Da chi:** planning chat
**Contesto:** Ogni Pokémon avrà 1 mossa Basic + 1 Finisher. Vanno definite tutte (151 × 2). Da decidere:
- Le scegliamo a mano una a una (più curato, più lento) o le deriviamo dal moveset PokeAPI con criteri automatici (più veloce, meno preciso)?
- Per ogni mossa serve: nome, tipo, categoria (Fisica/Speciale/Stato), base power, eventuale effetto extra
**Decisione richiesta da:** Milestone 5

---

### Q2 — Iper Raggio: Fisica o Speciale?
**Da chi:** planning chat
**Contesto:** In Gen 1 era Speciale; da Gen 4 in poi è Fisica. CONTEXT.md dice "sistema Gen 4+" quindi di default sarebbe Fisica.
**Decisione richiesta da:** quando si mappa la mossa per Charizard / altri (Milestone 5)
**Default proposto:** Fisica (coerente con sistema Gen 4+)

---

---

### Q9 — Sfondo home
**Da chi:** planning chat
**Contesto:** Samuel ha chiesto "una grafica dietro, ovviamente tutto tema pokemon". Da decidere:
- Statica (1 immagine fissa) o dinamica (parallax / loop animato)?
- Asset: AI generativa (in linea con illustrazioni carte) / fanart open / ufficiale Pokémon (problemi di copyright)?
- Tema: Kanto (logica narrativa, prima regione), generico tutti i Pokémon, o cambia in base alla regione che stai giocando?

**Decisione richiesta da:** Milestone 10
**Default proposto:** statica AI-generata, tema Kanto (panorama tipo Pallet Town o Mt. Moon), sostituibile da Impostazioni con altre opzioni man mano che si sbloccano regioni.

---

### Q10 — Valute del gioco: quante e quali
**Da chi:** planning chat
**Contesto:** Servono almeno una valuta pull, ma probabilmente di più. Modelli:
- **Singola valuta** — "Pokémonete", spese in tutto (semplice ma poco profondo)
- **Doppia** — Pokémonete (oggetti, evoluzioni, gear) + Pulls (per i Summon). Le pulls si guadagnano solo da storia/achievements.
- **Tripla (gacha-style)** — primary (pulls), premium (pulls premium per banner speciali), shards (frammenti da duplicati per upgrade).

**Decisione richiesta da:** Milestone 11
**Default proposto:** doppia (Pokémonete + Pulls) per il prototipo. Aggiungiamo Frammenti se servono per costellazioni (sono già menzionati in CONTEXT).

---

---

### Q13 — Audio engine
**Da chi:** planning chat
**Contesto:** Per impostazioni volume serve un sistema audio. Opzioni:
- **HTML5 Audio API** — semplice, sufficiente per musiche + SFX base
- **Web Audio API** — più potente (mixing, effetti), più complesso
- **Howler.js** — libreria che astrae le due sopra, popolare e leggera

**Decisione richiesta da:** Milestone 14
**Default proposto:** **Howler.js** — più semplice da gestire (cross-browser, fade, mute), peso minimo (~30KB).

---

### Q15 — RISOLTA: MT come oggetti Gear
**Risolta il:** 2026-05-11
**Decisione:** **Niente sistema MT separato.** I capipalestra droppano direttamente **oggetti** che entrano nel sistema **Gear** esistente (slot oggetti tenuti del Pokémon, M7). Es. battere Brock → oggetto "Pietra Roccia" che applicato a un Pokémon potenzia le mosse di tipo Roccia. Diventa un effetto Gear come gli altri.
**Note:** semplifica enormemente — un solo sistema oggetti, niente UI/state dedicato alle MT.

---

### Q16 — RISOLTA: Pure point-and-click
**Risolta il:** 2026-05-11
**Decisione:** Opzione A confermata. Ogni scena è un'immagine di sfondo con hotspot cliccabili. Niente personaggio mobile sullo schermo.

---

### Q17 — RISOLTA (aggiornata): Asset estratti dai giochi originali
**Risolta il:** 2026-05-11, aggiornata 2026-05-12
**Decisione precedente (obsoleta):** AI generativa stile pixel art GBA.
**Decisione attuale:** Samuel sta usando **modelli top-down estratti dai giochi originali Pokémon** (sorgente iniziale: Pokémon Central Wiki, Gen 1 GB).

**Fonti consigliate per riempire i buchi (mappe/interni non presenti su Pokémon Central):**
1. **The Spriters Resource — Pokémon Rosso/Blu/Giallo (GB):** https://www.spriters-resource.com/game_boy/pokered/
2. **The Spriters Resource — Pokémon FireRed/LeafGreen (GBA, remake completo di Kanto):** https://www.spriters-resource.com/game_boy_advance/pokefireredleafgreen/ — molto più completo, mappe più dettagliate
3. **Bulbapedia** (in inglese) — spesso ha mappe che le wiki italiane non hanno
4. **Tileset + Tiled editor** per ricostruzioni custom (quando una mappa proprio non esiste)
5. **AI generativa** come ultima risorsa

**Raccomandazione planning chat:** scegliere **una sola fonte stilistica** per evitare mismatch visivo. Le mappe FRLG (GBA) sono molto più complete delle RBY (GB). Considerare se passare a FRLG come fonte unica (rifacendo eventualmente anche le mappe già scaricate da PCW) o accettare il mismatch GB+GBA. Da decidere con Samuel.

---

### Q18 — RISOLTA: granularità massima
**Risolta il:** 2026-05-11
**Decisione:** ogni hotspot tracciato individualmente in `storyState.hotspotsConsumed`. Niente exploit di farming (cestino aperto = vuoto per sempre).

---

### Q14 — Evoluzioni: come funzionano nel gioco
**Da chi:** planning chat
**Contesto:** In Pokémon canonico i Pokémon evolvono per livello/oggetto. Qui non ci sono livelli (tutti hanno stat base fisse). Come gestiamo le evoluzioni?
- **Opzione A** — niente evoluzioni: ogni stadio è una carta separata, le pulli indipendentemente (Charmander, Charmeleon, Charizard sono 3 carte distinte)
- **Opzione B** — evoluzione in collezione: pulli solo lo stadio base, lo "evolvi" usando duplicati o pietre come materiali. La carta cambia.
- **Opzione C** — sistema costellazioni come evoluzione: 3 stelle → evolve, 6 stelle → forma finale.

**Decisione richiesta da:** Milestone 11 (impatta cosa pulli) + Milestone 7 (costellazioni)
**Default proposto:** Opzione **A** per il prototipo — semplifica enormemente. Ogni Pokémon è una carta distinta, le costellazioni restano solo per upgrade interni. (Possibile evoluzione futura: opzione B come sistema "advanced" post-prototipo.)

---

### Q3 — Slot dedicati per la passiva — chi li definisce?
**Da chi:** planning chat
**Contesto:** Ogni Pokémon ha 1-2 slot della griglia dove la passiva si attiva (es. Charizard → `front_center`). Servono per tutti i 151. Tre opzioni:
1. Definirli a mano per ogni Pokémon (come per le mosse)
2. Derivarli da regole (es. "tipo Volante → row=back", "tipo Lotta → row=front")
3. Lasciare al giocatore di scegliere (più libertà ma meno strategia)
**Decisione richiesta da:** Milestone 2 (drag & drop deve evidenziare gli slot dedicati)
**Default per ora:** opzione 1, ma per il drag & drop nell'M2 basta hardcodare un slot dedicato di test (es. `front_center` per tutti).

---

---

## Risolte

### Q4 — PP iniziali: 0 o 1?
**Risolta il:** 2026-05-10
**Decisione:** PP partono da **0**. CONTEXT.md lo specifica esplicitamente ("invece di partire pieni e calare, partono a 0 e si guadagnano colpendo"). Al turno 1 i Pokémon attaccano con il loro "attacco base" senza costo PP. Le mosse Basic (costo 1 PP) saranno disponibili dal secondo turno in poi per chi ha colpito.

---

### Q5 — Lineetta colorata per ogni stat: che colori?
**Risolta il:** 2026-05-10
**Decisione:** palette classico-Pokémon confermata da Samuel:
- HP → verde (`#4dad5b` = `var(--success)`)
- ATK → rosso/arancio (`#f08030` = `var(--type-fire)`)
- DEF → blu (`#6890f0` = `var(--type-water)`)
- SP.ATK → viola/rosa (`#f85888` = `var(--type-psychic)`)
- SP.DEF → verde acqua/cyan (`#98d8d8` = `var(--type-ice)`)
- SPEED → giallo (`#f8d030` = `var(--type-electric)`)
- PP → giallo accent (già attuale, invariato)
**Note:** dove possibile riusare le variabili CSS già definite in `:root` per coerenza.

---

### Q6 — Pokémon esclusivi della modalità Storia
**Risolta il:** 2026-05-10
**Decisione:** confermato il default canonico. Esclusivi storia (NON ottenibili dai Summon):
- **Starter**: Bulbasaur (+ Ivysaur, Venusaur), Charmander (+ Charmeleon, Charizard), Squirtle (+ Wartortle, Blastoise)
- **Fossili**: Omanyte/Omastar, Kabuto/Kabutops, Aerodactyl
- **Eevee + evoluzioni Gen 1**: Eevee, Vaporeon, Jolteon, Flareon
- **Snorlax**
- **Lapras**
- **Hitmonlee, Hitmonchan**
- **Leggendari** (Articuno, Zapdos, Moltres, Mewtwo, Mew) — non ottenibili per ora; Mewtwo otttenibile post-Lega in Grotta Celeste
**Note:** se Samuel ricorda altri Pokémon "regalo NPC" canonici si aggiungeranno (es. Magikarp dal venditore, Pokémon scambio, ecc.).

---

### Q7 — Modello del sistema Summon (gacha)
**Risolta il:** 2026-05-10
**Decisione:** opzione 4 — un solo banner permanente Gen 1, drop pesato per rarità, niente pity, niente rate-up. Modello custom semplice per il prototipo.

---

### Q8 — Sistema rarità Pokémon
**Risolta il:** 2026-05-10
**Decisione:** rarità per linea evolutiva (3★/4★/5★/6★, con leggendari 6★ non summonabili). **Samuel preparerà un file con la rarità di ogni Pokémon**, da mettere in `js/data/rarity.js` (o simile) quando sarà pronto.

---

### Q11 — Modalità Storia: struttura del percorso
**Risolta il:** 2026-05-10
**Decisione:** avventura punta-e-clicca esplorabile. Visione confermata da Samuel:
- Mappa città dall'alto stile Game Boy (es. Biancavilla con case e laboratorio Oak)
- Click sulle case → entri (cambio scena)
- Cestini cliccabili → oggetti nascosti
- Click verso il percorso → cambio scena su route
- Pokéball cliccabili sulle route → oggetti / Pokémon
- Allenatori cliccabili → battaglia → ricompense (valuta pull)
- Aree gated: alcune zone richiedono di aver compiuto eventi (es. battere capopalestra)
- Lega Pokémon come climax
- Post-Lega: Grotta Celeste con scale → Mewtwo; sblocco prossima regione
- Battaglie wild **non menzionate da Samuel** → assumiamo per ora **NO incontri wild casuali**, solo allenatori e Pokéball scriptati. Da riconfermare se serve.

---

### Q12 — Oggetti che potenziano un tipo: meccanica
**Risolta il:** 2026-05-10
**Decisione:** **MT come oggetti**. Battendo un capopalestra si ottengono **medaglia + MT**:
- **Medaglia** = badge cosmetico di progressione (visibile in profilo / collezione)
- **MT** = oggetto che il giocatore applica a un Pokémon per potenziare un tipo specifico (es. MT-Roccia da Brock)
**Note:** integrazione con sistema Gear da definire — vedi nuova Q15.

---

### Q14 — Evoluzioni: come funzionano nel gioco
**Risolta il:** 2026-05-10
**Decisione:** opzione A — ogni stadio è una carta separata, ottenibile indipendentemente. Pulli Charmander, Charmeleon, Charizard come 3 carte distinte. Le costellazioni restano un sistema separato (upgrade interni del singolo Pokémon).

<!--
Esempio formato risolto:
### Q0 — Esempio
**Risolta il:** YYYY-MM-DD
**Decisione:** ...
**Note:** ...
-->
