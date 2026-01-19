#!/bin/bash
# Generate TLS certificates for MQTT broker
# This script creates self-signed certificates for development/testing
# For production, use certificates from a trusted CA

set -e

CERT_DIR="mosquitto/config/certs"
CA_KEY="$CERT_DIR/ca.key"
CA_CERT="$CERT_DIR/ca.crt"
SERVER_KEY="$CERT_DIR/server.key"
SERVER_CERT="$CERT_DIR/server.crt"
CLIENT_KEY="$CERT_DIR/client.key"
CLIENT_CERT="$CERT_DIR/client.crt"

# Create certs directory
mkdir -p "$CERT_DIR"

echo "🔐 Generating TLS certificates for MQTT broker..."

# Generate CA private key
if [ ! -f "$CA_KEY" ]; then
    echo "📝 Creating CA private key..."
    openssl genrsa -out "$CA_KEY" 2048
fi

# Generate CA certificate
if [ ! -f "$CA_CERT" ]; then
    echo "📝 Creating CA certificate..."
    openssl req -new -x509 -days 3650 -key "$CA_KEY" -out "$CA_CERT" \
        -subj "/C=US/ST=State/L=City/O=Organization/CN=MQTT-CA"
fi

# Generate server private key
if [ ! -f "$SERVER_KEY" ]; then
    echo "📝 Creating server private key..."
    openssl genrsa -out "$SERVER_KEY" 2048
fi

# Generate server certificate signing request
if [ ! -f "$CERT_DIR/server.csr" ]; then
    echo "📝 Creating server certificate signing request..."
    openssl req -new -key "$SERVER_KEY" -out "$CERT_DIR/server.csr" \
        -subj "/C=US/ST=State/L=City/O=Organization/CN=mqtt-broker"
fi

# Generate server certificate
if [ ! -f "$SERVER_CERT" ]; then
    echo "📝 Creating server certificate..."
    openssl x509 -req -in "$CERT_DIR/server.csr" -CA "$CA_CERT" -CAkey "$CA_KEY" \
        -CAcreateserial -out "$SERVER_CERT" -days 3650
fi

# Generate client private key (for edge gateway)
if [ ! -f "$CLIENT_KEY" ]; then
    echo "📝 Creating client private key..."
    openssl genrsa -out "$CLIENT_KEY" 2048
fi

# Generate client certificate signing request
if [ ! -f "$CERT_DIR/client.csr" ]; then
    echo "📝 Creating client certificate signing request..."
    openssl req -new -key "$CLIENT_KEY" -out "$CERT_DIR/client.csr" \
        -subj "/C=US/ST=State/L=City/O=Organization/CN=edge-gateway"
fi

# Generate client certificate
if [ ! -f "$CLIENT_CERT" ]; then
    echo "📝 Creating client certificate..."
    openssl x509 -req -in "$CERT_DIR/client.csr" -CA "$CA_CERT" -CAkey "$CA_KEY" \
        -CAcreateserial -out "$CLIENT_CERT" -days 3650
fi

# Set permissions
chmod 600 "$CA_KEY" "$SERVER_KEY" "$CLIENT_KEY"
chmod 644 "$CA_CERT" "$SERVER_CERT" "$CLIENT_CERT"

echo ""
echo "✅ TLS certificates generated successfully!"
echo ""
echo "📁 Certificate files:"
echo "   CA Certificate: $CERT_DIR/ca.crt"
echo "   Server Certificate: $CERT_DIR/server.crt"
echo "   Server Key: $CERT_DIR/server.key"
echo "   Client Certificate: $CERT_DIR/client.crt"
echo "   Client Key: $CERT_DIR/client.key"
echo ""
echo "⚠️  These are self-signed certificates for development/testing."
echo "   For production, use certificates from a trusted CA."

