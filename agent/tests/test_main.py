import importlib
from pathlib import Path
import types
import sys
from unittest import mock

import pytest


def load_module(monkeypatch, status):
    """Load main module with patched GPIO and requests."""
    class FakeGPIO:
        BCM = "BCM"
        OUT = "OUT"
        LOW = "LOW"
        HIGH = "HIGH"
        def __init__(self):
            self.output_calls = []
        def setmode(self, mode):
            pass
        def setup(self, pin, mode):
            pass
        def output(self, pin, value):
            self.output_calls.append((pin, value))
        def cleanup(self):
            pass

    fake_gpio = FakeGPIO()
    gpio_module = types.SimpleNamespace(
        BCM=fake_gpio.BCM,
        OUT=fake_gpio.OUT,
        LOW=fake_gpio.LOW,
        HIGH=fake_gpio.HIGH,
        setmode=fake_gpio.setmode,
        setup=fake_gpio.setup,
        output=fake_gpio.output,
        cleanup=fake_gpio.cleanup,
    )
    # Patch RPi and RPi.GPIO
    rpi_pkg = types.ModuleType("RPi")
    rpi_pkg.GPIO = gpio_module
    monkeypatch.setitem(sys.modules, "RPi", rpi_pkg)
    monkeypatch.setitem(sys.modules, "RPi.GPIO", gpio_module)

    class FakeResponse:
        def json(self):
            return {"status": status} if status is not None else {}

    monkeypatch.setattr("requests.post", mock.Mock(return_value=FakeResponse()))

    spec = importlib.util.spec_from_file_location(
        "main", (Path(__file__).resolve().parent.parent / "main.py")
    )
    module = importlib.util.module_from_spec(spec)
    sys.modules["main"] = module
    spec.loader.exec_module(module)
    return module, fake_gpio


def test_open_command(monkeypatch):
    module, gpio = load_module(monkeypatch, "open")
    module.loop_once()
    assert (module.relay1, gpio.HIGH) in gpio.output_calls


def test_closed_command(monkeypatch):
    module, gpio = load_module(monkeypatch, "closed")
    module.loop_once()
    assert (module.relay1, gpio.LOW) in gpio.output_calls


def test_missing_status(monkeypatch):
    module, gpio = load_module(monkeypatch, None)
    before = list(gpio.output_calls)
    module.loop_once()
    assert gpio.output_calls == before


def test_unknown_status(monkeypatch):
    module, gpio = load_module(monkeypatch, "invalid")
    before = list(gpio.output_calls)
    module.loop_once()
    assert gpio.output_calls == before

