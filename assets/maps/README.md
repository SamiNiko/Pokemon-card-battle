# Mappe della modalità Storia

Qui vanno le immagini di sfondo delle scene. Sono caricate con `image-rendering: pixelated` per mantenere il pixel art crisp anche su schermi grandi.

---

## Come salvare le immagini

Per ogni scena serve un file PNG. **Nome del file = ID della scena** (esattamente).

### Lista file attesa

| File | Cosa contiene |
|---|---|
| `biancavilla.png` | Mappa esterna di Biancavilla (case + lab + alberi) |
| `casa-rosso-p0.png` | Casa di Rosso — **piano terra** (con tappeto e scale) |
| `casa-rosso-p1.png` | Casa di Rosso — **primo piano** (camera, TV, computer) |
| `casa-blu-p0.png` | Casa di Blu — piano terra |
| `casa-blu-p1.png` | Casa di Blu — primo piano |
| `lab-oak.png` | Laboratorio del Prof. Oak (interno) |
| `route-1.png` | Route 1 (verde, alberi, sentiero verso nord) |

### Note tecniche

- **Formato**: PNG con sfondo trasparente o pieno, non importa
- **Risoluzione**: qualsiasi — il sistema la scala automaticamente
- **Aspect ratio**: viene letto dall'immagine stessa e la scena si adatta
- **Pixel art crisp**: il browser non interpola, quindi va bene anche bassa risoluzione (256×256, 512×512, ecc.)

### Case a più piani

Ogni piano è una scena separata. Le scale collegano i piani:

- `casa-rosso-p0` ↑ scala → `casa-rosso-p1`
- `casa-rosso-p1` ↓ scala → `casa-rosso-p0`

L'hotspot "scala" è già configurato in `js/data/scenes.js` — devi solo regolare la posizione (% sopra l'immagine) per farlo combaciare con dove sono le scale nella tua mappa.

---

## Come regolare gli hotspot

In `js/data/scenes.js` ogni hotspot ha:

```js
{
  id: 'casa-rosso', type: 'door', label: 'Casa di Rosso',
  pos:  { left: '15%', top: '15%' },   // angolo top-left dell'area cliccabile
  size: { w: '25%', h: '30%' },         // dimensione in % dell'immagine
  target: 'casa-rosso-p0',
},
```

Tutti i valori sono **percentuali dell'immagine**, non del viewport. Quindi se la tua mappa è 1000×900 e l'area cliccabile della casa è 250px wide a partire da 150px from left → `left: '15%'`, `w: '25%'`.

Per testare velocemente le posizioni: in story.css c'è `.story-page.is-debug .hotspot` che le evidenzia in giallo trasparente. Per attivarlo aggiungi `class="story-page is-debug"` al `<body>` di story.html.

---

## Asset mancanti

Se un'immagine non esiste, la scena cade in **fallback** ai vecchi sprite hand-drawn (case CSS, alberi pixel art via SVG). Non si rompe nulla — basta poi aggiungere il file e refreshare.
