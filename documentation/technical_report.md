## Data Processing and Cleaning 

### 1. Problem Framing and Dataset Analysis

* **Data context** To map spatial zone identifiers PULocationID and DOLocationID to boroughs and service zones, we used the NYC Taxi Trip dataset which contains raw yellow cab trip data and taxi_zone_lookup.csv, which is a dimension table.

* **Data Challenges & Outliers:** Physical anomalies in data identified during initial inspection: Negative fare amounts (refund adjustments or metering issues), zero/negative trip durations, distance outliers > 100 miles, missing congestion_surcharge fields in early records. In addition, there were inconsistencies in the datetime formatting in the timestamps.

* **Assumptions** Data integrity was ensured by quarantining and removing records that had a timestamp during the cleaning process that was earlier than the pickup timestamp, and those with a trip time of zero or a negative fare. The null congestion surcharges were imputed as 0.0 as they were pre-mandatory implementation records.

* We created three strong metrics to feature:
1. **The average speed** in miles per hour, computed from distance and trip duration (in minutes) to determine traffic congestion bottlenecks.
2. **fare_per_mile:** Total amount over trip distance, used to determine trip unit-economics.
3. **is_rush_hour:** A binary variable indicating the rush hours of a weekday (between 7-10 AM and 4-7 PM).



## Database Design and Architecture 

### Architecture Diagram

<img width="391" height="422" alt="image" src="https://github.com/user-attachments/assets/554737fe-83e8-423f-9d4b-1e24d0ae0bd6" />

### Stack Choices & Justification
The backend server was selected to be Python 3.8.10 and Flask, which is lightweight, fast to prototype and easily integrated into other data science libraries such as pandas and numpy.

SQLite: Switched from a cloud-managed PostgreSQL instance (Neon) to local SQLite to avoid hard limits on cloud storage (1GB free tier limits, vs. ~1.6GB cleaned data footprint). SQLite offers local deployment without configuration, high read performance, support for native Python libraries (sqlite3).

For frontend, selected Vanilla JavaScript & Chart.js, to maintain a fast, framework-agnostic dashboard with no complex build steps and for analytical charts to be responsive, Chart.js was chosen.

### Trade-offs made during design(compromises)
**Local vs. Cloud Database:** Neon PostgreSQL provided enterprise cloud scaling capabilities, but SQLite was selected for the reliability and cost-efficiency of operating within the bounds of the local environment. The downside being that the dashboard loses out on being able to write concurrently to other users, but this is ok for an analytical dashboard that reads a lot.

**Pre-computed vs. Dynamic Aggregations:** The statistics are computed dynamically instead of creating static pre-cached files. This makes it possible to get fresh data for any filter query, but with a minor query latency on large unindexed scans.

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
* **Further Normalization:** Additional repeating fields like 'payment_type' or 'VendorID' could be extracted into separate lookup tables.
* **Pagination Performance:** Using 'OFFSET' for pagination becomes slower as the table size grows.
* **Data Quality:** Out of the nearly 200,000 trips in our sample, about 3,155 map to an "Unknown" borough, because the TLC itself assigns those trips to its "Unknown" zone IDs when the location wasn't recorded.
* **Missing Borough Name:** 142 sample trips have a pickup zone (ID 265) with no borough name, because pandas read the TLC's "N/A" borough label as a missing value. They are counted in the total but missing from the borough distribution. The fix is to load the zone file with 'keep_default_na=False' .
* **Out-of-range Dates:** The sample covers roughly December 31, 2018 to January 3, 2019. 349 trips (about 0.18%) fall outside January 1 to 3, mostly from December 31, but a few have clearly invalid years such as 2003. The cleaning step did not remove these, and the insight queries exclude them.



## Frontend development 

### 1. Overview
The frontend is a single page dashboard created with HTML, CSS and JavaScript and using Chart.js for the charts. It provides a user with the ability to filter NYC taxi trips and display the results in summary cards, charts and a table, based on data from Member 2's Flask API.

### 2. Structure and design
The code is in three files: index.html (structure), css/style.css (styling) and js/script.js (behaviour). For the small-dashboard, I used a single JavaScript file. It is divided into labeled sections and each function has only one function. All of the filters, sort order and page number are stored in a single state object, so that all of the parts of the page remain consistent. The colours are CSS variables and the layout changes to a single column below 800px.

### 3. Features
* **Filters:** date range, borough, distance range and fare range. They are checked first by the browser and are not allowed to be higher than the maximum (a minimum cannot be greater than the maximum) before the request is made.
* **Summary cards:** total trips, average fare, distance, duration and speed.
* **Graphics:** Borough doughnut chart, fare-against-distance scatter plot for up to 300 trips.
* A table displaying trips, which can be sorted by column and paged at 20 trips per page. There is a View button for each field including the derived average speed, fare per mile and flag for rush hour.

