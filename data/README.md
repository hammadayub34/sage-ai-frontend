# Data Directory

This directory is for storing CSV files and other data files that need to be imported into InfluxDB.

## Adding CSV Files

1. Place your CSV file in this directory
2. Use the import script to load it into InfluxDB:

```bash
# Basic import (auto-detects columns)
python scripts/import_csv_to_influxdb.py data/your_file.csv your_bucket_name

# With specific measurement name
python scripts/import_csv_to_influxdb.py data/your_file.csv your_bucket_name --measurement my_measurement

# With time column
python scripts/import_csv_to_influxdb.py data/your_file.csv your_bucket_name --time-column timestamp

# With time format
python scripts/import_csv_to_influxdb.py data/your_file.csv your_bucket_name --time-column timestamp --time-format "%Y-%m-%d %H:%M:%S"

# With tag columns (for filtering/grouping)
python scripts/import_csv_to_influxdb.py data/your_file.csv your_bucket_name --tag-columns machine_id,location
```

## CSV Format

Your CSV file should have:
- A header row with column names
- At least one data column
- Optionally a timestamp column

Example CSV:
```csv
timestamp,machine_id,location,temperature,pressure
2024-01-01 10:00:00,machine-01,floor-1,25.5,1013.25
2024-01-01 10:01:00,machine-01,floor-1,25.6,1013.30
```

## Notes

- The script will automatically detect numeric vs string values
- If no time column is specified, it will use the current time for all rows
- Tag columns are useful for filtering/grouping data in InfluxDB
- Field columns contain the actual measurement values

