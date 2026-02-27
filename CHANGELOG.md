# Changelog

## 2026-02-27 — Correction fallback formulaire : plus de `/?message=...` en erreur `not_found`

### Pourquoi
- En fallback navigateur (JS indisponible/partiel), le `<form>` utilisait le comportement par défaut (`GET /?message=...`).
- Le routeur HTTP comparait `self.path` strictement à `/`, donc `/?message=...` tombait sur `{"error": "not_found"}` et aucun log de chat n'était produit.

### Quoi
- `kaguya/server.py` :
  - formulaire HTML fixé explicitement en `method='post' action='/chat'` pour garantir l'envoi vers l'endpoint chat même sans JS,
  - parsing des routes via `urlsplit(self.path).path` dans `do_GET`/`do_POST` pour ignorer proprement la query string.
- `tests/test_cerveau.py` :
  - test de présence du fallback form `POST /chat`,
  - test de normalisation de route avec query string (`/?...` -> `/`).

### Comment
1. Forçage de la soumission formulaire vers `/chat`.
2. Normalisation de route côté handler HTTP avant dispatch.
3. Validation automatique + smoke runtime.

### Passages modifiés (état avant modification)
- Dans `kaguya/server.py`, **avant** le `<form>` n'avait pas `method/action`, donc fallback en `GET /?message=...`.
- Dans `kaguya/server.py`, **avant** le dispatch comparait `self.path` brut, ce qui rejetait les URL avec query string.

## 2026-02-27 — Compatibilité envoi chat (formulaire) + documentation PowerShell

### Pourquoi
- Certains environnements côté utilisateur (notamment PowerShell) ne reprennent pas les commandes Bash telles quelles (`&&`, heredoc, redirections POSIX), ce qui empêchait de reproduire facilement les validations proposées.
- Si le JavaScript front échoue ou est limité, le bouton **Envoyer** doit rester exploitable via un comportement formulaire standard.

### Quoi
- `kaguya/server.py` :
  - ajout de `parse_chat_payload()` qui accepte **JSON** et **application/x-www-form-urlencoded**,
  - endpoint `/chat` mis à jour pour gérer explicitement ces deux formats et renvoyer `415` sur type non supporté,
  - UI web convertie avec `<form id='chat-form'>` + `submit` (progressive enhancement) pour rendre l'envoi plus robuste.
- `tests/test_cerveau.py` :
  - ajout de tests parser payload (`json`, `form-urlencoded`, `content-type` non supporté).
- `README.md` :
  - ajout de blocs de commandes Windows PowerShell (installation, tests, serveur),
  - note explicite sur l'incompatibilité des opérateurs Bash dans PowerShell.

### Comment
1. Ajout d'un parseur de payload unique côté serveur, réutilisé par `/chat`.
2. Alignement de l'UI sur un submit de formulaire (fallback natif navigateur).
3. Documentation des commandes compatibles PowerShell + validation via tests.

### Passages modifiés (état avant modification)
- Dans `kaguya/server.py`, **avant** `/chat` n'acceptait que du JSON et rejetait les soumissions formulaire.
- Dans `README.md`, **avant** les commandes étaient présentées en style Bash uniquement, sans variante PowerShell.

## 2026-02-27 — Bouton Envoyer fiabilisé + log de chaque utilisation

### Pourquoi
- Le bouton **Envoyer** pouvait sembler inactif si la réponse backend n'était pas un JSON valide ou si l'appel échouait silencieusement.
- Besoin métier : générer une trace fichier après chaque utilisation du chat.

### Quoi
- `kaguya/server.py` :
  - UI web renforcée : bouton dédié `id=send-btn`, disable pendant envoi, endpoint absolu (`window.location.origin`), parsing JSON protégé et messages d'erreur explicites,
  - affichage du chemin du fichier log renvoyé par l'API,
  - `ChatService` écrit désormais un fichier JSON par message dans `logs/chat_usage/` et ajoute `meta.log_file` dans la réponse.
- `tests/test_cerveau.py` :
  - ajout du test `test_chat_service_writes_usage_log_file` pour vérifier la création du fichier log et son contenu minimal.
- `.gitignore` :
  - ajout de `logs/` pour éviter de versionner les traces d'usage locales.

