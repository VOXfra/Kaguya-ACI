"""CLI utilisateur pour dialoguer avec Kaguya sans écrire de code Python."""

from __future__ import annotations

import argparse

from kaguya.cerveau import CerveauKaguya


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="CLI Kaguya (local/hors-ligne)")
    parser.add_argument("--seed", type=int, default=42, help="Seed pour reproductibilité")
    parser.add_argument("--snapshot", type=str, default=None, help="Chemin snapshot à charger au démarrage")
    parser.add_argument("--once", type=str, default=None, help="Exécuter une commande unique puis quitter")
    return parser


def run_cli_once(cerveau: CerveauKaguya, commande: str) -> str:
    """Exécute une commande CLI unique."""
    if commande == "tick":
        return cerveau.boucle_de_vie()
    if commande.startswith("chat "):
        prompt = commande.replace("chat ", "", 1).strip()
        res = cerveau.ask_llm(prompt)
        return res.text
    if commande.startswith("save "):
        path = commande.replace("save ", "", 1).strip()
        cerveau.save_snapshot(path)
        return f"snapshot sauvegardé: {path}"
    if commande.startswith("load "):
        path = commande.replace("load ", "", 1).strip()
        ok = cerveau.load_snapshot(path)
        return f"snapshot chargé: {ok}"
    return cerveau.handle_cli(commande)


def run_interactive(args: argparse.Namespace) -> None:
    """Boucle interactive locale."""
    cerveau = CerveauKaguya(seed=args.seed, autoload_snapshot=args.snapshot)

    if args.once:
        print(run_cli_once(cerveau, args.once))
        return

    print("Kaguya CLI prête. Commandes: etat, propose, idees, resume, suggere <action>, pause, reprendre, tick, chat <texte>, save <fichier>, load <fichier>, quit")
    while True:
        try:
            cmd = input("kaguya> ").strip()
        except EOFError:
            break
        if not cmd:
            continue
        if cmd in {"quit", "exit"}:
            break
        out = run_cli_once(cerveau, cmd)
        print(out)


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    run_interactive(args)


if __name__ == "__main__":
    main()
