# Replit Setup Guide

This guide will help you set up and run the MQTT OT Network project on Replit.

## Step 1: Import Project to Replit

### Option A: If you already imported
1. Open your Replit project
2. Skip to Step 2

### Option B: Import from GitHub
1. Go to [Replit](https://replit.com)
2. Click **"Create Repl"**
3. Select **"Import from GitHub"**
4. Enter your repository URL: `https://github.com/hamzakhan3/mqtt-ot-network`
5. Click **"Import"**

## Step 2: Install Dependencies

### Quick Method (Recommended)
Just run the project - `main.py` will auto-install everything:
```bash
python main.py
```
OR click the **"Run"** button in Replit.

The script will automatically:
- ✅ Install Python dependencies (`requirements.txt`)
- ✅ Install frontend dependencies (`npm install`)
- ✅ Start all services

### Manual Method (If needed)
If you want to install dependencies manually first:

```bash
# Install Python dependencies
pip3 install -r requirements.txt

# Install frontend dependencies
cd frontend
npm install
cd ..
```

Or use the setup script:
```bash
chmod +x setup_replit.sh
./setup_replit.sh
```

## Step 3: Add Secrets (CRITICAL!)

**⚠️ The project will NOT work without these secrets!**

1. Click the **🔒 Secrets** tab (lock icon) in Replit's left sidebar
2. Click **"New secret"**
3. Add each secret from the list below:

### Required Secrets:

```
MQTT_BROKER_HOST=your-cluster.hivemq.cloud
MQTT_BROKER_PORT=8883
MQTT_USERNAME=your-hivemq-username
MQTT_PASSWORD=your-hivemq-password
MQTT_TLS_ENABLED=true

INFLUXDB_URL=https://us-east-1-1.aws.cloud2.influxdata.com
INFLUXDB_TOKEN=your-influxdb-token
INFLUXDB_ORG=your-org-name
INFLUXDB_BUCKET=plc_data_new

NEXT_PUBLIC_INFLUXDB_URL=https://us-east-1-1.aws.cloud2.influxdata.com
NEXT_PUBLIC_INFLUXDB_TOKEN=your-influxdb-token
NEXT_PUBLIC_INFLUXDB_ORG=your-org-name
NEXT_PUBLIC_INFLUXDB_BUCKET=plc_data_new

PINECONE_API_KEY=your_pinecone_api_key_here
PINECONE_INDEX_NAME=alarm-manual

OPENAI_API_KEY=your_openai_api_key_here

MACHINE_ID=machine-01
PUBLISH_INTERVAL=2.0
```

**See `REPLIT_SECRETS.md` for detailed instructions.**

## Step 4: Run the Project

### Method 1: Use the Run Button
1. Click the **▶️ Run** button in Replit
2. The `main.py` script will start automatically (configured in `.replit`)

### Method 2: Manual Start
```bash
python main.py
```

### What Gets Started:
- ✅ **InfluxDB Writer** - Writes MQTT data to InfluxDB
- ✅ **Mock PLC Agent** - Generates test data
- ✅ **Frontend** - Next.js web app (accessible via Replit webview)

## Step 5: Access the Frontend

1. After starting, look for the **webview** panel in Replit
2. Or click the **"Open in new tab"** icon next to the webview
3. The frontend should be running on port 3005 (or the port shown in logs)

## Troubleshooting

### "pip not found" or "npm not found"
- Replit should have these pre-installed
- If not, check the Replit console for errors

### "Module not found" errors
- Run: `pip3 install -r requirements.txt`
- Or let `main.py` auto-install (it will detect missing packages)

### Frontend not loading
- Check if `frontend/node_modules` exists
- If not, run: `cd frontend && npm install`
- Check the console logs for errors

### Services not starting
- Check the **Secrets** tab - all required secrets must be added
- Check console logs for specific error messages
- Verify your API keys are correct

### Port already in use
- Replit handles ports automatically
- If issues persist, check the logs in `/tmp/` directory

## Quick Test

After setup, test if secrets are configured:

```bash
# Test Pinecone
python3 -c "import os; print('PINECONE_API_KEY:', 'SET' if os.getenv('PINECONE_API_KEY') else 'NOT SET')"

# Test OpenAI
python3 -c "import os; print('OPENAI_API_KEY:', 'SET' if os.getenv('OPENAI_API_KEY') else 'NOT SET')"
```

## Project Structure

```
mqtt-ot-network/
├── main.py              # Main startup script (auto-installs deps)
├── .replit              # Replit configuration
├── requirements.txt     # Python dependencies
├── frontend/            # Next.js frontend
│   ├── package.json     # Node.js dependencies
│   └── ...
├── influxdb_writer/     # InfluxDB writer service
├── mock_plc_agent/      # Mock PLC data generator
├── alarm_monitor/       # Alarm monitoring service
└── scripts/             # Utility scripts
```

## Notes

- **Auto-installation**: `main.py` automatically detects and installs missing dependencies
- **Logs**: Service logs are written to `/tmp/` directory
- **Restart**: After adding new secrets, restart the project
- **Webview**: The frontend is accessible via Replit's webview panel

## Need Help?

- Check `REPLIT_SECRETS.md` for secrets configuration
- Check service logs in `/tmp/` directory
- Review console output for error messages

