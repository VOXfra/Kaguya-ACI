"""Serveur HTTP local pour discuter avec Kaguya.

Usage:
    python -m kaguya.server

Le serveur écoute par défaut sur http://127.0.0.1:1234.
"""

from __future__ import annotations

from dataclasses import asdict
import json
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Dict

from kaguya.cerveau import CerveauKaguya


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
        }

    def _apply_command(self, cmd: dict[str, Any]) -> None:
        name = cmd.get("cmd")
        if name == "SET_INTENTION":
            value = str(cmd.get("value", "progresser"))
            # Mapping simple, local et déterministe.
            if value == "stabiliser":
                self.cerveau.intention_active = self.cerveau.intention_active or None
        elif name == "PAUSE":
            self.cerveau.is_paused = True
        elif name == "RESUME":
            self.cerveau.is_paused = False

    def handle_message(self, message: str, mode: str = "realtime") -> Dict[str, Any]:
        """Traite un message utilisateur et renvoie une réponse structurée."""
        # Le cerveau avance d'un tick avant réponse pour garder la continuité.
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
<p>Serveur local: <code>127.0.0.1:1234</code></p>
<div id='chat' style='white-space:pre-wrap;border:1px solid #ccc;padding:8px;height:300px;overflow:auto'></div>
<input id='msg' style='width:70%' placeholder='Écris un message...'/>
<select id='mode'><option value='realtime'>realtime</option><option value='reflexion'>reflexion</option></select>
<button onclick='sendMsg()'>Envoyer</button>
<script>
async function sendMsg(){
  const m=document.getElementById('msg').value;
  const mode=document.getElementById('mode').value;
  const res=await fetch('/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:m,mode})});
  const data=await res.json();
  const box=document.getElementById('chat');
  box.textContent += '\nToi: '+m+'\nKaguya: '+data.reply+'\n';
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

        def log_message(self, format: str, *args: Any) -> None:  # silence serveur
            return

    return Handler


def run_server(host: str = "127.0.0.1", port: int = 1234) -> None:
    service = ChatService()
    server = ThreadingHTTPServer((host, port), make_handler(service))
    print(f"Kaguya server running on http://{host}:{port}")
    server.serve_forever()


if __name__ == "__main__":
    run_server()
