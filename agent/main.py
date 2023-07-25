import RPi.GPIO as GPIO
import time
import sys

# Define GPIO pin numbers
relay1 = 4
relay2 = 22
relay3 = 6
relay4 = 26

# Use the Broadcom SOC channel
GPIO.setmode(GPIO.BCM)

# Set up GPIO pins
GPIO.setup(relay1, GPIO.OUT)
GPIO.setup(relay2, GPIO.OUT)
GPIO.setup(relay3, GPIO.OUT)
GPIO.setup(relay4, GPIO.OUT)

print("Testing relays!", file=sys.stderr)

try:
    print("Turning on relays", file=sys.stderr)
    GPIO.output(relay1, GPIO.HIGH)
    GPIO.output(relay2, GPIO.HIGH)
    GPIO.output(relay3, GPIO.HIGH)
    GPIO.output(relay4, GPIO.HIGH)
    print("Turned on relays", file=sys.stderr)
    while True:
        time.sleep(10)
finally:
    print("Turning off relays", file=sys.stderr)
    GPIO.output(relay1, GPIO.LOW)
    GPIO.output(relay2, GPIO.LOW)
    GPIO.output(relay3, GPIO.LOW)
    GPIO.output(relay4, GPIO.LOW)

    print("Cleaning up!", file=sys.stderr)
    GPIO.cleanup()