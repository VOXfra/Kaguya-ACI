"""Tests du moteur décisionnel de Kaguya.

Ces tests décrivent le comportement attendu avant l'implémentation.
"""

from pathlib import Path

from kaguya.cerveau import ActionMonde, CerveauKaguya, MondeSimule


def test_cycle_de_vie_ecrit_un_journal_et_met_a_jour_l_etat():
    monde = MondeSimule(actions=[
        ActionMonde(nom="explorer", cout_energie=15.0, risque=0.2, gain_connaissance=8.0, gain_competence=3.0),
        ActionMonde(nom="se_reposer", cout_energie=-20.0, risque=0.05, gain_connaissance=1.0, gain_competence=0.0),
    ])

    cerveau = CerveauKaguya(seed=7)

    entree = cerveau.boucle_de_vie(monde)

    assert isinstance(entree, str)
    assert "Action:" in entree
    assert "Pourquoi:" in entree
    assert len(cerveau.memoire.court_terme) == 1
    assert len(cerveau.journal) == 1


def test_le_repos_est_prioritaire_si_energie_trop_basse():
    monde = MondeSimule(actions=[
        ActionMonde(nom="explorer", cout_energie=20.0, risque=0.2, gain_connaissance=10.0, gain_competence=5.0),
        ActionMonde(nom="se_reposer", cout_energie=-25.0, risque=0.01, gain_connaissance=0.0, gain_competence=0.0),
    ])

    cerveau = CerveauKaguya(seed=4)
    cerveau.etat.energie = 15.0

    decision = cerveau.choisir_action(monde)

    assert decision.nom == "se_reposer"


def test_la_memoire_long_terme_synthese_les_experiences():
    monde = MondeSimule(actions=[
        ActionMonde(nom="s_entrainer", cout_energie=10.0, risque=0.1, gain_connaissance=2.0, gain_competence=7.0),
    ])
    cerveau = CerveauKaguya(seed=1)

    for _ in range(6):
        cerveau.boucle_de_vie(monde)

    assert "s_entrainer" in cerveau.memoire.long_terme
    resume = cerveau.memoire.long_terme["s_entrainer"]
    assert resume["essais"] >= 6


def test_kaguya_force_une_execution_hors_ligne_stricte():
    """Valide explicitement la contrainte locale sans API externe."""
    cerveau = CerveauKaguya(seed=2)

    assert cerveau.contrainte_locale.hors_ligne_strict is True
    assert cerveau.contrainte_locale.api_externe_autorisee is False


def test_un_requirements_est_present_pour_l_execution_locale():
    """Vérifie qu'un fichier requirements est bien fourni."""
    assert Path("requirements.txt").exists()


def test_readme_decrit_l_utilisation_pas_a_pas():
    """Valide la présence d'un README riche et orienté usage."""
    contenu = Path("README.md").read_text(encoding="utf-8")
    assert "# Kaguya" in contenu
    assert "## Installation" in contenu
    assert "## Utilisation pas à pas" in contenu
    assert "## Architecture du cerveau" in contenu
    assert "## Journal de bord" in contenu
