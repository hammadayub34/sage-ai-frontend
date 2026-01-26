# Replit Secrets Configuration

This file lists all the environment variables (secrets) that need to be added in Replit's Secrets tab.

## How to Add Secrets in Replit

1. Click the **🔒 Secrets** tab (lock icon) in the left sidebar
2. Click **"New secret"**
3. Add each secret as `KEY=value` (or just the key name, then enter the value)
4. Click **"Add secret"**

## Required Secrets

### MQTT Configuration
```
MQTT_BROKER_HOST=your-cluster.hivemq.cloud
MQTT_BROKER_PORT=8883
MQTT_USERNAME=your-hivemq-username
MQTT_PASSWORD=your-hivemq-password
MQTT_TLS_ENABLED=true
```

### InfluxDB Configuration
```
INFLUXDB_URL=https://us-east-1-1.aws.cloud2.influxdata.com
INFLUXDB_TOKEN=your-influxdb-token
INFLUXDB_ORG=your-org-name
INFLUXDB_BUCKET=plc_data_new
```

### InfluxDB Configuration (Frontend - Next.js)
```
NEXT_PUBLIC_INFLUXDB_URL=https://us-east-1-1.aws.cloud2.influxdata.com
NEXT_PUBLIC_INFLUXDB_TOKEN=your-influxdb-token
NEXT_PUBLIC_INFLUXDB_ORG=your-org-name
NEXT_PUBLIC_INFLUXDB_BUCKET=plc_data_new
```

### Pinecone Configuration (NEW - Add These!)
```
PINECONE_API_KEY=your_pinecone_api_key_here
PINECONE_INDEX_NAME=alarm-manual
```

### OpenAI Configuration (Required for Chat/RAG)
```
OPENAI_API_KEY=your_openai_api_key_here
```

### Machine Configuration
```
MACHINE_ID=machine-01
PUBLISH_INTERVAL=2.0
```

## Notes

- **Secrets are encrypted** and not visible in your code
- **Restart Replit** after adding new secrets for them to take effect
- **Case-sensitive**: Make sure key names match exactly
- **No quotes needed**: Just add `KEY=value` directly

## Quick Checklist

- [ ] MQTT secrets added
- [ ] InfluxDB secrets added
- [ ] InfluxDB Next.js secrets added
- [ ] **Pinecone secrets added** ⭐
- [ ] OpenAI API key added
- [ ] Machine configuration added

## Testing Secrets

After adding secrets, test them in Replit shell:

```bash
# Test Pinecone
python3 -c "import os; print('PINECONE_API_KEY:', 'SET' if os.getenv('PINECONE_API_KEY') else 'NOT SET')"

# Test OpenAI
python3 -c "import os; print('OPENAI_API_KEY:', 'SET' if os.getenv('OPENAI_API_KEY') else 'NOT SET')"
```

