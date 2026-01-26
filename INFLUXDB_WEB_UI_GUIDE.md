# InfluxDB Web UI Guide

## Access the Web Interface

### Step 1: Open InfluxDB in Browser

**URL:** http://localhost:8086

**Login Credentials:**
- Username: `admin`
- Password: `admin123`

---

## Step-by-Step: View Your Data

### Step 1: Login
1. Open browser: http://localhost:8086
2. Enter username: `admin`
3. Enter password: `admin123`
4. Click "Sign In"

### Step 2: Navigate to Data Explorer
1. Click **"Data Explorer"** in the left sidebar
   - Or go directly to: http://localhost:8086/orgs/myorg/data-explorer

### Step 3: Select Your Bucket
1. Click **"Select Bucket"** dropdown at the top
2. Choose: **`plc_data_new`**

### Step 4: Write a Query
1. Click **"Script Editor"** tab (if not already selected)
2. Paste this query:

```flux
from(bucket: "plc_data_new")
  |> range(start: -24h)
  |> filter(fn: (r) => r["_measurement"] == "plc_data")
  |> filter(fn: (r) => r["machine_id"] == "machine-01")
  |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
  |> sort(columns: ["_time"], desc: true)
  |> limit(n: 10)
```

3. Click **"Submit"** button

### Step 5: View Results
- Results appear in a table format
- You can see all tag values in columns
- Switch to **"Graph"** view for visualizations
- Export as CSV if needed

---

## Quick Queries to Try

### 1. Latest Values for Machine-01 (Pivot Table)
```flux
from(bucket: "plc_data_new")
  |> range(start: -24h)
  |> filter(fn: (r) => r["_measurement"] == "plc_data")
  |> filter(fn: (r) => r["machine_id"] == "machine-01")
  |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
  |> sort(columns: ["_time"], desc: true)
  |> limit(n: 1)
```

### 2. All Recent Data Points
```flux
from(bucket: "plc_data_new")
  |> range(start: -1h)
  |> filter(fn: (r) => r["_measurement"] == "plc_data")
  |> limit(n: 100)
```

### 3. BottlesFilled Over Time
```flux
from(bucket: "plc_data_new")
  |> range(start: -1h)
  |> filter(fn: (r) => r["_measurement"] == "plc_data")
  |> filter(fn: (r) => r["machine_id"] == "machine-01")
  |> filter(fn: (r) => r["_field"] == "BottlesFilled")
  |> aggregateWindow(every: 5m, fn: mean, createEmpty: false)
```

### 4. Count Total Data Points
```flux
from(bucket: "plc_data_new")
  |> range(start: -24h)
  |> filter(fn: (r) => r["_measurement"] == "plc_data")
  |> count()
```

### 5. Which Machines Have Data
```flux
from(bucket: "plc_data_new")
  |> range(start: -24h)
  |> filter(fn: (r) => r["_measurement"] == "plc_data")
  |> keep(columns: ["machine_id"])
  |> distinct(column: "machine_id")
```

---

## Using the Query Builder (Visual)

### Step 1: Use Query Builder
1. In Data Explorer, click **"Builder"** tab (instead of Script Editor)
2. Select:
   - **Bucket:** `plc_data_new`
   - **Measurement:** `plc_data`
   - **Field:** Choose any field (e.g., `BottlesFilled`)
   - **Filter:** Add filter `machine_id` = `machine-01`
   - **Time Range:** Last 24 hours

### Step 2: Visualize
- Click **"Graph"** tab to see charts
- Click **"Table"** tab to see data in table format
- Click **"Raw Data"** to see raw Flux output

---

## Creating Dashboards

### Step 1: Create Dashboard
1. Click **"Dashboards"** in left sidebar
2. Click **"Create Dashboard"**
3. Click **"Add Cell"**

### Step 2: Add Visualization
1. Select **"Visualization Type"** (Line Graph, Gauge, etc.)
2. Click **"Configure"**
3. Write Flux query or use Query Builder
4. Click **"Save"**

### Step 3: Example Dashboard Cell
**Query for BottlesFilled Gauge:**
```flux
from(bucket: "plc_data_new")
  |> range(start: -24h)
  |> filter(fn: (r) => r["_measurement"] == "plc_data")
  |> filter(fn: (r) => r["machine_id"] == "machine-01")
  |> filter(fn: (r) => r["_field"] == "BottlesFilled")
  |> last()
```

---

## Troubleshooting

### Can't Access http://localhost:8086?
1. **Check if InfluxDB is running:**
   ```bash
   docker ps | grep influxdb
   ```

2. **Start InfluxDB if not running:**
   ```bash
   cd /Users/khanhamza/mqtt-ot-network
   docker-compose up -d influxdb
   ```

3. **Check port:**
   - InfluxDB should be on port `8086`
   - Check `docker-compose.yml` for port mapping

### Login Not Working?
- Username: `admin`
- Password: `admin123`
- If changed, check `docker-compose.yml` environment variables

### No Data Showing?
1. **Check time range:**
   - Try `-24h` instead of `-5m`
   - Data might be older than you think

2. **Verify bucket name:**
   - Should be: `plc_data_new`
   - Check in Data Explorer dropdown

3. **Check if data exists:**
   ```bash
   python3 quick_query.py
   ```

### Query Errors?
- Make sure bucket name is in quotes: `"plc_data_new"`
- Check measurement name: `"plc_data"`
- Verify machine_id filter matches your data

---

## Quick Access Links

- **Main UI:** http://localhost:8086
- **Data Explorer:** http://localhost:8086/orgs/myorg/data-explorer
- **Dashboards:** http://localhost:8086/orgs/myorg/dashboards
- **Buckets:** http://localhost:8086/orgs/myorg/buckets

---

## Tips

1. **Use Script Editor** for complex queries
2. **Use Builder** for simple visual queries
3. **Switch between Table/Graph/Raw Data** views
4. **Export data** as CSV for analysis
5. **Save queries** for reuse
6. **Create dashboards** for monitoring

---

## Example: View All Tags for Machine-01

1. Go to Data Explorer
2. Select bucket: `plc_data_new`
3. Paste this query:

```flux
from(bucket: "plc_data_new")
  |> range(start: -24h)
  |> filter(fn: (r) => r["_measurement"] == "plc_data")
  |> filter(fn: (r) => r["machine_id"] == "machine-01")
  |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
  |> sort(columns: ["_time"], desc: true)
  |> limit(n: 1)
```

4. Click Submit
5. You'll see all 18 tags in columns:
   - SystemRunning, Fault, Filling, Ready
   - BottlesFilled, BottlesRejected, BottlesPerMinute
   - AlarmFault, AlarmOverfill, AlarmUnderfill, etc.
   - FillLevel, TankTemperature, TankPressure, etc.