### Comment
1. Durcissement du JavaScript front pour éviter les échecs silencieux.
2. Journalisation côté serveur à chaque `handle_message`.
3. Validation via tests unitaires + smoke API.

### Passages modifiés (état avant modification)
- Dans `kaguya/server.py`, **avant** l'UI faisait `res.json()` directement et pouvait échouer sans diagnostic lisible en cas de réponse non conforme.
- Dans `kaguya/server.py`, **avant** aucune trace fichier n'était créée automatiquement après un envoi utilisateur.

## 2026-02-27 — Reconnexion LM Studio après démarrage manuel + bouton Envoyer robuste

### Pourquoi
- Après un premier échec LM Studio, le routeur restait en fallback local et ne retentait pas la connexion, même si l'utilisateur lançait le serveur LM Studio manuellement ensuite.
- En cas d'erreur HTTP/réseau côté `/chat`, l'UI web n'affichait pas clairement le problème, donnant l'impression que le bouton **Envoyer** ne faisait rien.

### Quoi
- `kaguya/llm.py` :
  - ajout d'une sonde `probe_ready()` dans `LMStudioEngine`,
  - ajout d'une logique de retry périodique dans `ModelRouter` pour reconnecter automatiquement LM Studio après démarrage manuel,
  - réactivation `lmstudio_available=True` dès que la sonde redevient positive.
- `kaguya/server.py` :
  - script web durci : validation message vide, gestion explicite erreurs HTTP/réseau, auto-scroll du chat, support touche Entrée.
- `tests/test_cerveau.py` :
  - nouveau test `test_router_reconnects_lmstudio_after_manual_start` qui valide le scénario "échec puis reconnexion".

### Comment
1. Simulation d'un moteur LM Studio indisponible puis disponible sans redémarrer Kaguya.
2. Ajout d'un probe à intervalle court dans le routeur pour retenter la connexion.
3. Ajout de garde-fous UI pour rendre les erreurs visibles dans la fenêtre de chat.

### Passages modifiés (état avant modification)
- Dans `kaguya/llm.py`, **avant** `lmstudio_available=False` pouvait rester bloqué sans tentative de reconnexion périodique.
- Dans `kaguya/server.py`, **avant** le script frontend ne gérait pas explicitement les erreurs `fetch`/HTTP ni l'envoi via touche Entrée.

## 2026-02-27 — Correction "Server not running" LM Studio + détection d'API robuste

### Pourquoi
- Quand LM Studio affichait "Server not running", la conversation tombait en fallback sans indication assez claire.
- Certaines versions LM Studio exposent `/api/v1/...` au lieu de `/v1/...`.

### Quoi
- `kaguya/server.py` :
  - `lmstudio_is_ready()` teste maintenant `/v1/models` **et** `/api/v1/models`,
  - `maybe_start_lmstudio()` tente plusieurs commandes (`lms server start`, `lmstudio server start`),
  - ajout d'un `lmstudio_hint` dans `GET /state`.
- `kaguya/llm.py` : `LMStudioEngine` tente successivement `/v1/chat/completions`, `/api/v1/chat/completions`, `/api/v1/chat`.
- `README.md` : instructions explicites quand LM Studio est ouvert mais serveur non démarré (Start Server).
- `tests/test_cerveau.py` : test de sonde booléenne `lmstudio_is_ready()`.
- `AGENT.md` : règle explicite sur la gestion du statut "Server not running".

### Comment
1. Reproduction locale avec LM Studio indisponible.
2. Ajout de fallback d'endpoint + messages explicites.
3. Validation tests et smoke serveur.

### Passages modifiés (état avant modification)
- Dans `kaguya/server.py`, **avant** la sonde readiness ne testait que `/v1/models`.
- Dans `kaguya/llm.py`, **avant** l'engine appelait uniquement `/v1/chat/completions`.

## 2026-02-27 — Commandes slash optionnelles dans le chat web

### Pourquoi
- Éviter de mélanger commandes techniques et discussion naturelle dans l'interface web.
- Permettre un pilotage explicite, ponctuel et lisible via une syntaxe dédiée.

### Quoi
- `kaguya/server.py` : ajout d'un parseur de commandes slash (`/etat`, `/resume`, etc.) côté `ChatService`.
- Les messages sans slash restent une conversation classique (flux LLM normal).
- Mise à jour du placeholder UI et de `README.md` pour documenter la syntaxe `/...`.
- Ajout de tests dans `tests/test_cerveau.py` :
  - slash command optionnelle,
  - conversation standard inchangée.
