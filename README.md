# MQTT OT Network Architecture

A complete MQTT-based system for simulating and monitoring PLC data on an Operational Technology (OT) network. This project includes a Mosquitto MQTT broker, a mock PLC agent that simulates bottle filler tags, and a data viewer for real-time monitoring.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    OT Network (VLAN/Subnet)              │
│                                                           │
│  ┌──────────────┐      ┌──────────────┐                 │
│  │ MQTT Broker  │      │  Mock PLC    │                 │
│  │  (Mosquitto) │◄─────┤   Agent      │                 │
│  │  Port: 1883  │      │  (Publisher) │                 │
│  │  Port: 9001  │      │              │                 │
│  └──────┬───────┘      └──────────────┘                 │
│         │                                                 │
│         │ MQTT Protocol                                  │
│         │                                                 │
│  ┌──────▼───────┐                                        │
│  │   Data       │                                        │
│  │  Viewer      │                                        │
│  │ (Subscriber) │                                        │
│  └──────────────┘                                        │
└─────────────────────────────────────────────────────────┘
```

## Components

### 1. MQTT Broker (Mosquitto)
- Central message broker for pub/sub communication
- Ports: 1883 (MQTT), 9001 (WebSocket)
- Docker-based deployment for portability

### 2. Mock PLC Agent
- Simulates bottle filler PLC tags
- Publishes data to MQTT topics every 2 seconds
- Generates realistic sensor, output, analog, and status data

### 3. Data Viewer
- Subscribes to MQTT topics
- Displays real-time JSON-formatted data
- Provides summary views of bottle filler status

## Prerequisites

- Docker and Docker Compose
- Python 3.7 or higher
- pip (Python package manager)

## Installation

1. **Clone or navigate to the project directory:**
   ```bash
   cd mqtt-ot-network
   ```

2. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Start the MQTT broker:**
   ```bash
   docker-compose up -d
   ```

   Verify the broker is running:
   ```bash
   docker ps
   ```

## Usage

### Starting the MQTT Broker

The broker runs in a Docker container. Start it with:

```bash
docker-compose up -d
```

Stop it with:

```bash
docker-compose down
```

View logs:

```bash
docker-compose logs -f mosquitto
```

### Running the Mock PLC Agent

The agent publishes bottle filler tag data to MQTT topics:

```bash
python mock_plc_agent/mock_plc_agent.py
```

**Environment Variables:**
- `MQTT_BROKER_HOST`: Broker IP address (default: `localhost`)
- `MQTT_BROKER_PORT`: Broker port (default: `1883`)
- `PUBLISH_INTERVAL`: Publish rate in seconds (default: `2.0`)

**Example:**
```bash
MQTT_BROKER_HOST=192.168.1.100 python mock_plc_agent/mock_plc_agent.py
```

### Running the Data Viewer

The viewer subscribes to MQTT topics and displays received messages:

```bash
python data_viewer/mqtt_subscriber.py
```

**Environment Variables:**
- `MQTT_BROKER_HOST`: Broker IP address (default: `localhost`)
- `MQTT_BROKER_PORT`: Broker port (default: `1883`)
- `MQTT_TOPIC`: Topic to subscribe to (default: `plc/bottlefiller/#`)

**Example:**
```bash
MQTT_BROKER_HOST=192.168.1.100 python data_viewer/mqtt_subscriber.py
```

## MQTT Topics

The mock PLC agent publishes to the following topics:

- `plc/bottlefiller/data` - Complete dataset with all tags
- `plc/bottlefiller/inputs` - Input sensor tags
- `plc/bottlefiller/outputs` - Output actuator tags
- `plc/bottlefiller/analog` - Analog sensor values
- `plc/bottlefiller/status` - System status flags
- `plc/bottlefiller/counters` - Production counters
- `plc/bottlefiller/alarms` - Alarm states

## Bottle Filler Tags

The mock agent simulates the following PLC tags:

