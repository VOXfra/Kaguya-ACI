# Kaguya

Kaguya est un cerveau décisionnel local (hors-ligne) orienté continuité long terme.

## Ce que cette version ajoute

- **Intentions actives** (mini-plan multi-ticks avec TTL et annulation en cas d'état critique).
- **Idées spontanées** (backlog priorisé, réutilisable plus tard).
- **Anti-loop / anti-stagnation** (malus répétition, cooldown, idée de changement d'approche).
- **LLM multi-modèles** : registre, moteur unifié, router auto/manuel, profils realtime/réflexion.
- **Dual output** standardisé (texte + commandes validées).
- **CLI texte** avec contrôle du modèle et bench rapide.
- **Snapshots versionnés** + rollback `.bak` en cas de corruption.
- **Observabilité** : taux d'échec, diversité, stress/énergie moyens, top actions/events.

## Installation

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```

## Vérification

```bash
pytest -q
```

## Utilisation pas à pas (sans coder)

### Option A — Discussion web (recommandé)

1. Démarrer le serveur:

```bash
python -m kaguya.server --port 1235 --start-lmstudio
```

2. Ouvrir dans le navigateur:

- http://127.0.0.1:1235

3. Discuter directement dans l’interface.

Vous pouvez utiliser des commandes optionnelles préfixées par `/` dans le chat web :
- `/etat`
- `/resume`
- `/idees`
- `/propose`
- `/pause`
- `/reprendre`

Le reste du temps, écrivez normalement (conversation classique).

> Note: LM Studio utilise souvent `127.0.0.1:1234`. Kaguya web est donc sur `127.0.0.1:1235` par défaut pour éviter les conflits.

### Option B — Terminal interactif (sans Python)

```bash
python -m kaguya.cli
```

Commandes utiles:
- `etat`
- `propose`
- `idees`
- `resume`
- `suggere <action>`
- `pause` / `reprendre`
- `tick`
- `chat <message>`
- `save <snapshot.json>`
- `load <snapshot.json>`
- `quit`

### Exécution rapide d’une commande unique

```bash
python -m kaguya.cli --once "etat"
python -m kaguya.cli --once "chat etat"
python -m kaguya.cli --once "save snapshot.json"
```

### Démarrage avec snapshot existant

```bash
python -m kaguya.cli --snapshot snapshot.json
```

## Architecture du cerveau

- **Temps interne** : `tick`, `sim_minutes`, `sim_day_phase` (pilotage principal).
- **Monde évolutif** : bruit, opportunités, danger, nouveauté, stabilité.
- **Intentions actives** : direction durable (`récupérer/stabiliser/explorer/progresser/tester une idée`).
- **Idées spontanées** : `intitule`, `contexte`, `cout_estime`, `risque_estime`, `priorite`, `recence`.
- **Meta-apprentissage** : ajustement lent `audace/diversite`.
- **Anti-loop** : fenêtre glissante 30 ticks + cooldown.
- **Mémoire contextuelle** : règles par contexte (`danger_high`, `opportunity_high`, `neutral`).
- **Permissions PC** : whitelist + refus journalisés.
- **Persistance durable** : snapshot versionné, autoload optionnel, rollback backup.
- **Observabilité** : `journal_evolutif` + `dashboard_history`.

### Couche LLM

- **Model Registry** (`kaguya/llm.py`) : liste déclarative des modèles.
- **LLM Engine interface** : `generate(prompt, mode, constraints, context)` -> `LLMResult`.
- **Model Router** : auto/manuel + fallback en cas d'erreur.
- **Inference profiles** : `realtime` (rapide) / `reflexion` (qualité).
- **Context Packet** Brain->LLM : stable pour tous les modèles.
- **Dual Output** LLM->Brain : texte + commandes (parse/validation côté cerveau).
- **Quick Eval Harness** : 5 prompts fixes (refus, risque, résumé, idée, personnalité).

## Local / hors-ligne

- Pas d'API externe.
- Pas de dépendance réseau.
- `ContrainteExecutionLocale` vérifiée à chaque tick.
