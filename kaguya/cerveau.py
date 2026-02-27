"""Moteur décisionnel simplifié de Kaguya.

Ce module implémente :
- un état interne dynamique,
- des instincts prioritaires,
- une mémoire court et long terme,
- une boucle de vie capable d'observer, décider, agir et apprendre,
- un journal de bord lisible en français,
- une contrainte explicite d'exécution 100% locale (hors-ligne strict).
"""

from __future__ import annotations

from dataclasses import dataclass, field
import random
from typing import Dict, List


@dataclass
class ContrainteExecutionLocale:
    """Définit la politique d'exécution locale de Kaguya.

    Cette structure sert de garde-fou explicite :
    - aucune API externe,
    - aucun accès réseau,
    - exécution entièrement locale.
    """

    hors_ligne_strict: bool = True
    api_externe_autorisee: bool = False

    def verifier(self) -> None:
        """Valide que la politique locale stricte est respectée.

        Si un futur changement active le réseau ou les API externes,
        l'erreur est immédiate pour protéger l'architecture demandée.
        """
        if not self.hors_ligne_strict:
            raise RuntimeError("Le mode hors-ligne strict est obligatoire pour Kaguya.")
        if self.api_externe_autorisee:
            raise RuntimeError("Les API externes sont interdites pour Kaguya en local.")


@dataclass
class EtatInterne:
    """Représente l'état interne vivant de Kaguya.

    Chaque valeur est bornée entre 0 et 100 pour rester lisible,
    stable et facilement interprétable par les règles d'instinct.
    """

    energie: float = 70.0
    clarte: float = 65.0
    tolerance_risque: float = 45.0
    curiosite: float = 60.0
    stabilite: float = 70.0

    def borner(self) -> None:
        """Contraint toutes les métriques de l'état interne à [0, 100]."""
        self.energie = max(0.0, min(100.0, self.energie))
        self.clarte = max(0.0, min(100.0, self.clarte))
        self.tolerance_risque = max(0.0, min(100.0, self.tolerance_risque))
        self.curiosite = max(0.0, min(100.0, self.curiosite))
        self.stabilite = max(0.0, min(100.0, self.stabilite))


@dataclass
class ActionMonde:
    """Décrit une action disponible dans le monde simulé."""

    nom: str
    cout_energie: float
    risque: float
    gain_connaissance: float
    gain_competence: float


@dataclass
class Memoire:
    """Stocke les événements récents et les résumés d'expériences."""

    court_terme: List[Dict[str, float | str | bool]] = field(default_factory=list)
    long_terme: Dict[str, Dict[str, float]] = field(default_factory=dict)

    def enregistrer_evenement(self, evenement: Dict[str, float | str | bool]) -> None:
        """Ajoute un événement en mémoire court terme avec fenêtre glissante.

        On garde volontairement peu d'éléments récents pour simuler une mémoire
        active, focalisée sur le présent.
        """
        self.court_terme.append(evenement)
        if len(self.court_terme) > 10:
            self.court_terme.pop(0)

    def consolider(self, nom_action: str, succes: bool, score_valeur: float) -> None:
        """Met à jour la mémoire long terme sous forme de résumé statistique."""
        if nom_action not in self.long_terme:
            self.long_terme[nom_action] = {
                "essais": 0.0,
                "succes": 0.0,
                "valeur_cumulee": 0.0,
            }

        resume = self.long_terme[nom_action]
        resume["essais"] += 1.0
        if succes:
            resume["succes"] += 1.0
        resume["valeur_cumulee"] += score_valeur


@dataclass
class MondeSimule:
    """Monde minimaliste fournissant la liste des actions possibles."""

    actions: List[ActionMonde]

    def executer(self, action: ActionMonde, aleatoire: random.Random) -> Dict[str, float | bool]:
        """Exécute une action et renvoie le résultat simulé.

        Le succès dépend du risque : plus le risque est haut, plus l'échec
        a de chances d'apparaître.
        """
        succes = aleatoire.random() > action.risque
        multiplicateur = 1.0 if succes else 0.25
        return {
            "succes": succes,
            "energie_delta": -action.cout_energie,
            "clarte_delta": (action.gain_connaissance * 0.2) * multiplicateur - (action.risque * 10),
            "stabilite_delta": (2.0 if succes else -5.0) - (action.risque * 4),
            "curiosite_delta": action.gain_connaissance * 0.1,
            "tolerance_risque_delta": 1.0 if succes else -1.5,
            "gain_connaissance_reel": action.gain_connaissance * multiplicateur,
            "gain_competence_reel": action.gain_competence * multiplicateur,
        }


