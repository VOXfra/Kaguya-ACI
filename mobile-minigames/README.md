# VOX Mini Games — Android

Prototype v0.1 d'un hub de mini-jeux mobile Android.

## Jeu disponible
- **Liquid Sort** : 20 niveaux progressifs, annulation, recommencer, indice, sauvegarde locale et animations Canvas.

## Architecture
Le projet utilise une activité Android Java légère et une vue Canvas personnalisée. Le moteur de Liquid Sort (`WaterSortGame`) ne dépend pas d'Android afin de rester testable et réutilisable.

## Build
```bash
gradle test assembleDebug
```

APK de debug : `app/build/outputs/apk/debug/app-debug.apk`.
