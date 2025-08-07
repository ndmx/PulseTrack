from flask import Flask, request, jsonify, render_template
from flask_socketio import SocketIO
from db.load import load_to_db
import pandas as pd
from db.connect import engine
from analyze import generate_chart
app = Flask(__name__, template_folder='templates')
socketio = SocketIO(app)
@app.route('/submit_poll', methods=['POST'])
def submit():
    data = request.json
    df = pd.DataFrame([{'source': 'user_form', 'content': data.get('response'), 'user_id': data.get('user_id'), 'location': data.get('location'), 'candidate': data.get('candidate')}])
    load_to_db(df, 'raw_inputs')
    return jsonify({'status': 'received'})
@app.route('/')
def dashboard():
    chart_path = generate_chart()
    return render_template('index.html', chart=chart_path)
if __name__ == '__main__':
    socketio.run(app, debug=True)
