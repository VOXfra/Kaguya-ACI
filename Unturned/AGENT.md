# AGENT.md — Unturned VOX

Portée : tout le dossier `Unturned/`.

Ces règles spécialisent les règles générales du dépôt pour le sous-projet Unturned.

1. Le sous-projet Unturned est indépendant du moteur décisionnel Kaguya : sa priorité est la total conversion d'Unturned demandée par VOX.
2. Le SDK officiel SmartlyDressedGames reste une dépendance amont. Ne pas recopier arbitrairement sa totalité dans Kaguya-ACI.
3. La baseline U3-SDK doit être verrouillée dans `upstream.lock.json` par commit exact et version Unity exacte.
4. Les nouveaux fichiers VOX vont dans `overlay/`. Les modifications de fichiers officiels vont autant que possible dans `patches/`.
5. `Unturned/SDK/` est un clone de travail local et n'est jamais versionné dans Kaguya-ACI.
6. Le réseau est autorisé uniquement pour les opérations de développement nécessaires (notamment `git clone/fetch` du SDK officiel). Le jeu final ne doit pas dépendre d'une API externe pour fonctionner.
7. Toujours lancer les validations disponibles avant et après une modification quand l'environnement le permet.
8. Maintenir `Unturned/CHANGELOG.md` à chaque modification avec quoi/pourquoi/comment et l'état précédent.
9. Commenter en français les scripts et le code VOX lorsque le commentaire apporte une information utile.
10. Ne jamais exiger du testeur qu'il modifie manuellement du C#, un shader ou un asset pour tester une build.
11. La milestone runtime prioritaire est un module client Steam stable chargé depuis `Unturned/Modules`, installable et désinstallable sans Unity Hub. HDRP reste une piste de R&D historique, pas une dépendance du workflow de test ni une condition pour `VOX GI`.
12. Les optimisations doivent conserver plusieurs niveaux de qualité ; le ray tracing matériel ne doit jamais devenir une dépendance obligatoire.
13. Le package utilisateur reste unifié (`VOX Overhaul`) même si les sous-systèmes sont séparés en interne : rendu, matériaux, GI, réflexions, corps FPS, QoL, véhicules et survie.
14. Ne pas présenter une approximation logicielle comme du Lumen Unreal ou du RTX matériel natif. Les noms internes sont `VOX GI` et `Hybrid Reflections`, avec fallback logiciel obligatoire.
