# Frontend API Endpoints

## Latest Tag Values Endpoint

Get the most recent tag values for a machine in a convenient format.

### Endpoint
```
GET /api/influxdb/latest
```

### Query Parameters
- `machineId` (optional): Machine ID to query. Default: `machine-01`
- `timeRange` (optional): Time range to search. Default: `-5m`

### Example Requests

#### Using curl:
```bash
# Get latest values for machine-01
curl http://localhost:3005/api/influxdb/latest?machineId=machine-01

# Get latest values for machine-02 with custom time range
curl http://localhost:3005/api/influxdb/latest?machineId=machine-02&timeRange=-10m
```

#### Using Python:
```python
import requests

response = requests.get(
    "http://localhost:3005/api/influxdb/latest",
    params={"machineId": "machine-01"}
)
data = response.json()
print(data)
```

#### Using the test script:
```bash
# Test with default machine-01
python3 test_api_latest.py

# Test with specific machine
python3 test_api_latest.py machine-02
```

### Response Format

#### Success (200):
```json
{
  "machineId": "machine-01",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "_time": "2024-01-15T10:30:00Z",
    "machine_id": "machine-01",
    "SystemRunning": true,
    "Fault": false,
    "Filling": true,
    "Ready": true,
    "BottlesFilled": 1234,
    "BottlesRejected": 5,
    "BottlesPerMinute": 45.2,
    "AlarmFault": false,
    "AlarmOverfill": false,
    "AlarmUnderfill": false,
    "AlarmLowProductLevel": false,
    "AlarmCapMissing": false,
    "FillLevel": 75.5,
    "TankTemperature": 22.3,
    "TankPressure": 15.2,
    "FillFlowRate": 2.5,
    "ConveyorSpeed": 120.0,
    "LowLevelSensor": false
  }
}
```

#### No Data Found (404):
```json
{
  "message": "No data found",
  "machineId": "machine-01",
  "data": null
}
```

#### Error (500):
```json
{
  "error": "Error message here"
}
```

---

## Custom Query Endpoint

Execute any Flux query directly.

### Endpoint
```
POST /api/influxdb/query
```

### Request Body
```json
{
  "fluxQuery": "from(bucket: \"plc_data_new\") |> range(start: -5m) |> limit(n: 1)"
}
```

### Example
```bash
curl -X POST http://localhost:3005/api/influxdb/query \
  -H "Content-Type: application/json" \
  -d '{
    "fluxQuery": "from(bucket: \"plc_data_new\") |> range(start: -5m) |> filter(fn: (r) => r[\"machine_id\"] == \"machine-01\") |> last()"
  }'
```

### Response
```json
{
  "data": [
    {
      "_time": "2024-01-15T10:30:00Z",
      "_field": "SystemRunning",
      "_value": true,
      "machine_id": "machine-01"
    }
  ]
}
```

---

## Quick Test

1. **Start the services:**
   ```bash
   # Terminal 1: Start Docker services
   docker-compose up -d
   
   # Terminal 2: Start mock PLC agent
   ./start_mock_plc.sh machine-01
   
   # Terminal 3: Start InfluxDB writer
   ./start_influxdb_writer.sh
   
   # Terminal 4: Start frontend
   cd frontend && npm run dev
   ```

2. **Wait a few seconds for data to be written**

3. **Test the endpoint:**
   ```bash
   python3 test_api_latest.py machine-01
   ```

   Or:
   ```bash
   curl http://localhost:3005/api/influxdb/latest?machineId=machine-01 | python3 -m json.tool
   ```

