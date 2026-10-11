import os
from datetime import datetime
import numpy as np
import pandas as pd

def run_data_pipeline(
    trip_file="../data/raw/yellow_tripdata_2019-01.csv",
    lookup_file="../data/raw/taxi_zone_lookup.csv",
    output_dir="../data/processed",
):
    os.makedirs(output_dir, exist_ok=True)
    log_messages = []
    log_messages.append(f"[{datetime.now()}] Currently starting data processing pipeline...")
# Loading raw data for later use
    try:
        trips = pd.read_csv(trip_file)
        lookup = pd.read_csv(lookup_file)
        log_messages.append(f"Successfully loaded {len(trips)} raw trip records and {len(lookup)} "
        "Zone lookup records."
        )

    except Exception as e:
        log_messages.append(f"Error loading source files: {str(e)}")
        raise e 
    initial_count = len(trips)
#Handling of the values that are missing
    if "congestion_surcharge" in trips.columns:
        trips["congestion_surcharge"] = trips["congestion_surcharge"].fillna(0.0)
    trips = trips.dropna(
        subset=[
            "tpep_pickup_datetime",
            "tpep_dropoff_datetime",
            "PULocationID",
            "DOLocationID",
        ]
    )

    # 2. Standardizing the timestamp.

    trips["tpep_pickup_datetime"] = pd.to_datetime(
        trips["tpep_pickup_datetime"], errors="coerce"
    )
    trips["tpep_dropoff_datetime"] = pd.to_datetime(
        trips["tpep_dropoff_datetime"], errors="coerce"
    )

    invalid_time =(
        trips["tpep_pickup_datetime"].isnull()
        | trips["tpep_dropoff_datetime"].isnull()
    )
    if invalid_time.sum() > 0:
        log_messages.append(
            f"Dropped {invalid_time.sum()} rows with invalid timestamp formats."
        )
        trips = trips[~invalid_time]

    #Trip duration to be calculated in minutes

    trips["trip_duration_mins"] = (
        trips["tpep_dropoff_datetime"] - trips["tpep_pickup_datetime"]    
    ).dt.total_seconds()/60.0

    #Detection of impossible constraints

    invalid_duration = trips["trip_duration_mins"] <= 0
    invalid_fare = (trips["fare_amount"]<0) | (trips["total_amount"]<0)
    invalid_distance = (trips["trip_distance"]<0) | (trips["trip_distance"]>100)
    invalid_passengers = (trips["passenger_count"] <= 0) | (trips["passenger_count"] > 6)

    outlier_mask= (invalid_duration | invalid_fare | invalid_distance | invalid_passengers)
    outlier_count = outlier_mask.sum()
    log_messages.append(
        f"Dropped {outlier_count} records because of physical or logical anomalies"
        "(negative fares, zero/negative duration, distance > 100mi, invalid"
        "passanger count)."
    )
    clean_trips = trips[~outlier_mask].copy()

    #Removing duplicate records 

    dup_count = clean_trips.duplicated().sum()
    clean_trips = clean_trips.drop_duplicates()
    log_messages.append(f"Removed {dup_count} duplicate records.")
    # 3.Features
    #Feature 1: average speed in miles per hour
    clean_trips["avg_speed_mph"] = np.where(
        clean_trips["trip_duration_mins"] > 0,
        clean_trips["trip_distance"] / (clean_trips["trip_duration_mins"] / 60.0),0.0,
    )
    speed_outlier_mask = clean_trips["avg_speed_mph"]>80
    log_messages.append(
        f"Dropped {speed_outlier_mask.sum()} records with unrealistic average"
        " speed > 80mph"
    )
    clean_trips = clean_trips[~speed_outlier_mask]
    #Feature number 2 will be the fare paid per mile
    clean_trips["fare_per_mile"] = np.where(
        clean_trips["trip_distance"] > 0,
        clean_trips["total_amount"] / clean_trips["trip_distance"],
        clean_trips["total_amount"],
    )
    #Feature 3: An indicator for rush hour weekly
    clean_trips["pickup_hour"] = clean_trips["tpep_pickup_datetime"].dt.hour 
    clean_trips["pickup_dayofweek"] = (
        clean_trips["tpep_pickup_datetime"].dt.dayofweek
    )
    clean_trips["is_rush_hour"] = (
        (clean_trips["pickup_dayofweek"] < 5) & (clean_trips["pickup_hour"].between(7, 10) | clean_trips["pickup_hour"].between(16,19)
        )
    ).astype(int)
    # 4. Next step is integrating with taxi_zone_lookup.csv file
    pu_lookup = lookup.rename(
        columns={"LocationID": "PULocationID", "Borough": "PUBorough", "Zone": "PUZone", "service_zone": "PUServiceZone",}
    )
    do_lookup = lookup.rename(columns={"LocationID": "DOLocationID", 
    "Borough": "DOBorough", "Zone": "DOZone", "service_zone": "DOServiceZone",
    })
    enriched_trips = clean_trips.merge(
        pu_lookup, on="PULocationID", how="left"
        ).merge(do_lookup, on="DOLocationID", how="left")
    final_count = len(enriched_trips)
    retention = ((final_count / initial_count)* 100 if initial_count > 0 else 0)
    log_messages.append(f"Pipeline complete. Initial: {initial_count}, Clean: {final_count}"
        f"(Retention: {retention:.2f}%)"
    )
    # Delivered output
    output_csv = os.path.join(output_dir, "cleaned_trips.csv")
    enriched_trips.to_csv(output_csv, index=False)
    log_file = os.path.join(output_dir, "data_quality_log.txt") 
    with open(log_file, "w") as f: f.write("\n".join(log_messages))
    print("\n".join(log_messages))
    return output_csv, log_file 
if __name__ == "__main__":
    run_data_pipeline( 
        trip_file="../data/raw/yellow_tripdata_2019-01.csv",
        lookup_file="../data/raw/taxi_zone_lookup.csv",)