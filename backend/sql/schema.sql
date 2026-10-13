CREATE TABLE IF NOT EXISTS zones (
    LocationID INTEGER PRIMARY KEY,
    Borough TEXT,
    Zone TEXT,
    service_zone TEXT
);

CREATE TABLE IF NOT EXISTS trips (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    VendorID INTEGER,
    tpep_pickup_datetime TEXT,
    tpep_dropoff_datetime TEXT,
    passenger_count INTEGER,
    trip_distance REAL,
    RatecodeID INTEGER,
    store_and_fwd_flag TEXT,
    PULocationID INTEGER,
    DOLocationID INTEGER,
    payment_type INTEGER,
    fare_amount REAL,
    extra REAL,
    mta_tax REAL,
    tip_amount REAL,
    tolls_amount REAL,
    improvement_surcharge REAL,
    total_amount REAL,
    congestion_surcharge REAL,
    trip_duration_mins REAL,
    avg_speed_mph REAL,
    fare_per_mile REAL,
    pickup_hour INTEGER,
    pickup_dayofweek INTEGER,
    is_rush_hour INTEGER,
    FOREIGN KEY (PULocationID) REFERENCES zones(LocationID),
    FOREIGN KEY (DOLocationID) REFERENCES zones(LocationID)
);

CREATE INDEX IF NOT EXISTS idx_pickup_time ON trips(tpep_pickup_datetime);
CREATE INDEX IF NOT EXISTS idx_pu_location ON trips(PULocationID);
CREATE INDEX IF NOT EXISTS idx_do_location ON trips(DOLocationID);
CREATE INDEX IF NOT EXISTS idx_fare ON trips(total_amount);