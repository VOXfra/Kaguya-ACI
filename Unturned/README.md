# Unturned VOX

Workspace de total conversion d'Unturned consacré en premier lieu à la refonte graphique : HDRP, ciel/nuages volumétriques, éclairage dynamique, matériaux cohérents, ray tracing et futur système `VOX GI` inspiré des principes de GI dynamique de Lumen.

## Principe

Le SDK officiel n'est pas copié dans `Kaguya-ACI`. Il est cloné localement dans `Unturned/SDK` à partir d'un commit verrouillé, puis notre couche VOX est appliquée dessus.

Cette séparation permet :

- de conserver une baseline officielle identifiable ;
- d'éviter de versionner des milliers de fichiers tiers dans Kaguya-ACI ;
- de reconstruire le workspace depuis zéro ;
- de stocker nos nouveaux fichiers dans `overlay/` ;
- de stocker les modifications des fichiers officiels sous forme de patches dans `patches/`.

## Baseline actuelle

- Dépôt : `SmartlyDressedGames/U3-SDK`
- Branche amont : `main`
- Commit : `6d72628501ee97753a48a0812c64446f3932eefa`
- Unity : `2022.3.62f3`
- Scène de démarrage : `Assets/GameStartup.unity`

La source de vérité est `upstream.lock.json`.

## Installation / reconstruction

Depuis Windows, double-cliquer sur :

`Unturned/bootstrap.cmd`

ou lancer :

```powershell
.\Unturned\bootstrap.ps1
```

Le script :

1. vérifie la présence de Git ;
2. clone le SDK officiel dans `Unturned/SDK` s'il n'existe pas ;
3. checkout le commit verrouillé ;
4. copie `overlay/` dans le SDK ;
5. applique les patches `patches/*.patch` dans l'ordre alphabétique ;
6. valide le commit, la version Unity et la scène de démarrage.

Pour repartir volontairement de la baseline et réappliquer notre couche :

```powershell
.\Unturned\bootstrap.ps1 -Refresh
```

`-Refresh` fait un `git reset --hard` et un `git clean -fd` dans `Unturned/SDK`. Il ne faut donc pas y conserver de modifications manuelles : tout changement VOX durable doit exister dans `overlay/` ou `patches/`.

## Organisation

```text
Unturned/
├─ bootstrap.cmd
├─ bootstrap.ps1
├─ upstream.lock.json
├─ overlay/          # nouveaux fichiers VOX copiés dans le projet Unity
├─ patches/          # modifications des fichiers officiels
├─ tools/            # validation et outils de développement
└─ SDK/              # clone local ignoré par Git
```

## Première cible graphique

La première milestone ne cherche pas encore à reproduire Lumen. Elle consiste à obtenir une baseline jouable avec :

1. migration HDRP ;
2. DirectX 12 ;
3. Physical Sky ;
4. Volumetric Clouds ;
5. volumetric fog ;
6. nouveau pipeline de matériaux stylisés ;
7. SSGI ;
8. presets graphiques et instrumentation des performances.

Une fois cette baseline stable, `VOX GI` sera ajouté par étapes : screen-space, radiance probes, cache temporel, tracing matériel puis fallback logiciel.

## Rôle du testeur

Le développement est prévu pour que le testeur n'ait pas à modifier le C#, les shaders ou les assets. Son rôle est de lancer les versions de test, reproduire des situations et remonter les différences visuelles, bugs et performances.
