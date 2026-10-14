# Urban Mobility Data Explorer

This project is meant to process and present information from an NYC yellow taxi trip dataset. We cleaned up the provided raw data, stored the processed information, built a backend service to query the data and created a frontend dashboard for users to explore urban mobility patterns and draw meaningful insights.
  
## How to setup and Run

### Clone the repository

Run the following commands to clone the repository: 

```
git clone https://github.com/imenarh/urban-mobility.git

cd urban-mobility/
```

### Setup your environment

Use the follow commands to setup your python virtual environment:
```
python3 -m venv venv
source venv/bin/activate
 pip install -r backend/requirements.txt
```

### Download the Taxi trip data

Obtain the raw data required to create a cleaned up database. Download them below:
  1. [yellow_tripdata](https://alueducation.instructure.com/courses/3138/files/581082?wrap=1)
  2. [tataxi_zone_lookup.csv](https://alueducation.instructure.com/courses/3138/files/581089?wrap=1)
  3. [taxi_zones](https://alueducation.instructure.com/courses/3138/files/581075?wrap=1)

Place the downloaded data in `backend/data/raw/`.  
  
### Run the data cleanup and populate the Database

Navigate to `backend/src/` and run these commands (one-by-one):
```
python3 pipeline.py     

python3 database.py 
```

### Start the project (backend and frontend)

1. **Start the backend:**
  
In the `backend/src/` folder, run:
  ```
  python3 app.py         # starts the API on http://localhost:5000
  ```

2. **Start the Frontend:**

In a different terminal, and in the repo root, run the following command:
```
python3 -m http.server 8000 --directory frontend
```

## Available APIs
- `GET /api/stats` gives summary numbers and trips per borough
- `GET /api/trips` has filters: `borough`, `location_id`, `is_rush_hour`, `start_date`, `end_date`,
  `min_fare`, `max_fare`, `min_distance`, `max_distance`, `sort_by`, `order`, `limit`, `offset`

## Assignment Deliverables

- 5 minute walkthrough video: [video link](https://jam.dev/v/26f9424d-d168-4d1e-ad7a-d2d161f06f75)
- Team Participation Sheet: [link](https://docs.google.com/spreadsheets/d/1MKmqO5X7MDIaNBVUdVTbXLzOmWTAkmv_ImL6zK8pVW0/edit?gid=0#gid=0)
- Technical report PDF: https://github.com/imenarh/urban-mobility/blob/main/documentation/technical_report.md
- Database Schema: [`backend/sql/schema.sql`](./backend/sql/schema.sql)
- CodeVibe Reports: [`codevibe-reports/`](./codevibe-reports/)
