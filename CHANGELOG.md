# Changelog

## 2026-02-27 — Documentation complète avec README pas à pas

### Pourquoi
- Répondre à la demande d'un README détaillé, esthétique et exploitable immédiatement.
- Rendre l'utilisation de Kaguya claire pour un usage local, sans ambiguïté.
- Vérifier automatiquement la présence des sections essentielles du README.

### Quoi
- Ajout de `README.md` avec :
  - présentation de Kaguya,
  - installation,
  - vérification,
  - utilisation pas à pas,
  - architecture du cerveau,
  - journal de bord,
  - contraintes offline.
- Mise à jour de `tests/test_cerveau.py` avec un test dédié qui valide la présence des sections-clés du README.

### Comment
1. Exécution des tests existants avant modification.
2. Ajout d'un test de documentation (attendu en échec tant que README absent).
3. Rédaction du README complet en français.
4. Exécution finale des tests pour valider l'ensemble.

### Passages modifiés (état avant modification)
- Dans `tests/test_cerveau.py`, **avant** il n'existait pas de test de validation du README.
- À la racine du projet, **avant** le fichier `README.md` n'existait pas.

## 2026-02-27 — Renforcement local/offline + requirements

### Pourquoi
- Répondre à la demande d'un fichier `requirements` exécutable pour installer l'environnement.
- Garantir explicitement un fonctionnement 100% local sans Internet ni API externe.
- Renforcer la vérification automatique via les tests.

### Quoi
- Ajout de `requirements.txt` avec la dépendance de test (`pytest`).
- Mise à jour de `kaguya/cerveau.py` avec une politique `ContrainteExecutionLocale` appliquée à chaque boucle de vie.
- Mise à jour de `tests/test_cerveau.py` pour couvrir :
  - la contrainte hors-ligne stricte,
  - la présence du fichier `requirements.txt`.

### Comment
1. Exécution des tests existants avant modification.
2. Ajout d'une contrainte explicite en code pour interdire API externe/réseau.
3. Ajout de tests de conformité locale.
4. Exécution finale de tous les tests.

### Passages modifiés (état avant modification)
- Dans `kaguya/cerveau.py`, l'en-tête **avant** ne mentionnait pas la contrainte locale :
  - `- un journal de bord lisible en français.`
- Dans `kaguya/cerveau.py`, la classe `CerveauKaguya.__init__` **avant** ne contenait pas de politique locale dédiée :
  - `self._rng = random.Random(seed)`
  - `self.etat = EtatInterne()`
  - `self.memoire = Memoire()`
  - `self.journal: List[str] = []`
- Dans `tests/test_cerveau.py`, **avant** il n'existait pas de tests :
  - `test_kaguya_force_une_execution_hors_ligne_stricte`
  - `test_un_requirements_est_present_pour_l_execution_locale`

## 2026-02-27 — Initialisation du moteur décisionnel de Kaguya

### Pourquoi
- Poser une base exécutable pour le "cerveau" demandé : état interne, instincts, mémoire, boucle de vie, simulation du monde et journal lisible.
- Démarrer avec une approche test-first : écrire des tests de comportement puis implémenter.

### Quoi
- Création d'un fichier `AGENT.md` à la racine pour formaliser les règles de travail du dépôt.
- Ajout de tests de comportement dans `tests/test_cerveau.py` couvrant :
  - la boucle de vie et l'écriture du journal,
  - la priorité de repos en énergie basse,
  - la consolidation mémoire long terme.
- Implémentation du moteur dans `kaguya/cerveau.py` :
  - état interne (`EtatInterne`),
  - actions et monde simulé (`ActionMonde`, `MondeSimule`),
  - mémoire court/long terme (`Memoire`),
  - contrôleur principal (`CerveauKaguya`) et sa boucle de vie.
- Ajout de `kaguya/__init__.py` pour le packaging Python.
- Ajout de `pyproject.toml` pour configurer `pytest` et le `pythonpath`.

### Comment
1. Écriture de tests qui échouent d'abord (import impossible du module non créé).
2. Implémentation progressive des classes et méthodes nécessaires jusqu'au vert des tests.
3. Exécution finale de `pytest -q` pour valider l'ensemble.

### Passages supprimés / modifiés (état avant modification)
- Aucun passage supprimé (création initiale).
- Aucun passage modifié préexistant (création initiale de fichiers).
