# Kaguya

Kaguya est un moteur décisionnel autonome local, construit comme un système vivant sur un **temps interne**.

Cette version ajoute 7 briques majeures :
1. monde dynamique persistant,
2. progression par compétences,
3. événements rares,
4. souvenirs marquants,
5. consolidation périodique,
6. routines émergentes,
7. résumé évolutif par journée simulée.

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

### 1) Créer le cerveau

```python
from kaguya.cerveau import CerveauKaguya
cerveau = CerveauKaguya(seed=42)
```

### 2) Lancer des ticks de vie

```python
for _ in range(50):
    phrase = cerveau.boucle_de_vie()
    print(phrase)
```

### 3) Observer les journaux

```python
print(cerveau.journal_humain[-1])
print(cerveau.journal_debug[-1])
print(cerveau.journal_evolutif[-1] if cerveau.journal_evolutif else "pas encore de journée complète")
```

### 4) Observer monde + compétences + souvenirs

```python
print(cerveau.etat_monde)
print({k: v.niveau for k, v in cerveau.competences.items()})
print(len(cerveau.memoire.souvenirs_marquants))
```

---

## Architecture du cerveau

### Temps interne (règle d'or)
- `tick`, `tick_seconds`, `sim_minutes`, `sim_day_minutes`, `sim_day_phase`.
- L'horloge PC (`pc_day_phase`) est un simple profil faible.

### État interne
- `energy`, `clarity`, `stability`, `curiosity`, `risk_tolerance`, `fatigue`, `stress` (toutes bornées [0..1]).

### Monde évolutif autonome
- `bruit_instabilite`, `opportunites`, `danger`, `nouveaute`, `stabilite_globale`.
- Le monde évolue à chaque tick, même sans action ciblée.
- Les actions peuvent modifier durablement son état.

### Compétences (skills)
Chaque action possède une compétence :
- `niveau`, `experience`, `seuil`.
- Effets de progression :
  - réduction de risque,
  - réduction du coût énergétique,
  - légère hausse de récompense,
  - meilleure régulation du stress.

### Événements rares
Types gérés :
- `discovery`
- `near_failure`
- `success_major`
- `stress_spike`
- `opportunity_exceptionnelle`

Probabilité faible, modulée par l'instabilité du monde.

### Souvenirs marquants
Chaque souvenir contient :
- type,
- gravité,
- action,
- tick,
- état interne au moment.

Influence : biais de scoring pour actions similaires + modulation temporaire de risque/curiosité.

### Consolidation périodique
Tous les `CONSOLIDATION_EVERY_TICKS` ticks :
- détection actions dominantes/évitées,
- ajustements légers de `risk_tolerance`, `curiosity`, `stability`,
- purge des souvenirs mineurs.

### Routines émergentes
La répétition action+phase augmente un compteur de routine, qui donne un léger bonus de stabilité/scoring.

### Journal évolutif
À chaque journée simulée complète (288 ticks), création d'un résumé :
- actions dominantes,
- événements marquants,
- niveaux de compétences,
- variation d'état interne.

---

## Local / hors-ligne

- Exécution strictement locale.
- Pas d'appel réseau.
- Pas d'API externe.
- Vérification systématique via `ContrainteExecutionLocale.verifier()`.
