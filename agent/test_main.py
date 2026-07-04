import importlib.util
import pathlib
import sys
import types
import unittest
from unittest import mock


MODULE_PATH = pathlib.Path(__file__).with_name("main.py")
spec = importlib.util.spec_from_file_location("agent_main", MODULE_PATH)
agent_main = importlib.util.module_from_spec(spec)
sys.modules["agent_main"] = agent_main
spec.loader.exec_module(agent_main)


def fake_gpio():
    gpio = mock.Mock()
    gpio.BCM = "BCM"
    gpio.OUT = "OUT"
    gpio.LOW = "LOW"
    gpio.HIGH = "HIGH"
    return gpio


def fake_response(payload):
    response = mock.Mock()
    response.json.return_value = payload
    return response


class EnvFlagTests(unittest.TestCase):
    def test_env_flag_accepts_true_values(self):
        for value in ["1", "true", "TRUE", "yes", "on"]:
            with self.subTest(value=value):
                with mock.patch.dict(agent_main.os.environ, {"FLAG": value}, clear=True):
                    self.assertTrue(agent_main.env_flag("FLAG"))

    def test_env_flag_accepts_false_values(self):
        for value in ["", "0", "false", "FALSE", "no", "off"]:
            with self.subTest(value=value):
                with mock.patch.dict(agent_main.os.environ, {"FLAG": value}, clear=True):
                    self.assertFalse(agent_main.env_flag("FLAG"))

    def test_env_flag_rejects_ambiguous_values(self):
        with mock.patch.dict(agent_main.os.environ, {"FLAG": "enabled"}, clear=True):
            with self.assertRaisesRegex(ValueError, "FLAG must be one of"):
                agent_main.env_flag("FLAG")


class RelayControllerTests(unittest.TestCase):
    def test_dry_run_never_imports_or_writes_gpio(self):
        relay = agent_main.RelayController(pin=4, dry_run=True)

        with self.assertLogs(level="WARNING") as logs:
            relay.setup()
            relay.open()
            relay.close()
            relay.cleanup()

        self.assertIsNone(relay._gpio)
        self.assertTrue(any("DRY RUN enabled" in line for line in logs.output))
        self.assertTrue(
            any("would set relay pin 4 to GPIO.HIGH" in line for line in logs.output)
        )
        self.assertTrue(
            any("would set relay pin 4 to GPIO.LOW" in line for line in logs.output)
        )

    def test_real_mode_initializes_writes_and_cleans_up_gpio(self):
        gpio = fake_gpio()
        relay = agent_main.RelayController(pin=4, dry_run=False, gpio_module=gpio)

        relay.setup()
        relay.open()
        relay.close()
        relay.cleanup()

        self.assertEqual(
            gpio.method_calls,
            [
                mock.call.setmode("BCM"),
                mock.call.setup(4, "OUT"),
                mock.call.output(4, "LOW"),
                mock.call.output(4, "HIGH"),
                mock.call.output(4, "LOW"),
                mock.call.output(4, "LOW"),
                mock.call.cleanup(),
            ],
        )


class TakeCommandTests(unittest.TestCase):
    def test_take_command_sends_agent_token_and_returns_status(self):
        response = fake_response({"status": "open"})

        with mock.patch.dict(
            agent_main.os.environ,
            {agent_main.AGENT_TOKEN_ENV: "secret"},
            clear=True,
        ):
            with mock.patch.object(
                agent_main.requests,
                "post",
                return_value=response,
            ) as post:
                self.assertEqual(agent_main.take_command("pi-host"), "open")

        post.assert_called_once_with(
            agent_main.DEFAULT_GATE_STATUS_URL,
            json={"host": "pi-host"},
            headers={"Authorization": "Bearer secret"},
            timeout=5,
        )
        response.raise_for_status.assert_called_once_with()

    def test_take_command_uses_status_url_override(self):
        status_url = "http://127.0.0.1:3100/api/gate/take_status"

        with mock.patch.dict(
            agent_main.os.environ,
            {agent_main.STATUS_URL_ENV: status_url},
            clear=True,
        ):
            with mock.patch.object(
                agent_main.requests,
                "post",
                return_value=fake_response({"status": "closed"}),
            ) as post:
                self.assertEqual(agent_main.take_command("pi-host"), "closed")

        post.assert_called_once_with(
            status_url,
            json={"host": "pi-host"},
            headers={},
            timeout=5,
        )

    def test_take_command_rejects_missing_status(self):
        with mock.patch.object(
            agent_main.requests,
            "post",
            return_value=fake_response({"error": "Unauthorized"}),
        ):
            with self.assertRaisesRegex(KeyError, "status"):
                agent_main.take_command("pi-host")

    def test_apply_command_rejects_unknown_status_without_touching_relay(self):
        relay = mock.Mock()

        with self.assertRaisesRegex(ValueError, "Unknown command"):
            agent_main.apply_command("jammed", relay)

        self.assertEqual(relay.method_calls, [])


class HealthcheckTests(unittest.TestCase):
    def test_dry_run_healthcheck_does_not_use_sentry_monitor(self):
        with mock.patch.object(agent_main.logging, "warning") as warning:
            self.assertIs(
                agent_main.build_healthcheck(True),
                agent_main.ping_healthcheck,
            )

        warning.assert_called_once_with(
            "DRY RUN: Sentry cron monitor will not be pinged"
        )

    def test_live_healthcheck_uses_agent_sentry_monitor(self):
        wrapped = mock.Mock()
        sentry_sdk = types.ModuleType("sentry_sdk")
        crons = types.ModuleType("sentry_sdk.crons")
        crons.monitor = mock.Mock(return_value=lambda func: wrapped)

        with mock.patch.dict(
            sys.modules,
            {"sentry_sdk": sentry_sdk, "sentry_sdk.crons": crons},
        ):
            self.assertIs(agent_main.build_healthcheck(False), wrapped)

        crons.monitor.assert_called_once_with(monitor_slug=agent_main.MONITOR_SLUG)


if __name__ == "__main__":
    unittest.main()