- Mise à jour de `AGENT.md` pour imposer la convention slash.

### Comment
1. Exécution baseline des tests.
2. Ajout d'un branchement précoce slash côté serveur.
3. Ajout de tests et validation finale.

### Passages modifiés (état avant modification)
- Dans `kaguya/server.py`, **avant** toutes les entrées passaient directement en mode conversationnel.
- Dans `README.md`, **avant** la syntaxe `/etat` n'était pas décrite.

## 2026-02-27 — Démarrage conversationnel fiable avec LM Studio (auto-start + fallback)

### Pourquoi
- La page web s'ouvrait mais l'expérience conversationnelle pouvait sembler inactive si LM Studio n'était pas démarré.
- Il fallait permettre au serveur Kaguya de tenter le démarrage LM Studio automatiquement.

### Quoi
- `kaguya/server.py` :
  - ajout de `maybe_start_lmstudio()` et `lmstudio_is_ready()`,
  - nouveaux flags `--start-lmstudio` et `--lmstudio-cmd`,
  - message de statut explicite au boot,
  - maintien d'un fallback local si LM Studio reste indisponible,
  - correction de l'affichage HTML (Kaguya 1235, LM Studio 1234).
- `kaguya/llm.py` : timeout LM Studio ajusté pour réduire les faux fallback trop agressifs.
- `README.md` : instructions explicites pour auto-démarrage LM Studio.
- `tests/test_cerveau.py` : test de statut de démarrage LM Studio côté serveur.
- `AGENT.md` : règle d'exigence auto-start LM Studio.

### Comment
1. Exécution des tests baseline.
2. Ajout du gestionnaire de cycle LM Studio dans le serveur.
3. Ajustement timeout LLM et documentation utilisateur.
4. Validation finale par tests + vérification runtime serveur.

### Passages modifiés (état avant modification)
- Dans `kaguya/server.py`, **avant** il n'existait pas de flags `--start-lmstudio/--lmstudio-cmd`.
- Dans `kaguya/server.py`, **avant** la page indiquait un port ambigu pour la discussion.

## 2026-02-27 — Compatibilité LM Studio + séparation des ports discussion

### Pourquoi
- L'utilisateur utilise LM Studio sur `127.0.0.1:1234`, ce qui entrait en conflit avec le serveur web Kaguya.
- Il fallait permettre une discussion directe sans collision de port et sans retouche manuelle du code.

### Quoi
- `kaguya/llm.py` : ajout/renforcement de l'engine `LMStudioEngine` (API OpenAI-compatible locale).
- `ModelRegistry` inclut désormais `lmstudio-active` et le router tente LM Studio puis fallback rapide local en cas d'indisponibilité.
- `kaguya/server.py` : port par défaut déplacé vers `127.0.0.1:1235` + paramètres CLI `--host/--port`.
- `README.md` : instructions explicites LM Studio (1234) + Kaguya web (1235).
- `AGENT.md` : règle explicite de séparation de ports.
- `tests/test_cerveau.py` : tests supplémentaires registry LM Studio + fallback router.

### Comment
1. Exécution baseline de la suite de tests.
2. Ajout de l'intégration LM Studio dans la couche LLM et ajustement du router/fallback.
3. Réglage du serveur web Kaguya sur port non conflictuel.
4. Mise à jour docs/règles/tests puis validation finale.

### Passages modifiés (état avant modification)
- Dans `kaguya/server.py`, **avant** le port par défaut était `127.0.0.1:1234`.
- Dans `kaguya/llm.py`, **avant** il n'existait pas de modèle registry `lmstudio-active` avec engine dédié.

## 2026-02-27 — Simplification de lancement: zéro code manuel pour l'utilisateur

### Pourquoi
- Supprimer le besoin de manipuler du code Python pour démarrer Kaguya.
- Fournir une expérience prête à l'emploi via commandes terminal/navigateur uniquement.

### Quoi
- Ajout de `kaguya/cli.py` (mode interactif et `--once`) pour piloter Kaguya sans écrire de script.
- Mise à jour de `README.md` : remplacement du bloc "coder soi-même" par parcours serveur web + CLI terminal.
- Mise à jour de `tests/test_cerveau.py` avec test dédié `run_cli_once`.
- Mise à jour de `AGENT.md` pour imposer une UX orientée commandes prêtes à l'emploi.

