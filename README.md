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

## Utilisation pas à pas

### 1) Créer le cerveau

```python
from kaguya.cerveau import CerveauKaguya
c = CerveauKaguya(seed=42)
```

### 2) Lancer la boucle

```python
for _ in range(50):
    print(c.boucle_de_vie())
```

### 3) Interagir via CLI texte

```python
print(c.handle_cli("etat"))
print(c.handle_cli("propose"))
print(c.handle_cli("idees"))
print(c.handle_cli("resume"))
print(c.handle_cli("suggere explore"))
print(c.handle_cli("pause"))
print(c.handle_cli("reprendre"))
```

### 4) Contrôler le router modèle

```python
print(c.handle_cli("model status"))
print(c.handle_cli("model auto"))
print(c.handle_cli("mode realtime"))
print(c.handle_cli("mode reflexion"))
print(c.handle_cli("model set qwen2.5-14b"))
print(c.handle_cli("llm ask"))
print(c.handle_cli("bench"))
```

### 5) Sauvegarder et recharger

```python
c.save_snapshot("snapshot.json")
ok = c.load_snapshot("snapshot.json")
print("loaded:", ok)
```


## Démarrer une discussion complète (serveur local)

Lance le serveur :

```bash
python -m kaguya.server
```

Puis ouvre :

- http://127.0.0.1:1234

API utile :
- `GET /state`
- `POST /chat` avec `{"message":"...","mode":"realtime|reflexion"}`

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
