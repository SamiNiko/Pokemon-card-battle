#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
gen_movesets_passives.py
========================
Genera:
  - Pokemon_Mosse_Passive_Gen1.xlsx, foglio 'Gen 1' riempito con
    Mossa Base 1 / Pot.M1 / Mossa Base 2 / Pot.M2 / Finisher / Pot.F /
    Passiva / Effetto Passiva  (uno per ogni dei 151 Pokemon Gen 1)
  - js/data/movesets.js  formato [base1, base2, finisher]
  - js/data/passives.js  con effetti + posizioni di attivazione

Regole:
  - Categoria phys/spec scelta dalla stat piu' alta (ATK vs SP.ATK)
  - 2 mosse base di TIPI DIVERSI quando possibile, stessa categoria
  - Finisher: STAB tipo primario, piu' potente, stessa categoria
  - Power scaling per rarita' (gap finisher meno aggressivo):
      Comune        base 35 / fin 65
      Non Comune    base 50 / fin 80
      Raro          base 65 / fin 95
      Epico         base 80 / fin 115
      Pseudo        base 90 / fin 130
      Leggendario   base 100 / fin 150
    Le 3 mosse di uno stesso Pokemon hanno variazione ±5
  - Passive: biblioteca di 18 archetipi competitive adattati
  - Posizioni passiva: derivate dalla NATURA della passiva
    (Hero Colosseum style), 1-2 caselle ciascuna
