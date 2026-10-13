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
   """Trips with filters for date, fare, distanceand location."""
   limit = min(request.args.get("limit",100, type=int), 1000)
   offset = request.args.get("offset", 0, type=int)
   borough = request.args.get("borough", type=str)
   location_id = request.args.get("location_id", type=int)
   is_rush_hour = request.args.get("is_rush_hour", type=int)
   start_date = request.args.get("start_date", type=str)
   end_date = request.args.get("end_date", type=str)
   min_fare = request.args.get("min_fare", type=float)
   max_fare = request.args.get("max_fare", type=float)
   min_distance = request.args.get("min_distance", type=float)
   max_distance = request.args.get("max_distance", type=float)
   sort_by =request.args.get("sort_by", "tpep_pickup_datetime")
   order = request.args.get("order", "desc")

   #only allow real column names, so nobody can injectSQL throughsort_by
   allowed_sorts = ["tpep_pickup_datetime", "total_amount",
                  "trip_distance", "trip_duration_mins"]
   if sort_by not in allowed_sorts:
      sort_by = "tpep_pickup_datetime"
      order = "ASC" if order.lower() in ("asc",) else "DESC"

   query = """
      SELECT t.*, pz.Borough AS PUBorough, pz.Zone AS PUZone,
      dz.Borough AS DOBorough,dz.Zone AS DOZone
      FROM trips t
      JOIN zones pz ON t.PULocationID = pz.LocationID
      JOIN zones dz ON t.DOLocationID = dz.LocationID
      WHERE 1=1
      """
   params = []

   if borough:
      query += "AND (pz.Borough = ? OR dz.Borough = ?)"
      params.extend([borough, borough])

   if location_id is not None:
      query += "AND (t.PULocationID = ? OR t.DOLocationID = ?)"
      params.extend([location_id, location_id])

   if is_rush_hour is not None:
      query += " AND t.is_rush_hour = ?"
      params.append(is_rush_hour)

   if start_date:
      query += " AND NOT (t.tpep_pickup_datetime < ?)"
      params.append(start_date)

   if end_date:
      query += "AND NOT (t.tpep_pickup_datetime > ?)"
      params.append(end_date + " 23:59:59")

   if min_fare is not None:
      query += " AND NOT (t.total_amount < ?)"
      params.append(min_fare)

   if max_fare is not None:
      query += "And NOT (t.total_amount > ?)"
      params.append(max_fare)

   if min_distance is not None:
      query += "AND NOT (t.trip_distance < ?)"
      params.append(min_distance)

   if max_distance is not None:
      query += "AND NOT (t.trip_distance > ?)"
      params.append(max_distance)

   query += f" ORDER BY t.{sort_by} {order} LIMIT ? OFFSET ?"
   params.extend([limit, offset])

   conn = get_db_connection()
   cursor = conn.cursor()
   cursor.execute(query, params)
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