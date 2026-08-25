# Changelog — VOX Mini Games

## 0.1.0 — 2026-08-25
### Ajouté
- Nouveau hub mobile Android indépendant de Kaguya, hébergé dans la branche `mobile-minigames`.
- Premier mini-jeu **Liquid Sort** entièrement jouable.
- 20 niveaux pré-générés et solvables par construction.
- Règles de versement par groupe de couleur, sélection tactile et détection de victoire.
- Boutons Annuler, Refaire et Indice.
- Progression et niveau courant sauvegardés localement avec `SharedPreferences`.
- Effet de versement, surbrillance de sélection, indice animé, haptique et célébration de victoire.
- Hub prévu pour accueillir d'autres mini-jeux (Parking, Slide, Connect affichés comme futurs modules).
- Tests unitaires du moteur de jeu.
- Workflow GitHub Actions pour produire automatiquement un APK de debug.

### Pourquoi
Créer une première base Android réellement installable et testable avant d'étendre le hub avec plusieurs mini-jeux.

### Comment
Le prototype est écrit en Java natif Android, avec rendu via `Canvas` pour éviter les dépendances graphiques et conserver un APK léger. Le moteur de jeu est séparé de l'interface pour permettre des tests et des évolutions sans casser le rendu.

### Modifié / supprimé
- Aucun code Kaguya n'a été modifié ou supprimé dans ce sous-projet.
