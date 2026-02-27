"""Cerveau décisionnel de Kaguya (version tick interne).

Principes clés :
- le temps interne pilote l'agent (tick + temps simulé),
- l'horloge PC ne sert qu'à un profil faible (pc_day_phase),
- fonctionnement 100% local/hors-ligne sans API externe,
- objectifs actifs + gating + scoring stable,
- mémoire long terme par action avec EMA et mécanisme d'évitement,
- double journal : humain (court) + debug (numérique).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
import random
from typing import Callable, Dict, List
import time

SIM_MIN_PER_TICK: float = 5.0
EMA_ALPHA: float = 0.15


@dataclass
class ContrainteExecutionLocale:
    """Politique stricte : Kaguya reste locale/hors-ligne."""

    hors_ligne_strict: bool = True
    api_externe_autorisee: bool = False

    def verifier(self) -> None:
        """Bloque explicitement les modes non autorisés."""
        if not self.hors_ligne_strict:
            raise RuntimeError("Le mode hors-ligne strict est obligatoire pour Kaguya.")
        if self.api_externe_autorisee:
            raise RuntimeError("Les API externes sont interdites pour Kaguya en local.")


@dataclass
class EtatInterne:
    """État interne minimal borné dans [0..1]."""

    energy: float = 0.70
    clarity: float = 0.65
    stability: float = 0.70
    curiosity: float = 0.60
    risk_tolerance: float = 0.45
    fatigue: float = 0.25
    stress: float = 0.25

    def borner(self) -> None:
        """Maintient toutes les dimensions dans [0..1]."""
        self.energy = max(0.0, min(1.0, self.energy))
        self.clarity = max(0.0, min(1.0, self.clarity))
        self.stability = max(0.0, min(1.0, self.stability))
        self.curiosity = max(0.0, min(1.0, self.curiosity))
        self.risk_tolerance = max(0.0, min(1.0, self.risk_tolerance))
        self.fatigue = max(0.0, min(1.0, self.fatigue))
        self.stress = max(0.0, min(1.0, self.stress))


@dataclass
class MemoireAction:
    """Mémoire long terme par action (obligatoire)."""

    n_total: int = 0
    n_success: int = 0
    n_fail: int = 0
    last_tick: int = 0
    ema_reward: float = 0.0
    ema_cost: float = 0.0
    recent_fail_streak: int = 0
    recent_success_streak: int = 0
    avoid_until_tick: int = 0


@dataclass
class Memoire:
    """Mémoire globale : événements récents + mémoire actionnelle LT."""

    court_terme: List[Dict[str, float | str | bool]] = field(default_factory=list)
    long_terme: Dict[str, MemoireAction] = field(default_factory=dict)

    def init_actions(self, noms_actions: List[str]) -> None:
        """Assure l'initialisation mémoire pour chaque action fixe."""
        for nom in noms_actions:
            if nom not in self.long_terme:
                self.long_terme[nom] = MemoireAction()

    def enregistrer_evenement(self, evenement: Dict[str, float | str | bool]) -> None:
        """Conserve une fenêtre glissante récente."""
        self.court_terme.append(evenement)
        if len(self.court_terme) > 30:
            self.court_terme.pop(0)


@dataclass
class ActionProfile:
    """Profil fixe d'action du monde simulé."""

    base_risk: float
    energy_cost: float
    clarity_cost: float
    stability_gain: float
    knowledge_gain: float
    fatigue_gain: float
    stress_on_fail: float


@dataclass
class MondeSimule:
    """Monde simulé avec 7 actions fixes."""

    action_profiles: Dict[str, ActionProfile]

    @classmethod
    def standard(cls) -> "MondeSimule":
        """Construit la table obligatoire de 7 actions fixes."""
        return cls(
            action_profiles={
                "rest": ActionProfile(0.02, -0.10, -0.04, 0.05, 0.00, -0.10, 0.04),
                "organize": ActionProfile(0.08, 0.08, 0.05, 0.10, 0.03, 0.04, 0.06),
                "practice": ActionProfile(0.14, 0.12, 0.09, 0.05, 0.12, 0.08, 0.09),
                "explore": ActionProfile(0.22, 0.16, 0.10, 0.03, 0.18, 0.09, 0.12),
                "reflect": ActionProfile(0.05, 0.05, -0.03, 0.08, 0.09, -0.02, 0.05),
                "idle": ActionProfile(0.01, -0.03, -0.02, 0.02, 0.00, -0.05, 0.03),
                "challenge": ActionProfile(0.35, 0.20, 0.16, 0.07, 0.20, 0.12, 0.18),
            }
        )

    @property
    def actions(self) -> List[str]:
        """Expose les actions disponibles."""
        return list(self.action_profiles.keys())


