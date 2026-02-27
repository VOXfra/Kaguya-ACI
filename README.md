# Kaguya

Kaguya est un **moteur décisionnel local** (hors-ligne) pensé comme un agent cognitif évolutif.

Ce dépôt fournit une première base exécutable du « cerveau » de Kaguya :
- un **état interne dynamique**,
- des **instincts prioritaires**,
- une **mémoire court et long terme**,
- une **boucle de vie** (observer → agir → apprendre → journaliser),
- un **journal de bord lisible**.

> ⚠️ Politique actuelle : exécution **100% locale**, sans API externe.

---

## Ce qu’est Kaguya

Kaguya n’est pas un simple chatbot :
- elle maintient un état interne (énergie, clarté, curiosité, stabilité, tolérance au risque),
- elle choisit ses actions selon des priorités (instinct de préservation, progression, apprentissage),
- elle met à jour sa mémoire selon les résultats,
- elle conserve un journal pour expliquer ce qu’elle fait, pourquoi et ce qu’elle retient.

---

## Prérequis

- Python 3.10+
- pip

---

## Installation

### 1) Cloner le dépôt

```bash
git clone <url-du-repo>
cd Kaguya-ACI
```

### 2) (Recommandé) créer un environnement virtuel

```bash
python -m venv .venv
source .venv/bin/activate
```

### 3) Installer les dépendances

```bash
python -m pip install -r requirements.txt
```

---

## Vérifier que tout fonctionne

Lancer la suite de tests :

```bash
pytest -q
```

Si tout est correct, vous verrez les tests passer.

---

## Utilisation pas à pas

### Étape 1 — Définir les actions du monde simulé

Chaque action possède :
- un coût énergétique,
- un risque d’échec,
- un gain de connaissance,
- un gain de compétence.

### Étape 2 — Instancier le cerveau de Kaguya

On peut fixer une graine (`seed`) pour rendre les simulations reproductibles.

### Étape 3 — Lancer une ou plusieurs boucles de vie

À chaque cycle, Kaguya :
1. vérifie la contrainte hors-ligne,
2. choisit une action,
3. exécute l’action dans le monde simulé,
4. met à jour son état,
5. écrit un événement mémoire,
6. consolide la mémoire long terme,
7. ajoute une entrée de journal.

### Exemple minimal

```python
from kaguya.cerveau import ActionMonde, MondeSimule, CerveauKaguya

monde = MondeSimule(actions=[
    ActionMonde(nom="explorer", cout_energie=15.0, risque=0.20, gain_connaissance=8.0, gain_competence=3.0),
    ActionMonde(nom="se_reposer", cout_energie=-20.0, risque=0.05, gain_connaissance=1.0, gain_competence=0.0),
    ActionMonde(nom="s_entrainer", cout_energie=10.0, risque=0.10, gain_connaissance=2.0, gain_competence=7.0),
])

cerveau = CerveauKaguya(seed=42)

for _ in range(3):
    entree = cerveau.boucle_de_vie(monde)
    print(entree)

print("État final:", cerveau.etat)
print("Mémoire court terme:", cerveau.memoire.court_terme)
print("Mémoire long terme:", cerveau.memoire.long_terme)
```

---

## Architecture du cerveau

Le fichier principal est `kaguya/cerveau.py`.

Composants :

- `ContrainteExecutionLocale`
  - impose le mode hors-ligne strict,
  - bloque toute activation d’API externe.

- `EtatInterne`
  - énergie,
  - clarté,
  - tolérance au risque,
  - curiosité,
  - stabilité.

- `ActionMonde`
  - structure d’une action disponible dans l’environnement.

- `MondeSimule`
  - exécute une action,
  - calcule succès/échec et deltas d’état.

- `Memoire`
  - `court_terme` : événements récents,
  - `long_terme` : résumés consolidés des expériences.

- `CerveauKaguya`
  - choix d’action via instincts + scoring adaptatif,
  - boucle de vie complète,
  - journalisation explicative.

---

## Journal de bord

Le journal (`cerveau.journal`) contient des entrées lisibles de type :
- **Action** choisie,
- **Pourquoi** (raison principale),
- **Comment** (paramètres de simulation),
- **Résultat** (succès/échec),
- **Rétention** (valeur d’expérience retenue).

Objectif : rendre les décisions observables et auditables.

---

## Fonctionnement sans Internet / API externe

Le moteur actuel :
- n’appelle aucune API externe,
- ne dépend d’aucun service réseau pour décider,
- fonctionne sur simulation locale pure.

La contrainte est validée à chaque cycle via `ContrainteExecutionLocale.verifier()`.

---

## Structure du projet

```text
kaguya/
  __init__.py
  cerveau.py
tests/
  test_cerveau.py
requirements.txt
pyproject.toml
CHANGELOG.md
AGENT.md
README.md
```

---

## Feuille de route possible

- enrichir les instincts (intégrité, stabilité long terme, gestion de charge),
- améliorer la mémoire (résumés sémantiques, pondération temporelle),
- ajouter des scénarios de simulation plus réalistes,
- exporter le journal vers des formats exploitables (JSON/CSV),
- ajouter une CLI locale pour piloter les simulations.

