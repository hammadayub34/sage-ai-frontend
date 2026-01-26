#!/bin/bash
# Setup MQTT broker authentication
# Creates password file and sets up users

set -e

PASSWD_FILE="mosquitto/config/passwd"

echo "🔐 Setting up MQTT broker authentication..."

# Check if mosquitto_passwd is available
if ! command -v mosquitto_passwd &> /dev/null; then
    echo "❌ mosquitto_passwd not found. Installing mosquitto-clients..."
    echo "   On macOS: brew install mosquitto"
    echo "   On Ubuntu: sudo apt-get install mosquitto-clients"
    exit 1
fi

# Create password file
if [ ! -f "$PASSWD_FILE" ]; then
    echo "📝 Creating password file..."
    # Use -b flag (batch mode) to specify password directly
    mosquitto_passwd -c -b "$PASSWD_FILE" edge_gateway edge_gateway_pass
    mosquitto_passwd -b "$PASSWD_FILE" influxdb_writer influxdb_writer_pass
    mosquitto_passwd -b "$PASSWD_FILE" admin admin_pass
    echo "✅ Password file created: $PASSWD_FILE"
else
    echo "ℹ️  Password file already exists: $PASSWD_FILE"
    echo "   To add a new user, run:"
    echo "   mosquitto_passwd -b $PASSWD_FILE <username> <password>"
fi

echo ""
echo "👤 Users created:"
echo "   - edge_gateway / edge_gateway_pass (OT Network - Publisher)"
echo "   - influxdb_writer / influxdb_writer_pass (IT Network - Subscriber)"
echo "   - admin / admin_pass (Full Access)"
echo ""
echo "⚠️  Change these passwords in production!"

