import requests
import RPi.GPIO as GPIO
import time
import sys
import socket
import logging
import sentry_sdk
from sentry_sdk.crons import monitor
from sentry_sdk.integrations.logging import LoggingIntegration

# All of this is already happening by default!
sentry_logging = LoggingIntegration(
    level=logging.INFO,        # Capture info and above as breadcrumbs
    event_level=logging.ERROR  # Send errors as events
)
sentry_sdk.init(
    # Obtained from https://sentry.watonomous.ca/organizations/bentestorg2/projects/gate-opener/getting-started/python/
    dsn="https://f8195556fd09492ba3be5b2b12acb773@sentry.watonomous.ca/4",
    integrations=[
        sentry_logging,
    ],

    # Set traces_sample_rate to 1.0 to capture 100%
    # of transactions for performance monitoring.
    # We recommend adjusting this value in production.
    traces_sample_rate=1.0
)

logging.basicConfig(level=logging.INFO)

hostname = socket.gethostname()

# Define GPIO pin numbers
relay1 = 4
# kept for future use
#relay2 = 22
#relay3 = 6
#relay4 = 26

# Use the Broadcom SOC channel
GPIO.setmode(GPIO.BCM)

## Set up GPIO pins
GPIO.setup(relay1, GPIO.OUT)

logging.info("Initializing relay to off")
GPIO.output(relay1, GPIO.LOW)

@monitor(monitor_slug='gate-opener-agent')
def loop_once():
    try:
        #url = 'http://100.106.129.114:8081/api/take_command' # for debugging
        url = 'https://gate-opener-cloud.fly.dev/api/take_command'
        data = {'host': hostname}

        response = requests.post(url, json=data, timeout=5)

        command = response.text
        logging.info(f"Command: {command}")

        if command == 'closed':
            logging.info(f"Turning off relay")
            GPIO.output(relay1, GPIO.LOW)
        elif command == 'open':
            logging.info(f"Turning on relay")
            GPIO.output(relay1, GPIO.HIGH)
        else:
            raise ValueError(f"Unknown command: {command}")
    except Exception as e:
        logging.error(f"Unexpected {e=}, {type(e)=}")
        logging.info("Sleeping for 2 seconds and trying again")
        time.sleep(2)

# Continuously poll for the latest command
try:
    while True:
        loop_once()
        time.sleep(1)
finally:
    logging.info("Turning off relays")
    GPIO.output(relay1, GPIO.LOW)

    logging.info("Cleaning up!")
    GPIO.cleanup()

