import arrow
import time
import atexit
import logging

from apscheduler.schedulers.background import BackgroundScheduler
from flask import Flask, render_template, redirect, request
from threading import Lock

app = Flask(__name__)

OPEN_TEMPORARY_SECONDS = 10
COMMAND_HISTORY_MAX_LENGTH = 100

state_mutex = Lock()
state = {
    'target_state': 'closed', # closed, open_temporary, open_permanent
    'open_temporary_start': 0,
    'last_contact_with_gate': 0,
    'command_history': [],
}

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
    with state_mutex:
        now = time.time()
        if state['target_state'] == 'open_temporary':
            seconds_to_closing = f"{state['open_temporary_start'] + OPEN_TEMPORARY_SECONDS - now:.0f}"
        else:
            seconds_to_closing = 'N/A'
        
        return render_template(
            'dashboard.html',
            target_state=state['target_state'],
            seconds_to_closing=seconds_to_closing,
            seconds_since_last_contact_with_gate=f"{now - state['last_contact_with_gate']:.2f}",
            command_history_formatted=format_command_history(now, state['command_history']),
        )

@app.route('/open_temporary')
def open_temporary():
    with state_mutex:
        logging.info('CMD: open_temporary')
        now = time.time()
        state['target_state'] = 'open_temporary'
        state['open_temporary_start'] = now

        state['command_history'].append({
            'timestamp': now,
            'target_state': state['target_state'],
        })
        state['command_history'] = state['command_history'][-COMMAND_HISTORY_MAX_LENGTH:]

        return redirect('/')

@app.route('/open_permanent')
def open_permanent():
    with state_mutex:
        now = time.time()
        logging.info('CMD: open_permanent')
        state['target_state'] = 'open_permanent'

        state['command_history'].append({
            'timestamp': now,
            'target_state': state['target_state'],
        })
        state['command_history'] = state['command_history'][-COMMAND_HISTORY_MAX_LENGTH:]

        return redirect('/')

@app.route('/close')
def close():
    with state_mutex:
        now = time.time()
        logging.info('CMD: close')
        state['target_state'] = 'closed'

        state['command_history'].append({
            'timestamp': now,
            'target_state': state['target_state'],
        })

        state['command_history'] = state['command_history'][-COMMAND_HISTORY_MAX_LENGTH:]

        return redirect('/')

@app.route('/api/take_command', methods=['POST'])
def command():
    with state_mutex:
        now = time.time()
        logging.warn(f'API: take_command, payload: {request.json}')
        state['last_contact_with_gate'] = now
        return target_state_to_command(state['target_state'])

def control_loop():
    with state_mutex:
        now = time.time()
        if state['target_state'] == 'open_temporary' and state['open_temporary_start'] + OPEN_TEMPORARY_SECONDS < now:
            logging.info('open_temporary: Time is up, closing')
            state['target_state'] = 'closed'
        elif state['target_state'] == 'open_temporary':
            logging.info(f'open_temporary: Waiting for {state["open_temporary_start"] + OPEN_TEMPORARY_SECONDS - now} seconds to pass before closing')

scheduler = BackgroundScheduler()
scheduler.add_job(func=control_loop, trigger="interval", seconds=1)
scheduler.start()
# Shut down the scheduler when exiting the app
atexit.register(lambda: scheduler.shutdown())

# Required for apscheduler to not run twice in Flask debug mode
# https://stackoverflow.com/a/15491587/4527337
if __name__ == '__main__':
    app.run(use_reloader=False)
