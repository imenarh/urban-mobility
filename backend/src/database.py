import os 
import sqlite3
import pandas as pd

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "../data/processed/urban_mobility.db")
CSV_PATH = os.path.join(BASE_DIR, "../data/processed/cleaned_trips.csv")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Creates the trips table and indexes."""
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
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
            PUBorough TEXT,
            PUZone TEXT,
            PUServiceZone TEXT,
            DOBorough TEXT,
            DOZone TEXT,
            DOServiceZone TEXT
            );
            """)
    # indexes for the filters the API uses
    cursor.execute(
        "CREATE INDEX IF NOT EXISTS idx_pickup_time ON"
        " trips(tpep_pickup_datetime);"
    )
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_pu_borough ON trips(PUBorough);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_do_borough ON trips(DOBorough);")

    conn.commit()
    conn.close()
    print("Local SQLite database schema and indexes initialized successfully!")


def load_cleaned_data_to_sqlite():
    """Bulk inserts cleaned CSV data into SQLite in memory-safe chunks."""
    init_db()

    if not os.path.exists(CSV_PATH):
        print(
            f"Error: {CSV_PATH} not found. Please run Member 1's pipline.py first"
            " to generate the processed dataset."
        )
        return
    print("Connecting to the local SQLitedatabase to begin bulk ingestion...")
    conn = get_db_connection()

    # clear old rows first so running this twice doesn't duplicate data
    conn.execute("DELETE FROM trips")
    conn.commit()

    chunksize = 50000
    total_inserted = 0

    for chunk in pd.read_csv(CSV_PATH, chunksize=chunksize):
        chunk.to_sql("trips", conn, if_exists="append", index=False)
        total_inserted += len(chunk)
        print(
            f"Sucessfully inserted {total_inserted} total records into SQLite..."
        )    

    conn.close()
    print("Full dataset successfully uploaded to local SQLite database!")

if __name__ in ("__main__",):   
   load_cleaned_data_to_sqlite() 
    