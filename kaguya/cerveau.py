"""Cerveau décisionnel de Kaguya avec couche LLM routée."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime
import json
from pathlib import Path
import random
from typing import Callable, Dict, List, Optional
import time

from kaguya.llm import ContextPacket, LLMResult, ModelRegistry, ModelRouter, quick_eval_harness

SIM_MIN_PER_TICK: float = 5.0
EMA_ALPHA: float = 0.15
CONSOLIDATION_EVERY_TICKS: int = 48
SNAPSHOT_VERSION: int = 3
AUTOSAVE_EVERY_TICKS: int = 60


@dataclass
class ContrainteExecutionLocale:
    hors_ligne_strict: bool = True
    api_externe_autorisee: bool = False

    def verifier(self) -> None:
        if not self.hors_ligne_strict:
            raise RuntimeError("Le mode hors-ligne strict est obligatoire pour Kaguya.")
        if self.api_externe_autorisee:
            raise RuntimeError("Les API externes sont interdites pour Kaguya en local.")


@dataclass
class Permissions:
    whitelist_capacites: set[str] = field(default_factory=lambda: {"simulate", "log", "snapshot", "llm"})
    sensibles_interdites: set[str] = field(default_factory=lambda: {"network", "filesystem_delete", "shell_exec"})
    refus_log: List[Dict[str, str | int]] = field(default_factory=list)

    def autorise(self, capacite: str, tick: int) -> bool:
        if capacite in self.sensibles_interdites or capacite not in self.whitelist_capacites:
            self.refus_log.append({"tick": tick, "capacite": capacite, "raison": "capacité non autorisée"})
            return False
        return True


@dataclass
class EtatInterne:
    energy: float = 0.70
    clarity: float = 0.65
    stability: float = 0.70
    curiosity: float = 0.60
    risk_tolerance: float = 0.45
    fatigue: float = 0.25
    stress: float = 0.25

    def borner(self) -> None:
        self.energy = max(0.0, min(1.0, self.energy))
        self.clarity = max(0.0, min(1.0, self.clarity))
        self.stability = max(0.0, min(1.0, self.stability))
        self.curiosity = max(0.0, min(1.0, self.curiosity))
        self.risk_tolerance = max(0.0, min(1.0, self.risk_tolerance))
        self.fatigue = max(0.0, min(1.0, self.fatigue))
        self.stress = max(0.0, min(1.0, self.stress))


@dataclass
class EtatMonde:
    bruit_instabilite: float = 0.35
    opportunites: float = 0.55
    danger: float = 0.30
    nouveaute: float = 0.70
    stabilite_globale: float = 0.60

    def borner(self) -> None:
        self.bruit_instabilite = max(0.0, min(1.0, self.bruit_instabilite))
        self.opportunites = max(0.0, min(1.0, self.opportunites))
        self.danger = max(0.0, min(1.0, self.danger))
        self.nouveaute = max(0.0, min(1.0, self.nouveaute))
        self.stabilite_globale = max(0.0, min(1.0, self.stabilite_globale))


@dataclass
class IntentionActive:
    nom: str
    objectif_lie: str
    actions_preferees: List[str]
    tick_fin: int
    cancel_on_critical: bool = True


@dataclass
class Idee:
    intitule: str
    contexte: str
    cout_estime: float
    risque_estime: float
    priorite: float
    recence_tick: int


@dataclass
class MemoireAction:
    n_total: int = 0
    n_success: int = 0
    n_fail: int = 0
    last_tick: int = 0
    ema_reward: float = 0.0
    ema_cost: float = 0.0
    recent_fail_streak: int = 0
    recent_success_streak: int = 0
    avoid_until_tick: int = 0
    contexts: Dict[str, Dict[str, float]] = field(default_factory=dict)


@dataclass
class Competence:
    niveau: int = 1
    experience: float = 0.0
    seuil: float = 1.0


@dataclass
class SouvenirMarquant:
    type: str
    gravite: float
    action: str
    tick: int
    state: Dict[str, float]


@dataclass
class Memoire:
    court_terme: List[Dict[str, float | str | bool]] = field(default_factory=list)
    long_terme: Dict[str, MemoireAction] = field(default_factory=dict)
    souvenirs_marquants: List[SouvenirMarquant] = field(default_factory=list)
    routines: Dict[str, Dict[str, int]] = field(default_factory=dict)

    def init_actions(self, noms_actions: List[str]) -> None:
        for nom in noms_actions:
            self.long_terme.setdefault(nom, MemoireAction())
            self.routines.setdefault(nom, {"night": 0, "morning": 0, "day": 0, "evening": 0})

    def enregistrer_evenement(self, evenement: Dict[str, float | str | bool]) -> None:
        self.court_terme.append(evenement)
        if len(self.court_terme) > 80:
            self.court_terme.pop(0)


@dataclass
class ActionProfile:
    base_risk: float
    energy_cost: float
    clarity_cost: float
    stability_gain: float
    knowledge_gain: float
    fatigue_gain: float
    stress_on_fail: float


@dataclass
class MondeSimule:
    action_profiles: Dict[str, ActionProfile]

    @classmethod
    def standard(cls) -> "MondeSimule":
        return cls(action_profiles={
            "rest": ActionProfile(0.02, -0.10, -0.04, 0.05, 0.00, -0.10, 0.04),
            "organize": ActionProfile(0.08, 0.08, 0.05, 0.10, 0.03, 0.04, 0.06),
            "practice": ActionProfile(0.14, 0.12, 0.09, 0.05, 0.12, 0.08, 0.09),
            "explore": ActionProfile(0.22, 0.16, 0.10, 0.03, 0.18, 0.09, 0.12),
            "reflect": ActionProfile(0.05, 0.05, -0.03, 0.08, 0.09, -0.02, 0.05),
            "idle": ActionProfile(0.01, -0.03, -0.02, 0.02, 0.00, -0.05, 0.03),
            "challenge": ActionProfile(0.35, 0.20, 0.16, 0.07, 0.20, 0.12, 0.18),
        })

    @property
    def actions(self) -> List[str]:
        return list(self.action_profiles.keys())


@dataclass
class ObjectifActif:
    name: str
    priority: float
    is_active: Callable[[EtatInterne, bool, bool], bool]
    fit: Callable[[str], float]


class CerveauKaguya:
    def __init__(self, seed: int | None = None, autoload_snapshot: str | None = None) -> None:
        self._rng = random.Random(seed)
        self._last_tick_monotonic = time.monotonic()

        self.contrainte_locale = ContrainteExecutionLocale()
        self.permissions = Permissions()
        self.etat = EtatInterne()
        self.etat_monde = EtatMonde()

        self.tick = 0
        self.tick_seconds = 0.0
        self.sim_minutes = 0.0
        self.sim_day_minutes = 0.0
        self.sim_day_phase = "night"
        self.pc_day_phase = self._compute_pc_day_phase()
        self._last_day_index = 0

        self.is_paused = False
        self.default_snapshot_path = "kaguya_snapshot.json"

        self.intention_active: Optional[IntentionActive] = None
        self.idees_backlog: List[Idee] = []

        self.memoire = Memoire()
        self.journal_humain: List[str] = []
        self.journal_debug: List[Dict[str, object]] = []
        self.journal_evolutif: List[Dict[str, object]] = []
        self.dashboard_history: List[Dict[str, object]] = []

        self.monde = MondeSimule.standard()
        self.memoire.init_actions(self.monde.actions)
        self.last_action_tick = {a: 0 for a in self.monde.actions}
        self.competences = {a: Competence() for a in self.monde.actions}
        self.action_history: List[str] = []

        self.meta = {"audace": 1.0, "diversite": 1.0}
        self.cooldowns: Dict[str, int] = {a: 0 for a in self.monde.actions}
        self.objectifs = self._build_objectifs()

        # Couche LLM unifiée (registry + router).
        self.model_registry = ModelRegistry.default()
        self.model_router = ModelRouter(registry=self.model_registry)
        self.llm_last_result: Dict[str, object] | None = None

        if autoload_snapshot:
            self.load_snapshot(autoload_snapshot)

    def _compute_pc_day_phase(self) -> str:
        return "night" if (datetime.now().hour < 6 or datetime.now().hour >= 22) else "day"

    def _compute_sim_day_phase(self) -> str:
        m = self.sim_day_minutes
        if m < 360:
            return "night"
        if m < 720:
            return "morning"
        if m < 1080:
            return "day"
        return "evening"

    def _tick_time_update(self) -> None:
        now = time.monotonic()
        self.tick_seconds = now - self._last_tick_monotonic
        self._last_tick_monotonic = now
        self.tick += 1
        self.sim_minutes += SIM_MIN_PER_TICK
        self.sim_day_minutes = self.sim_minutes % 1440.0
        self.sim_day_phase = self._compute_sim_day_phase()
        self.pc_day_phase = self._compute_pc_day_phase()

    def _evolve_world(self) -> None:
        w = self.etat_monde
        w.bruit_instabilite += self._rng.uniform(-0.02, 0.02)
        w.danger += self._rng.uniform(-0.01, 0.01) + w.bruit_instabilite * 0.003
        w.opportunites += self._rng.uniform(-0.01, 0.01) - w.danger * 0.002 + 0.002
        w.nouveaute -= 0.004
        w.stabilite_globale += self._rng.uniform(-0.01, 0.01) - w.bruit_instabilite * 0.004
        w.borner()

    def _apply_action_world_effect(self, action: str, success: bool) -> None:
        w = self.etat_monde
        g = 1.0 if success else 0.5
        if action == "organize":
            w.stabilite_globale += 0.03 * g
            w.bruit_instabilite -= 0.025 * g
        elif action == "explore":
            w.nouveaute += 0.06 * g
            w.opportunites += 0.03 * g
        elif action == "challenge":
            w.opportunites += 0.04 * g
            w.danger += 0.03 * (2 - g)
        elif action == "idle":
            w.nouveaute -= 0.01
        w.borner()

    def _passive_recovery(self) -> None:
        if self.sim_day_phase == "night":
            e, c, f, s = 0.030, 0.020, -0.025, -0.012
        else:
            e, c, f, s = 0.012, 0.008, -0.010, -0.006
        boost = 1.10 if self.pc_day_phase == "night" else 1.0
        self.etat.energy += e * boost
        self.etat.clarity += c * boost
        self.etat.fatigue += f * boost
        self.etat.stress += s * boost
        self.etat.borner()

    def _build_objectifs(self) -> List[ObjectifActif]:
        def fit_from(mapping: Dict[str, float]) -> Callable[[str], float]:
            return lambda action: mapping.get(action, 0.0)
        return [
            ObjectifActif("Recover", 1.0, lambda s, _r, _st: s.energy < 0.35 or s.clarity < 0.35 or s.fatigue > 0.70, fit_from({"rest": 1.0, "idle": 0.5, "reflect": 0.3})),
            ObjectifActif("Stabilize", 0.9, lambda s, _r, _st: s.stability < 0.45 or s.stress > 0.65, fit_from({"organize": 1.0, "reflect": 0.6, "rest": 0.4})),
            ObjectifActif("Explore", 0.6, lambda s, _r, _st: s.curiosity > 0.60 and s.energy > 0.50 and s.stability > 0.55 and s.stress < 0.70, fit_from({"explore": 1.0, "challenge": 0.3})),
            ObjectifActif("Progress", 0.5, lambda _s, rec, stb: not (rec or stb), fit_from({"practice": 1.0, "reflect": 0.4, "organize": 0.2})),
        ]

    def _active_objectifs(self) -> List[ObjectifActif]:
        rec = self.objectifs[0].is_active(self.etat, False, False)
        stb = self.objectifs[1].is_active(self.etat, rec, False)
        return [o for o in self.objectifs if o.is_active(self.etat, rec, stb)]

    def _intention_invalid(self) -> bool:
        if not self.intention_active:
            return True
        if self.tick > self.intention_active.tick_fin:
            return True
        if self.intention_active.cancel_on_critical and (self.etat.energy < 0.15 or self.etat.stress > 0.90):
            return True
        return False

    def _choose_intention(self, actifs: List[ObjectifActif]) -> None:
        if self.intention_active and not self._intention_invalid():
            return
        names = {o.name for o in actifs}
        if self.idees_backlog and self.idees_backlog[0].priorite > 0.7:
            self.intention_active = IntentionActive("tester une idée", "Idea", ["explore", "practice", "reflect"], self.tick + self._rng.randint(5, 12))
            return
        if "Recover" in names:
            self.intention_active = IntentionActive("récupérer", "Recover", ["rest", "reflect", "idle"], self.tick + self._rng.randint(6, 12))
        elif "Stabilize" in names:
            self.intention_active = IntentionActive("stabiliser", "Stabilize", ["organize", "reflect", "rest"], self.tick + self._rng.randint(6, 12))
        elif self.etat_monde.nouveaute > 0.55:
            self.intention_active = IntentionActive("explorer", "Explore", ["explore", "reflect", "practice"], self.tick + self._rng.randint(8, 20))
        else:
            self.intention_active = IntentionActive("progresser", "Progress", ["practice", "organize", "reflect"], self.tick + self._rng.randint(6, 16))

    def _gated_actions(self) -> List[str]:
        cands = []
        for a in self.monde.actions:
            mem = self.memoire.long_terme[a]
            if mem.avoid_until_tick > self.tick or self.cooldowns[a] > self.tick:
                continue
            cands.append(a)
        if self.etat.energy < 0.20:
            cands = [a for a in cands if a in {"rest", "idle", "reflect"}]
        if self.etat.stability < 0.30:
            cands = [a for a in cands if a != "challenge"]
        if self.etat.stress > 0.85:
            cands = [a for a in cands if a != "challenge"]
        if self.intention_active:
            preferred = [a for a in cands if a in self.intention_active.actions_preferees]
            if preferred:
                return preferred
        return cands or ["rest"]

    def _skill_modifiers(self, action: str) -> Dict[str, float]:
        lvl = self.competences[action].niveau
        return {
            "risk_mult": max(0.75, 1 - 0.02 * (lvl - 1)),
            "energy_mult": max(0.78, 1 - 0.015 * (lvl - 1)),
            "reward_mult": min(1.25, 1 + 0.02 * (lvl - 1)),
        }

    def _anti_loop_penalty(self, action: str) -> float:
        window = self.action_history[-30:]
        repeat = sum(1 for a in window if a == action)
        if repeat >= 12:
            self.cooldowns[action] = self.tick + 5
            return 0.30
        return 0.02 * repeat

    def _detect_stagnation(self) -> bool:
        window = self.memoire.court_terme[-30:]
        if len(window) < 12:
            return False
        any_event = any(e.get("rare_event") != "none" for e in window)
        novelty_gain = self.etat_monde.nouveaute - 0.5
        skill_progress = sum(1 for s in self.competences.values() if s.niveau > 1)
        return (not any_event) and novelty_gain < 0.02 and skill_progress <= 1

    def _context_key(self) -> str:
        if self.etat_monde.danger > 0.6:
            return "danger_high"
        if self.etat_monde.opportunites > 0.6:
            return "opportunity_high"
        return "neutral"

    def _context_bias(self, action: str) -> float:
        mem = self.memoire.long_terme[action]
        d = mem.contexts.get(self._context_key())
        if not d:
            return 0.0
        return d["score"] * 0.05 + min(0.08, d["freq"] * 0.01) + min(0.06, d["gravite"] * 0.01)

    def _score_action(self, action: str, actifs: List[ObjectifActif]) -> float:
        p = self.monde.action_profiles[action]
        mem = self.memoire.long_terme[action]
        mods = self._skill_modifiers(action)
        reward = (p.knowledge_gain + p.stability_gain) * mods["reward_mult"] + 0.03 * self.etat_monde.opportunites
        cost = (p.energy_cost * mods["energy_mult"]) + p.clarity_cost + p.fatigue_gain * 0.6
        score = reward - cost
        for o in actifs:
            score += o.priority * o.fit(action)
        score += 0.6 * mem.ema_reward - 0.6 * mem.ema_cost
        score -= 0.8 * mem.recent_fail_streak
        score += 0.25 * mem.recent_success_streak
        score += 0.2 * min(1.0, (self.tick - self.last_action_tick[action]) / 50.0) * self.meta["diversite"]
        risk = p.base_risk * mods["risk_mult"] + self.etat.stress * 0.25 - self.etat.stability * 0.15 + self.etat_monde.danger * 0.15
        score -= (1 - self.etat.risk_tolerance) * 0.6 * risk * self.meta["audace"]
        score -= self._anti_loop_penalty(action)
        score += self._context_bias(action)
        score += self._rng.uniform(-0.05, 0.05)
        return score

    def choisir_action(self) -> str:
        actifs = self._active_objectifs()
        self._choose_intention(actifs)
        cands = self._gated_actions()
        scores = {a: self._score_action(a, actifs) for a in cands}
        action = max(scores, key=scores.get)
        self.journal_debug.append({"tick": self.tick, "intention": asdict(self.intention_active) if self.intention_active else None, "scores": scores, "chosen": action})
        return action

    def _update_idees(self, rare_event: str, action: str) -> None:
        if rare_event in {"discovery", "success_major"}:
            self.idees_backlog.append(Idee("tester approche ambitieuse", f"événement {rare_event}", 0.45, 0.55, 0.80, self.tick))
        elif rare_event in {"near_failure", "stress_spike"}:
            self.idees_backlog.append(Idee(f"éviter {action} temporairement", "tension élevée", 0.20, 0.25, 0.90, self.tick))
        if self.etat.curiosity > 0.78:
            self.idees_backlog.append(Idee("exploration légère ciblée", "curiosité haute", 0.35, 0.40, 0.70, self.tick))
        if self._detect_stagnation():
            self.idees_backlog.append(Idee("changer d'approche", "stagnation détectée", 0.30, 0.30, 0.95, self.tick))
        self.idees_backlog = sorted(self.idees_backlog, key=lambda i: i.priorite - 0.002 * (self.tick - i.recence_tick), reverse=True)[:25]

    def _roll_rare_event(self, action: str) -> str:
        if self._rng.random() > min(0.25, 0.03 + self.etat_monde.bruit_instabilite * 0.08):
            return "none"
        event = self._rng.choice(["discovery", "near_failure", "success_major", "stress_spike", "opportunity_exceptionnelle"])
        g = self._rng.uniform(0.45, 1.0)
        if event == "discovery":
            self.etat.curiosity += 0.12 * g
        elif event == "near_failure":
            self.etat.stress += 0.14 * g
            self.etat.stability -= 0.06 * g
        elif event == "success_major":
            self.etat.stress -= 0.08 * g
            self.etat.risk_tolerance += 0.05 * g
        elif event == "stress_spike":
            self.etat.stress += 0.18 * g
        else:
            self.etat_monde.opportunites += 0.12 * g
        self.memoire.souvenirs_marquants.append(SouvenirMarquant(event, g, action, self.tick, asdict(self.etat)))
        self.etat.borner()
        self.etat_monde.borner()
        return event

    def _executer_action(self, action: str) -> Dict[str, float | bool | str]:
        p = self.monde.action_profiles[action]
        mods = self._skill_modifiers(action)
        risk = max(0.0, min(1.0, p.base_risk * mods["risk_mult"] + self.etat.stress * 0.2 - self.etat.stability * 0.1 + self.etat_monde.danger * 0.2))
        success = self._rng.random() > risk
        self.etat.energy -= p.energy_cost * mods["energy_mult"]
        self.etat.clarity -= p.clarity_cost
        self.etat.stability += p.stability_gain * (1.0 if success else 0.4)
        self.etat.curiosity += p.knowledge_gain * 0.05 + self.etat_monde.nouveaute * 0.02
        self.etat.fatigue += p.fatigue_gain
        if success:
            self.etat.stress -= 0.02
        else:
            self.etat.stress += p.stress_on_fail + self.etat_monde.danger * 0.05
        self.etat.borner()
        self._apply_action_world_effect(action, success)
        rare_event = self._roll_rare_event(action)
        self._update_idees(rare_event, action)
        return {
            "success": success,
            "observed_reward": (p.knowledge_gain + p.stability_gain) * (1.0 if success else 0.25),
            "observed_cost": (p.energy_cost * mods["energy_mult"]) + p.clarity_cost + p.fatigue_gain * 0.6,
            "risk_effective": risk,
            "rare_event": rare_event,
        }

    def _update_competence(self, action: str, success: bool) -> None:
        s = self.competences[action]
        before = s.niveau
        s.experience += 0.30 if success else 0.12
        if s.experience >= s.seuil:
            s.experience -= s.seuil
            s.niveau += 1
            s.seuil *= 1.25
        if s.niveau > before:
            self.idees_backlog.append(Idee(f"capitaliser {action}", "montée de compétence", 0.30, 0.35, 0.65, self.tick))

    def _update_memoire_long_terme(self, action: str, result: Dict[str, float | bool | str]) -> None:
        mem = self.memoire.long_terme[action]
        success = bool(result["success"])
        mem.n_total += 1
        mem.last_tick = self.tick
        if success:
            mem.n_success += 1
            mem.recent_success_streak += 1
            mem.recent_fail_streak = 0
        else:
            mem.n_fail += 1
            mem.recent_fail_streak += 1
            mem.recent_success_streak = 0
            if self.etat.stress > 0.75:
                mem.avoid_until_tick = self.tick + 40
        r = float(result["observed_reward"])
        c = float(result["observed_cost"])
        mem.ema_reward = (1 - EMA_ALPHA) * mem.ema_reward + EMA_ALPHA * r
        mem.ema_cost = (1 - EMA_ALPHA) * mem.ema_cost + EMA_ALPHA * c
        ctx = self._context_key()
        mem.contexts.setdefault(ctx, {"score": 0.0, "freq": 0.0, "gravite": 0.0})
        mem.contexts[ctx]["score"] = 0.8 * mem.contexts[ctx]["score"] + 0.2 * (r - c)
        mem.contexts[ctx]["freq"] += 1
        if result["rare_event"] != "none":
            mem.contexts[ctx]["gravite"] += 1

    def _meta_learning(self) -> None:
        w = self.memoire.court_terme[-20:]
        if not w:
            return
        fail_rate = sum(1 for e in w if not bool(e.get("success", True))) / len(w)
        avg_reward = sum(float(e.get("reward", 0.0)) for e in w) / len(w)
        rest_ratio = sum(1 for e in w if e.get("action") == "rest") / len(w)
        if fail_rate > 0.45:
            self.meta["audace"] = max(0.85, self.meta["audace"] - 0.02)
        elif fail_rate < 0.25:
            self.meta["audace"] = min(1.10, self.meta["audace"] + 0.01)
        if avg_reward < 0.05:
            self.etat.curiosity += 0.01
        if rest_ratio > 0.40:
            self.meta["diversite"] = min(1.20, self.meta["diversite"] + 0.03)
        else:
            self.meta["diversite"] = max(0.90, self.meta["diversite"] - 0.01)
        self.etat.borner()

    def _consolidation_periodique(self) -> None:
        if self.tick % CONSOLIDATION_EVERY_TICKS != 0:
            return
        w = self.action_history[-80:]
        if not w:
            return
        counts = {a: 0 for a in self.monde.actions}
        for a in w:
            counts[a] += 1
        dom = max(counts, key=counts.get)
        low = min(counts, key=counts.get)
        if dom in {"explore", "challenge"}:
            self.etat.risk_tolerance += 0.015
            self.etat.curiosity += 0.010
        if dom in {"organize", "reflect", "rest"}:
            self.etat.stability += 0.012
        if low in {"explore", "challenge"}:
            self.etat.curiosity -= 0.008
        self.memoire.souvenirs_marquants = [s for s in self.memoire.souvenirs_marquants if s.gravite >= 0.55]
        self.etat.borner()

    def _compute_dashboard(self) -> Dict[str, object]:
        w = self.memoire.court_terme[-60:]
        if not w:
            return {"fail_rate": 0.0, "action_diversity": 0, "avg_stress": self.etat.stress, "avg_energy": self.etat.energy, "top_actions": [], "top_events": []}
        fail_rate = sum(1 for e in w if not bool(e.get("success", True))) / len(w)
        actions = [str(e.get("action", "")) for e in w]
        events = [str(e.get("rare_event", "none")) for e in w if str(e.get("rare_event", "none")) != "none"]
        top_actions = sorted({a: actions.count(a) for a in set(actions)}.items(), key=lambda x: x[1], reverse=True)[:3]
        top_events = sorted({ev: events.count(ev) for ev in set(events)}.items(), key=lambda x: x[1], reverse=True)[:3]
        return {
            "fail_rate": round(fail_rate, 3),
            "action_diversity": len(set(actions)),
            "avg_stress": round(sum(float(e.get("stress", self.etat.stress)) for e in w) / len(w), 3),
            "avg_energy": round(sum(float(e.get("energy", self.etat.energy)) for e in w) / len(w), 3),
            "top_actions": top_actions,
            "top_events": top_events,
        }

    def _day_summary_if_needed(self) -> None:
        day = int(self.sim_minutes // 1440)
        if day <= self._last_day_index:
            return
        self._last_day_index = day
        dash = self._compute_dashboard()
        summary = {
            "day_index": day,
            "intentions": self.intention_active.nom if self.intention_active else "none",
            "skills": {a: self.competences[a].niveau for a in self.monde.actions},
            "dashboard": dash,
        }
        self.journal_evolutif.append(summary)
        self.dashboard_history.append(summary)

    def _human_log(self, action: str, success: bool, rare_event: str) -> str:
        cap = self.intention_active.nom if self.intention_active else "ajustement"
        if rare_event != "none":
            return f"Je poursuis '{cap}' via {action}, événement {rare_event}."
        return f"Je poursuis '{cap}' via {action} ({'succès' if success else 'échec'})."

    def _state_snapshot(self) -> Dict[str, object]:
        return {
            "tick": self.tick,
            "phase": self.sim_day_phase,
            "etat": asdict(self.etat),
            "monde": asdict(self.etat_monde),
            "intention": asdict(self.intention_active) if self.intention_active else None,
            "meta": self.meta.copy(),
        }

    # ----------------------- Contrat Brain -> LLM unique ----------------------
    def build_context_packet(self, mode: str) -> ContextPacket:
        return ContextPacket(
            etat_resume={
                "energy": round(self.etat.energy, 3),
                "stress": round(self.etat.stress, 3),
                "stability": round(self.etat.stability, 3),
                "danger": round(self.etat_monde.danger, 3),
                "phase": self.sim_day_phase,
            },
            intention={
                "nom": self.intention_active.nom if self.intention_active else None,
                "objectif": self.intention_active.objectif_lie if self.intention_active else None,
                "ttl": (self.intention_active.tick_fin - self.tick) if self.intention_active else None,
                "actions": self.intention_active.actions_preferees if self.intention_active else [],
            },
            objectifs=[o.name for o in self._active_objectifs()],
            derniers_evenements=self.memoire.court_terme[-8:],
            backlog_idees=[asdict(i) for i in self.idees_backlog[:8]],
            relation_style="coopératif-prudent",
            mode="realtime" if mode == "realtime" else "reflexion",
        )

    def _validate_llm_commands(self, commands: List[Dict[str, object]]) -> List[Dict[str, object]]:
        allowed = {"GET_STATE", "PROPOSE", "SET_INTENTION", "PAUSE", "RESUME"}
        validated: List[Dict[str, object]] = []
        for c in commands:
            cmd = str(c.get("cmd", ""))
            if cmd not in allowed:
                continue
            if cmd == "SET_INTENTION" and "value" not in c:
                continue
            validated.append(c)
        return validated

    def ask_llm(self, prompt: str, mode: str | None = None) -> LLMResult:
        if not self.permissions.autorise("llm", self.tick):
            return LLMResult("Permission LLM refusée.", [], {"latency_ms": 0.0, "error": "permission"})
        use_mode = mode if mode in {"realtime", "reflexion"} else self.model_router.current_mode
        self.model_router.set_mode(use_mode)  # type: ignore[arg-type]
        packet = self.build_context_packet(use_mode)
        result = self.model_router.generate(prompt, use_mode, constraints={"max_commands": 3}, context=packet)  # type: ignore[arg-type]
        result.commands = self._validate_llm_commands(result.commands)
        self.llm_last_result = {"text": result.text, "commands": result.commands, "meta": result.meta}
        return result

    def boucle_de_vie(self) -> str:
        if self.is_paused:
            return "Boucle en pause."
        self.contrainte_locale.verifier()
        if not self.permissions.autorise("simulate", self.tick):
            return "Action refusée par permissions."

        self._tick_time_update()
        self._evolve_world()
        self._passive_recovery()
        before = self._state_snapshot()

        action = self.choisir_action()
        result = self._executer_action(action)

        self.last_action_tick[action] = self.tick
        self.action_history.append(action)
        self.memoire.routines[action][self.sim_day_phase] += 1
        self._update_competence(action, bool(result["success"]))
        self._update_memoire_long_terme(action, result)

        evt = {
            "tick": self.tick,
            "action": action,
            "success": bool(result["success"]),
            "reward": float(result["observed_reward"]),
            "cost": float(result["observed_cost"]),
            "rare_event": str(result["rare_event"]),
            "stress": self.etat.stress,
            "energy": self.etat.energy,
        }
        self.memoire.enregistrer_evenement(evt)

        self._meta_learning()
        self._consolidation_periodique()
        self._day_summary_if_needed()

        if result["rare_event"] in {"near_failure", "stress_spike", "success_major"}:
            self.intention_active = None

        if self.tick % AUTOSAVE_EVERY_TICKS == 0:
            self.save_snapshot(self.default_snapshot_path)

        human = self._human_log(action, bool(result["success"]), str(result["rare_event"]))
        self.journal_humain.append(human)
        self.journal_debug.append({"tick": self.tick, "before": before, "after": self._state_snapshot(), "result": result})
        return human

    def snapshot_dict(self) -> Dict[str, object]:
        return {
            "version": SNAPSHOT_VERSION,
            "tick": self.tick,
            "sim_minutes": self.sim_minutes,
            "etat": asdict(self.etat),
            "monde": asdict(self.etat_monde),
            "meta": self.meta,
            "competences": {k: asdict(v) for k, v in self.competences.items()},
            "memoire": {
                "court_terme": self.memoire.court_terme,
                "long_terme": {k: asdict(v) for k, v in self.memoire.long_terme.items()},
                "souvenirs_marquants": [asdict(s) for s in self.memoire.souvenirs_marquants],
                "routines": self.memoire.routines,
            },
            "intention_active": asdict(self.intention_active) if self.intention_active else None,
            "idees_backlog": [asdict(i) for i in self.idees_backlog],
            "router": {
                "auto_mode": self.model_router.auto_mode,
                "forced_model_key": self.model_router.forced_model_key,
                "current_mode": self.model_router.current_mode,
                "keep_warm": self.model_router.keep_warm,
            },
        }

    def save_snapshot(self, path: str) -> None:
        if not self.permissions.autorise("snapshot", self.tick):
            return
        p = Path(path)
        backup = p.with_suffix(p.suffix + ".bak")
        payload = json.dumps(self.snapshot_dict(), ensure_ascii=False, indent=2)
        if p.exists():
            backup.write_text(p.read_text(encoding="utf-8"), encoding="utf-8")
        p.write_text(payload, encoding="utf-8")
        backup.write_text(payload, encoding="utf-8")

    def load_snapshot(self, path: str) -> bool:
        p = Path(path)
        backup = p.with_suffix(p.suffix + ".bak")
        try:
            data = json.loads(p.read_text(encoding="utf-8"))
            if int(data.get("version", -1)) != SNAPSHOT_VERSION:
                raise ValueError("version snapshot incompatible")
        except Exception:
            if not backup.exists():
                return False
            try:
                data = json.loads(backup.read_text(encoding="utf-8"))
                if int(data.get("version", -1)) != SNAPSHOT_VERSION:
                    return False
            except Exception:
                return False

        self.tick = int(data["tick"])
        self.sim_minutes = float(data["sim_minutes"])
        self.sim_day_minutes = self.sim_minutes % 1440.0
        self.sim_day_phase = self._compute_sim_day_phase()
        self.etat = EtatInterne(**data["etat"])
        self.etat_monde = EtatMonde(**data["monde"])
        self.meta = dict(data["meta"])
        self.competences = {k: Competence(**v) for k, v in data["competences"].items()}
        self.memoire.court_terme = list(data["memoire"]["court_terme"])
        self.memoire.long_terme = {k: MemoireAction(**v) for k, v in data["memoire"]["long_terme"].items()}
        self.memoire.souvenirs_marquants = [SouvenirMarquant(**s) for s in data["memoire"]["souvenirs_marquants"]]
        self.memoire.routines = {k: dict(v) for k, v in data["memoire"]["routines"].items()}
        self.idees_backlog = [Idee(**i) for i in data.get("idees_backlog", [])]
        intent = data.get("intention_active")
        self.intention_active = IntentionActive(**intent) if intent else None

        router = data.get("router", {})
        self.model_router.auto_mode = bool(router.get("auto_mode", True))
        self.model_router.forced_model_key = router.get("forced_model_key")
        self.model_router.current_mode = router.get("current_mode", "realtime")
        self.model_router.keep_warm = bool(router.get("keep_warm", True))
        return True

    def handle_cli(self, commande: str) -> str:
        c = commande.strip().lower()
        if c == "etat":
            return f"tick={self.tick}, phase={self.sim_day_phase}, intention={self.intention_active.nom if self.intention_active else 'none'}, energy={self.etat.energy:.2f}, stress={self.etat.stress:.2f}, danger={self.etat_monde.danger:.2f}"
        if c == "resume":
            return str(self.journal_evolutif[-1]) if self.journal_evolutif else "Pas encore de journée simulée complète."
        if c == "idees":
            return "; ".join(i.intitule for i in self.idees_backlog[:5]) if self.idees_backlog else "Aucune idée en attente."
        if c == "propose":
            return f"Je veux faire: {self.choisir_action()} (intention={self.intention_active.nom if self.intention_active else 'none'})."
        if c.startswith("suggere "):
            payload = c.replace("suggere ", "", 1).strip()
            if payload in self.monde.actions:
                if self.intention_active and payload in self.intention_active.actions_preferees:
                    return "Oui, suggestion acceptée: cohérente avec mon intention."
                return "Non, suggestion refusée: pas cohérente avec ma priorité actuelle."
            return "Non, suggestion inconnue."
        if c == "pause":
            self.is_paused = True
            return "Boucle mise en pause."
        if c == "reprendre":
            self.is_paused = False
            return "Boucle reprise."

        # Contrôles router/modèles (UI texte).
        if c == "model status":
            return str(self.model_router.status())
        if c == "model auto":
            self.model_router.set_auto(True)
            return "Sélection modèle: AUTO activé."
        if c.startswith("model set "):
            key = c.replace("model set ", "", 1).strip()
            ok = self.model_router.force_model(key)
            return "Modèle forcé." if ok else "Modèle inconnu."
        if c == "mode realtime":
            self.model_router.set_mode("realtime")
            return "Mode inference: realtime."
        if c == "mode reflexion":
            self.model_router.set_mode("reflexion")
            return "Mode inference: reflexion."
        if c == "llm ask":
            res = self.ask_llm("etat et proposition", self.model_router.current_mode)
            return f"LLM[{res.meta.get('model')}]: {res.text}"
        if c == "bench":
            return str(quick_eval_harness(self.model_router))

        return "Commande non reconnue."
