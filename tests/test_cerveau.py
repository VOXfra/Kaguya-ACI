"""Tests du moteur décisionnel de Kaguya (version tick interne)."""

from pathlib import Path

from kaguya.cerveau import CerveauKaguya, SIM_MIN_PER_TICK


def test_temps_interne_progresse_par_tick():
    cerveau = CerveauKaguya(seed=7)

    cerveau.boucle_de_vie()

    assert cerveau.tick == 1
    assert cerveau.sim_minutes == SIM_MIN_PER_TICK
    assert 0.0 <= cerveau.sim_day_minutes < 1440.0
    assert cerveau.sim_day_phase in {"night", "morning", "day", "evening"}


def test_recovery_night_booste_energie_et_reduit_fatigue():
    cerveau = CerveauKaguya(seed=1)
    cerveau.sim_minutes = 0.0
    cerveau.sim_day_minutes = 0.0
    cerveau.sim_day_phase = "night"
    cerveau.pc_day_phase = "night"

    before_energy = cerveau.etat.energy
    before_fatigue = cerveau.etat.fatigue

    cerveau._passive_recovery()

    assert cerveau.etat.energy > before_energy
    assert cerveau.etat.fatigue < before_fatigue


def test_actions_fixes_sont_presentes():
    cerveau = CerveauKaguya(seed=2)
    assert set(cerveau.monde.actions) == {
        "rest",
        "organize",
        "practice",
        "explore",
        "reflect",
        "idle",
        "challenge",
    }


def test_objectif_recover_active_si_energie_basse():
    cerveau = CerveauKaguya(seed=3)
    cerveau.etat.energy = 0.20
    actifs = [o.name for o in cerveau._active_objectifs()]
    assert "Recover" in actifs


def test_gating_energie_critique_limite_les_actions():
    cerveau = CerveauKaguya(seed=4)
    cerveau.etat.energy = 0.10
    candidats = cerveau._gated_actions()
    assert set(candidats).issubset({"rest", "idle", "reflect"})


def test_memoire_long_terme_met_a_jour_ema_et_compteurs():
    cerveau = CerveauKaguya(seed=5)

    for _ in range(8):
        cerveau.boucle_de_vie()

    mem = cerveau.memoire.long_terme
    assert any(m.n_total > 0 for m in mem.values())
    assert any((m.ema_reward != 0.0 or m.ema_cost != 0.0) for m in mem.values())


def test_double_journal_est_produit():
    cerveau = CerveauKaguya(seed=6)

    human = cerveau.boucle_de_vie()

    assert isinstance(human, str)
    assert len(cerveau.journal_humain) == 1
    assert len(cerveau.journal_debug) >= 2


def test_contrainte_hors_ligne_stricte_est_active():
    cerveau = CerveauKaguya(seed=2)

    assert cerveau.contrainte_locale.hors_ligne_strict is True
    assert cerveau.contrainte_locale.api_externe_autorisee is False


def test_fichiers_documentation_et_requirements_sont_presents():
    assert Path("requirements.txt").exists()
    contenu = Path("README.md").read_text(encoding="utf-8")
    assert "## Installation" in contenu
    assert "## Utilisation pas à pas" in contenu
    assert "## Architecture du cerveau" in contenu
