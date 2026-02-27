# Kaguya

Kaguya est un **moteur décisionnel autonome local** orienté simulation continue.

Cette version implémente un cerveau centré sur un **temps interne en ticks** :
- l'agent vit à son propre rythme (`tick`, `sim_minutes`, `sim_day_phase`),
- l'heure du PC ne fait qu'influencer légèrement la récupération (`pc_day_phase`),
- aucune API externe n'est utilisée.

---

## Vision rapide

Kaguya maintient un état interne, choisit des actions selon ses objectifs et son historique, puis apprend à chaque cycle.

Le cycle standard :
1. avancer d'un tick,
2. récupérer passivement selon la phase simulée,
3. filtrer les actions (gating),
4. scorer et choisir une action,
5. exécuter l'action,
6. mettre à jour la mémoire long terme,
7. produire un journal humain + un journal debug.

---

## Installation

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```

---

## Vérification

```bash
pytest -q
```

---

## Utilisation pas à pas

### 1) Instancier le cerveau

```python
from kaguya.cerveau import CerveauKaguya

cerveau = CerveauKaguya(seed=42)
```

### 2) Lancer des ticks de vie

```python
for _ in range(10):
    phrase = cerveau.boucle_de_vie()
    print(phrase)
```

### 3) Observer les journaux

```python
print(cerveau.journal_humain[-1])
print(cerveau.journal_debug[-1])
```

### 4) Lire l'état interne

```python
print(cerveau.etat)
print(cerveau.tick, cerveau.sim_minutes, cerveau.sim_day_phase, cerveau.pc_day_phase)
```

---

## Architecture du cerveau

Fichier principal : `kaguya/cerveau.py`.

### Temps interne (règle d'or)
- `tick: int`
- `tick_seconds: float`
- `sim_minutes: float`
- `sim_day_minutes: float`
- `sim_day_phase: str` (`night/morning/day/evening`)
- `pc_day_phase: str` (profil faible)
- `last_action_tick: dict[str, int]`

Constante : `SIM_MIN_PER_TICK = 5`.

### États internes [0..1]
- `energy`
- `clarity`
- `stability`
- `curiosity`
- `risk_tolerance`
- `fatigue`
- `stress`

### Récupération passive
Par tick, selon la phase simulée :
- nuit : récupération plus forte,
- autres phases : récupération plus modérée,
- bonus PC nuit : +10% max.

### Actions simulées fixes (7)
- `rest`
- `organize`
- `practice`
- `explore`
- `reflect`
- `idle`
- `challenge`

Chaque action possède un profil fixe :
- `base_risk`, `energy_cost`, `clarity_cost`,
- `stability_gain`, `knowledge_gain`,
- `fatigue_gain`, `stress_on_fail`.

### Objectifs actifs (4)
- `Recover`
- `Stabilize`
- `Explore`
- `Progress`

Ces objectifs contribuent au score de décision selon priorité + fit(action).

### Mémoire long terme par action
- `n_total`, `n_success`, `n_fail`, `last_tick`
- `ema_reward`, `ema_cost`
- `recent_fail_streak`, `recent_success_streak`
- `avoid_until_tick`

EMA avec `alpha = 0.15`.

### Gating + Scoring
- gating avant score (avoid, énergie critique, stress/stabilité),
- score unique : reward-cost + objectifs + mémoire + diversité + instinct risque + micro-bruit.

---

## Journal de bord

Deux canaux :
- `journal_humain` : une phrase intentionnelle concise,
- `journal_debug` : valeurs numériques, objectifs actifs, scores et transitions d'état.

---

## Local / hors-ligne

- Exécution strictement locale.
- Pas d'appel réseau.
- Pas d'API externe.
- Validation via `ContrainteExecutionLocale.verifier()` à chaque tick.

