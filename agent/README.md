## Getting started

Manual:
```bash
pip install -r requirements.txt
sudo -E python3 main.py
```

Set `GATE_CONTROLLER_AGENT_TOKEN` to match the cloud app's `AGENT_TOKEN`.
For Docker Compose, put it in `agent/.env` or export it in the shell before
starting the service. Compose fails fast if the variable is missing.

Set `GATE_CONTROLLER_AGENT_DRY_RUN=1` to poll the cloud service and log the
relay actions without importing, initializing, writing, or cleaning up GPIO.
This is useful for validating token and cloud connectivity without toggling the
gate. Dry-run polls the cloud service normally, so the last-contact timestamp
updates, but it does not initialize Sentry monitoring.

For one-shot smoke tests, set `GATE_CONTROLLER_AGENT_RUN_ONCE=1`. To point the
agent at a non-production cloud instance, set `GATE_CONTROLLER_STATUS_URL` to
that instance's `/api/gate/take_status` URL.

Always-on service:
```bash
docker compose up -d --build
docker compose logs --tail 10 -f
```
