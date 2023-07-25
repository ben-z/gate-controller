import time
import atexit
import logging

from apscheduler.schedulers.background import BackgroundScheduler
from flask import Flask, render_template, redirect
from threading import Lock

app = Flask(__name__)

OPEN_TEMPORARY_SECONDS = 10

state_mutex = Lock()
state = {
    'target_state': 'closed', # closed, open_temporary, open_permanent
    'open_temporary_start': 0,
}

def target_state_to_command(target_state):
    if target_state in ['open_temporary', 'open_permanent']:
        return 'open'
    elif target_state == 'closed':
        return 'closed'
    else:
        raise Exception(f'Unknown target_state: {target_state}')

@app.route('/')
def dashboard():
    with state_mutex:
        now = time.time()
        if state['target_state'] == 'open_temporary':
            seconds_to_closing = f"{state['open_temporary_start'] + OPEN_TEMPORARY_SECONDS - now:.0f}"
        else:
            seconds_to_closing = 'N/A'
        return render_template('dashboard.html', target_state=state['target_state'], seconds_to_closing=seconds_to_closing)

@app.route('/open_temporary')
def open_temporary():
    with state_mutex:
        logging.info('CMD: open_temporary')
        now = time.time()
        state['target_state'] = 'open_temporary'
        state['open_temporary_start'] = now
        return redirect('/')

@app.route('/open_permanent')
def open_permanent():
    with state_mutex:
        logging.info('CMD: open_permanent')
        state['target_state'] = 'open_permanent'
        return redirect('/')

@app.route('/close')
def close():
    with state_mutex:
        logging.info('CMD: close')
        state['target_state'] = 'closed'
        return redirect('/')

@app.route('/api/take_command', methods=['POST'])
def command():
    with state_mutex:
        logging.info('CMD: command')
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
