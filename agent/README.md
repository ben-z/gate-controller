## Getting started

Manual:
```bash
pip install -r requirements.txt
sudo -E python3 main.py
```

Set `GATE_CONTROLLER_AGENT_TOKEN` to match the cloud app's `AGENT_TOKEN`.
For Docker Compose, put it in `agent/.env` or export it in the shell before
starting the service. Compose fails fast if the variable is missing.

Always-on service:
```bash
docker compose up -d --build
docker compose logs --tail 10 -f
```
