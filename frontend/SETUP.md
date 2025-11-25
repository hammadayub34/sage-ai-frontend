# Frontend Setup Guide

## Quick Start

1. **Install dependencies:**
   ```bash
   cd frontend
   npm install
   ```

2. **Start the development server:**
   ```bash
   npm run dev
   ```
   
   Or use the helper script from the project root:
   ```bash
   ./start_frontend.sh
   ```

3. **Open your browser:**
   Navigate to `http://localhost:3005`

## Configuration

The frontend connects directly to InfluxDB. Default configuration:
- **URL:** `http://localhost:8086`
- **Token:** `my-super-secret-auth-token`
- **Org:** `myorg`
- **Bucket:** `plc_data_new`

To customize, create a `.env.local` file in the `frontend` directory:
```
NEXT_PUBLIC_INFLUXDB_URL=http://localhost:8086
NEXT_PUBLIC_INFLUXDB_TOKEN=your-token-here
NEXT_PUBLIC_INFLUXDB_ORG=your-org
NEXT_PUBLIC_INFLUXDB_BUCKET=your-bucket
```

## CORS Configuration (if needed)

If you encounter CORS errors when connecting to InfluxDB, you may need to configure InfluxDB to allow cross-origin requests. However, since we're running both on localhost, this should not be an issue.

If you do need to enable CORS in InfluxDB, you can add this to your InfluxDB configuration or use a proxy.

## Features

✅ Real-time status monitoring  
✅ Production counters  
✅ Alarm panel  
✅ Tank status  
✅ Time series charts  
✅ Circular gauges  
✅ Complete tags table  
✅ Multi-machine support  

## Troubleshooting

### No data showing
1. Ensure InfluxDB is running: `docker ps | grep influxdb`
2. Check that data is being written: Run `check_influxdb_data.py`
3. Verify the bucket name matches: Default is `plc_data_new`
4. Check browser console for errors

### Connection errors
1. Verify InfluxDB is accessible at `http://localhost:8086`
2. Check the token is correct
3. Ensure the organization name matches

### Build errors
1. Make sure all dependencies are installed: `npm install`
2. Check Node.js version (should be 18+)
3. Clear `.next` folder and rebuild: `rm -rf .next && npm run build`