@dataclass
class ObjectifActif:
    """Structure d'objectif actif demandée."""

    name: str
    priority: float
    is_active: Callable[[EtatInterne, bool, bool], bool]
    fit: Callable[[str], float]


class CerveauKaguya:
    """Moteur de décision principal basé sur ticks internes."""

    def __init__(self, seed: int | None = None) -> None:
        self._rng = random.Random(seed)
        self._last_tick_monotonic = time.monotonic()

        self.contrainte_locale = ContrainteExecutionLocale()
        self.etat = EtatInterne()

        # Temps interne : c'est lui qui pilote, jamais l'heure PC directement.
        self.tick: int = 0
        self.tick_seconds: float = 0.0
        self.sim_minutes: float = 0.0
        self.sim_day_minutes: float = 0.0
        self.sim_day_phase: str = "night"
        self.pc_day_phase: str = self._compute_pc_day_phase()

        self.memoire = Memoire()
        self.journal_humain: List[str] = []
        self.journal_debug: List[Dict[str, object]] = []

        self.monde = MondeSimule.standard()
        self.memoire.init_actions(self.monde.actions)
        self.last_action_tick: Dict[str, int] = {action: 0 for action in self.monde.actions}

        self.objectifs = self._build_objectifs()

    def _compute_pc_day_phase(self) -> str:
        """Phase PC simple (jour/nuit) avec impact limité."""
        hour = datetime.now().hour
        return "night" if (hour < 6 or hour >= 22) else "day"

    def _compute_sim_day_phase(self) -> str:
        """Phase simulée basée uniquement sur sim_day_minutes."""
        m = self.sim_day_minutes
        if 0 <= m < 360:
            return "night"
        if 360 <= m < 720:
            return "morning"
        if 720 <= m < 1080:
            return "day"
        return "evening"

    def _tick_time_update(self) -> None:
        """Fait avancer le temps interne d'un tick."""
        now = time.monotonic()
        self.tick_seconds = now - self._last_tick_monotonic
        self._last_tick_monotonic = now

        self.tick += 1
        self.sim_minutes += SIM_MIN_PER_TICK
        self.sim_day_minutes = self.sim_minutes % 1440.0
        self.sim_day_phase = self._compute_sim_day_phase()
        self.pc_day_phase = self._compute_pc_day_phase()

    def _passive_recovery(self) -> None:
        """Applique la récupération passive par tick selon phase simulée.

        L'influence PC est limitée à +/-10% (ici +10% la nuit).
        """
        if self.sim_day_phase == "night":
            e, c, f, s = 0.030, 0.020, -0.025, -0.012
        else:
            e, c, f, s = 0.012, 0.008, -0.010, -0.006

        # Micro-influence horaire réelle, bornée à +10%.
        boost = 1.10 if self.pc_day_phase == "night" else 1.0
        e, c, f, s = e * boost, c * boost, f * boost, s * boost

        self.etat.energy += e
        self.etat.clarity += c
        self.etat.fatigue += f
        self.etat.stress += s
        self.etat.borner()

    def _build_objectifs(self) -> List[ObjectifActif]:
        """Construit les 4 objectifs actifs exacts demandés."""

        def fit_from(mapping: Dict[str, float]) -> Callable[[str], float]:
            return lambda action: mapping.get(action, 0.0)

        return [
            ObjectifActif(
                name="Recover",
                priority=1.0,
                is_active=lambda s, _r, _st: s.energy < 0.35 or s.clarity < 0.35 or s.fatigue > 0.70,
                fit=fit_from({"rest": 1.0, "idle": 0.5, "reflect": 0.3}),
            ),
            ObjectifActif(
                name="Stabilize",
                priority=0.9,
                is_active=lambda s, _r, _st: s.stability < 0.45 or s.stress > 0.65,
                fit=fit_from({"organize": 1.0, "reflect": 0.6, "rest": 0.4}),
            ),
            ObjectifActif(
                name="Explore",
                priority=0.6,
                is_active=lambda s, _r, _st: s.curiosity > 0.60 and s.energy > 0.50 and s.stability > 0.55 and s.stress < 0.70,
                fit=fit_from({"explore": 1.0, "challenge": 0.3}),
            ),
            ObjectifActif(
                name="Progress",
                priority=0.5,
                is_active=lambda _s, recover_active, stabilize_active: not (recover_active or stabilize_active),
                fit=fit_from({"practice": 1.0, "reflect": 0.4, "organize": 0.2}),
            ),
        ]

    def _active_objectifs(self) -> List[ObjectifActif]:
        """Évalue les objectifs actifs avec dépendance Recover/Stabilize pour Progress."""
        recover = self.objectifs[0]
        stabilize = self.objectifs[1]
        recover_active = recover.is_active(self.etat, False, False)
        stabilize_active = stabilize.is_active(self.etat, recover_active, False)

        actifs: List[ObjectifActif] = []
        for obj in self.objectifs:
            if obj.is_active(self.etat, recover_active, stabilize_active):
                actifs.append(obj)
        return actifs

    def _gated_actions(self) -> List[str]:
        """Applique le filtre de gating avant scoring."""
        candidates: List[str] = []
        for action in self.monde.actions:
            mem = self.memoire.long_terme[action]
            # Gating d'évitement mémoire.
            if mem.avoid_until_tick > self.tick:
                continue
            candidates.append(action)

        # Énergie critique : actions autorisées rest/idle/reflect uniquement.
        if self.etat.energy < 0.20:
            allowed = {"rest", "idle", "reflect"}
            candidates = [a for a in candidates if a in allowed]

        filtered: List[str] = []
        for action in candidates:
            # Stabilité basse : challenge interdit et explore réduit (filtrage strict demandé).
            if self.etat.stability < 0.30 and action == "challenge":
                continue
            # Stress très haut : challenge interdit.
            if self.etat.stress > 0.85 and action == "challenge":
                continue
            filtered.append(action)

        return filtered or ["rest"]

    def _score_action(self, action: str, actifs: List[ObjectifActif]) -> float:
        """Applique la formule unique de scoring demandée."""
        p = self.monde.action_profiles[action]
        mem = self.memoire.long_terme[action]

        # Reward/Cost observables.
        reward = p.knowledge_gain + p.stability_gain
        cost = p.energy_cost + p.clarity_cost + p.fatigue_gain * 0.6

        score = reward - cost

        # Objectifs.
        for obj in actifs:
            score += obj.priority * obj.fit(action)

        # Mémoire.
        score += 0.60 * mem.ema_reward
        score -= 0.60 * mem.ema_cost
        score -= 0.80 * mem.recent_fail_streak
        score += 0.25 * mem.recent_success_streak

        # Récence / diversité.
        gap = min(1.0, (self.tick - self.last_action_tick[action]) / 50.0)
        score += 0.20 * gap

        # Instinct risque.
        risk = p.base_risk + self.etat.stress * 0.25 - self.etat.stability * 0.15
        score -= (1.0 - self.etat.risk_tolerance) * 0.60 * risk

        # Pénalités spécifiques demandées côté gating souple.
        if self.etat.stability < 0.30 and action == "explore":
            score -= 0.20
        if self.etat.stress > 0.85 and action == "explore":
            score -= 0.30

        # Micro bruit.
        score += self._rng.uniform(-0.05, 0.05)
        return score

    def choisir_action(self) -> str:
        """Sélectionne l'action de score maximal après gating."""
        actifs = self._active_objectifs()
        candidates = self._gated_actions()
        scores = {a: self._score_action(a, actifs) for a in candidates}
        action = max(scores, key=scores.get)

        # Journal debug de décision (numérique).
        self.journal_debug.append(
            {
                "tick": self.tick,
                "sim_day_phase": self.sim_day_phase,
                "pc_day_phase": self.pc_day_phase,
                "active_objectifs": [o.name for o in actifs],
                "candidates": candidates,
                "scores": scores,
                "chosen": action,
            }
        )
        return action

    def _executer_action(self, action: str) -> Dict[str, float | bool]:
        """Simule le résultat de l'action et renvoie reward/cost observés."""
        p = self.monde.action_profiles[action]

        # Risque effectif simple et stable.
        risk_effective = max(0.0, min(1.0, p.base_risk + self.etat.stress * 0.20 - self.etat.stability * 0.10))
        succes = self._rng.random() > risk_effective

        # Application de l'action sur l'état.
        self.etat.energy -= p.energy_cost
        self.etat.clarity -= p.clarity_cost
        self.etat.stability += p.stability_gain * (1.0 if succes else 0.4)
        self.etat.curiosity += p.knowledge_gain * 0.05
        self.etat.fatigue += p.fatigue_gain

        if succes:
            self.etat.stress -= 0.02
            observed_reward = p.knowledge_gain + p.stability_gain
        else:
            self.etat.stress += p.stress_on_fail
            observed_reward = (p.knowledge_gain + p.stability_gain) * 0.25

        observed_cost = p.energy_cost + p.clarity_cost + p.fatigue_gain * 0.6

        self.etat.borner()

        return {
            "success": succes,
            "observed_reward": observed_reward,
            "observed_cost": observed_cost,
            "risk_effective": risk_effective,
        }

    def _update_memoire_long_terme(self, action: str, resultat: Dict[str, float | bool]) -> None:
        """Met à jour la mémoire LT selon la règle obligatoire."""
        mem = self.memoire.long_terme[action]
        succes = bool(resultat["success"])

        mem.n_total += 1
        mem.last_tick = self.tick

        if succes:
            mem.n_success += 1
            mem.recent_success_streak += 1
            mem.recent_fail_streak = 0
        else:
            mem.n_fail += 1
            mem.recent_fail_streak += 1
            mem.recent_success_streak = 0
            if self.etat.stress > 0.75:
                mem.avoid_until_tick = self.tick + 40

        # EMA reward/cost.
        observed_reward = float(resultat["observed_reward"])
        observed_cost = float(resultat["observed_cost"])
        mem.ema_reward = (1.0 - EMA_ALPHA) * mem.ema_reward + EMA_ALPHA * observed_reward
        mem.ema_cost = (1.0 - EMA_ALPHA) * mem.ema_cost + EMA_ALPHA * observed_cost

    def _state_snapshot(self) -> Dict[str, float | int | str]:
        """Capture l'état avant décision pour audit."""
        return {
            "tick": self.tick,
            "sim_minutes": self.sim_minutes,
            "sim_day_minutes": self.sim_day_minutes,
            "sim_day_phase": self.sim_day_phase,
            "pc_day_phase": self.pc_day_phase,
            "energy": self.etat.energy,
            "clarity": self.etat.clarity,
            "stability": self.etat.stability,
            "curiosity": self.etat.curiosity,
            "risk_tolerance": self.etat.risk_tolerance,
            "fatigue": self.etat.fatigue,
            "stress": self.etat.stress,
        }

    def _human_log(self, action: str, success: bool) -> str:
        """Produit un log humain (1 phrase max)."""
        if action == "rest":
            base = "Je récupère pour préserver ma clarté et mon énergie"
        elif action in {"explore", "challenge"}:
            base = "Je tente une progression mesurée malgré l'incertitude"
        elif action in {"organize", "reflect"}:
            base = "Je stabilise mon fonctionnement pour rester cohérente"
        else:
            base = "Je maintiens un rythme prudent et durable"
        suffix = " (succès)." if success else " (échec, j'ajuste)."
        return base + suffix

    def boucle_de_vie(self) -> str:
        """Cycle complet : temps -> récupération -> décision -> action -> apprentissage."""
        self.contrainte_locale.verifier()

        self._tick_time_update()
        self._passive_recovery()

        state_before = self._state_snapshot()
        action = self.choisir_action()
        resultat = self._executer_action(action)

        self.last_action_tick[action] = self.tick
        self._update_memoire_long_terme(action, resultat)

        evenement = {
            "tick": self.tick,
            "action": action,
            "success": bool(resultat["success"]),
            "reward": float(resultat["observed_reward"]),
            "cost": float(resultat["observed_cost"]),
            "stress": self.etat.stress,
            "fatigue": self.etat.fatigue,
        }
        self.memoire.enregistrer_evenement(evenement)

        human = self._human_log(action, bool(resultat["success"]))
        self.journal_humain.append(human)

        # Complément debug du tick (état avant + résultat).
        self.journal_debug.append(
            {
                "tick": self.tick,
                "state_before": state_before,
                "action_result": {
                    "action": action,
                    "success": bool(resultat["success"]),
                    "risk_effective": float(resultat["risk_effective"]),
                    "reward": float(resultat["observed_reward"]),
                    "cost": float(resultat["observed_cost"]),
                },
                "state_after": self._state_snapshot(),
            }
        )

        return human
