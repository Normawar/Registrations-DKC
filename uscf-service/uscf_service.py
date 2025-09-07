from flask import Flask, request, jsonify
from flask_cors import CORS
from uscf_lookup import USCFLookup
import logging

app = Flask(__name__)
CORS(app)
uscf_lookup = USCFLookup(rate_limit_seconds=1.0)

@app.route('/uscf-lookup', methods=['POST'])
def lookup_player():
    try:
        data = request.get_json()
        uscf_id = data.get('uscf_id')
        
        if not uscf_id:
            return jsonify({'error': 'USCF ID is required'}), 400
        
        player = uscf_lookup.lookup_by_id(uscf_id)
        
        if not player:
            return jsonify({'error': 'Player not found'}), 404
        
        player_data = {
            'uscf_id': player.uscf_id,
            'name': player.name,
            'rating_regular': player.rating_regular,
            'rating_quick': player.rating_quick,
            'state': player.state,
            'expiration_date': player.expiration_date
        }
        
        return jsonify(player_data)
        
    except Exception as e:
        logging.error(f"Error in lookup_player: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/uscf-lookup-name', methods=['POST'])
def lookup_players_by_name():
    try:
        data = request.get_json()
        first_name = data.get('first_name')
        last_name = data.get('last_name')
        
        if not first_name and not last_name:
            return jsonify({'error': 'At least a first or last name is required'}), 400
        
        players = uscf_lookup.lookup_by_name(first_name, last_name)
        
        players_data = []
        for player in players:
            players_data.append({
                'uscf_id': player.uscf_id,
                'name': player.name,
                'rating_regular': player.rating_regular,
                'rating_quick': player.rating_quick,
                'state': player.state,
                'expiration_date': player.expiration_date
            })
        
        return jsonify(players_data)
        
    except Exception as e:
        logging.error(f"Error in lookup_players_by_name: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy'})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080, debug=True)
