# AGENT.md

## Règles de travail (portée : tout le dépôt)
1. Toujours exécuter des tests **avant** d'implémenter, lorsque c'est possible.
2. Tenir un `CHANGELOG.md` mis à jour à chaque modification.
3. Le changelog doit être en français, détailler **quoi/pourquoi/comment**.
4. Le changelog doit mentionner les passages supprimés/modifiés dans leur version précédente.
5. Vérifier le bon fonctionnement avant livraison finale.
6. Commenter abondamment le code, en français.
7. Prioriser le développement du moteur décisionnel ("cerveau") de Kaguya.
8. Le cerveau doit être piloté par un **temps interne tick** ; l'heure PC ne fournit qu'un profil faible.
9. Kaguya fonctionne intégralement en local (hors-ligne strict), sans API externe.
10. Le cerveau inclut intentions actives, idées spontanées, anti-loop/anti-stagnation, CLI texte, snapshots versionnés avec rollback et métriques d'observabilité.
11. La couche LLM suit un contrat stable : registry, engine unique, router auto/manuel, context packet unique, dual output validé, bench rapide 5 prompts.
12. Le projet doit pouvoir démarrer un serveur de discussion local sur `http://127.0.0.1:1235`.
13. L'expérience utilisateur doit privilégier des commandes prêtes à l'emploi (serveur/CLI) sans demander de code Python manuel.
14. Si LM Studio occupe 127.0.0.1:1234, Kaguya web doit utiliser 127.0.0.1:1235 par défaut.
15. Le serveur Kaguya doit pouvoir tenter de démarrer LM Studio automatiquement (`--start-lmstudio`) tout en gardant un fallback local.
16. Dans le chat web, les commandes de pilotage doivent être optionnelles et préfixées par `/` (ex: `/etat`) pour ne pas polluer la conversation normale.
17. Si LM Studio est ouvert mais "Server not running", Kaguya doit indiquer clairement ce statut et proposer auto-start ou instruction explicite de démarrage serveur LM Studio.
