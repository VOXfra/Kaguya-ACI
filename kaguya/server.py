"""Serveur HTTP local pour discuter avec Kaguya.

Usage:
    python -m kaguya.server --port 1235

Notes:
- Kaguya web écoute par défaut sur http://127.0.0.1:1235.
- LM Studio utilise souvent http://127.0.0.1:1234.
"""

from __future__ import annotations

from dataclasses import asdict
import argparse
import json
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import os
import shlex
import subprocess
import time
from typing import Any, Dict
from urllib import error as urlerror
from urllib import request as urlrequest

from kaguya.cerveau import CerveauKaguya


def lmstudio_is_ready(endpoint_base: str = "http://127.0.0.1:1234") -> bool:
    """Teste rapidement si LM Studio répond à l'API locale."""
    try:
        with urlrequest.urlopen(f"{endpoint_base.rstrip('/')}/v1/models", timeout=0.6) as resp:
            return resp.status == 200
    except Exception:
        return False


def maybe_start_lmstudio(start: bool, lmstudio_cmd: str | None, wait_s: float = 8.0) -> tuple[bool, str]:
    """Démarre LM Studio si demandé et possible.

    Retourne (started_or_ready, message).
    """
    if lmstudio_is_ready():
        return True, "LM Studio déjà actif sur 127.0.0.1:1234"

    if not start:
        return False, "LM Studio non démarré automatiquement (utiliser --start-lmstudio)"

    # Commande par défaut : CLI LM Studio si installée.
    cmd = lmstudio_cmd or os.environ.get("KAGUYA_LMSTUDIO_CMD") or "lms server start"

    try:
        subprocess.Popen(shlex.split(cmd), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception as e:
        return False, f"Impossible de lancer LM Studio: {e}"

    deadline = time.time() + wait_s
    while time.time() < deadline:
        if lmstudio_is_ready():
            return True, f"LM Studio lancé via: {cmd}"
        time.sleep(0.25)

    return False, f"LM Studio non prêt après lancement (cmd='{cmd}')"


class ChatService:
    """Service applicatif de discussion (état en mémoire)."""

    def __init__(self) -> None:
        self.cerveau = CerveauKaguya(seed=42)
        self.history: list[dict[str, Any]] = []

    def state_payload(self) -> Dict[str, Any]:
        """Retourne un état lisible pour inspection côté UI/API."""
        return {
            "tick": self.cerveau.tick,
            "phase": self.cerveau.sim_day_phase,
            "intention": asdict(self.cerveau.intention_active) if self.cerveau.intention_active else None,
            "etat": asdict(self.cerveau.etat),
            "monde": asdict(self.cerveau.etat_monde),
            "router": self.cerveau.model_router.status(),
            "ideas": [asdict(i) for i in self.cerveau.idees_backlog[:5]],
            "lmstudio_ready": lmstudio_is_ready(),
        }

    def _apply_command(self, cmd: dict[str, Any]) -> None:
        name = cmd.get("cmd")
        if name == "PAUSE":
            self.cerveau.is_paused = True
        elif name == "RESUME":
            self.cerveau.is_paused = False

    def _run_slash_command(self, raw_message: str) -> Dict[str, Any] | None:
        """Exécute une commande slash optionnelle (`/etat`, `/resume`, etc.)."""
        if not raw_message.startswith("/"):
            return None

        # On retire le slash initial et on réutilise la CLI interne du cerveau.
        command = raw_message[1:].strip()
        if not command:
            return {
                "reply": "Commande vide. Exemple: /etat",
                "commands": [],
                "meta": {"mode": "slash", "error": "empty_command"},
                "tick_log": "",
                "state": self.state_payload(),
            }

        # Certaines commandes doivent rester conversationnelles via LLM.
        if command.startswith("chat "):
            prompt = command.replace("chat ", "", 1).strip()
            llm_result = self.cerveau.ask_llm(prompt, "realtime")
            return {
                "reply": llm_result.text,
                "commands": llm_result.commands,
                "meta": {**llm_result.meta, "mode": "slash"},
                "tick_log": "",
                "state": self.state_payload(),
            }

        reply = self.cerveau.handle_cli(command)
        return {
            "reply": reply,
            "commands": [],
            "meta": {"mode": "slash", "error": None},
            "tick_log": "",
            "state": self.state_payload(),
        }

    def handle_message(self, message: str, mode: str = "realtime") -> Dict[str, Any]:
        """Traite un message utilisateur et renvoie une réponse structurée."""
        # Les slash commands sont optionnelles et évitent de mélanger discussion + pilotage.
        slash_payload = self._run_slash_command(message)
        if slash_payload is not None:
            self.history.append({"user": message, "assistant": slash_payload["reply"], "tick": self.cerveau.tick})
            return slash_payload

        tick_log = self.cerveau.boucle_de_vie()
        llm_result = self.cerveau.ask_llm(message, mode)

        for cmd in llm_result.commands:
            self._apply_command(cmd)

        payload = {
            "reply": llm_result.text,
            "commands": llm_result.commands,
            "meta": llm_result.meta,
            "tick_log": tick_log,
            "state": self.state_payload(),
        }
        self.history.append({"user": message, "assistant": payload["reply"], "tick": self.cerveau.tick})
        return payload


HTML_PAGE = """<!doctype html>
<html lang='fr'>
<head><meta charset='utf-8'><title>Kaguya Chat</title></head>
<body>
<h1>Kaguya — Discussion locale</h1>
<p>Serveur Kaguya: <code>127.0.0.1:1235</code></p>
<p>LM Studio attendu: <code>127.0.0.1:1234</code></p>
<div id='chat' style='white-space:pre-wrap;border:1px solid #ccc;padding:8px;height:300px;overflow:auto'></div>
<input id='msg' style='width:70%' placeholder='Écris un message... (/etat, /resume, /pause...)'/>
<select id='mode'><option value='realtime'>realtime</option><option value='reflexion'>reflexion</option></select>
<button onclick='sendMsg()'>Envoyer</button>
<script>
async function sendMsg(){
  const m=document.getElementById('msg').value;
  const mode=document.getElementById('mode').value;
  const res=await fetch('/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:m,mode})});
  const data=await res.json();
  const box=document.getElementById('chat');
  const err = data.meta && data.meta.error ? ' [fallback='+data.meta.error+']' : '';
  box.textContent += '\nToi: '+m+'\nKaguya: '+data.reply+err+'\n';
  document.getElementById('msg').value='';
}
</script>
</body></html>"""


def make_handler(service: ChatService):
    class Handler(BaseHTTPRequestHandler):
        def _send_json(self, payload: Dict[str, Any], code: int = 200) -> None:
            body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            self.send_response(code)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self) -> None:  # noqa: N802
            if self.path == "/":
                data = HTML_PAGE.encode("utf-8")
                self.send_response(HTTPStatus.OK)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)
                return
            if self.path == "/state":
                self._send_json(service.state_payload())
                return
            self._send_json({"error": "not_found"}, 404)

        def do_POST(self) -> None:  # noqa: N802
            if self.path != "/chat":
                self._send_json({"error": "not_found"}, 404)
                return
            length = int(self.headers.get("Content-Length", "0"))
            raw = self.rfile.read(length) if length else b"{}"
            try:
                data = json.loads(raw.decode("utf-8"))
                message = str(data.get("message", "")).strip()
                mode = str(data.get("mode", "realtime"))
            except Exception:
                self._send_json({"error": "invalid_json"}, 400)
                return
            if not message:
                self._send_json({"error": "message_required"}, 400)
                return
            self._send_json(service.handle_message(message, mode))

        def log_message(self, format: str, *args: Any) -> None:
            return

    return Handler


def run_server(host: str = "127.0.0.1", port: int = 1235, start_lmstudio: bool = False, lmstudio_cmd: str | None = None) -> None:
    ok, msg = maybe_start_lmstudio(start_lmstudio, lmstudio_cmd)
    print(msg)
    if not ok:
        print("Kaguya continue en mode fallback local si LM Studio indisponible.")

    service = ChatService()
    server = ThreadingHTTPServer((host, port), make_handler(service))
    print(f"Kaguya server running on http://{host}:{port}")
    server.serve_forever()


def main() -> None:
    parser = argparse.ArgumentParser(description="Serveur local Kaguya")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=1235)
    parser.add_argument("--start-lmstudio", action="store_true", help="Tente de démarrer LM Studio automatiquement")
    parser.add_argument("--lmstudio-cmd", type=str, default=None, help="Commande de démarrage LM Studio (ex: 'lms server start')")
    args = parser.parse_args()
    run_server(args.host, args.port, args.start_lmstudio, args.lmstudio_cmd)


if __name__ == "__main__":
    main()