### Comment
1. Exécution baseline des tests.
2. Ajout d'une CLI dédiée (`python -m kaguya.cli`).
3. Réécriture de la section usage README en mode opérationnel.
4. Validation finale des tests.

### Passages modifiés (état avant modification)
- Dans `README.md`, **avant** l'utilisateur devait instancier `CerveauKaguya` et appeler des méthodes Python manuellement.
- Dans le dépôt, **avant** il n'existait pas de module `kaguya/cli.py`.

## 2026-02-27 — Serveur de discussion local complet (127.0.0.1:1234)

### Pourquoi
- Permettre de démarrer Kaguya en mode discussion réelle, pas seulement en tests unitaires.
- Fournir une interface locale immédiate (web + API JSON) sans dépendance externe.

### Quoi
- Ajout de `kaguya/server.py` :
  - `ChatService` (orchestration cerveau + LLM),
  - serveur HTTP local `run_server(host="127.0.0.1", port=1234)`,
  - endpoints `GET /`, `GET /state`, `POST /chat`.
- Mise à jour de `tests/test_cerveau.py` avec un test dédié au service de chat.
- Mise à jour de `README.md` avec procédure de démarrage serveur et URL cible.
- Mise à jour de `AGENT.md` pour inscrire l’exigence de démarrage serveur local.

### Comment
1. Exécution baseline des tests avant modification.
2. Implémentation du serveur HTTP standard library et du service de conversation.
3. Ajout d’un test de non-régression sur le flux de discussion.
4. Validation finale via `pytest -q`.

### Passages modifiés (état avant modification)
- Dans le dépôt, **avant** il n’existait pas de module `kaguya/server.py`.
- Dans `README.md`, **avant** il n’y avait pas d’instruction pour démarrer `http://127.0.0.1:1234`.

## 2026-02-27 — Layer LLM unifiée : registry/router/profils/contract + bench

### Pourquoi
- Découpler le cerveau du modèle effectif grâce à une interface LLM unique.
- Permettre sélection auto/manuel des modèles, avec fallback robuste en cas d'erreur runtime.
- Stabiliser le contrat Brain->LLM et LLM->Brain pour éviter les couplages fragiles.
- Ajouter un bench interne court pour comparer rapidement les comportements utiles à Kaguya.

### Quoi
- Nouveau module `kaguya/llm.py` :
  - `ModelRegistry` déclaratif (modèles, runtime, profils, tags),
  - `LLMEngine`/`MockLLMEngine` avec retour standardisé (`latency/tokens/error`),
  - `ModelRouter` auto/manuel, modes `realtime`/`reflexion`, fallback rapide,
  - `ContextPacket` (contrat unique Brain->LLM),
  - `LLMResult` dual output (texte + commandes),
  - `quick_eval_harness` (5 tests fixes).
- `kaguya/cerveau.py` :
  - intégration router + état modèle,
  - `build_context_packet()`, `ask_llm()`, validation stricte des commandes,
  - extension CLI (`model status`, `model auto`, `model set ...`, `mode realtime/reflexion`, `llm ask`, `bench`),
  - snapshot version `3` incluant état du router.
- `tests/test_cerveau.py` : tests dédiés registry/router/harness et contrat brain-llm.
- Mises à jour `README.md` et `AGENT.md`.

### Comment
1. Exécution baseline des tests existants.
2. Ajout du module LLM séparé puis câblage progressif dans le cerveau.
3. Ajout/ajustement des tests sur le contrat unique et le router.
4. Validation finale via `pytest -q`.

### Passages modifiés (état avant modification)
- Dans `kaguya/cerveau.py`, **avant** il n'existait pas de module dédié `kaguya/llm.py` ni de `ModelRouter`.
- Dans `kaguya/cerveau.py`, **avant** `SNAPSHOT_VERSION` était `2`.
- Dans `tests/test_cerveau.py`, **avant** il n'existait pas de test explicite `quick_eval_harness`.

## 2026-02-27 — Continuité renforcée : intentions, anti-loop, CLI pilotage, observabilité