### Input Tags
- `BottlePresent` - Photoeye detects bottle
- `BottleAtFill` - Bottle in fill position
- `BottleAtCap` - Bottle at capping station
- `LowLevel` - Low product level sensor
- `HighLevel` - High product level sensor
- `CapPresent` - Cap detection sensor

### Output Tags
- `FillValve` - Fill valve open/close
- `ConveyorMotor` - Conveyor motor run/stop
- `CappingMotor` - Capping motor run/stop
- `IndicatorGreen` - Green status light
- `IndicatorRed` - Red status light
- `IndicatorYellow` - Yellow warning light

### Analog Tags
- `FillLevel` - Current fill level (0-100%)
- `FillFlowRate` - Flow rate (L/min)
- `TankTemperature` - Product temperature (°C)
- `TankPressure` - Tank pressure (PSI)
- `ConveyorSpeed` - Conveyor speed (RPM)

### Status Tags
- `SystemRunning` - System is running
- `Filling` - Currently filling
- `Ready` - System ready
- `Fault` - Fault condition active
- `AutoMode` - Auto mode selected

### Counter Tags
- `BottlesFilled` - Total bottles filled
- `BottlesRejected` - Total bottles rejected
- `BottlesPerMinute` - Production rate

## OT Network Configuration

For deployment on an OT network:

1. **Update broker IP address:**
   - Set `MQTT_BROKER_HOST` environment variable to your OT network IP
   - Or modify the default in `mock_plc_agent/config.py` and `data_viewer/mqtt_subscriber.py`

2. **Network isolation:**
   - Configure firewall rules for ports 1883 and 9001
   - Use VLANs or network segmentation
   - Consider static IP assignment for the broker

3. **Security (Production):**
   - Enable authentication in `mosquitto/config/mosquitto.conf`
   - Set `allow_anonymous false`
   - Create password file: `mosquitto_passwd -c mosquitto/config/passwd plc_user`
   - Add TLS/SSL encryption for port 8883

## Testing

### Test Broker Connection

Use `mosquitto_pub` and `mosquitto_sub` (if installed):

```bash
# Subscribe
mosquitto_sub -h localhost -t "plc/bottlefiller/#" -v

# Publish test message
mosquitto_pub -h localhost -t "plc/bottlefiller/test" -m "Hello MQTT"
```

### End-to-End Test

1. Start the broker: `docker-compose up -d`
2. Start the agent: `python mock_plc_agent/mock_plc_agent.py`
3. Start the viewer: `python data_viewer/mqtt_subscriber.py`

You should see data flowing from the agent to the viewer.

## Troubleshooting

### Broker not starting
- Check Docker is running: `docker ps`
- Check port availability: `netstat -an | grep 1883`
- View broker logs: `docker-compose logs mosquitto`

### Connection refused
- Verify broker is running: `docker ps`
- Check broker IP address matches configuration
- Verify firewall rules allow MQTT ports

### No messages received
- Verify topic subscription matches publication
- Check QoS levels (should be 1 for reliable delivery)
- Verify network connectivity between components

## File Structure

```
mqtt-ot-network/
├── docker-compose.yml          # Docker orchestration
├── requirements.txt            # Python dependencies
├── README.md                   # This file
│
├── mosquitto/
│   ├── config/
│   │   └── mosquitto.conf      # Broker configuration
│   ├── data/                   # Persistence directory
│   └── log/                    # Log files directory
│
├── mock_plc_agent/
│   ├── mock_plc_agent.py       # Main publisher script
│   └── config.py               # Agent configuration
│
├── data_viewer/
│   ├── mqtt_subscriber.py      # Subscriber script
│   └── display_formatter.py    # Data formatting utilities
│
└── docs/
    └── architecture.md         # Architecture documentation
```

## Future Enhancements

- TLS/SSL encryption support
- Username/password authentication
- Database integration for historical data
- Web-based dashboard (using WebSocket on port 9001)
- Multiple PLC agent instances
- Broker clustering for high availability
- Message queuing for offline subscribers

## License

This project is provided as-is for educational and development purposes.

## Support

For issues or questions, please check the broker logs and agent/viewer console output for error messages.

