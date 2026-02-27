"""Couche LLM abstraite pour Kaguya.

Objectifs :
- registre déclaratif des modèles,
- interface unique d'inférence,
- routing auto/manuel + fallback,
- profils realtime/réflexion,
- contrat stable context packet / dual output,
- mini-bench interne (5 prompts fixes).
"""

from __future__ import annotations

from dataclasses import dataclass, field
import time
from typing import Dict, List, Literal, Protocol

ModeInference = Literal["realtime", "reflexion"]


@dataclass
class ModelProfile:
    context_length: int
    quant: str
    threads: int
    gpu_layers: int
    temperature: float
    top_p: float


@dataclass
class ModelSpec:
    display_name: str
    model_path: str
    runtime_type: str
    default_profile: ModelProfile
    tags: List[str]


@dataclass
class ContextPacket:
    etat_resume: Dict[str, float | str]
    intention: Dict[str, str | int | list[str] | None]
    objectifs: List[str]
    derniers_evenements: List[Dict[str, object]]
    backlog_idees: List[Dict[str, object]]
    relation_style: str
    mode: ModeInference


@dataclass
class LLMResult:
    text: str
    commands: List[Dict[str, object]]
    meta: Dict[str, object]


class LLMEngine(Protocol):
    def generate(self, prompt: str, mode: ModeInference, constraints: Dict[str, object], context: ContextPacket) -> LLMResult:
        ...