### Pourquoi
- Renforcer la continuité des décisions avec de vraies intentions actives multi-ticks.
- Ajouter de l'initiative via un backlog d'idées réutilisable.
- Éviter les comportements répétitifs/stagnants et améliorer le pilotage humain en CLI.
- Consolider la persistance (versioning, rollback) et l'observabilité (métriques synthétiques).

### Quoi
- `kaguya/cerveau.py` :
  - intentions actives avec TTL + conditions d'annulation,
  - backlog d'idées enrichi (`intitule`, contexte, coût/risque estimés, priorité/récence),
  - anti-loop fenêtre 30 ticks + cooldown,
  - détection stagnation et idée "changer d'approche",
  - CLI `etat`, `resume`, `idees`, `propose`, `suggere <...>`, `pause`, `reprendre`,
  - snapshots versionnés (`SNAPSHOT_VERSION=2`) + rollback backup,
  - chargement snapshot au démarrage (optionnel) + autosnapshot périodique,
  - tableaux de bord (`fail_rate`, diversité, moyennes, top actions/events).
- `tests/test_cerveau.py` : mise à jour complète de la couverture sur ces mécanismes.
- `README.md` et `AGENT.md` alignés avec les nouvelles commandes et capacités.

### Comment
1. Exécution des tests existants en baseline avant refonte.
2. Implémentation incrémentale des sous-systèmes (intention, idées, anti-loop, CLI, persistance, dashboard).
3. Mise à jour des tests automatisés.
4. Validation finale par `pytest -q`.

### Passages modifiés (état avant modification)
- Dans `kaguya/cerveau.py`, **avant** les commandes CLI utilisaient des variantes accentuées et sans `suggere/pause/reprendre` strictement définies.
- Dans `kaguya/cerveau.py`, **avant** `SNAPSHOT_VERSION` était `1` et il n'y avait pas de dashboard structuré (`top_actions/top_events`).
- Dans `tests/test_cerveau.py`, **avant** il n'existait pas de test explicite sur la commande `suggere` ni sur les métriques dashboard.

## 2026-02-27 — Intention active, CLI, permissions et persistance versionnée

### Pourquoi
- Ajouter de la continuité court terme via une intention active au lieu d'un choix totalement myope tick par tick.
- Introduire un comportement plus organique : backlog d'idées, auto-calibrage et protections anti-boucle.
- Renforcer la cohabitation PC : permissions explicites et journal des refus.
- Ajouter une persistance durable avec snapshots versionnés et rollback de sécurité.

### Quoi
- `kaguya/cerveau.py` :
  - ajout `IntentionActive` (durée 5–20 ticks),
  - ajout backlog `Idee` et génération d'idées depuis événements rares,
  - ajout meta-apprentissage (`meta[audace/diversite]`),
  - ajout anti-loop/cooldowns,
  - ajout mémoire contextuelle (`danger_high`, `opportunity_high`, `neutral`),
  - ajout `Permissions` + `refus_log`,
  - ajout snapshot `save_snapshot/load_snapshot` versionné + backup rollback,
  - ajout interface `handle_cli` (propose, explique, résume, idées, état, etc.).
- `tests/test_cerveau.py` : couverture intention, permissions, snapshot, CLI, anti-loop et résumé évolutif.
- Mise à jour de `README.md` et `AGENT.md`.

### Comment
1. Exécution des tests existants avant modifications.
2. Implémentation incrémentale des nouveaux sous-systèmes.
3. Mise à jour des tests automatisés pour validation fonctionnelle.
4. Validation finale de l'ensemble via `pytest -q`.

### Passages modifiés (état avant modification)
- Dans `kaguya/cerveau.py`, **avant** il n'existait pas de `IntentionActive`, `Idee`, `Permissions` ni de `handle_cli`.
- Dans `kaguya/cerveau.py`, **avant** il n'existait pas de `save_snapshot/load_snapshot` avec rollback backup.
- Dans `tests/test_cerveau.py`, **avant** il n'existait pas de tests dédiés à la CLI et aux permissions.

## 2026-02-27 — Monde dynamique, skills, événements rares et évolution long terme

### Pourquoi
- Passer d'un moteur de choix d'action à un système qui vit dans un environnement persistant.
- Ajouter une continuité structurelle : progression de compétences, souvenirs marquants, routines et consolidation identitaire.
- Répondre aux attentes d'évolution organique et de réduction du caractère aléatoire sur le long terme.

