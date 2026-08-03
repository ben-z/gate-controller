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

One-shot mode is restricted to dry runs so a smoke test cannot operate the
physical relay. Run it as a non-restarting Compose command:

```bash
docker compose run --rm --no-deps \
  -e GATE_CONTROLLER_AGENT_DRY_RUN=1 \
  -e GATE_CONTROLLER_AGENT_RUN_ONCE=1 \
  agent
```

To point the command at a non-production cloud instance, also pass
`-e GATE_CONTROLLER_STATUS_URL=https://example.com/api/gate/take_status`.

Always-on service:
```bash
docker compose up -d --build
docker compose logs --tail 10 -f
```
