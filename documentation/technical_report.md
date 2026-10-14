## Data Processing and Cleaning (Ganza Gavin):

### 1. Problem Framing and Dataset Analysis

* **Data context** To map spatial zone identifiers PULocationID and DOLocationID to boroughs and service zones, we used the NYC Taxi Trip dataset which contains raw yellow cab trip data and taxi_zone_lookup.csv, which is a dimension table.

* **Data Challenges & Outliers:** Physical anomalies in data identified during initial inspection: Negative fare amounts (refund adjustments or metering issues), zero/negative trip durations, distance outliers > 100 miles, missing congestion_surcharge fields in early records. In addition, there were inconsistencies in the datetime formatting in the timestamps.

* **Assumptions** Data integrity was ensured by quarantining and removing records that had a timestamp during the cleaning process that was earlier than the pickup timestamp, and those with a trip time of zero or a negative fare. The null congestion surcharges were imputed as 0.0 as they were pre-mandatory implementation records.

* We created three strong metrics to feature:
1. **The average speed** in miles per hour, computed from distance and trip duration (in minutes) to determine traffic congestion bottlenecks.
2. **fare_per_mile:** Total amount over trip distance, used to determine trip unit-economics.
3. **is_rush_hour:** A binary variable indicating the rush hours of a weekday (between 7-10 AM and 4-7 PM).



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
* **Further Normalization:** Additional repeating fields like 'payment_type' or 'VendorID' could be extracted into separate lookup tables.
* **Pagination Performance:** Using 'OFFSET' for pagination becomes slower as the table size grows.
* **Data Quality:** Out of the nearly 200,000 trips in our sample, about 3,155 map to an "Unknown" borough, because the TLC itself assigns those trips to its "Unknown" zone IDs when the location wasn't recorded.
* **Missing Borough Name:** 142 sample trips have a pickup zone (ID 265) with no borough name, because pandas read the TLC's "N/A" borough label as a missing value. They are counted in the total but missing from the borough distribution. The fix is to load the zone file with 'keep_default_na=False' .
* **Out-of-range Dates:** The sample covers roughly December 31, 2018 to January 3, 2019. 349 trips (about 0.18%) fall outside January 1 to 3, mostly from December 31, but a few have clearly invalid years such as 2003. The cleaning step did not remove these, and the insight queries exclude them.



## Frontend development (Yai Majak D'Agoot)

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


## Algorithms, Integration & Testing (Imena Rwigema Herve)

**For the algorithm:** a hash map is used which is hand-written to count trips per drop-off zone. Then a hand-written min-heap of size K = 5 picks the top 5.

**How it works**

* Count in one scan over the trips (O(n) time): O(m) memory (m is the number of different zones/route).
* Rank with the min-heap (current top K). The root is the smallest of the K.
  -If a new count is larger than the root, new count replaces the root and shifts down.
  - Otherwise skip it.
* To read out the result, pop everything and reverse it and it will go from the biggest to the smallest.

**Why this and not a full sort**

- It takes O(m log K) time as opposed to O(m log m).
- The memory usage for the ranking is O(K).
- One comparison per item with the root.

**Honest restrictions on the statements made in the report**

The heap won't make it any easier because of counting.
The gain in speed is small with approximately 265 zones. It is of greater importance for routes (tens of thousands of pairs).
The heap is simpler, but has a predictable worst case; quickselect is O(m) on average.
Cache the counts to avoid counting millions of rows for each load.

**Definitions**

Top 5" refers to the 5 greatest numbers.
The k is the number of results to return, not the maximum value.

