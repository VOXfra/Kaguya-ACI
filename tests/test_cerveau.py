"""Tests du moteur Kaguya + couche LLM registry/router."""

from pathlib import Path

from kaguya.cerveau import CerveauKaguya, SIM_MIN_PER_TICK, SNAPSHOT_VERSION
from kaguya.llm import ContextPacket, ModelRegistry, ModelRouter, quick_eval_harness
from kaguya.server import ChatService, maybe_start_lmstudio, lmstudio_is_ready
from kaguya.cli import run_cli_once


def test_temps_interne_progresse_par_tick():
    c = CerveauKaguya(seed=7)
    c.boucle_de_vie()
    assert c.tick == 1
    assert c.sim_minutes == SIM_MIN_PER_TICK


def test_intention_active_est_definie_et_guide_les_actions():
    c = CerveauKaguya(seed=2)
    c.boucle_de_vie()
    assert c.intention_active is not None
    preferred = set(c.intention_active.actions_preferees)
    action = c.choisir_action()
    assert action in preferred


def test_backlog_idees_naissance_evenement_ou_stagnation():
    c = CerveauKaguya(seed=9)
    for _ in range(220):
        c.boucle_de_vie()
    assert isinstance(c.idees_backlog, list)


def test_anti_loop_applique_malus_et_cooldown():
    c = CerveauKaguya(seed=6)
    c.action_history = ["rest"] * 30
    p = c._anti_loop_penalty("rest")
    assert p >= 0.30
    assert c.cooldowns["rest"] > c.tick


def test_permissions_refusent_capacite_sensible():
    c = CerveauKaguya(seed=1)
    assert c.permissions.autorise("network", c.tick) is False
    assert len(c.permissions.refus_log) >= 1


def test_snapshot_save_load_avec_rollback(tmp_path):
    c = CerveauKaguya(seed=4)
    for _ in range(20):
        c.boucle_de_vie()
    snap = tmp_path / "snap.json"
    c.save_snapshot(str(snap))
    assert c.snapshot_dict()["version"] == SNAPSHOT_VERSION

    snap.write_text("{corrompu", encoding="utf-8")
    assert c.load_snapshot(str(snap)) is True


def test_cli_commandes_minimales():
    c = CerveauKaguya(seed=3)
    c.boucle_de_vie()
    assert "tick=" in c.handle_cli("etat")
    assert "Je veux faire:" in c.handle_cli("propose")
    assert isinstance(c.handle_cli("idees"), str)
    assert "pause" in c.handle_cli("pause").lower()
    assert "reprise" in c.handle_cli("reprendre").lower()


def test_cli_suggere_accepte_ou_refuse():
    c = CerveauKaguya(seed=10)
    c.boucle_de_vie()
    rep = c.handle_cli("suggere rest")
    assert rep.startswith("Oui") or rep.startswith("Non")


def test_journal_evolutif_et_dashboard_apres_un_jour_simule():
    c = CerveauKaguya(seed=8)
    for _ in range(290):
        c.boucle_de_vie()
    assert len(c.journal_evolutif) >= 1
    assert len(c.dashboard_history) >= 1
    dash = c.dashboard_history[-1]["dashboard"]
    assert "fail_rate" in dash
    assert "top_actions" in dash
    assert "top_events" in dash


def test_model_registry_router_et_harness():
    reg = ModelRegistry.default()
    router = ModelRouter(registry=reg)
    ctx = ContextPacket({}, {"nom": None}, [], [], [], "neutre", "realtime")
    r = router.generate("etat", "realtime", {}, ctx)
    assert isinstance(r.text, str)
    assert "latency_ms" in r.meta
    status = router.status()
    assert "active_model" in status
    bench = quick_eval_harness(router)
    assert len(bench["tests"]) == 5


def test_brain_llm_contract_and_cli_model_controls():
    c = CerveauKaguya(seed=11)
    c.boucle_de_vie()
    packet = c.build_context_packet("realtime")
    assert packet.mode == "realtime"
    rr = c.ask_llm("etat")
    assert isinstance(rr.text, str)
    assert isinstance(rr.commands, list)
    assert "auto_mode" in c.handle_cli("model status")
    assert "AUTO" in c.handle_cli("model auto")


def test_docs_et_requirements_presents():
    assert Path("requirements.txt").exists()
    r = Path("README.md").read_text(encoding="utf-8")
    assert "## Utilisation pas à pas" in r
    assert "## Architecture du cerveau" in r


def test_chat_service_allows_local_discussion():
    service = ChatService()
    payload = service.handle_message("etat", mode="realtime")
    assert "reply" in payload
    assert "state" in payload
    assert payload["state"]["tick"] >= 1


def test_cli_run_once_sans_coder():
    c = CerveauKaguya(seed=12)
    out = run_cli_once(c, "etat")
    assert "tick=" in out
    out2 = run_cli_once(c, "chat etat")
    assert isinstance(out2, str)


def test_registry_contains_lmstudio_model():
    reg = ModelRegistry.default()
    assert "lmstudio-active" in reg.models


def test_router_fallback_if_lmstudio_unavailable():
    reg = ModelRegistry.default()
    router = ModelRouter(registry=reg)
    ctx = ContextPacket({}, {"nom": None}, [], [], [], "neutre", "realtime")
    res = router.generate("etat", "realtime", {}, ctx)
    assert isinstance(res.text, str)
    assert "model" in res.meta


def test_server_reports_lmstudio_not_started_without_flag():
    ok, msg = maybe_start_lmstudio(False, None)
    assert ok is False or ok is True
    assert isinstance(msg, str)


def test_chat_service_slash_command_optional():
    service = ChatService()
    before_tick = service.cerveau.tick
    payload = service.handle_message("/etat", mode="realtime")
    assert payload["meta"]["mode"] == "slash"
    assert "tick=" in payload["reply"]
    # Commande de pilotage: pas d'avancement de boucle conversationnelle.
    assert service.cerveau.tick == before_tick


def test_chat_service_normal_message_still_conversational():
    service = ChatService()
    payload = service.handle_message("bonjour", mode="realtime")
    assert "reply" in payload
    assert payload["state"]["tick"] >= 1


def test_lmstudio_ready_probe_returns_bool():
    assert isinstance(lmstudio_is_ready(), bool)