### 4. Backend integration.
The frontend only uses /api/trips and /api/stats. Three small lookups take place between the two sides of the fence: toApiParams() (date_from becomes start_date), SORT_COLUMNS (sort_fields), fromApiTrip() (PUZone becomes pickup_zone).
The API returns no total count, so getTrips() requests 21 rows (the default is 20) per page and only calls Next if there is an additional row. getTrips() fetches the data once and reprocesses it as needed. /api/stats does not use filters and fetches the entire table, and only calls Next if there is an additional row.

### 5. Error handling and accessibility
All requests are made through getJSON(), and refreshDashboard() handles any errors and displays the error message "Could not load data" in the status pill. If there are no trips returned in the search results, the empty result will display "No trips match these filters. The page also has a skip link, labelled inputs, visible focus outline and a native dialog popup and roles.

### 6. Testing
There was syntax checking of script.js and the entire dashboard was executed on mock data while developing it. This test should be performed against the real database as full data set is not loaded. Planned checks: each filter alone and in combination, invalid input, no results, sorting, first and last page, the popup, backend stopped and mobile layout. Results and screenshots to be added.

### 7. Limitations and improvements
* All of the cards and the borough chart aren't affected by filtering, as /api/stats doesn't support filters.
* The scatter plot is not representative of a random sample of the first 300 matching trips.
* There's no map or hourly chart, as there are no endpoints in the backend for them.
* With additional time: filter support in /api/stats, hourly and zone endpoints, GeoJSON borough heat map, a total count to aid in pagination.

## Algorithms, Integration & Testing

We chose to implement a simple bubble sort algorithm and return the top 5 destinations of the drop-off zones.

**How it works**

- To count and group trips by drop-off location (DOLocationID), we use an basic SQL query.
- use the *bubble sort* algorithm to compare and sort/rank the locations by number of trips ending there.
- To select the top 5 highest-ranked zones, choose that option -
- Use the 5 location IDs to get their names from the zones table.
- Return a JSON object with the 5 locations and # of trips to each location.

**Why bubble sort?**

The reason we selected a bubble sort is its simplicity, it was easy to understand, implement, and demonstrate without using Python's built-in sorting functions.

It is very suitable for our data set as we do not have millions of trips to sort – just a few types of drop-off zones.

**The time and space complexity.**

Database aggregation: Counts trips by drop-off location. Processing cost will depend on how many times it is done as well as the query execution plan generated by SQLite.

Bubble sort: O(m²) time for m number of different drop-off locations.

Space: O(1) additional space as the bubble sort uses the space that is already occupied by the list.

Sorting result: O(10log n) to sort the results.

**Limitations**

The bubble sort is not as efficient as algorithms like merge sort and heap sort for large lists.

The database should sum all the trips prior to the sorting process.

It currently ranks the entire data set and will not change if dashboard filters are applied.

Counting the number of trips may be costly for large data sets. Count numbers may be stored in a cache or precounted for better performance.

**Integration and testing**

The ranking algorithm was integrated in the Flask API with the endpoint `/api/ranking`. The frontend polls the results and shows the top 5 "drop-off zones" on the dashboard.

The endpoint was tested to see if it would return a 5 record HTTP 200. The ranking was also displayed in the frontend.


### Insights and Interpretation

<img width="1280" height="719" alt="WhatsApp Image 2026-10-14 at 23 45 33" src="https://github.com/user-attachments/assets/dc7d5ca8-a754-4610-95bf-0203b222330a" />



### Reflecting and Future Work

### Team Challenges: 

**Technical**

* Installing in a legacy environment with Python 3.8.10 had dependency resolution issues; careful version pinning of compatible versions of libraries (e.g., pandas==2.0.3 and numpy==1.24.3) was necessary to ensure that the pipeline was testable without variation.

* Handling well over 7.5 million records (~1.6GB cleaned CSV) introduced major memory and storage issues when ingesting the data into the database in bulk, so memory-safe chunking strategies were required (50,000 rows at a time) as well as moving to SQLite.

* Coordinating code contributions amongst four distinct pipeline, database, frontend, and algorithmic modules, involved in the system, was achieved through strict Git branching practices, .gitignore file configuration for large files of data, and the resolution of pre-receive hook size violations.

**Real world product improvements & Next steps**

If this application were deployed as a production grade enterprise mobility platform, a couple of architectural changes would be made a priority:

**Cloud Infrastructure Scaling:** Move from local SQLite to a managed cloud Postgres or distributed data warehouse (AWS RDS or Snowflake) to handle enterprise level high concurrency user traffic.

**Implementing Server-Side Pagination & Total Counts:** Enhance the responsiveness of the UI and navigation of dataset with efficient server-side pagination and total record count metadata.

**Geospatial Map Integration:** Using interactive mapping with Leaflet.js or Mapbox and PostGIS or spatial indexes, visualize pickup/drop-off "hotspot" locations by NYC borough.

**Real-Time Stream Processing:** Enhance the monthly batch pipeline model to receive live streaming taxi meter data feeds through Apache Kafka and WebSockets for real-time monitoring of the traffic.


