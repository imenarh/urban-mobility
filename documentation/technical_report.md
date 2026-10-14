## Data Processing and Cleaning (Ganza Gavin):

### 1. Problem Framing and Dataset Analysis

* **Data context** To map spatial zone identifiers PULocationID and DOLocationID to boroughs and service zones, we used the NYC Taxi Trip dataset which contains raw yellow cab trip data and taxi_zone_lookup.csv, which is a dimension table.

* **Data Challenges & Outliers:** Physical anomalies in data identified during initial inspection: Negative fare amounts (refund adjustments or metering issues), zero/negative trip durations, distance outliers > 100 miles, missing congestion_surcharge fields in early records. In addition, there were inconsistencies in the datetime formatting in the timestamps.

* **Assumptions** Data integrity was ensured by quarantining and removing records that had a timestamp during the cleaning process that was earlier than the pickup timestamp, and those with a trip time of zero or a negative fare. The null congestion surcharges were imputed as 0.0 as they were pre-mandatory implementation records.

* We created three strong metrics to feature:
**1.The average speed** in miles per hour, computed from distance and trip duration (in minutes) to determine traffic congestion bottlenecks.
**2.fare_per_mile:** Total amount over trip distance, used to determine trip unit-economics
**3.is_rush_hour:** A binary variable indicating the rush hours of a weekday (between 7-10 AM and 4-7 PM).



## Database Design and Architecture (James D. Kanneh II) 

### 1. Schema overview
The project uses two primary tables: 'zones' and 'trips'. Every row inside the 'zones' table defines a unique taxi zone, while each row in the 'trips' table corresponds to a single taxi ride.

### 2. Relationships and keys
The primary key for the zones table is 'zones.LocationID', and for trips, it is 'trips.id'. To connect them, 'PULocationID' and 'DOLocationID' in the trips table function as foreign keys that link back to that zone ID.

### 3. Why I normalized 
Normalization was used to eliminate data redundancy. Previously, attributes like borough names and zone titles were duplicated on every trip entry twice,once for the pickup point and once for the drop-off,adding up to six repeating columns per row. Now, that area info is stored just once in the 'zones' table.

### 4. Indexes
To speed up common searches and API filtering, indexes were created on specific columns:
* **Pickup time ('tpep_pickup_datetime'):** Speeds up date-based queries and sorting.
* **'PULocationID' and 'DOLocationID':** Speeds up location filters and borough joins.
* **'total_amount':** Speeds up fare range filtering and sorting.
*(Note: No index was added for trip distance).*

### 5. Why SQLite
SQLite was selected because it's lightweight, requires no external server installation, and is natively integrated into Python. Its main drawback is that it doesn't handle heavy simultaneous write operations from multiple users very well.

### 6. Data loading
The 'database.py' script clears existing records at the start to avoid duplicates if re-run. It populates the 'zones' table first since the trips rely on those foreign keys, and then inserts the trips in batches of 50,000 rows. I had to test using a smaller sample because the full 656 MB raw dataset completely filled up my Chromebook's local storage, so the full dataset has not been loaded yet.

### 7. API design
The backend features a few key routes: '/' acts as a health check, '/api/stats' supplies overall summaries and borough trip counts, and '/api/trips' handles filtering, sorting, and pagination. To prevent SQL injection, all user filter parameters use safe placeholders ('?'), sorting is restricted to a whitelist of columns, and results are capped at 1,000 records maximum.

### 8. Limitations and improvements
If given more time, several areas could be improved or addressed:
* **Foreign Key Enforcement:** SQLite doesn't enforce foreign keys by default unless 'PRAGMA foreign_keys = ON' is enabled, which my code currently misses.
* **Further Normalization:** Additional repeating fields like 'payment_type' or 'VendorID' could be extracted into sepearate lookup tables.
* **Pagination Performance:** Using 'OFFSET' for pagination becomes slower as the table size grows.
* **Data Quality:** Out of the nearly 200,000 trips in our sample, about 3,155 map to an "Unknown" borough, because the TLC itself assigns those trips to its "Unknown" zone IDs when the location wasn't recorded.
* **Missing Borough Name:** 142 sample trips have a pickup zone (ID 265) with no borough name, because pandas read the TLC's "N/A" borough label as a missing value. They are counted in the total but missintg from the borough distribution. The fix is to load the zone file with 'keep_defult_na=False'
