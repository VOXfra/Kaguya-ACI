# VOX Overhaul runtime module

## v0.2.0 Full Stack Alpha

Le runtime Steam est désormais la voie de test principale. Le module client est chargé depuis `Unturned/Modules/VOXGraphics` sans Unity Hub et avec lancement sans BattlEye.

Sous-systèmes présents dans la build v0.2.0 :

- ACES / color grading via le Post Processing Stack déjà intégré à Unturned ;
- ambient occlusion, bloom et SSR renforcés ;
- renderer deferred forcé par défaut ;
- atmosphère et brouillard dynamiques jour/nuit ;
- HDR, depth, depth normals et motion vectors ;
- ombres 4 cascades et distance accrue ;
- `VOX GI` alpha : radiance locale approchée avec probes lumineuses pilotées par raycasts ;
- `Hybrid Reflections` : SSR + deux ReflectionProbes temps réel autour du joueur ;
- matériaux stylisés enrichis : metallic, smoothness, occlusion et normal maps procédurales par famille de matériau, sans remplacer les normal maps existantes ;
- corps visible en première personne en réutilisant le modèle troisième personne, avec crâne et bras TP masqués pour conserver le viewmodel FPS.

Les termes `VOX GI` et `Hybrid Reflections` sont intentionnels : cette voie n'est ni le Lumen d'Unreal ni du DXR/RTX natif. Le but est d'obtenir un résultat visuel comparable par une pile compatible avec le renderer actuel d'Unturned et un fallback logiciel.

### Debug

- `F8` : overlay de statut
- `F7` : VOX GI on/off
- `F6` : matériaux VOX on/off

Le package utilisateur reste unique et réversible. Le testeur ne doit pas compiler ou modifier manuellement le code.
