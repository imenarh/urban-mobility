import os 
import sqlite3
import pandas as pd

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "../data/processed/urban_mobility.db")
CSV_PATH = os.path.join(BASE_DIR, "../data/processed/cleaned_trips.csv")
ZONES_PATH = os.path.join(BASE_DIR, "../data/raw/taxi_zone_lookup.csv")
SCHEMA_PATH = os.path.join(BASE_DIR, "../sql/schema.sql")

#these now live in the zones table
ZONE_COLUMNS = ["PUBorough","PUZone","PUServiceZone",
                "DOBorough","DOZone","DOServiceZone"]

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Builds the tables and indexes from schema.sql"""
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = get_db_connection()

    with open(SCHEMA_PATH) as f:
        conn.executescript(f.read())
    
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
    conn.execute("DELETE FROM zones")
    conn.commit()

    zones = pd.read_csv(ZONES_PATH)
    zones.to_sql("zones",conn, if_exists="append", index=False)
    print(f"Loaded {len(zones)} zones.")

    chunksize = 50000
    total_inserted = 0

    for chunk in pd.read_csv(CSV_PATH, chunksize=chunksize):
        chunk = chunk.drop(columns=ZONE_COLUMNS)
        chunk.to_sql("trips", conn, if_exists="append", index=False)
        total_inserted += len(chunk)
        print(
            f"Sucessfully inserted {total_inserted} total records into SQLite..."
        )    

    conn.close()
    print("Full dataset successfully uploaded to local SQLite database!")

if __name__ in ("__main__",):   
   load_cleaned_data_to_sqlite() 
    