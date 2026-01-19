# InfluxDB: Bucket vs Measurement Explained

## Why `plc_data_new` (Bucket) vs `plc_data` (Measurement)?

### **Bucket: `plc_data_new`**
- **What it is:** A **container/database** in InfluxDB
- **Purpose:** Stores all time-series data
- **Configuration:** Set via `INFLUXDB_BUCKET` environment variable
- **Location in code:** Line 43 in `influxdb_writer_production.py`
  ```python
  INFLUXDB_BUCKET = os.getenv("INFLUXDB_BUCKET", "plc_data_new")
  ```
- **Used in:** `write_api.write(bucket=INFLUXDB_BUCKET, record=point)`

**Think of it as:** A database name (like MySQL database or PostgreSQL database)

---

### **Measurement: `plc_data`**
- **What it is:** A **table/collection** within the bucket
- **Purpose:** Groups related data points together
- **Configuration:** Hardcoded in the Point creation (Line 143)
  ```python
  point = Point("plc_data") \
      .tag("machine_id", machine_id) \
      .field("BottlesFilled", bottles_filled) \
      ...
  ```
- **Used in:** `Point("plc_data")` - this is the measurement name

**Think of it as:** A table name (like MySQL table or PostgreSQL table)

---

## InfluxDB Data Hierarchy

```
InfluxDB
└── Organization: "myorg"
    └── Bucket: "plc_data_new"  ← Container (like database)
        └── Measurement: "plc_data"  ← Table (like table)
            ├── Tags: machine_id="machine-01"
            ├── Fields: BottlesFilled, SystemRunning, etc.
            └── Timestamp: 2025-11-26T01:36:50Z
```

---

## Why This Naming?

### Historical Context:
- **Old bucket:** `plc_data` (might have old data or different schema)
- **New bucket:** `plc_data_new` (fresh start with new schema/fields)
- **Measurement:** `plc_data` (kept same name for consistency)

### Benefits:
1. **Bucket separation:** Can keep old and new data separate
2. **Measurement consistency:** Same measurement name across buckets
3. **Easy migration:** Can query both buckets if needed

---

## Query Examples

### Query from specific bucket:
```flux
from(bucket: "plc_data_new")  // ← Bucket name
  |> range(start: -1h)
  |> filter(fn: (r) => r["_measurement"] == "plc_data")  // ← Measurement name
  |> filter(fn: (r) => r["machine_id"] == "machine-01")
```

### Query both buckets (if needed):
```flux
union(
  tables: [
    from(bucket: "plc_data") |> range(start: -1h),
    from(bucket: "plc_data_new") |> range(start: -1h)
  ]
)
  |> filter(fn: (r) => r["_measurement"] == "plc_data")
```

---

## Summary

| Concept | Name | Purpose | Where Set |
|---------|------|---------|-----------|
| **Bucket** | `plc_data_new` | Container/database | `.env` file: `INFLUXDB_BUCKET` |
| **Measurement** | `plc_data` | Table/collection | Code: `Point("plc_data")` |

**Why different?**
- Bucket = Database (can have multiple measurements)
- Measurement = Table (groups related data points)
- We use `plc_data_new` bucket to keep new data separate from old `plc_data` bucket
- We use `plc_data` measurement name for consistency