"""
import os, sys, json
from openpyxl import load_workbook
from openpyxl.styles import Font, PatternFill, Alignment

# ============================================================
#  STATS GEN 1  (HP, ATK, DEF, SP_ATK, SP_DEF, SPE) — Gen 7+ stats
# ============================================================
STATS = {
    1: (45, 49, 49, 65, 65, 45),    2: (60, 62, 63, 80, 80, 60),    3: (80, 82, 83, 100, 100, 80),
    4: (39, 52, 43, 60, 50, 65),    5: (58, 64, 58, 80, 65, 80),    6: (78, 84, 78, 109, 85, 100),
    7: (44, 48, 65, 50, 64, 43),    8: (59, 63, 80, 65, 80, 58),    9: (79, 83, 100, 85, 105, 78),
    10: (45, 30, 35, 20, 20, 45),   11: (50, 20, 55, 25, 25, 30),   12: (60, 45, 50, 90, 80, 70),
    13: (40, 35, 30, 20, 20, 50),   14: (45, 25, 50, 25, 25, 35),   15: (65, 90, 40, 45, 80, 75),
    16: (40, 45, 40, 35, 35, 56),   17: (63, 60, 55, 50, 50, 71),   18: (83, 80, 75, 70, 70, 101),
    19: (30, 56, 35, 25, 35, 72),   20: (55, 81, 60, 50, 70, 97),
    21: (40, 60, 30, 31, 31, 70),   22: (65, 90, 65, 61, 61, 100),
    23: (35, 60, 44, 40, 54, 55),   24: (60, 95, 69, 65, 79, 80),
    25: (35, 55, 40, 50, 50, 90),   26: (60, 90, 55, 90, 80, 110),
    27: (50, 75, 85, 20, 30, 40),   28: (75, 100, 110, 45, 55, 65),
    29: (55, 47, 52, 40, 40, 41),   30: (70, 62, 67, 55, 55, 56),   31: (90, 92, 87, 75, 85, 76),
    32: (46, 57, 40, 40, 40, 50),   33: (61, 72, 57, 55, 55, 65),   34: (81, 102, 77, 85, 75, 85),
    35: (70, 45, 48, 60, 65, 35),   36: (95, 70, 73, 95, 90, 60),
    37: (38, 41, 40, 50, 65, 65),   38: (73, 76, 75, 81, 100, 100),
    39: (115, 45, 20, 45, 25, 20),  40: (140, 70, 45, 85, 50, 45),
    41: (40, 45, 35, 30, 40, 55),   42: (75, 80, 70, 65, 75, 90),
    43: (45, 50, 55, 75, 65, 30),   44: (60, 65, 70, 85, 75, 40),   45: (75, 80, 85, 110, 90, 50),
    46: (35, 70, 55, 45, 55, 25),   47: (60, 95, 80, 60, 80, 30),
    48: (60, 55, 50, 40, 55, 45),   49: (70, 65, 60, 90, 75, 90),
    50: (10, 55, 25, 35, 45, 95),   51: (35, 100, 50, 50, 70, 120),
    52: (40, 45, 35, 40, 40, 90),   53: (65, 70, 60, 65, 65, 115),
    54: (50, 52, 48, 65, 50, 55),   55: (80, 82, 78, 95, 80, 85),
    56: (40, 80, 35, 35, 45, 70),   57: (65, 105, 60, 60, 70, 95),
    58: (55, 70, 45, 70, 50, 60),   59: (90, 110, 80, 100, 80, 95),
    60: (40, 50, 40, 40, 40, 90),   61: (65, 65, 65, 50, 50, 90),   62: (90, 95, 95, 70, 90, 70),
    63: (25, 20, 15, 105, 55, 90),  64: (40, 35, 30, 120, 70, 105), 65: (55, 50, 45, 135, 95, 120),
    66: (70, 80, 50, 35, 35, 35),   67: (80, 100, 70, 50, 60, 45),  68: (90, 130, 80, 65, 85, 55),
    69: (50, 75, 35, 70, 30, 40),   70: (65, 90, 50, 85, 45, 55),   71: (80, 105, 65, 100, 70, 70),
    72: (40, 40, 35, 50, 100, 70),  73: (80, 70, 65, 80, 120, 100),
    74: (40, 80, 100, 30, 30, 20),  75: (55, 95, 115, 45, 45, 35),  76: (80, 120, 130, 55, 65, 45),
    77: (50, 85, 55, 65, 65, 90),   78: (65, 100, 70, 80, 80, 105),
    79: (90, 65, 65, 40, 40, 15),   80: (95, 75, 110, 100, 80, 30),
    81: (25, 35, 70, 95, 55, 45),   82: (50, 60, 95, 120, 70, 70),
    83: (52, 90, 55, 58, 62, 60),
    84: (35, 85, 45, 35, 35, 75),   85: (60, 110, 70, 60, 60, 110),
    86: (65, 45, 55, 45, 70, 45),   87: (90, 70, 80, 70, 95, 70),
    88: (80, 80, 50, 40, 50, 25),   89: (105, 105, 75, 65, 100, 50),
    90: (30, 65, 100, 45, 25, 40),  91: (50, 95, 180, 85, 45, 70),
    92: (30, 35, 30, 100, 35, 80),  93: (45, 50, 45, 115, 55, 95),  94: (60, 65, 60, 130, 75, 110),
    95: (35, 45, 160, 30, 45, 70),
    96: (60, 48, 45, 43, 90, 42),   97: (85, 73, 70, 73, 115, 67),
    98: (30, 105, 90, 25, 25, 50),  99: (55, 130, 115, 50, 50, 75),
    100: (40, 30, 50, 55, 55, 100), 101: (60, 50, 70, 80, 80, 150),
    102: (60, 40, 80, 60, 45, 40),  103: (95, 95, 85, 125, 75, 55),
    104: (50, 50, 95, 40, 50, 35),  105: (60, 80, 110, 50, 80, 45),
    106: (50, 120, 53, 35, 110, 87), 107: (50, 105, 79, 35, 110, 76),
    108: (90, 55, 75, 60, 75, 30),
    109: (40, 65, 95, 60, 45, 35),  110: (65, 90, 120, 85, 70, 60),
    111: (80, 85, 95, 30, 30, 25),  112: (105, 130, 120, 45, 45, 40),
    113: (250, 5, 5, 35, 105, 50),
    114: (65, 55, 115, 100, 40, 60),
    115: (105, 95, 80, 40, 80, 90),
    116: (30, 40, 70, 70, 25, 60),  117: (55, 65, 95, 95, 45, 85),
    118: (45, 67, 60, 35, 50, 63),  119: (80, 92, 65, 65, 80, 68),
    120: (30, 45, 55, 70, 55, 85),  121: (60, 75, 85, 100, 85, 115),
    122: (40, 45, 65, 100, 120, 90),
    123: (70, 110, 80, 55, 80, 105),
    124: (65, 50, 35, 115, 95, 95), 125: (65, 83, 57, 95, 85, 105), 126: (65, 95, 57, 100, 85, 93),
    127: (65, 125, 100, 55, 70, 85),
    128: (75, 100, 95, 40, 70, 110),
    129: (20, 10, 55, 15, 20, 80),  130: (95, 125, 79, 60, 100, 81),
    131: (130, 85, 80, 85, 95, 60),
    132: (48, 48, 48, 48, 48, 48),
    133: (55, 55, 50, 45, 65, 55),
    134: (130, 65, 60, 110, 95, 65), 135: (65, 65, 60, 110, 95, 130), 136: (65, 130, 60, 95, 110, 65),
    137: (65, 60, 70, 85, 75, 40),
    138: (35, 40, 100, 90, 55, 35), 139: (70, 60, 125, 115, 70, 55),
    140: (30, 80, 90, 55, 45, 55),  141: (60, 115, 105, 65, 70, 80),
    142: (80, 105, 65, 60, 75, 130),
    143: (160, 110, 65, 65, 110, 30),
    144: (90, 85, 100, 95, 125, 85), 145: (90, 90, 85, 125, 90, 100), 146: (90, 100, 90, 125, 85, 90),
    147: (41, 64, 45, 50, 50, 50),  148: (61, 84, 65, 70, 70, 70),  149: (91, 134, 95, 100, 100, 80),
    150: (106, 110, 90, 154, 90, 130),
    151: (100, 100, 100, 100, 100, 100),
}

# ============================================================
#  TIPI POKEMON  (id → [type1, type2?] — minuscolo, formato PokeAPI)
# ============================================================
TYPES = {
    1: ['grass', 'poison'],   2: ['grass', 'poison'],   3: ['grass', 'poison'],
    4: ['fire'],              5: ['fire'],              6: ['fire', 'flying'],
    7: ['water'],             8: ['water'],             9: ['water'],
    10: ['bug'],              11: ['bug'],              12: ['bug', 'flying'],
    13: ['bug', 'poison'],    14: ['bug', 'poison'],    15: ['bug', 'poison'],
    16: ['normal', 'flying'], 17: ['normal', 'flying'], 18: ['normal', 'flying'],
    19: ['normal'],           20: ['normal'],
    21: ['normal', 'flying'], 22: ['normal', 'flying'],
    23: ['poison'],           24: ['poison'],
    25: ['electric'],         26: ['electric'],
    27: ['ground'],           28: ['ground'],
    29: ['poison'],           30: ['poison'],           31: ['poison', 'ground'],
    32: ['poison'],           33: ['poison'],           34: ['poison', 'ground'],
    35: ['fairy'],            36: ['fairy'],
    37: ['fire'],             38: ['fire'],
    39: ['normal', 'fairy'],  40: ['normal', 'fairy'],
    41: ['poison', 'flying'], 42: ['poison', 'flying'],
    43: ['grass', 'poison'],  44: ['grass', 'poison'],  45: ['grass', 'poison'],
    46: ['bug', 'grass'],     47: ['bug', 'grass'],
    48: ['bug', 'poison'],    49: ['bug', 'poison'],
    50: ['ground'],           51: ['ground'],
    52: ['normal'],           53: ['normal'],
    54: ['water'],            55: ['water'],
    56: ['fighting'],         57: ['fighting'],
    58: ['fire'],             59: ['fire'],
    60: ['water'],            61: ['water'],            62: ['water', 'fighting'],
    63: ['psychic'],          64: ['psychic'],          65: ['psychic'],
    66: ['fighting'],         67: ['fighting'],         68: ['fighting'],
    69: ['grass', 'poison'],  70: ['grass', 'poison'],  71: ['grass', 'poison'],
    72: ['water', 'poison'],  73: ['water', 'poison'],
    74: ['rock', 'ground'],   75: ['rock', 'ground'],   76: ['rock', 'ground'],
    77: ['fire'],             78: ['fire'],
    79: ['water', 'psychic'], 80: ['water', 'psychic'],
    81: ['electric', 'steel'], 82: ['electric', 'steel'],
    83: ['normal', 'flying'],
    84: ['normal', 'flying'], 85: ['normal', 'flying'],
    86: ['water'],            87: ['water', 'ice'],
    88: ['poison'],           89: ['poison'],
    90: ['water'],            91: ['water', 'ice'],
    92: ['ghost', 'poison'],  93: ['ghost', 'poison'],  94: ['ghost', 'poison'],
    95: ['rock', 'ground'],
    96: ['psychic'],          97: ['psychic'],
    98: ['water'],            99: ['water'],
    100: ['electric'],        101: ['electric'],
    102: ['grass', 'psychic'], 103: ['grass', 'psychic'],
    104: ['ground'],          105: ['ground'],
    106: ['fighting'],        107: ['fighting'],
    108: ['normal'],
    109: ['poison'],          110: ['poison'],
    111: ['ground', 'rock'],  112: ['ground', 'rock'],
    113: ['normal'],
    114: ['grass'],
    115: ['normal'],
    116: ['water'],           117: ['water'],
    118: ['water'],           119: ['water'],
    120: ['water'],           121: ['water', 'psychic'],
    122: ['psychic', 'fairy'],
    123: ['bug', 'flying'],
    124: ['ice', 'psychic'],  125: ['electric'],        126: ['fire'],
    127: ['bug'],
    128: ['normal'],
    129: ['water'],           130: ['water', 'flying'],
    131: ['water', 'ice'],
    132: ['normal'],
    133: ['normal'],
    134: ['water'],           135: ['electric'],        136: ['fire'],
    137: ['normal'],
    138: ['rock', 'water'],   139: ['rock', 'water'],
    140: ['rock', 'water'],   141: ['rock', 'water'],
    142: ['rock', 'flying'],
    143: ['normal'],
    144: ['ice', 'flying'],   145: ['electric', 'flying'], 146: ['fire', 'flying'],
    147: ['dragon'],          148: ['dragon'],          149: ['dragon', 'flying'],
    150: ['psychic'],         151: ['psychic'],
}

# ============================================================
#  RARITA' — replica di rarity.js
# ============================================================
LEGGENDARI         = {144, 145, 146, 150, 151}
PSEUDO_LEGGENDARI  = {149}
EPICI              = {3, 6, 9, 18, 26, 38, 94, 123, 130, 143}
RARI               = {25, 31, 34, 45, 59, 62, 64, 65, 68, 71, 73, 76, 78, 82, 83, 106, 107, 112,
                      113, 115, 122, 124, 125, 126, 127, 128, 131, 132, 134, 135, 136, 142}

def rarity_of(pid):
    if pid in LEGGENDARI:        return 'legendary'
    if pid in PSEUDO_LEGGENDARI: return 'pseudo'
    if pid in EPICI:             return 'epic'
    if pid in RARI:              return 'rare'
    # Tutti gli altri sono uncommon o common, lo determino dal totale stat
    total = sum(STATS[pid])
    return 'uncommon' if total >= 350 else 'common'

# Power scaling rivisto (gap finisher meno aggressivo)
POWER_BY_RARITY = {
    # rarity: (base_min, base_max, fin_min, fin_max)
    'common':    (30, 40, 60, 70),
    'uncommon':  (45, 55, 75, 85),
    'rare':      (60, 70, 90, 100),
    'epic':      (75, 85, 110, 120),
    'pseudo':    (85, 95, 125, 135),
    'legendary': (95, 105, 145, 155),
}

# ============================================================
#  TYPE_IT → type EN (per il movepool xlsx in italiano)
# ============================================================
TYPE_IT2EN = {
    'normale':    'normal', 'fuoco':     'fire',     'acqua':     'water',
    'erba':       'grass',  'elettro':   'electric', 'ghiaccio':  'ice',
    'lotta':      'fighting', 'veleno':  'poison',   'terra':     'ground',
    'volante':    'flying', 'psico':     'psychic',  'coleottero':'bug',
    'roccia':     'rock',   'spettro':   'ghost',    'drago':     'dragon',
    'buio':       'dark',   'acciaio':   'steel',    'folletto':  'fairy',
    '???':        'normal',
}
CAT_IT2EN = {'fisica':'physical', 'speciale':'special', 'stato':'status'}

# ============================================================
#  PASSIVE LIBRARY — 18 archetipi competitive adattati
#  Ogni passiva ha:
#    - name (italiano)
#    - effect (descrizione gameplay)
#    - active_slots: lista di slotKey (1-2) dove la passiva si attiva
#      Le slot sono Hero-Colosseum-style: dipendono dalla NATURA della passiva.
#    - meta: chiave + payload per il combat engine futuro
# ============================================================
# Pool slot per ogni archetipo: insieme delle caselle dove la passiva
# ha senso strategico. Per ogni Pokemon, scegliamo deterministicamente
# 1-2 slot DAL POOL DELL'ARCHETIPO, in modo che 3 Pokemon dello stesso
# archetipo in un team possano avere combinazioni di slot diverse e
# attivare tutte e 3 le passive. (varieta' a la Hero Colosseum)
PASSIVE_LIB = {
    'siccita': {
        'name': 'Siccità',
        'effect': "Le tue mosse Fuoco infliggono +25% di danno.",
        'pool':  ['back-center', 'back-left', 'back-right', 'front-center'],  # regia/comando
        'meta':  {'kind': 'type_boost', 'type': 'fire', 'mult': 1.25},
    },
    'pioggerellina': {
        'name': 'Pioggerellina',
        'effect': "Le tue mosse Acqua infliggono +25% di danno.",
        'pool':  ['back-center', 'back-left', 'back-right', 'front-center'],
        'meta':  {'kind': 'type_boost', 'type': 'water', 'mult': 1.25},
    },
    'sabbiainfinita': {
        'name': 'Sabbiainfinita',
        'effect': "Le tue mosse Roccia/Terra infliggono +20% di danno.",
        'pool':  ['back-center', 'back-left', 'back-right', 'front-center'],
        'meta':  {'kind': 'type_boost_multi', 'types': ['rock', 'ground'], 'mult': 1.20},
    },
    'snownevicata': {
        'name': 'Scendineve',
        'effect': "Le tue mosse Ghiaccio infliggono +25% di danno.",
        'pool':  ['back-center', 'back-left', 'back-right', 'front-center'],
        'meta':  {'kind': 'type_boost', 'type': 'ice', 'mult': 1.25},
    },
    'levitazione': {
        'name': 'Levitazione',
        'effect': "Immune al danno diretto da colonna vuota e mosse Terra.",
        'pool':  ['front-left', 'front-right', 'back-left', 'back-right'],   # sfuggente
        'meta':  {'kind': 'immune', 'mods': ['direct_damage'], 'types': ['ground']},
    },
    'multiscala': {
        'name': 'Multiscaglia',
        'effect': "A HP pieno, subisci -50% di danno dal primo colpo ricevuto.",
        'pool':  ['front-center', 'front-left', 'front-right'],  # linea fronte
        'meta':  {'kind': 'first_hit_resist', 'amount': 0.5, 'condition': 'full_hp'},
    },
    'vigore': {
        'name': 'Vigore',
        'effect': "Sopravvivi con 1 HP a un colpo che ti ucciderebbe (1 volta a battaglia).",
        'pool':  ['front-center', 'front-left', 'front-right'],
        'meta':  {'kind': 'endure_once', 'once': True},
    },
    'rigenerazione': {
        'name': 'Rigenerazione',
        'effect': "A fine turno, recuperi il 15% degli HP massimi.",
        'pool':  ['back-center', 'back-left', 'back-right'],   # safe back
        'meta':  {'kind': 'regen', 'percent': 0.15, 'when': 'turn_end'},
    },
    'pressione': {
        'name': 'Pressione',
        'effect': "Il Pokémon che ti attacca consuma 1 PP extra.",
        'pool':  ['front-center', 'front-left', 'front-right'],
        'meta':  {'kind': 'extra_pp_cost', 'amount': 1},
    },
    'tecnico': {
        'name': 'Tecnico',
        'effect': "Le tue mosse Base infliggono +30% di danno.",
        'pool':  ['front-center', 'front-left', 'front-right', 'back-center'],
        'meta':  {'kind': 'base_move_boost', 'mult': 1.30},
    },
    'fortunone': {
        'name': 'Fortunone',
        'effect': "Le tue mosse Finisher infliggono +20% di danno.",
        'pool':  ['back-center', 'back-left', 'back-right'],
        'meta':  {'kind': 'finisher_boost', 'mult': 1.20},
    },
    'adattabilita': {
        'name': 'Adattabilità',
        'effect': "Il bonus STAB delle tue mosse è raddoppiato (×2 anziché ×1.5).",
        'pool':  ['front-center', 'back-center', 'front-left', 'front-right', 'back-left', 'back-right'],
        'meta':  {'kind': 'stab_boost', 'mult': 2.0},
    },
    'pancialarda': {
        'name': 'Pancialarda',
        'effect': "Subisci -30% di danno dalle mosse Fuoco e Ghiaccio.",
        'pool':  ['front-center', 'front-left', 'front-right'],
        'meta':  {'kind': 'type_resist', 'types': ['fire', 'ice'], 'mult': 0.70},
    },
    'specchiomagico': {
        'name': 'Specchiomagico',
        'effect': "Le mosse Speciali subite infliggono -25% di danno.",
        'pool':  ['back-center', 'back-left', 'back-right', 'front-center'],
        'meta':  {'kind': 'cat_resist', 'cat': 'special', 'mult': 0.75},
    },
    'statico': {
        'name': 'Statico',
        'effect': "Il Pokémon che ti attacca ha 30% di non guadagnare PP quel turno.",
        'pool':  ['front-center', 'front-left', 'front-right'],
        'meta':  {'kind': 'pp_block_chance', 'chance': 0.3},
    },
    'velenpunta': {
        'name': 'Velenpunta',
        'effect': "Le tue mosse Veleno infliggono +25% di danno.",
        'pool':  ['back-center', 'back-left', 'back-right', 'front-center'],
        'meta':  {'kind': 'type_boost', 'type': 'poison', 'mult': 1.25},
    },
    'corazza': {
        'name': 'Corazza',
        'effect': "Subisci -20% di danno dalle mosse Fisiche.",
        'pool':  ['front-center', 'front-left', 'front-right'],
        'meta':  {'kind': 'cat_resist', 'cat': 'physical', 'mult': 0.80},
    },
    'velocitascatto': {
        'name': 'Velocitàscatto',
        'effect': "A ogni turno la tua Velocità aumenta del 15% (cumulativo, max +60%).",
        'pool':  ['back-left', 'back-right', 'back-center', 'front-left', 'front-right'],
        'meta':  {'kind': 'speed_stack', 'percent': 0.15, 'max_stacks': 4},
    },
    'ultrapotenza': {
        'name': 'Ultrapotenza',
        'effect': "Il tuo Attacco è raddoppiato. La tua Difesa è dimezzata.",
        'pool':  ['front-center', 'front-left', 'front-right'],
        'meta':  {'kind': 'atk_boost_def_drop', 'atk_mult': 2.0, 'def_mult': 0.5},
    },
}

# Tutte le combinazioni possibili di 1-2 slot dal pool (1 elemento prima, poi 2)
def slot_combos(pool):
    """Lista di tuple — combinazioni di 1 elemento, poi di 2 elementi
    (ordinate alfabeticamente per stabilità). Non ripetiamo (a,b) e (b,a)."""
    singles = [(s,) for s in pool]
    pairs = []
    for i, a in enumerate(pool):
        for b in pool[i+1:]:
            pairs.append(tuple(sorted([a, b])))
    return singles + pairs

# Distribuzione round-robin: per ogni archetipo, distribuisco i combos
# uniformemente fra tutti i Pokemon che usano quell'archetipo. Cosi' due
# Pokemon dello stesso archetipo non avranno mai gli stessi slot a meno che
# ci siano piu' Pokemon che combos disponibili.
_ASSIGN_CACHE = {}  # pid → tuple di slot

def build_assignment_cache():
    """Pre-popola _ASSIGN_CACHE con assegnazioni stabili."""
    by_arch = {}
    for pid, key in POKEMON_PASSIVE.items():
        by_arch.setdefault(key, []).append(pid)
    for key, pids in by_arch.items():
        combos = slot_combos(PASSIVE_LIB[key]['pool'])
        # Ordino i pid per stabilità tra esecuzioni
        for i, pid in enumerate(sorted(pids)):
            combo = combos[i % len(combos)]
            _ASSIGN_CACHE[pid] = list(combo)

def pick_combo_for_pokemon(pid, archetype_key):
    if not _ASSIGN_CACHE:
        build_assignment_cache()
    return _ASSIGN_CACHE.get(pid, list(slot_combos(PASSIVE_LIB[archetype_key]['pool'])[0]))

# ============================================================
#  MAPPING Pokemon → passiva archetipo
#  Scelto in base all'identita' competitiva del Pokemon
# ============================================================
POKEMON_PASSIVE = {
    # Starter Erba
    1: 'velenpunta',     2: 'velenpunta',     3: 'velenpunta',
    # Starter Fuoco
    4: 'siccita',        5: 'siccita',        6: 'siccita',
    # Starter Acqua
    7: 'pioggerellina',  8: 'pioggerellina',  9: 'pioggerellina',
    # Bug deboli
    10: 'corazza',       11: 'corazza',       12: 'fortunone',
    13: 'velenpunta',    14: 'corazza',       15: 'velenpunta',
    # Pidgey line: speedster
    16: 'velocitascatto', 17: 'velocitascatto', 18: 'velocitascatto',
    # Rattata / Spearow
    19: 'tecnico',       20: 'tecnico',       21: 'tecnico',       22: 'velocitascatto',
    # Ekans / Arbok
    23: 'velenpunta',    24: 'pressione',
    # Pikachu / Raichu
    25: 'statico',       26: 'statico',
    # Sandshrew
    27: 'corazza',       28: 'sabbiainfinita',
    # Nidoran♀ line
    29: 'velenpunta',    30: 'velenpunta',    31: 'corazza',
    # Nidoran♂ line
    32: 'velenpunta',    33: 'velenpunta',    34: 'ultrapotenza',
    # Clefairy / Clefable
    35: 'specchiomagico', 36: 'specchiomagico',
    # Vulpix / Ninetales
    37: 'siccita',       38: 'siccita',
    # Jigglypuff / Wigglytuff
    39: 'specchiomagico', 40: 'specchiomagico',
    # Zubat / Golbat
    41: 'levitazione',   42: 'levitazione',
    # Oddish / Gloom / Vileplume
    43: 'velenpunta',    44: 'velenpunta',    45: 'velenpunta',
    # Paras / Parasect
    46: 'tecnico',       47: 'pressione',
    # Venonat / Venomoth
    48: 'velenpunta',    49: 'velenpunta',
    # Diglett / Dugtrio
    50: 'velocitascatto', 51: 'velocitascatto',
    # Meowth / Persian
    52: 'fortunone',     53: 'tecnico',
    # Psyduck / Golduck
    54: 'pressione',     55: 'pressione',
    # Mankey / Primeape
    56: 'ultrapotenza',  57: 'ultrapotenza',
    # Growlithe / Arcanine
    58: 'siccita',       59: 'siccita',
    # Poliwag / Poliwhirl / Poliwrath
    60: 'pioggerellina', 61: 'pioggerellina', 62: 'ultrapotenza',
    # Abra / Kadabra / Alakazam
    63: 'pressione',     64: 'specchiomagico', 65: 'specchiomagico',
    # Machop / Machoke / Machamp
    66: 'ultrapotenza',  67: 'ultrapotenza',  68: 'ultrapotenza',
    # Bellsprout / Weepinbell / Victreebel
    69: 'velenpunta',    70: 'velenpunta',    71: 'velenpunta',
    # Tentacool / Tentacruel
    72: 'velenpunta',    73: 'velenpunta',
    # Geodude / Graveler / Golem
    74: 'corazza',       75: 'corazza',       76: 'sabbiainfinita',
    # Ponyta / Rapidash
    77: 'siccita',       78: 'velocitascatto',
    # Slowpoke / Slowbro
    79: 'rigenerazione', 80: 'rigenerazione',
    # Magnemite / Magneton
    81: 'corazza',       82: 'corazza',
    # Farfetch'd
    83: 'tecnico',
    # Doduo / Dodrio
    84: 'velocitascatto', 85: 'velocitascatto',
    # Seel / Dewgong
    86: 'snownevicata',  87: 'snownevicata',
    # Grimer / Muk
    88: 'velenpunta',    89: 'velenpunta',
    # Shellder / Cloyster
    90: 'corazza',       91: 'corazza',
    # Gastly / Haunter / Gengar
    92: 'levitazione',   93: 'levitazione',   94: 'levitazione',
    # Onix
    95: 'corazza',
    # Drowzee / Hypno
    96: 'pressione',     97: 'pressione',
    # Krabby / Kingler
    98: 'ultrapotenza',  99: 'ultrapotenza',
    # Voltorb / Electrode
    100: 'statico',     101: 'velocitascatto',
    # Exeggcute / Exeggutor
    102: 'rigenerazione', 103: 'rigenerazione',
    # Cubone / Marowak
    104: 'corazza',     105: 'ultrapotenza',
    # Hitmonlee / Hitmonchan
    106: 'tecnico',     107: 'tecnico',
    # Lickitung
    108: 'rigenerazione',
    # Koffing / Weezing
    109: 'levitazione', 110: 'levitazione',
    # Rhyhorn / Rhydon
    111: 'corazza',     112: 'corazza',
    # Chansey
    113: 'specchiomagico',
    # Tangela
    114: 'rigenerazione',
    # Kangaskhan
    115: 'tecnico',
    # Horsea / Seadra
    116: 'pioggerellina', 117: 'pioggerellina',
    # Goldeen / Seaking
    118: 'pioggerellina', 119: 'pioggerellina',
    # Staryu / Starmie
    120: 'pioggerellina', 121: 'specchiomagico',
    # Mr. Mime
    122: 'specchiomagico',
    # Scyther
    123: 'tecnico',
    # Jynx
    124: 'snownevicata',
    # Electabuzz / Magmar
    125: 'statico',     126: 'siccita',
    # Pinsir
    127: 'ultrapotenza',
    # Tauros
    128: 'tecnico',
    # Magikarp
    129: 'vigore',
    # Gyarados
    130: 'ultrapotenza',
    # Lapras
    131: 'snownevicata',
    # Ditto
    132: 'adattabilita',
    # Eevee
    133: 'adattabilita',
    # Vaporeon / Jolteon / Flareon
    134: 'pioggerellina', 135: 'statico',   136: 'siccita',
    # Porygon
    137: 'adattabilita',
    # Omanyte / Omastar
    138: 'corazza',     139: 'corazza',
    # Kabuto / Kabutops
    140: 'corazza',     141: 'tecnico',
    # Aerodactyl
    142: 'velocitascatto',
    # Snorlax
    143: 'pancialarda',
    # Articuno / Zapdos / Moltres
    144: 'snownevicata', 145: 'statico',  146: 'siccita',
    # Dratini / Dragonair / Dragonite
    147: 'multiscala',  148: 'multiscala', 149: 'multiscala',
    # Mewtwo
    150: 'pressione',
    # Mew
    151: 'adattabilita',
}

# ============================================================
#  LEGGI MOVEPOOL DALL'XLSX
# ============================================================
def load_movepool(xlsx_path='Pokemon_Mosse_Passive_Gen1.xlsx'):
    """Return: dict[pkmn_id] -> list of dict {name_it, name_en, type, cat, power}"""
    wb = load_workbook(xlsx_path, data_only=True)
    ws = wb['Movepool']
    out = {}
    for row in ws.iter_rows(min_row=2, values_only=True):
        pid, _pn, name_it, name_en, type_it, cat_it, power = row
        if pid is None: continue
        pid = int(pid)
        type_en = TYPE_IT2EN.get(str(type_it or '').strip().lower(), 'normal')
        cat_en  = CAT_IT2EN.get(str(cat_it  or '').strip().lower(), 'status')
        try:
            pow_i = int(power) if power not in (None, '—', '-') else 0
        except (ValueError, TypeError):
            pow_i = 0
        out.setdefault(pid, []).append({
            'name_it': str(name_it or '').strip(),
            'name_en': str(name_en or '').strip(),
            'type':    type_en,
            'cat':     cat_en,
            'power':   pow_i,
        })
    return out


# ============================================================
#  SCELTA CATEGORIA + MOSSE
# ============================================================
def category_for(pid):
    """Phys o spec in base alla stat piu' alta."""
    _, atk, _, spatk, _, _ = STATS[pid]
    return 'physical' if atk >= spatk else 'special'

