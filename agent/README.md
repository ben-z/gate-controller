## Getting started

Manual:
```bash
pip install -r requirements.txt
sudo -E python3 main.py
```

Set `GATE_CONTROLLER_AGENT_TOKEN` if the cloud app has `AGENT_TOKEN` configured.
For Docker Compose, put it in `agent/.env` or export it in the shell before
starting the service.

Always-on service:
```bash
docker compose up -d --build
docker compose logs --tail 10 -f
```
