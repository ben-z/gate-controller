import arrow
import time
import atexit
import logging
import dbm
import json
import os
import sentry_sdk

from apscheduler.schedulers.background import BackgroundScheduler
from contextlib import contextmanager
from flask import Flask, render_template, redirect, request
from pathlib import Path
from threading import Lock
from sentry_sdk.crons import monitor
from sentry_sdk.integrations.logging import LoggingIntegration
from time import sleep

# All of this is already happening by default!
sentry_logging = LoggingIntegration(
    level=logging.INFO,        # Capture info and above as breadcrumbs
    event_level=logging.ERROR  # Send errors as events
)
sentry_sdk.init(
    # Obtained from https://unicorns-are-cool.sentry.io/settings/projects/gate-opener/keys/
    dsn="https://b3184994f9d267983dc3a5c99747b8b0@o4505847402135552.ingest.sentry.io/4505847409410048",
    integrations=[
        sentry_logging,
    ],

    # Set traces_sample_rate to 1.0 to capture 100%
    # of transactions for performance monitoring.
    # We recommend adjusting this value in production.
    traces_sample_rate=1.0
)

logging.basicConfig(level=logging.INFO)

app = Flask(__name__)


OPEN_TEMPORARY_SECONDS = 10
COMMAND_HISTORY_MAX_LENGTH = 100


# Use /fly_app_data as the data directory if running on Fly
if Path('/fly_app_data').exists():
    DATA_DIR = Path('/fly_app_data')
else:
    DATA_DIR = Path('./data')
DATA_DIR.mkdir(exist_ok=True)
DB_PATH = DATA_DIR / 'db.dbm'

logging.info(f'Using DB_PATH: {DB_PATH}')

state_mutex = Lock()
initial_state = {
    'target_state': 'closed', # closed, open_temporary, open_permanent
    'open_temporary_start': 0,
    'last_contact_with_gate': 0,
    'command_history': [],
}

def read_state():
    with dbm.open(str(DB_PATH), 'c') as db:
        state = initial_state.copy()

        if 'state' in db:
            state.update(json.loads(db['state']))

        return state

def write_state(state):
    with dbm.open(str(DB_PATH), 'c') as db:
        db['state'] = json.dumps(state)

@contextmanager
def state_provider():
    state = read_state()
    try:
        yield state
    finally:
        write_state(state)

def target_state_to_command(target_state):
    if target_state in ['open_temporary', 'open_permanent']:
        return 'open'
    elif target_state == 'closed':
        return 'closed'
    else:
        raise Exception(f'Unknown target_state: {target_state}')

def format_command_history(now, command_history):
    formatted = []
    for command in reversed(command_history):
        formatted.append({
            'timestamp': arrow.get(command['timestamp']).humanize(),
            'target_state': command['target_state'],
        })
    return formatted

@app.route('/')
def dashboard():
    with state_mutex, state_provider() as state:
        now = time.time()
        if state['target_state'] == 'open_temporary':
            seconds_to_closing = f"{state['open_temporary_start'] + OPEN_TEMPORARY_SECONDS - now:.0f}"
        else:
            seconds_to_closing = 'N/A'
        
        return render_template(
            'dashboard.html.j2',
            target_state=state['target_state'],
            seconds_to_closing=seconds_to_closing,
            seconds_since_last_contact_with_gate=f"{now - state['last_contact_with_gate']:.2f}",
            command_history_formatted=format_command_history(now, state['command_history']),
        )

@app.route('/open_temporary')
def open_temporary():
    with state_mutex, state_provider() as state:
        logging.info('CMD: open_temporary')
        now = time.time()
        state['target_state'] = 'open_temporary'
        state['open_temporary_start'] = now

        state['command_history'].append({
            'timestamp': now,
            'target_state': state['target_state'],
        })
        state['command_history'] = state['command_history'][-COMMAND_HISTORY_MAX_LENGTH:]

        return render_template('redirect_to_dashboard.html.j2', action='open_temporary', icon_name="gate-orange", title="Open Gate (Temporary)")

@app.route('/open_permanent')
def open_permanent():
    with state_mutex, state_provider() as state:
        now = time.time()
        logging.info('CMD: open_permanent')
        state['target_state'] = 'open_permanent'

        state['command_history'].append({
            'timestamp': now,
            'target_state': state['target_state'],
        })
        state['command_history'] = state['command_history'][-COMMAND_HISTORY_MAX_LENGTH:]

        return render_template('redirect_to_dashboard.html.j2', action='open_permanent', icon_name="gate-red", title="Open Gate (Permanent)")

@app.route('/close')
def close():
    with state_mutex, state_provider() as state:
        now = time.time()
        logging.info('CMD: close')
        state['target_state'] = 'closed'

        state['command_history'].append({
            'timestamp': now,
            'target_state': state['target_state'],
        })

        state['command_history'] = state['command_history'][-COMMAND_HISTORY_MAX_LENGTH:]

        return render_template('redirect_to_dashboard.html.j2', action='close', icon_name="gate-black", title="Close Gate")

@app.route('/api/take_command', methods=['POST'])
def command():
    with state_mutex, state_provider() as state:
        now = time.time()
        logging.warn(f'API: take_command, payload: {request.json}')
        state['last_contact_with_gate'] = now
        return target_state_to_command(state['target_state'])

def control_loop():
    with state_mutex, state_provider() as state:
        now = time.time()
        if state['target_state'] == 'open_temporary' and state['open_temporary_start'] + OPEN_TEMPORARY_SECONDS < now:
            logging.info('open_temporary: Time is up, closing')
            state['target_state'] = 'closed'
        elif state['target_state'] == 'open_temporary':
            logging.info(f'open_temporary: Waiting for {state["open_temporary_start"] + OPEN_TEMPORARY_SECONDS - now} seconds to pass before closing')

@monitor(monitor_slug='gate-opener-cloud')
def ping_healthcheck():
    sleep(0.5) # space out the begin and end API calls

scheduler = BackgroundScheduler()
scheduler.add_job(func=control_loop, trigger="interval", seconds=1)
scheduler.add_job(func=ping_healthcheck, trigger="interval", seconds=60)
scheduler.start()
# Shut down the scheduler when exiting the app
atexit.register(lambda: scheduler.shutdown())

if __name__ == '__main__':
    # use_reloader=False is required for apscheduler to not run twice
    # in Flask debug mode. However, this means that we'll need to manually
    # restart the server when we make changes to the backend code.
    # https://stackoverflow.com/a/15491587/4527337
    # https://stackoverflow.com/a/9476701/4527337
    app.run(debug=True, use_reloader=True, host='0.0.0.0', port=8081)
