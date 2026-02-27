"""Cerveau décisionnel de Kaguya (tick interne, monde évolutif, progression).

Ce module conserve les fondations précédentes (temps interne + offline strict)
et ajoute :
- un monde dynamique persistant,
- un système de compétences (skills),
- des événements rares,
- des souvenirs marquants à poids élevé,
- une consolidation périodique identitaire,
- des routines émergentes,
- un journal évolutif par journée simulée.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
import random
from typing import Callable, Dict, List
import time

SIM_MIN_PER_TICK: float = 5.0
EMA_ALPHA: float = 0.15
CONSOLIDATION_EVERY_TICKS: int = 48


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
class EtatMonde:
    """Monde dynamique persistant qui évolue à chaque tick."""

    bruit_instabilite: float = 0.35
    opportunites: float = 0.55
    danger: float = 0.30
    nouveaute: float = 0.70
    stabilite_globale: float = 0.60

    def borner(self) -> None:
        """Borne toutes les dimensions monde dans [0..1]."""
        self.bruit_instabilite = max(0.0, min(1.0, self.bruit_instabilite))
        self.opportunites = max(0.0, min(1.0, self.opportunites))
        self.danger = max(0.0, min(1.0, self.danger))
        self.nouveaute = max(0.0, min(1.0, self.nouveaute))
        self.stabilite_globale = max(0.0, min(1.0, self.stabilite_globale))


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
class Competence:
    """Progression par compétence liée à une action."""

    niveau: int = 1
    experience: float = 0.0
    seuil: float = 1.0


@dataclass
class SouvenirMarquant:
    """Souvenir à poids élevé influençant les choix futurs."""

    type: str
    gravite: float
    action: str
    tick: int
    state: Dict[str, float]


@dataclass
class Memoire:
    """Mémoire globale avec court terme, LT, souvenirs et routines."""

    court_terme: List[Dict[str, float | str | bool]] = field(default_factory=list)
    long_terme: Dict[str, MemoireAction] = field(default_factory=dict)
    souvenirs_marquants: List[SouvenirMarquant] = field(default_factory=list)
    routines: Dict[str, Dict[str, int]] = field(default_factory=dict)

    def init_actions(self, noms_actions: List[str]) -> None:
        """Assure l'initialisation mémoire pour chaque action fixe."""
        for nom in noms_actions:
            if nom not in self.long_terme:
                self.long_terme[nom] = MemoireAction()
            if nom not in self.routines:
                self.routines[nom] = {"night": 0, "morning": 0, "day": 0, "evening": 0}

    def enregistrer_evenement(self, evenement: Dict[str, float | str | bool]) -> None:
        """Conserve une fenêtre glissante récente."""
        self.court_terme.append(evenement)
        if len(self.court_terme) > 40:
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
        self.etat_monde = EtatMonde()

        # Temps interne : c'est lui qui pilote, jamais l'heure PC directement.
        self.tick: int = 0
        self.tick_seconds: float = 0.0
        self.sim_minutes: float = 0.0
        self.sim_day_minutes: float = 0.0
        self.sim_day_phase: str = "night"
        self.pc_day_phase: str = self._compute_pc_day_phase()
        self._last_day_index: int = 0

        self.memoire = Memoire()
        self.journal_humain: List[str] = []
        self.journal_debug: List[Dict[str, object]] = []
        self.journal_evolutif: List[Dict[str, object]] = []

        self.monde = MondeSimule.standard()
        self.memoire.init_actions(self.monde.actions)
        self.last_action_tick: Dict[str, int] = {action: 0 for action in self.monde.actions}
        self.competences: Dict[str, Competence] = {action: Competence() for action in self.monde.actions}
        self.action_history: List[str] = []

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

    def _evolve_world(self) -> None:
        """Évolution autonome du monde, indépendante de Kaguya."""
        w = self.etat_monde
        drift = self._rng.uniform(-0.015, 0.015)

        w.bruit_instabilite += drift + self._rng.uniform(-0.01, 0.01)
        w.danger += 0.25 * w.bruit_instabilite * 0.01 + self._rng.uniform(-0.008, 0.008)
        w.opportunites += self._rng.uniform(-0.01, 0.01) + (0.5 - w.danger) * 0.005
        w.nouveaute -= 0.004
        w.stabilite_globale += (0.5 - w.bruit_instabilite) * 0.01 + self._rng.uniform(-0.006, 0.006)
        w.borner()

    def _apply_action_world_effect(self, action: str, success: bool) -> None:
        """Effets durables des actions sur le monde."""
        w = self.etat_monde
        gain = 1.0 if success else 0.5

        if action == "organize":
            w.stabilite_globale += 0.030 * gain
            w.bruit_instabilite -= 0.025 * gain
            w.danger -= 0.010 * gain
        elif action == "explore":
            w.nouveaute += 0.060 * gain
            w.opportunites += 0.030 * gain
            w.bruit_instabilite += 0.015 * (2 - gain)
        elif action == "challenge":
            w.opportunites += 0.045 * gain
            w.danger += 0.030 * (2 - gain)
        elif action == "reflect":
            w.stabilite_globale += 0.018 * gain
            w.bruit_instabilite -= 0.012 * gain
        elif action == "idle":
            w.nouveaute -= 0.010
        w.borner()

    def _passive_recovery(self) -> None:
        """Applique la récupération passive par tick selon phase simulée."""
        if self.sim_day_phase == "night":
            e, c, f, s = 0.030, 0.020, -0.025, -0.012
        else:
            e, c, f, s = 0.012, 0.008, -0.010, -0.006

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
            if mem.avoid_until_tick > self.tick:
                continue
            candidates.append(action)

        if self.etat.energy < 0.20:
            allowed = {"rest", "idle", "reflect"}
            candidates = [a for a in candidates if a in allowed]

        filtered: List[str] = []
        for action in candidates:
            if self.etat.stability < 0.30 and action == "challenge":
                continue
            if self.etat.stress > 0.85 and action == "challenge":
                continue
            filtered.append(action)

        return filtered or ["rest"]

    def _skill_modifiers(self, action: str) -> Dict[str, float]:
        """Retourne les modificateurs de compétence pour une action."""
        skill = self.competences[action]
        lvl = max(1, skill.niveau)
        return {
            "risk_mult": max(0.75, 1.0 - 0.02 * (lvl - 1)),
            "energy_mult": max(0.78, 1.0 - 0.015 * (lvl - 1)),
            "reward_mult": min(1.25, 1.0 + 0.02 * (lvl - 1)),
            "stress_relief": min(0.08, 0.005 * (lvl - 1)),
        }

    def _routine_bonus(self, action: str) -> float:
        """Calcule un bonus routine si action fréquente dans cette phase."""
        count = self.memoire.routines[action][self.sim_day_phase]
        return min(0.10, 0.01 * count)

    def _souvenir_bias(self, action: str) -> float:
        """Calcule l'influence des souvenirs marquants sur le scoring."""
        bias = 0.0
        for s in self.memoire.souvenirs_marquants[-20:]:
            if s.action != action:
                continue
            if s.type in {"success_major", "discovery", "opportunity_exceptionnelle"}:
                bias += 0.08 * s.gravite
            elif s.type in {"near_failure", "stress_spike"}:
                bias -= 0.06 * s.gravite
        return bias

    def _score_action(self, action: str, actifs: List[ObjectifActif]) -> float:
        """Applique la formule unique de scoring enrichie par monde/skills/routines."""
        p = self.monde.action_profiles[action]
        mem = self.memoire.long_terme[action]
        mods = self._skill_modifiers(action)

        reward = (p.knowledge_gain + p.stability_gain) * mods["reward_mult"]
        reward += 0.03 * self.etat_monde.opportunites
        cost = (p.energy_cost * mods["energy_mult"]) + p.clarity_cost + p.fatigue_gain * 0.6

        score = reward - cost

        for obj in actifs:
            score += obj.priority * obj.fit(action)

        score += 0.60 * mem.ema_reward
        score -= 0.60 * mem.ema_cost
        score -= 0.80 * mem.recent_fail_streak
        score += 0.25 * mem.recent_success_streak

        gap = min(1.0, (self.tick - self.last_action_tick[action]) / 50.0)
        score += 0.20 * gap

        risk = p.base_risk * mods["risk_mult"] + self.etat.stress * 0.25 - self.etat.stability * 0.15 + self.etat_monde.danger * 0.15
        score -= (1.0 - self.etat.risk_tolerance) * 0.60 * risk

        if self.etat.stability < 0.30 and action == "explore":
            score -= 0.20
        if self.etat.stress > 0.85 and action == "explore":
            score -= 0.30

        score += self._routine_bonus(action)
        score += self._souvenir_bias(action)
        score += self._rng.uniform(-0.05, 0.05)
        return score

    def choisir_action(self) -> str:
        """Sélectionne l'action de score maximal après gating."""
        actifs = self._active_objectifs()
        candidates = self._gated_actions()
        scores = {a: self._score_action(a, actifs) for a in candidates}
        action = max(scores, key=scores.get)

        self.journal_debug.append(
            {
                "tick": self.tick,
                "sim_day_phase": self.sim_day_phase,
                "pc_day_phase": self.pc_day_phase,
                "active_objectifs": [o.name for o in actifs],
                "world": {
                    "noise": self.etat_monde.bruit_instabilite,
                    "danger": self.etat_monde.danger,
                    "opportunities": self.etat_monde.opportunites,
                    "novelty": self.etat_monde.nouveaute,
                    "stability": self.etat_monde.stabilite_globale,
                },
                "candidates": candidates,
                "scores": scores,
                "chosen": action,
            }
        )
        return action

    def _executer_action(self, action: str) -> Dict[str, float | bool | str]:
        """Simule le résultat de l'action et renvoie reward/cost observés."""
        p = self.monde.action_profiles[action]
        mods = self._skill_modifiers(action)

        risk_effective = max(
            0.0,
            min(
                1.0,
                p.base_risk * mods["risk_mult"]
                + self.etat.stress * 0.20
                - self.etat.stability * 0.10
                + self.etat_monde.danger * 0.20
                + self.etat_monde.bruit_instabilite * 0.10,
            ),
        )
        succes = self._rng.random() > risk_effective

        self.etat.energy -= p.energy_cost * mods["energy_mult"]
        self.etat.clarity -= p.clarity_cost
        self.etat.stability += p.stability_gain * (1.0 if succes else 0.4)
        self.etat.curiosity += p.knowledge_gain * 0.05 + self.etat_monde.nouveaute * 0.02
        self.etat.fatigue += p.fatigue_gain

        if succes:
            self.etat.stress -= 0.02 + mods["stress_relief"]
            observed_reward = (p.knowledge_gain + p.stability_gain) * mods["reward_mult"]
        else:
            self.etat.stress += p.stress_on_fail + self.etat_monde.danger * 0.05
            observed_reward = (p.knowledge_gain + p.stability_gain) * 0.25

        observed_cost = (p.energy_cost * mods["energy_mult"]) + p.clarity_cost + p.fatigue_gain * 0.6
        self.etat.borner()

        self._apply_action_world_effect(action, succes)
        rare_type = self._roll_rare_event(action, succes)

        return {
            "success": succes,
            "observed_reward": observed_reward,
            "observed_cost": observed_cost,
            "risk_effective": risk_effective,
            "rare_event": rare_type,
        }

    def _roll_rare_event(self, action: str, success: bool) -> str:
        """Déclenche éventuellement un événement rare et durable."""
        p_event = min(0.25, 0.03 + self.etat_monde.bruit_instabilite * 0.08)
        if self._rng.random() > p_event:
            return "none"

        event_types = [
            "discovery",
            "near_failure",
            "success_major",
            "stress_spike",
            "opportunity_exceptionnelle",
        ]
        event = self._rng.choice(event_types)

        gravite = self._rng.uniform(0.45, 1.0)
        if event == "discovery":
            self.etat.curiosity += 0.12 * gravite
            self.etat.stability += 0.04 * gravite
        elif event == "near_failure":
            self.etat.stress += 0.14 * gravite
            self.etat.stability -= 0.07 * gravite
        elif event == "success_major":
            self.etat.stress -= 0.08 * gravite
            self.etat.risk_tolerance += 0.05 * gravite
            self.etat.stability += 0.06 * gravite
        elif event == "stress_spike":
            self.etat.stress += 0.18 * gravite
            self.etat.clarity -= 0.06 * gravite
        elif event == "opportunity_exceptionnelle":
            self.etat.curiosity += 0.10 * gravite
            self.etat_monde.opportunites += 0.12 * gravite

        self.etat.borner()
        self.etat_monde.borner()

        # Souvenir marquant mémorisé.
        souvenir = SouvenirMarquant(
            type=event,
            gravite=gravite,
            action=action,
            tick=self.tick,
            state={
                "energy": self.etat.energy,
                "clarity": self.etat.clarity,
                "stability": self.etat.stability,
                "curiosity": self.etat.curiosity,
                "risk_tolerance": self.etat.risk_tolerance,
                "fatigue": self.etat.fatigue,
                "stress": self.etat.stress,
            },
        )
        self.memoire.souvenirs_marquants.append(souvenir)

        # Influence temporaire sur profil de risque/curiosité.
        if event in {"near_failure", "stress_spike"}:
            self.etat.risk_tolerance -= 0.03 * gravite
        else:
            self.etat.risk_tolerance += 0.02 * gravite
        self.etat.curiosity += 0.01 * gravite if event in {"discovery", "opportunity_exceptionnelle"} else -0.005 * gravite
        self.etat.borner()

        return event

    def _update_competence(self, action: str, success: bool) -> None:
        """Met à jour progression d'une compétence associée à l'action."""
        skill = self.competences[action]
        skill.experience += 0.30 if success else 0.12
        if skill.experience >= skill.seuil:
            skill.experience -= skill.seuil
            skill.niveau += 1
            skill.seuil *= 1.25

    def _update_memoire_long_terme(self, action: str, resultat: Dict[str, float | bool | str]) -> None:
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

        observed_reward = float(resultat["observed_reward"])
        observed_cost = float(resultat["observed_cost"])
        mem.ema_reward = (1.0 - EMA_ALPHA) * mem.ema_reward + EMA_ALPHA * observed_reward
        mem.ema_cost = (1.0 - EMA_ALPHA) * mem.ema_cost + EMA_ALPHA * observed_cost

    def _update_routines(self, action: str) -> None:
        """Détecte répétitions contextuelles par phase et forme des routines."""
        self.memoire.routines[action][self.sim_day_phase] += 1

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
            "world_noise": self.etat_monde.bruit_instabilite,
            "world_opportunities": self.etat_monde.opportunites,
            "world_danger": self.etat_monde.danger,
            "world_novelty": self.etat_monde.nouveaute,
            "world_stability": self.etat_monde.stabilite_globale,
        }

    def _human_log(self, action: str, success: bool, rare_event: str) -> str:
        """Produit un log humain (1 phrase max)."""
        if action == "rest":
            base = "Je récupère pour préserver ma clarté et mon énergie"
        elif action in {"explore", "challenge"}:
            base = "Je tente une progression mesurée malgré l'incertitude"
        elif action in {"organize", "reflect"}:
            base = "Je stabilise mon fonctionnement pour rester cohérente"
        else:
            base = "Je maintiens un rythme prudent et durable"
        if rare_event != "none":
            return f"{base} et un événement rare ({rare_event}) reconfigure ma trajectoire."
        return base + (" (succès)." if success else " (échec, j'ajuste).")

    def _consolidation_periodique(self) -> None:
        """Consolidation identitaire tous les X ticks."""
        if self.tick % CONSOLIDATION_EVERY_TICKS != 0:
            return

        # Actions dominantes / évitées sur fenêtre récente.
        window = self.action_history[-80:]
        if not window:
            return

        counts: Dict[str, int] = {a: 0 for a in self.monde.actions}
        for a in window:
            counts[a] += 1

        dominant = max(counts, key=counts.get)
        avoided = min(counts, key=counts.get)

        # Ajustements légers demandés.
        if dominant in {"explore", "challenge"}:
            self.etat.risk_tolerance += 0.015
            self.etat.curiosity += 0.010
        if dominant in {"organize", "reflect", "rest"}:
            self.etat.stability += 0.012
            self.etat.risk_tolerance -= 0.006
        if avoided in {"explore", "challenge"}:
            self.etat.curiosity -= 0.008

        self.etat.borner()

        # Purge souvenirs mineurs, conservation marquants.
        self.memoire.souvenirs_marquants = [s for s in self.memoire.souvenirs_marquants if s.gravite >= 0.55]

    def _day_summary_if_needed(self) -> None:
        """Produit un résumé périodique par journée simulée."""
        current_day = int(self.sim_minutes // 1440)
        if current_day <= self._last_day_index:
            return

        self._last_day_index = current_day
        window_events = [e for e in self.memoire.court_terme if isinstance(e.get("tick"), int) and int(e["tick"]) > self.tick - 288]
        counts: Dict[str, int] = {a: 0 for a in self.monde.actions}
        for e in window_events:
            a = str(e.get("action", ""))
            if a in counts:
                counts[a] += 1

        top_actions = sorted(counts.items(), key=lambda x: x[1], reverse=True)[:3]
        last_skills = {a: self.competences[a].niveau for a in self.monde.actions}
        marquants = [s.type for s in self.memoire.souvenirs_marquants[-5:]]

        self.journal_evolutif.append(
            {
                "day_index": current_day,
                "dominant_actions": top_actions,
                "events": marquants,
                "skills": last_skills,
                "state": {
                    "energy": self.etat.energy,
                    "clarity": self.etat.clarity,
                    "stability": self.etat.stability,
                    "curiosity": self.etat.curiosity,
                    "risk_tolerance": self.etat.risk_tolerance,
                    "fatigue": self.etat.fatigue,
                    "stress": self.etat.stress,
                },
            }
        )

    def boucle_de_vie(self) -> str:
        """Cycle complet : temps -> monde -> récupération -> décision -> apprentissage."""
        self.contrainte_locale.verifier()

        self._tick_time_update()
        self._evolve_world()
        self._passive_recovery()

        state_before = self._state_snapshot()
        action = self.choisir_action()
        resultat = self._executer_action(action)

        self.last_action_tick[action] = self.tick
        self.action_history.append(action)
        self._update_routines(action)
        self._update_competence(action, bool(resultat["success"]))
        self._update_memoire_long_terme(action, resultat)

        evenement = {
            "tick": self.tick,
            "action": action,
            "success": bool(resultat["success"]),
            "reward": float(resultat["observed_reward"]),
            "cost": float(resultat["observed_cost"]),
            "stress": self.etat.stress,
            "fatigue": self.etat.fatigue,
            "rare_event": str(resultat["rare_event"]),
        }
        self.memoire.enregistrer_evenement(evenement)

        self._consolidation_periodique()
        self._day_summary_if_needed()

        human = self._human_log(action, bool(resultat["success"]), str(resultat["rare_event"]))
        self.journal_humain.append(human)

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
                    "rare_event": str(resultat["rare_event"]),
                    "skill_level": self.competences[action].niveau,
                },
                "state_after": self._state_snapshot(),
            }
        )

        return human