class MockLLMEngine:
    """Moteur mock local pour tests/unités sans dépendance externe."""

    def __init__(self, model_name: str) -> None:
        self.model_name = model_name

    def generate(self, prompt: str, mode: ModeInference, constraints: Dict[str, object], context: ContextPacket) -> LLMResult:
        start = time.perf_counter()

        short = mode == "realtime"
        msg = "Je propose une action prudente alignée sur ton état." if short else "Je propose un plan structuré en plusieurs étapes, avec prudence et continuité."
        commands: List[Dict[str, object]] = [{"cmd": "PROPOSE"}]

        lower = prompt.lower()
        if "etat" in lower:
            commands = [{"cmd": "GET_STATE"}]
        if "intention" in lower:
            commands = [{"cmd": "SET_INTENTION", "value": "stabiliser"}]
        if "pause" in lower:
            commands = [{"cmd": "PAUSE"}]
        if "reprendre" in lower:
            commands = [{"cmd": "RESUME"}]

        elapsed = (time.perf_counter() - start) * 1000
        return LLMResult(
            text=msg,
            commands=commands,
            meta={
                "latency_ms": round(elapsed, 3),
                "input_tokens": max(1, len(prompt) // 4),
                "output_tokens": max(1, len(msg) // 4),
                "model": self.model_name,
                "error": None,
            },
        )


@dataclass
class ModelRegistry:
    models: Dict[str, ModelSpec]

    @classmethod
    def default(cls) -> "ModelRegistry":
        return cls(
            models={
                "qwen2.5-14b": ModelSpec(
                    display_name="Qwen2.5 14B",
                    model_path="models/qwen2.5-14b.gguf",
                    runtime_type="GGUF",
                    default_profile=ModelProfile(4096, "Q4_K_M", 8, 20, 0.5, 0.9),
                    tags=["realtime", "rapide"],
                ),
                "qwen3.5-35b-a3b": ModelSpec(
                    display_name="Qwen3.5 35B A3B",
                    model_path="models/qwen3.5-35b-a3b.gguf",
                    runtime_type="GGUF",
                    default_profile=ModelProfile(8192, "Q4_K_M", 12, 40, 0.6, 0.95),
                    tags=["qualite", "reflexion"],
                ),
            }
        )


@dataclass
class ModelRouter:
    registry: ModelRegistry
    auto_mode: bool = True
    forced_model_key: str | None = None
    current_mode: ModeInference = "realtime"
    keep_warm: bool = True
    loaded_engines: Dict[str, LLMEngine] = field(default_factory=dict)
    active_model_key: str | None = None
    latency_history: List[float] = field(default_factory=list)

    def set_mode(self, mode: ModeInference) -> None:
        self.current_mode = mode

    def set_auto(self, enabled: bool) -> None:
        self.auto_mode = enabled
        if enabled:
            self.forced_model_key = None

    def force_model(self, key: str) -> bool:
        if key not in self.registry.models:
            return False
        self.auto_mode = False
        self.forced_model_key = key
        return True

    def choose_model_key(self, mode: ModeInference) -> str:
        if not self.auto_mode and self.forced_model_key:
            return self.forced_model_key
        if mode == "realtime":
            return "qwen2.5-14b"
        return "qwen3.5-35b-a3b"

    def _load_engine(self, key: str) -> LLMEngine:
        if key not in self.loaded_engines:
            self.loaded_engines[key] = MockLLMEngine(key)
        self.active_model_key = key
        if not self.keep_warm:
            for k in list(self.loaded_engines.keys()):
                if k != key:
                    del self.loaded_engines[k]
        return self.loaded_engines[key]

    def _fallback_key(self) -> str:
        return "qwen2.5-14b"

    def generate(self, prompt: str, mode: ModeInference, constraints: Dict[str, object], context: ContextPacket) -> LLMResult:
        target = self.choose_model_key(mode)
        engine = self._load_engine(target)
        try:
            result = engine.generate(prompt, mode, constraints, context)
        except Exception as e:  # fallback robuste runtime
            fallback = self._fallback_key()
            engine = self._load_engine(fallback)
            result = engine.generate(prompt, "realtime", constraints, context)
            result.meta["error"] = f"fallback:{e}"

        self.latency_history.append(float(result.meta.get("latency_ms", 0.0)))
        if len(self.latency_history) > 200:
            self.latency_history.pop(0)
        return result

    def status(self) -> Dict[str, object]:
        avg = sum(self.latency_history) / len(self.latency_history) if self.latency_history else 0.0
        active = self.active_model_key
        spec = self.registry.models.get(active) if active else None
        return {
            "auto_mode": self.auto_mode,
            "mode": self.current_mode,
            "active_model": spec.display_name if spec else "none",
            "runtime_loaded": list(self.loaded_engines.keys()),
            "estimated_vram_status": "ok" if active else "idle",
            "avg_latency_ms": round(avg, 3),
        }


@dataclass
class QuickEvalResult:
    prompt: str
    latency_ms: float
    length: int
    coherence: float


def quick_eval_harness(router: ModelRouter) -> Dict[str, object]:
    """Exécute 5 tests fixes pour évaluer rapidement les profils."""
    prompts = [
        "refus naturel",
        "négociation de risque",
        "résumé journal",
        "proposition d'idée",
        "maintien personnalité",
    ]
    rows: List[QuickEvalResult] = []
    dummy_ctx = ContextPacket({}, {"nom": None}, [], [], [], "neutre", router.current_mode)
    for p in prompts:
        r = router.generate(p, router.current_mode, {}, dummy_ctx)
        text = r.text
        coherence = 1.0 if text and isinstance(text, str) else 0.0
        rows.append(QuickEvalResult(p, float(r.meta.get("latency_ms", 0.0)), len(text), coherence))

    return {
        "tests": [asdict_like(x) for x in rows],
        "avg_latency_ms": round(sum(x.latency_ms for x in rows) / len(rows), 3),
        "avg_length": round(sum(x.length for x in rows) / len(rows), 2),
        "avg_coherence": round(sum(x.coherence for x in rows) / len(rows), 3),
    }


def asdict_like(row: QuickEvalResult) -> Dict[str, object]:
    return {
        "prompt": row.prompt,
        "latency_ms": row.latency_ms,
        "length": row.length,
        "coherence": row.coherence,
    }
