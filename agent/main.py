import requests
import RPi.GPIO as GPIO
import time
import sys
import socket
import logging

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

relay1_on = False

# Continuously poll for the latest command
try:
    while True:
        try:
            #url = 'http://100.106.129.114:8081/api/take_command' # for debugging
            url = 'https://gate-opener-cloud.fly.dev/api/take_command'
            data = {'host': hostname}
        
            response = requests.post(url, json=data)

            command = response.text
            logging.info(f"Command: {command}")
        
            if command == 'closed':
                logging.info(f"Turning off relay if on ({relay1_on=})")
                if relay1_on:
                    GPIO.output(relay1, GPIO.LOW)
            elif command == 'open':
                logging.info(f"Turning on relay if off ({relay1_on=})")
                if not relay1_on:
                    GPIO.output(relay1, GPIO.HIGH)
            else:
                raise ValueError(f"Unknown command: {commandl}")
        
            time.sleep(1)
        except Exception as e:
            logging.error(f"Unexpected {err=}, {type(err)=}")
            logging.warning("Sleeping for 10 seconds and trying again")
            time.sleep(10)
finally:
    logging.info("Turning off relays")
    GPIO.output(relay1, GPIO.LOW)

    logging.info("Cleaning up!")
    GPIO.cleanup()

