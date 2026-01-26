# MQTT OT Network Architecture Documentation

## System Architecture Overview

### High-Level Components

1. **MQTT Broker Service** (Mosquitto) - Central message broker
2. **Mock PLC Agent** - Publishes simulated bottle filler data
3. **Data Viewer/Subscriber** - Receives and displays MQTT messages
4. **Network Infrastructure** - OT network isolation and connectivity

### Network Topology

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
│  ┌──────▼───────┐      ┌──────────────┐                 │
│  │   Data       │      │  Optional:    │                 │
│  │  Viewer      │      │  HMI/SCADA   │                 │
│  │ (Subscriber) │      │  Integration │                 │
│  └──────────────┘      └──────────────┘                 │
│                                                           │
└─────────────────────────────────────────────────────────┘
         │
         │ (Optional: Bridge to IT Network)
         │
┌────────▼──────────────────────────────────────────────┐
│              IT Network (Optional)                      │
│  ┌──────────────┐                                      │
│  │  Monitoring  │                                      │
│  │   Dashboard  │                                      │
│  └──────────────┘                                      │
└────────────────────────────────────────────────────────┘
```

## Component Details

### 1. MQTT Broker (Mosquitto)

- **Purpose**: Central message broker for pub/sub communication
- **Ports**: 
  - 1883 (MQTT standard)
  - 9001 (WebSocket for web clients)
- **Persistence**: Message queue and state storage
- **Configuration**: `mosquitto/config/mosquitto.conf`
- **Deployment**: Docker container for isolation and portability
- **Features**:
  - Anonymous access (development mode)
  - Message persistence
  - Connection logging
  - Automatic reconnection support

### 2. Mock PLC Agent

- **Purpose**: Simulates bottle filler PLC tags and publishes to MQTT
- **Language**: Python 3.7+ with paho-mqtt library
- **Publish Rate**: Configurable (default: 2 seconds)
- **Topics**:
  - `plc/bottlefiller/data` - Complete dataset
  - `plc/bottlefiller/inputs` - Input tags
  - `plc/bottlefiller/outputs` - Output tags
  - `plc/bottlefiller/analog` - Analog values
  - `plc/bottlefiller/status` - Status flags
  - `plc/bottlefiller/counters` - Counter values
  - `plc/bottlefiller/alarms` - Alarm states
- **Features**:
  - Realistic data simulation
  - Automatic reconnection on disconnect
  - Connection state tracking
  - Configurable via environment variables

### 3. Data Viewer/Subscriber

- **Purpose**: Subscribes to MQTT topics and displays received data
- **Language**: Python 3.7+ with paho-mqtt library
- **Subscription**: Wildcard `plc/bottlefiller/#`
- **Output**: JSON formatted console output
- **Features**:
  - Real-time data display
  - Summary views for complete datasets
  - Automatic reconnection
  - Formatted JSON output

## Data Flow

```
1. Mock PLC Agent generates bottle filler tag data
   ↓
2. Agent publishes to MQTT broker topics
   ↓
3. MQTT broker receives and routes messages
   ↓
4. Data Viewer subscribes and receives messages
   ↓
5. Viewer displays formatted JSON data
```

## Bottle Filler Tag Structure

### Input Tags (Boolean)
- `BottlePresent` - Photoeye detects bottle
- `BottleAtFill` - Bottle in fill position
- `BottleAtCap` - Bottle at capping station
- `LowLevel` - Low product level sensor
- `HighLevel` - High product level sensor
- `CapPresent` - Cap detection sensor

### Output Tags (Boolean)
- `FillValve` - Fill valve open/close
- `ConveyorMotor` - Conveyor motor run/stop
- `CappingMotor` - Capping motor run/stop
- `IndicatorGreen` - Green status light
- `IndicatorRed` - Red status light
- `IndicatorYellow` - Yellow warning light

### Analog Tags (Real/Float)
- `FillLevel` - Current fill level (0-100%)
- `FillFlowRate` - Flow rate (L/min)
- `TankTemperature` - Product temperature (°C)
- `TankPressure` - Tank pressure (PSI)
- `ConveyorSpeed` - Conveyor speed (RPM)

### Status Tags (Boolean)
- `SystemRunning` - System is running
- `Filling` - Currently filling
- `Ready` - System ready
- `Fault` - Fault condition active
- `AutoMode` - Auto mode selected

### Counter Tags (Integer)
- `BottlesFilled` - Total bottles filled
- `BottlesRejected` - Total bottles rejected
- `BottlesPerMinute` - Production rate

### Alarm Tags (Boolean)
- `LowProductLevel` - Low product level alarm
- `Overfill` - Overfill detected
- `Underfill` - Underfill detected
- `NoBottle` - No bottle at fill position
- `CapMissing` - Cap missing alarm

## Security Architecture

### Phase 1: Development/Testing (Current)

- Anonymous access enabled
- Local network only
- No encryption
- Suitable for development and testing environments

### Phase 2: Production (Optional Enhancement)

