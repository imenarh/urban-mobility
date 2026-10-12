import os
import sqlite3
from flask import Flask, jsonify, request
from flask_cors import CORS 

app = Flask(__name__)
# so the frontenf can call this api
CORS(app) #Enable CORS
# database file made by our data cleaning script
DB_PATH = os.path.join(
   os.path.dirname(__file__), "../data/processed/urban_mobility.db"
   )

def get_db_connection():
    
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row #Enable dictionary-style column access
    return conn
# quick check that the server is up
@app.route("/", methods=["GET"])
def health_check():
    return jsonify({
        "status": "healthy",
        "message": "Urban Mobility API is running with local SQLite database!",
    })

@app.route("/api/trips", methods=["GET"])
def get_trips():
    """ Retrieves paginated trips with optional filters for borough and rush hour."""
   # Get the filters from the URL
    limit = request.args.get("limit", 100, type=int)
    offset = request.args.get("offset", 0, type=int)
    borough = request.args.get("borough", None, type=str)
    is_rush_hour = request.args.get("is_rush_hour", type=int)

    conn = get_db_connection()
    cursor = conn.cursor()
#where 1=1 so i can add AND conditions after it
    query = "SELECT * FROM trips WHERE 1=1"
   # Values that go in the ? spots in the query, to prevent SQL injection
    params = []
# Match the borough on either pickup or dropoff
    if borough:
        query += " AND (PUBorough =? OR DUBorough =?)"
        params.extend([borough, borough])
#Check for None because 0 (non-rush hour) is a valid value
    if is_rush_hour is not None:
        query += " AND is_rush_hour =?"
        params.append(is_rush_hour)
#Newest trips first, then apply pagination
    query += " ORDER BY tpep_pickup_datetime DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])

    cursor.execute(query, params)
    #jsonify cant read sqlite3.Row, so make dicts
    trips = [dict(row) for row in cursor.fetchall()]
    cursor.close()
    conn.close()
    return jsonify(trips)


@app.route("/api/stats", methods=["GET"])
def get_stats():
    """ Provides aggregate urban mobility metrics and borough distribution for the dashboard."""
    
    conn = get_db_connection()
    cursor = conn.cursor()
# Overall averages across all trips
    cursor.execute("""
        SELECT COUNT(*) AS total_trips,
        ROUND(AVG(total_amount), 2) AS average_fare,
        ROUND(AVG(trip_distance), 2) AS average_distance,
        ROUND(AVG(trip_duration_mins), 2) AS average_duration,
        ROUND(AVG(avg_speed_mph), 2) AS average_speed
        FROM trips;
    """)
   
    summary = dict(cursor.fetchone())
    # Trips count 
    cursor.execute("""
        SELECT z.Borough AS borough, COUNT(*) AS trip_count
        FROM trips t
        JOIN zones z ON t.PULocationID = z.LocationID
        WHERE z.Borough IS NOT NULL
        GROUP BY z.Borough
        ORDER BY trip_count DESC;
    """)
    
    borough_stats = [dict(row) for row in cursor.fetchall()]
    cursor.close()
    conn.close()

    return jsonify({
        "summary": summary,
        "borough_distribution": borough_stats
    })


if __name__ == "__main__":
    # debug=True auto-reloades on changes, on local use only
    app.run(debug=True, port=5000)