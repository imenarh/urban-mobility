# Urban Mobility Data Explorer

This project is meant to process and present information from an NYC yellow taxi trip dataset. We cleaned up the provided raw data, stored the processed information, built a backend service to query the data and created a frontend dashboard for users to explore urban mobility patterns and draw meaningful insights.
  
## How to get started

### 1. Setup your environment

You first need to create and activate your python virtual environment. Use the following commands:
```
python3 -m venv venv
source venv/bin/activate
 pip install -r backend/requirements.txt
```

### 2. Download the Taxi trip data

Obtain the raw data required to create a cleaned up database. Download them below:
  1. [yellow_tripdata](https://alueducation.instructure.com/courses/3138/files/581082?wrap=1)
  2. [tataxi_zone_lookup.csv](https://alueducation.instructure.com/courses/3138/files/581089?wrap=1)
  3. [taxi_zones](https://alueducation.instructure.com/courses/3138/files/581075?wrap=1)

  
## Run the data cleanup and populate the Database
1. `python pipeline.py` cleans the data and writes `cleaned_trips.csv`
2. `python database.py` builds the SQLite database from `backend/sql/schema.sql` and loads the data
3. `python app.py` starts the API on http://localhost:5000

## API
- `GET /api/stats` gives summary numbers and trips per borough
- `GET /api/trips` has filters: `borough`, `location_id`, `is_rush_hour`, `start_date`, `end_date`,
  `min_fare`, `max_fare`, `min_distance`, `max_distance`, `sort_by`, `order`, `limit`, `offset`