- Username/password authentication
- TLS/SSL encryption (port 8883)
- ACL (Access Control List) for topic permissions
- Network segmentation (firewall rules)
- Certificate-based authentication

## Deployment Architecture

### Docker-Based Deployment

- **Container**: `eclipse-mosquitto:latest`
- **Network**: Docker bridge network (`ot-network`)
- **Volumes**: Config, data, and log persistence
- **Restart Policy**: `unless-stopped` for reliability

### Service Communication

- **Protocol**: MQTT 3.1.1
- **QoS Levels**: 
  - QoS 0: Fire and forget
  - QoS 1: At least once (used for PLC data)
- **Retain**: False (live data, not retained)
- **Keep Alive**: 60 seconds
- **Automatic Reconnection**: Enabled with exponential backoff

## Configuration Management

### Environment Variables

- `MQTT_BROKER_HOST`: Broker IP address (default: `localhost`)
- `MQTT_BROKER_PORT`: Broker port (default: `1883`)
- `PUBLISH_INTERVAL`: Agent publish rate in seconds (default: `2.0`)
- `OT_NETWORK_SUBNET`: Network subnet for isolation

### Configuration Files

- `mosquitto/config/mosquitto.conf`: Broker settings, listeners, persistence
- `mock_plc_agent/config.py`: Agent settings (topics, data generation parameters)

## Network Considerations

### OT Network Requirements

- Static IP assignment for broker
- Firewall rules for MQTT ports (1883, 9001)
- Network isolation from IT network (optional bridge)
- Low latency requirements (<100ms)

### Connectivity

- Agent connects to broker via TCP/IP
- Subscriber connects to broker via TCP/IP
- WebSocket support for web-based clients (port 9001)

## Scalability Considerations

### Current Design

- Single broker instance
- Single agent instance
- Suitable for development/testing
- Handles typical PLC data rates (1-10 messages/second)

### Future Enhancements

- Broker clustering for high availability
- Multiple agent instances (different PLCs)
- Message queuing for offline subscribers
- Database integration for historical data
- Load balancing for multiple subscribers
- Message compression for high-volume scenarios

## Monitoring & Observability

### Logging

- **Broker logs**: `mosquitto/log/mosquitto.log`
- **Agent logs**: Console output with timestamps
- **Viewer logs**: Console output with message details

### Metrics (Future Enhancement)

- Message throughput
- Connection count
- Topic subscription count
- Error rates
- Latency measurements
- Queue depth

## Error Handling

### Connection Management

- Automatic reconnection with exponential backoff
- Connection state tracking
- Graceful degradation on disconnect
- Clear error messages with return codes

### Message Publishing

- Connection verification before publish
- Error handling for publish failures
- QoS 1 for reliable delivery
- Retry logic for failed publishes

## Testing Strategy

1. **Unit Testing**: Mock data generation logic
2. **Integration Testing**: End-to-end MQTT pub/sub
3. **Network Testing**: Connectivity across OT network
4. **Load Testing**: Message throughput under load
5. **Failure Testing**: Broker restart, network interruption
6. **Reconnection Testing**: Automatic recovery scenarios

## Performance Characteristics

### Expected Throughput

- **Messages per second**: 3-7 (depending on publish interval)
- **Message size**: ~1-5 KB per complete dataset
- **Network bandwidth**: <50 KB/s typical
- **Latency**: <100ms (local network)

### Resource Usage

- **Broker**: ~50-100 MB RAM, minimal CPU
- **Agent**: ~20-30 MB RAM, <1% CPU
- **Viewer**: ~20-30 MB RAM, <1% CPU

## Deployment Scenarios

### Development/Testing

- Single machine deployment
- Localhost connections
- Anonymous access
- No encryption

### Production OT Network

- Dedicated server for broker
- Static IP configuration
- Network segmentation
- Authentication enabled
- TLS encryption
- Firewall rules

### Hybrid (OT + IT Bridge)

- Broker on OT network
- Bridge to IT network for monitoring
- Separate authentication domains
- Network isolation maintained

## Troubleshooting Guide

### Common Issues

1. **Connection Refused**
   - Verify broker is running: `docker-compose ps`
   - Check port availability: `netstat -an | grep 1883`
   - Verify firewall rules

2. **Unexpected Disconnections**
   - Check broker logs: `docker-compose logs mosquitto`
   - Verify network stability
   - Check keepalive settings

3. **No Messages Received**
   - Verify topic subscription matches publication
   - Check QoS levels
   - Verify network connectivity

4. **High CPU Usage**
   - Check for multiple agent instances
   - Verify publish interval settings
   - Check for connection loops

## Future Enhancements

1. **Security**
   - TLS/SSL encryption
   - Certificate-based authentication
   - ACL for topic permissions

2. **Monitoring**
   - Prometheus metrics export
   - Grafana dashboards
   - Alerting system

3. **Data Persistence**
   - TimescaleDB integration
   - Historical data storage
   - Data retention policies

4. **Scalability**
   - Broker clustering
   - Load balancing
   - Message queuing

5. **Integration**
   - HMI/SCADA integration
   - REST API gateway
   - Web dashboard