### Quoi
- Refonte de `kaguya/cerveau.py` avec un monde autonome `EtatMonde` (bruit/instabilité, opportunités, danger, nouveauté, stabilité globale).
- Ajout de la progression par compétences (`Competence`) liée à chaque action, avec effets sur risque/coût/récompense/stress.
- Ajout d'un système d'événements rares : `discovery`, `near_failure`, `success_major`, `stress_spike`, `opportunity_exceptionnelle`.
- Ajout des souvenirs marquants (`SouvenirMarquant`) avec influence sur le scoring futur.
- Ajout d'une consolidation périodique (`CONSOLIDATION_EVERY_TICKS`) et purge des souvenirs mineurs.
- Ajout des routines émergentes par phase simulée et bonus associé.
- Ajout d'un journal évolutif quotidien (`journal_evolutif`).
- Mise à jour des tests, du README et du AGENT.

### Comment
1. Exécution de la suite de tests en baseline avant la refonte.
2. Implémentation incrémentale : monde, compétences, événements, mémoire marquante, consolidation, routines, résumé périodique.
3. Mise à jour des tests et documentation pour couvrir les nouveaux mécanismes.
4. Validation finale complète avec `pytest -q`.

### Passages modifiés (état avant modification)
- Dans `kaguya/cerveau.py`, **avant** il n'existait pas de structure monde persistante :
  - pas de classe `EtatMonde`
  - pas de `_evolve_world()`
- Dans `kaguya/cerveau.py`, **avant** il n'existait pas de compétences :
  - pas de `Competence`
  - pas de `_update_competence()`
- Dans `kaguya/cerveau.py`, **avant** il n'existait pas de souvenirs marquants et événements rares :
  - pas de `SouvenirMarquant`
  - pas de `_roll_rare_event()`
- Dans `kaguya/cerveau.py`, **avant** il n'existait pas de `journal_evolutif` ni de résumé journalier.

## 2026-02-27 — Refonte tick interne + objectifs + scoring complet

### Pourquoi
- Aligner le cerveau avec la règle d'or : le temps interne tick pilote l'agent.
- Ajouter les mécanismes demandés : fatigue/stress, récupération passive, objectifs actifs, gating, scoring unique et mémoire LT enrichie.
- Produire un double journal (humain + debug) et mettre la documentation à niveau.

### Quoi
- Refonte de `kaguya/cerveau.py` avec :
  - temps interne (`tick`, `tick_seconds`, `sim_minutes`, `sim_day_minutes`, `sim_day_phase`, `pc_day_phase`),
  - états internes normalisés `[0..1]` incluant `fatigue` et `stress`,
  - table fixe des 7 actions (`rest`, `organize`, `practice`, `explore`, `reflect`, `idle`, `challenge`),
  - objectifs actifs (`Recover`, `Stabilize`, `Explore`, `Progress`),
  - mémoire long terme par action (EMA, streaks, avoid_until_tick),
  - gating avant décision,
  - formule de scoring unique,
  - journaux `journal_humain` et `journal_debug`.
- Mise à jour complète de `tests/test_cerveau.py` pour valider la nouvelle architecture.
- Mise à jour de `README.md` (guide pas à pas orienté tick interne).
- Mise à jour de `AGENT.md` pour expliciter la gouvernance temps interne + offline.

### Comment
1. Exécution des tests avant modification.
2. Refonte incrémentale du moteur autour du tick interne.
3. Réécriture des tests pour couvrir les nouvelles règles.
4. Validation finale de l'ensemble par `pytest -q`.

### Passages modifiés (état avant modification)
- Dans `kaguya/cerveau.py`, l'état interne **avant** utilisait les échelles 0..100 et sans `fatigue/stress` :
  - `energie: float = 70.0`
  - `clarte: float = 65.0`
  - `tolerance_risque: float = 45.0`
- Dans `kaguya/cerveau.py`, la boucle **avant** ne pilotait pas le temps interne tick :
  - `def boucle_de_vie(self) -> str:`
  - `self.contrainte_locale.verifier()`
  - `action = self.choisir_action()`
- Dans `tests/test_cerveau.py`, les tests **avant** validaient l'ancienne API (sans tick/scoring/objectifs complets).

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