def pick_moves(pid, movepool):
    """
    Ritorna (base1, base2, finisher) come dict {name, type, cat, power}.
    Garantisce categoria coerente, tipi diversi quando possibile,
    finisher STAB tipo primario.
    """
    cat   = category_for(pid)
    types = TYPES[pid]
    primary = types[0]
    secondary = types[1] if len(types) > 1 else None

    pool = [m for m in movepool.get(pid, []) if m['cat'] == cat and m['power'] > 0]

    rarity = rarity_of(pid)
    bmin, bmax, fmin, fmax = POWER_BY_RARITY[rarity]
    # power scaling: assegno valori fissi nel range, con piccola variazione
    pwr_b1 = (bmin + bmax) // 2
    pwr_b2 = pwr_b1 - 3  # base 2 leggermente piu' debole
    pwr_fn = (fmin + fmax) // 2

    # Scelta mossa per "fedelta'": dato un tipo target + power target,
    # scegli la mossa del pool con power piu' vicino. Cosi' un Bulbasaur comune
    # avra' "Frusta Erba" (power originale 45) invece di "Solarraggio" (power 120).
    def pick_closest(candidates, target_power):
        if not candidates:
            return None
        return min(candidates, key=lambda m: abs(m['power'] - target_power))

    # Mossa 1: STAB primario, power vicino a pwr_b1
    stab_primary = [m for m in pool if m['type'] == primary]
    base1_src = pick_closest(stab_primary, pwr_b1) or (pool[0] if pool else None)

    # Mossa 2: STAB secondario se dual-type, altrimenti tipo coperto != primario
    if secondary:
        stab_secondary = [m for m in pool if m['type'] == secondary]
    else:
        stab_secondary = [m for m in pool if m['type'] != primary]
    base2_src = pick_closest(stab_secondary, pwr_b2) or pick_closest([m for m in stab_primary if m is not base1_src], pwr_b2) or base1_src

    # Finisher: STAB primario, power vicino a pwr_fn (preferisce mossa diversa da base1)
    finisher_candidates = [m for m in stab_primary if m is not base1_src]
    finisher_src = pick_closest(finisher_candidates, pwr_fn) or pick_closest(stab_primary, pwr_fn) or base1_src

    def mk(src, name_fallback, type_fb, power_v):
        if not src:
            return {'name': name_fallback, 'type': type_fb, 'cat': cat, 'power': power_v}
        return {'name': src['name_it'] or src['name_en'] or name_fallback,
                'type': src['type'] or type_fb, 'cat': cat, 'power': power_v}

    fb_name = {'fire':'Fiammata', 'water':'Acquagetto', 'grass':'Foglielama', 'electric':'Saetta',
               'psychic':'Psichico', 'normal':'Attacco', 'ground':'Geosismo', 'rock':'Frana',
               'ice':'Geloraggio', 'bug':'Pungiglione', 'poison':'Acidi', 'fighting':'Pugnodinamico',
               'flying':'Aeroattacco', 'ghost':'Ombra Notturna', 'dragon':'Furia Drago',
               'dark':'Morso', 'steel':'Spada Santa', 'fairy':'Forza Lunare'}

    base1    = mk(base1_src,    fb_name.get(primary, 'Attacco Base'),    primary,    pwr_b1)
    # forziamo tipo secondario nel base2 anche se src potrebbe avere tipo diverso
    base2_type = secondary if secondary else (base2_src['type'] if base2_src else 'normal')
    base2    = mk(base2_src,    fb_name.get(base2_type, 'Colpo Tattico'), base2_type, pwr_b2)
    finisher = mk(finisher_src, fb_name.get(primary, 'Mossa Finale'),     primary,    pwr_fn)
    finisher['name'] = finisher['name']  # nome resta com'è
    # Garantisco categoria coerente (tutto phys o tutto spec)
    base1['cat'] = base2['cat'] = finisher['cat'] = cat
    return base1, base2, finisher


