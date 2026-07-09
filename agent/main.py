import requests
import time
import socket
import logging
import os

DRY_RUN_ENV = "GATE_CONTROLLER_AGENT_DRY_RUN"
AGENT_TOKEN_ENV = "GATE_CONTROLLER_AGENT_TOKEN"
GATE_STATUS_URL = "https://gate-controller-cloud-v3.benzhang.dev/api/gate/take_status"
MONITOR_SLUG = "gate-controller-agent"
RELAY_PIN = 4
TRUE_VALUES = {"1", "true", "t", "yes", "y", "on"}
FALSE_VALUES = {"", "0", "false", "f", "no", "n", "off"}


def env_flag(name):
    value = os.environ.get(name, "")
    normalized = value.strip().lower()
    if normalized in TRUE_VALUES:
        return True
    if normalized in FALSE_VALUES:
        return False
    raise ValueError(
        f"{name} must be one of {sorted(TRUE_VALUES | FALSE_VALUES)}, got {value!r}"
    )


def init_sentry():
    try:
        import sentry_sdk
        from sentry_sdk.integrations.logging import LoggingIntegration
    except ImportError:
        logging.warning("sentry_sdk is unavailable; continuing without Sentry")
        return

    sentry_logging = LoggingIntegration(
        level=logging.INFO,
        event_level=logging.ERROR,
    )
    sentry_sdk.init(
        # Gate controller agent Sentry project DSN.
        dsn="https://b3184994f9d267983dc3a5c99747b8b0@o4505847402135552.ingest.sentry.io/4505847409410048",
        integrations=[
            sentry_logging,
        ],
        traces_sample_rate=1.0,
    )


class RelayController:
    def __init__(self, pin, dry_run=False, gpio_module=None):
        self.pin = pin
        self.dry_run = dry_run
        self._gpio = gpio_module

    def setup(self):
        if self.dry_run:
            logging.warning(
                "DRY RUN enabled: GPIO relay will not be initialized or modified"
            )
            return

        if self._gpio is None:
            import RPi.GPIO as GPIO

            self._gpio = GPIO

        self._gpio.setmode(self._gpio.BCM)
        self._gpio.setup(self.pin, self._gpio.OUT)
        logging.info("Initializing relay to off")
        self._gpio.output(self.pin, self._gpio.LOW)

    def open(self):
        self._write("open", "HIGH")

    def close(self):
        self._write("closed", "LOW")

    def cleanup(self):
        if self.dry_run:
            logging.warning("DRY RUN: skipping relay shutdown and GPIO cleanup")
            return
        if self._gpio is None:
            return

        logging.info("Turning off relays")
        self._gpio.output(self.pin, self._gpio.LOW)

        logging.info("Cleaning up!")
        self._gpio.cleanup()

    def _write(self, command, gpio_level_name):
        if self.dry_run:
            logging.warning(
                "DRY RUN: command %r would set relay pin %s to GPIO.%s",
                command,
                self.pin,
                gpio_level_name,
            )
            return

        if self._gpio is None:
            raise RuntimeError("RelayController.setup() must be called before use")

        self._gpio.output(self.pin, getattr(self._gpio, gpio_level_name))


def take_command(hostname):
    data = {'host': hostname}
    headers = {}
    token = os.environ.get(AGENT_TOKEN_ENV)
    if token:
        headers["Authorization"] = f"Bearer {token}"

    response = requests.post(GATE_STATUS_URL, json=data, headers=headers, timeout=5)
    response.raise_for_status()

    command = response.json().get('status')
    if command is None:
        raise KeyError("The 'status' key is missing in the response")
    if command not in {"closed", "open"}:
        raise ValueError(f"Unknown command: {command}")
    return command


def apply_command(command, relay):
    logging.info(f"Command: {command}")

    if command == 'closed':
        logging.info("Turning off relay")
        relay.close()
    elif command == 'open':
        logging.info("Turning on relay")
        relay.open()
    else:
        raise ValueError(f"Unknown command: {command}")


def loop_once(relay, hostname):
    try:
        apply_command(take_command(hostname), relay)
    except Exception as e:
        logging.error(f"Unexpected {e=}, {type(e)=}")
        logging.info("Sleeping for 2 seconds and trying again")
        time.sleep(2)


def ping_healthcheck():
    time.sleep(0.5)  # space out the begin and end API calls


def build_healthcheck(dry_run):
    if dry_run:
        logging.warning("DRY RUN: Sentry cron monitor will not be pinged")
        return ping_healthcheck

    try:
        from sentry_sdk.crons import monitor
    except ImportError:
        logging.warning("sentry_sdk is unavailable; healthcheck will not be monitored")
        return ping_healthcheck

    return monitor(monitor_slug=MONITOR_SLUG)(ping_healthcheck)


def main():
    logging.basicConfig(level=logging.INFO)

    dry_run = env_flag(DRY_RUN_ENV)
    if not dry_run:
        init_sentry()
    monitored_healthcheck = build_healthcheck(dry_run)
    relay = RelayController(RELAY_PIN, dry_run=dry_run)

    hostname = socket.gethostname()

    try:
        relay.setup()
        last_healthcheck_time = 0
        while True:
            loop_once(relay, hostname)
            now = time.time()
            # Ping healthcheck every minute
            if now - last_healthcheck_time > 60:
                logging.info("Pinging healthcheck")
                start = time.perf_counter()
                monitored_healthcheck()
                stop = time.perf_counter()
                logging.info(f"Healthcheck loop completed in {stop-start:.2f} seconds")
                last_healthcheck_time = now
            time.sleep(1)
    finally:
        relay.cleanup()


if __name__ == "__main__":
    main()
