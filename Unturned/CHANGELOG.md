# Changelog — Unturned VOX

## 2026-09-02 — Initialisation du workspace graphique Unturned

### Pourquoi
- Le dépôt officiel `SmartlyDressedGames/U3-SDK` est en lecture seule pour VOX ; le développement doit donc vivre dans `VOXfra/Kaguya-ACI`.
- Copier tout le SDK officiel dans Kaguya-ACI rendrait les mises à jour amont, les diffs et la maintenance inutilement lourds.
- Le futur chantier HDRP/VOX GI a besoin d'une baseline reproductible avant toute modification graphique.

### Quoi
- Création de la branche `unturned-graphics-overhaul`.
- Création du sous-projet `Unturned/`.
- Ajout de `upstream.lock.json` avec :
  - U3-SDK officiel ;
  - commit verrouillé `6d72628501ee97753a48a0812c64446f3932eefa` ;
  - Unity `2022.3.62f3` ;
  - scène `Assets/GameStartup.unity`.
- Ajout de `bootstrap.ps1` et `bootstrap.cmd` pour cloner automatiquement le SDK dans `Unturned/SDK`, checkout la baseline, appliquer l'overlay et les patches puis valider le workspace.
- Ajout de `tools/Test-Workspace.ps1` pour contrôler commit, version Unity, scène de démarrage et `git diff --check`.
- Ajout des dossiers `overlay/` et `patches/` documentés.
- Mise à jour du `.gitignore` racine afin d'exclure le clone SDK, les builds, logs et caches locaux.
- Ajout de règles spécialisées `Unturned/AGENT.md` pour séparer ce chantier des contraintes propres au projet Kaguya.

### Comment
1. Vérification préalable de l'absence de branche Unturned existante.
2. Lecture des règles du dépôt avant modification.
3. Vérification de la baseline officielle U3-SDK et récupération du commit courant de `main`.
4. Mise en place d'un modèle reproductible `baseline officielle + overlay + patches`.
5. Ajout d'un contrôle automatique du workspace à la fin du bootstrap.

### État avant modification
- Aucun dossier `Unturned/` n'existait dans Kaguya-ACI.
- Aucun SDK Unturned n'était référencé ou verrouillé dans le dépôt.
- Le `.gitignore` ne contenait aucune exclusion spécifique aux fichiers Unity/Unturned.
- Aucune branche dédiée à l'overhaul graphique Unturned n'existait.

### Validation / limites de l'environnement
- Les fichiers GitHub et la baseline amont ont été vérifiés via le dépôt officiel.
- Le runtime de travail utilisé pour cette modification ne dispose pas d'un accès DNS sortant pour exécuter réellement `git clone`; le clonage est donc effectué par le bootstrap sur la machine Windows du testeur, qui dispose de l'accès GitHub.
- La validation complète du bootstrap sera considérée verte lorsque `bootstrap.cmd` aura cloné le SDK et que `Test-Workspace.ps1` aura affiché `[VOX] Validation OK`.