# ============================================================
#  SCRITTURA
# ============================================================
def fill_xlsx(rows, xlsx_path='Pokemon_Mosse_Passive_Gen1.xlsx'):
    wb = load_workbook(xlsx_path)
    ws = wb['Gen 1']
    # header già esiste; popolo dalla row 2
    blue_bold = Font(bold=True, color='0000FF')
    for i, r in enumerate(rows, start=2):
        ws.cell(row=i, column=7,  value=r['base1']['name'])
        ws.cell(row=i, column=8,  value=r['base1']['power'])
        ws.cell(row=i, column=9,  value=r['base2']['name'])
        ws.cell(row=i, column=10, value=r['base2']['power'])
        ws.cell(row=i, column=11, value=r['finisher']['name'])
        ws.cell(row=i, column=12, value=r['finisher']['power'])
        ws.cell(row=i, column=13, value=r['passive_name'])
        ws.cell(row=i, column=14, value=r['passive_effect'])
    wb.save(xlsx_path)
    print(f"[xlsx] Salvato {xlsx_path} con {len(rows)} righe")

def write_movesets_js(rows, out_path='js/data/movesets.js'):
    """Formato: [base1, base2, finisher]"""
    lines = []
    lines.append("/* ============================================================")
    lines.append("   movesets.js — 2 mosse Base + 1 Finisher per ogni Pokémon Gen 1")
    lines.append("   Categoria (phys|spec) uniforme tra le 3 mosse di uno stesso Pokémon")
    lines.append("   (scelta in base alla stat più alta: ATK vs SP.ATK).")
    lines.append("   ")
    lines.append("   Struttura per entry: [base1, base2, finisher]")
    lines.append("   Ogni mossa: { name, type, cat: 'physical'|'special', power }")
    lines.append("   Generato da scripts/gen_movesets_passives.py")
    lines.append("   ============================================================ */")
    lines.append("")
    lines.append("export const MOVESETS = {")
    for r in rows:
        b1, b2, fn = r['base1'], r['base2'], r['finisher']
        def mv(m):
            return ("{ name: '" + m['name'].replace("'", "\\'") +
                    "', type: '" + m['type'] +
                    "', cat: '" + m['cat'] +
                    "', power: " + str(m['power']) + " }")
        lines.append(f"  {r['id']}: [ {mv(b1)}, {mv(b2)}, {mv(fn)} ],   // {r['name_it']}")
    lines.append("};")
    lines.append("")
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))
    print(f"[movesets] Salvato {out_path}")