class CerveauKaguya:
    """Cerveau décisionnel principal de Kaguya.

    Le moteur applique des instincts (priorités), choisit une action,
    intègre le retour du monde, puis produit une entrée de journal.
    """

    def __init__(self, seed: int | None = None) -> None:
        # Générateur pseudo-aléatoire pour des simulations reproductibles.
        self._rng = random.Random(seed)
        # Politique de sécurité : Kaguya doit rester totalement locale.
        self.contrainte_locale = ContrainteExecutionLocale()
        # État interne dynamique initial.
        self.etat = EtatInterne()
        # Mémoire court/long terme.
        self.memoire = Memoire()
        # Journal de bord textuel (historique lisible).
        self.journal: List[str] = []

    def choisir_action(self, monde: MondeSimule) -> ActionMonde:
        """Choisit une action selon les instincts et l'état courant.

        Priorité principale : si l'énergie est basse, se reposer devient dominant.
        Sinon, on maximise un score orienté curiosité + prudence adaptative.
        """
        # Instinct de préservation énergétique : si trop bas, recherche de repos.
        if self.etat.energie < 25.0:
            for action in monde.actions:
                if "repos" in action.nom:
                    return action

        meilleure_action = monde.actions[0]
        meilleur_score = float("-inf")

        for action in monde.actions:
            # Score utilité : combinaison simple entre gains et coûts.
            score = (
                action.gain_connaissance * (self.etat.curiosite / 100.0)
                + action.gain_competence * 0.7
                - action.cout_energie * (1.0 if self.etat.energie < 40 else 0.5)
                - (action.risque * (100.0 - self.etat.tolerance_risque) / 50.0)
            )

            # On tient compte de l'expérience passée (mémoire long terme).
            if action.nom in self.memoire.long_terme:
                resume = self.memoire.long_terme[action.nom]
                taux_succes = resume["succes"] / max(1.0, resume["essais"])
                score += taux_succes * 2.0

            if score > meilleur_score:
                meilleur_score = score
                meilleure_action = action

        return meilleure_action

    def _appliquer_resultat(self, resultat: Dict[str, float | bool]) -> None:
        """Met à jour l'état interne en appliquant les deltas du résultat."""
        self.etat.energie += float(resultat["energie_delta"])
        self.etat.clarte += float(resultat["clarte_delta"])
        self.etat.stabilite += float(resultat["stabilite_delta"])
        self.etat.curiosite += float(resultat["curiosite_delta"])
        self.etat.tolerance_risque += float(resultat["tolerance_risque_delta"])
        self.etat.borner()

    def boucle_de_vie(self, monde: MondeSimule) -> str:
        """Réalise un cycle complet : observer -> agir -> apprendre -> journaliser."""
        # Vérification systématique des contraintes hors-ligne avant tout cycle.
        self.contrainte_locale.verifier()

        # Étape 1 : choisir l'action la plus cohérente avec l'état interne.
        action = self.choisir_action(monde)

        # Étape 2 : exécuter l'action dans le monde simulé.
        resultat = monde.executer(action, self._rng)

        # Étape 3 : mise à jour physiologique/cognitive.
        self._appliquer_resultat(resultat)

        # Étape 4 : calcul d'une valeur globale de l'expérience.
        score_valeur = float(resultat["gain_connaissance_reel"]) + float(resultat["gain_competence_reel"]) - max(0.0, action.cout_energie * 0.3)

        # Étape 5 : archivage mémoire court terme.
        evenement = {
            "action": action.nom,
            "succes": bool(resultat["succes"]),
            "valeur": score_valeur,
            "energie": self.etat.energie,
            "clarte": self.etat.clarte,
        }
        self.memoire.enregistrer_evenement(evenement)

        # Étape 6 : consolidation long terme (apprentissage).
        self.memoire.consolider(action.nom, bool(resultat["succes"]), score_valeur)

        # Étape 7 : génération du journal lisible en français.
        raison = self._raison_decision(action)
        entree = (
            f"Action: {action.nom} | "
            f"Pourquoi: {raison} | "
            f"Comment: simulation locale hors-ligne avec risque={action.risque:.2f}, coût_énergie={action.cout_energie:.1f} | "
            f"Résultat: {'succès' if resultat['succes'] else 'échec'} | "
            f"Rétention: expérience évaluée à {score_valeur:.2f}"
        )
        self.journal.append(entree)
        return entree

    def _raison_decision(self, action: ActionMonde) -> str:
        """Explique brièvement la raison principale du choix d'action."""
        if "repos" in action.nom and self.etat.energie <= 35.0:
            return "priorité à la préservation énergétique"
        if action.risque > 0.4 and self.etat.tolerance_risque < 50:
            return "prise de risque calculée pour apprendre"
        if action.gain_connaissance >= action.gain_competence:
            return "curiosité dominante orientée connaissance"
        return "équilibre entre progression et stabilité"
