# Patches VOX

Ce dossier contient les modifications apportées aux fichiers suivis par le dépôt officiel U3-SDK.

Convention :

- format : patch Git unifié ;
- extension : `.patch` ;
- ordre : préfixe numérique (`001-...`, `002-...`) ;
- chaque patch doit passer `git apply --check` sur le commit défini dans `../upstream.lock.json` ;
- `bootstrap.ps1` ignore proprement un patch déjà appliqué.

Les nouveaux fichiers qui n'existent pas dans le SDK officiel doivent de préférence aller dans `../overlay/`.