def write_passives_js(rows, out_path='js/data/passives.js'):
    lines = []
    lines.append("/* ============================================================")
    lines.append("   passives.js — Passive per ogni Pokémon Gen 1")
    lines.append("   ")
    lines.append("   Ogni Pokémon ha una passiva tra ~18 archetipi competitive")
    lines.append("   adattati. Le SLOT di attivazione sono PER-POKEMON (non per")
    lines.append("   archetipo): cosi' Pokemon dello stesso archetipo possono")
    lines.append("   avere combinazioni di slot diverse e in un team da 3 ognuno")
    lines.append("   puo' attivare la propria passiva (varieta' a la Hero Colosseum).")
    lines.append("   ")
    lines.append("   Strutture:")
    lines.append("     - PASSIVE_LIBRARY[key] = { name, effect, meta, slotPool }")
    lines.append("         slotPool: slot dove la passiva HA SENSO per la sua natura")
    lines.append("     - POKEMON_PASSIVE[id] = { key, activeSlots: [...1-2 slot] }")
    lines.append("         activeSlots: scelti DAL slotPool dell'archetipo,")
    lines.append("         determinisitcamente per dare varieta'")
    lines.append("   ")
    lines.append("   Generato da scripts/gen_movesets_passives.py")
    lines.append("   ============================================================ */")
    lines.append("")
    lines.append("export const PASSIVE_LIBRARY = {")
    for key, p in PASSIVE_LIB.items():
        meta_json = json.dumps(p['meta'])
        pool_str = ', '.join("'" + s + "'" for s in p['pool'])
        lines.append(f"  '{key}': {{")
        lines.append(f"    name:     '{p['name']}',")
        lines.append(f"    effect:   \"{p['effect']}\",")
        lines.append(f"    slotPool: [{pool_str}],")
        lines.append(f"    meta:     {meta_json},")
        lines.append("  },")
    lines.append("};")
    lines.append("")
    lines.append("/** Mappa Pokémon → { key, activeSlots }. */")
    lines.append("export const POKEMON_PASSIVE = {")
    for r in rows:
        slots_str = ', '.join("'" + s + "'" for s in r['active_slots'])
        lines.append(f"  {r['id']}: {{ key: '{r['passive_key']}', activeSlots: [{slots_str}] }},   // {r['name_it']}")
    lines.append("};")
    lines.append("")
    lines.append("/** Helper: restituisce la passiva di un Pokémon o null.")
    lines.append("    Forma compatibile: { key, name, effect, activeSlots, meta }. */")
    lines.append("export function getPassive(pokemonId) {")
    lines.append("  const entry = POKEMON_PASSIVE[pokemonId];")
    lines.append("  if (!entry) return null;")
    lines.append("  const lib = PASSIVE_LIBRARY[entry.key];")
    lines.append("  if (!lib) return null;")
    lines.append("  return {")
    lines.append("    key:         entry.key,")
    lines.append("    name:        lib.name,")
    lines.append("    effect:      lib.effect,")
    lines.append("    meta:        lib.meta,")
    lines.append("    activeSlots: entry.activeSlots,")
    lines.append("  };")
    lines.append("}")
    lines.append("")
    lines.append("/** Helper: true se la passiva si attiva nella slot indicata. */")
    lines.append("export function passiveActiveInSlot(pokemonId, slotKey) {")
    lines.append("  const p = getPassive(pokemonId);")
    lines.append("  return p ? p.activeSlots.includes(slotKey) : false;")
    lines.append("}")
    lines.append("")
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))
    print(f"[passives] Salvato {out_path}")


