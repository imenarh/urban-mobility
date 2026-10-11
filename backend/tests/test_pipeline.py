import os 
import sys 
import pandas as pd 
import pytest
Sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__),"../src"))) from pipeline import run_data_pipeline
def test_data_pipeline():
    trip_path = "../data/raw/yellow_tripdata_2019-01.csv"
    lookup_path = "../data/raw/taxi_zone_lookup.csv"
    output_dir = "../data/processed"
    csv_out, log_out = run_data_pipeline(trip_path, lookup_path, output_dir)
    assert os.path.exists(csv_out), "Cleaned csv file was not generated"
    assert os.path.exists(logout), "Data quality log was not generated"
    df = pd.read_csv(csv_out)
    #Verification of the features
    assert "avg_speed_mph" in df.columns 
    assert "fare_per_mile" in df.columns 
    assert "is_rush_hour" in df.columns
    assert "PUBorough" in df.columns 
    assert "DOBorough" in df.columns 
    # Verfication of any invalid fares and negative durations
    assert (df["trip_duration_mins"] > 0).all()
    assert (df["fare_amount"] >= 0).all()
    assert len(df) > 0