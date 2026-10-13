# Urban Mobility Data Explorer

NYC yellow taxi data pipeline, SQLite database, Flask API and dashboard.

## Setup
1. Create and activate a virtual environment: `python3 -m venv venv` then `source venv/bin/activate`
2. Install the requirements: `pip install -r backend/requirements.txt`
3. Download the trip CSV and `taxi_zone_lookup.csv` from Canvas into `backend/data/raw/`
   (the data is not in Git because the files are too large)

## Run (from backend/src)
1. `python pipeline.py` cleans the data and writes `cleaned_trips.csv`
2. `python database.py` builds the SQLite database from `backend/sql/schema.sql` and loads the data
3. `python app.py` starts the API on http://localhost:5000

## API
- `GET /api/stats` gives summary numbers and trips per borough
- `GET /api/trips` has filters: `borough`, `location_id`, `is_rush_hour`, `start_date`, `end_date`,
  `min_fare`, `max_fare`, `min_distance`, `max_distance`, `sort_by`, `order`, `limit`, `offset`