# ============================================================
#  MAIN
# ============================================================
def main():
    # Carica i nomi italiani dei Pokemon dal foglio Gen 1
    wb = load_workbook('Pokemon_Mosse_Passive_Gen1.xlsx', data_only=True)
    ws = wb['Gen 1']
    name_map = {}
    for row in ws.iter_rows(min_row=2, values_only=True):
        if row[0] is None: continue
        try:
            pid = int(row[0])
        except (ValueError, TypeError):
            continue
        if pid < 1 or pid > 151:
            continue
        name_map[pid] = (str(row[1] or '').strip(), str(row[2] or '').strip())

    movepool = load_movepool()
    rows = []
    for pid in range(1, 152):
        base1, base2, finisher = pick_moves(pid, movepool)
        passive_key = POKEMON_PASSIVE.get(pid, 'tecnico')
        passive     = PASSIVE_LIB[passive_key]
        # Slot per QUESTO pokemon, scelti deterministicamente dal pool dell'archetipo
        active_slots = pick_combo_for_pokemon(pid, passive_key)
        name_en, name_it = name_map.get(pid, (f'#{pid}', f'#{pid}'))
        rows.append({
            'id':             pid,
            'name_en':        name_en,
            'name_it':        name_it,
            'rarity':         rarity_of(pid),
            'cat':            category_for(pid),
            'base1':          base1,
            'base2':          base2,
            'finisher':       finisher,
            'passive_key':    passive_key,
            'passive_name':   passive['name'],
            'passive_effect': passive['effect'],
            'active_slots':   active_slots,
        })

    # Output
    fill_xlsx(rows)
    write_movesets_js(rows)
    write_passives_js(rows)

    # Report sintetico
    print(f"\n=== REPORT ===")
    print(f"Totale Pokemon processati: {len(rows)}")
    by_rar = {}
    for r in rows: by_rar[r['rarity']] = by_rar.get(r['rarity'], 0) + 1
    for k, v in by_rar.items(): print(f"  {k}: {v}")
    by_passive = {}
    for r in rows: by_passive[r['passive_key']] = by_passive.get(r['passive_key'], 0) + 1
    print(f"\nPokemon per archetipo passiva:")
    for k in sorted(by_passive, key=lambda x: -by_passive[x]):
        print(f"  {k}: {by_passive[k]}")

if __name__ == '__main__':
    main()
