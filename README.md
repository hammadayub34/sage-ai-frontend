# MQTT OT Network - Industrial Monitoring & AI Insights Platform

A comprehensive industrial monitoring and AI-powered insights platform for real-time machine data analysis, work order management, and predictive maintenance.

## Tech Stack

- **Next.js 14** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling (dark theme)
- **Recharts** - Charting library
- **React Query** - Data fetching and caching
- **InfluxDB Client** - Time-series database for sensor data
- **MongoDB** - Document database for machines, labs, work orders
- **OpenAI API** - AI-powered analysis and insights
- **Pinecone** - Vector database for RAG (Retrieval Augmented Generation)
- **MQTT** - Real-time data streaming

## Features

### 📊 Monitoring Dashboard
- **Real-time Machine Monitoring** - Live status and performance metrics
- **Vibration Analysis** - Multi-axis vibration charts with time range selection (5m, 30m, 1h, 24h)
- **Performance Metrics** - Downtime/uptime statistics with skeleton loading states
- **AI Analysis** - Automated insights based on machine performance, alerts, and work orders
- **Alert History** - 24-hour alert tracking with detailed breakdown
- **Work Orders** - Machine-specific work order management and tracking
- **Last Seen Timestamps** - Track when machines last reported data

### 🤖 AI Insights Dashboard
- **Performance Analytics** - Comprehensive machine performance statistics
- **Shift Utilization** - Track and analyze shift-based productivity
- **Wise Analysis** - AI-powered insights across all machines in a lab
- **Calendar View** - Date range selection for historical data analysis
- **Events Tracking** - Monitor downtime incidents and alerts over time
- **Comparative Analysis** - Month-over-month performance comparisons

### 📈 Data Visualization
- **Vibration Charts** - Real-time multi-axis vibration monitoring with:
  - Time range selection (5 minutes to 24 hours)
  - Aggregated data for 24-hour views
  - Click-and-drag zoom functionality
  - Dynamic axis selection display
- **Performance Charts** - Downtime, uptime, and incident tracking
- **Time Series Data** - Historical trend analysis

### 🔧 Work Order Management
- **Create Work Orders** - Comprehensive work order creation with:
  - AI Auto Fill - Intelligent form pre-filling using RAG
  - Equipment selection
  - Priority levels
  - Status tracking
- **Calendar View** - Visual work order timeline with priority-based color coding
- **Machine-Specific Orders** - Filter work orders by selected machine
- **Status Management** - Track pending, in-progress, and completed orders

### 🚨 Alert System
- **Real-time Alerts** - Monitor critical machine conditions
- **Alert History** - 24-hour alert tracking with detailed breakdown
- **Alert Categories** - Organized by severity and type
- **No Alert States** - Clear messaging when no alerts are present

### 📱 Equipment Management
- **Machine List** - Browse all machines across labs
- **Last Seen Tracking** - See when each machine last reported data
- **Lab Organization** - Organize machines by facility/lab
- **Machine Details** - View comprehensive machine information

## Setup

### Prerequisites
- Node.js 18+ 
- MongoDB instance
- InfluxDB instance
- OpenAI API key (for AI features)
- Pinecone API key (for RAG features)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/hamzakhan3/mqtt-ot-network.git
cd mqtt-ot-network
```

2. Install dependencies:
```bash
npm install
cd frontend
npm install
```

3. Configure environment variables:
Create a `.env.local` file in the root directory:
```env
# InfluxDB
NEXT_PUBLIC_INFLUXDB_URL=http://localhost:8086
NEXT_PUBLIC_INFLUXDB_TOKEN=your-influxdb-token
NEXT_PUBLIC_INFLUXDB_ORG=your-org
NEXT_PUBLIC_INFLUXDB_BUCKET=your-bucket

# MongoDB
MONGODB_URI=mongodb://localhost:27017/your-database

# OpenAI
OPENAI_API_KEY=your-openai-api-key

# Pinecone
PINECONE_API_KEY=your-pinecone-api-key
PINECONE_ENVIRONMENT=your-pinecone-environment
PINECONE_INDEX_NAME=your-index-name

# JWT
JWT_SECRET=your-jwt-secret
```

4. Start development server:
```bash
npm run dev
```

The app will be available at `http://localhost:3005`

## Project Structure

```
mqtt-ot-network/
├── app/
│   ├── page.tsx                    # Monitoring dashboard
│   ├── ai-insights/
│   │   └── page.tsx                # AI Insights dashboard
│   ├── work-orders/
│   │   └── page.tsx                # Work orders management
│   ├── shopfloors/
│   │   └── page.tsx                # Equipment/machines list
│   └── api/
│       ├── monitoring/
│       │   └── analysis/           # AI analysis for monitoring
│       ├── ai-insights/
│       │   └── wise-analysis/       # AI insights generation
│       ├── influxdb/
│       │   ├── vibration/          # Vibration data API
│       │   ├── downtime/            # Downtime statistics
│       │   └── last-seen/          # Last seen timestamps
│       └── work-order/
│           └── autofill/           # AI auto-fill for work orders
├── components/
│   ├── VibrationChart.tsx          # Vibration visualization
│   ├── DowntimeStats.tsx           # Performance metrics
│   ├── AlarmHistory.tsx            # Alert history display
│   ├── WorkOrderForm.tsx           # Work order creation form
│   └── DateRangeCalendar.tsx       # Calendar component
├── hooks/
│   └── useVibrationData.ts         # Vibration data fetching hook
├── lib/
│   ├── influxdb.ts                 # InfluxDB client
│   ├── mongodb.ts                  # MongoDB client
│   ├── embeddings.ts               # Embedding generation
│   └── pinecone.ts                 # Pinecone client
└── types/
    └── *.ts                        # TypeScript type definitions
```

## Key Features Details

### AI Analysis (Monitoring Page)
- Automatically analyzes machine performance based on:
  - Downtime/uptime percentages
  - Alert history
  - Work order status
  - Vibration data availability
- Provides structured insights with:
  - Performance overview
  - Key observations
  - Recommendations
- Updates dynamically when machine or time range changes

### Vibration Chart
- **Time Range Options**: 5 minutes, 30 minutes, 1 hour, 24 hours
- **Data Aggregation**: Automatic aggregation for 24-hour views (1-minute intervals)
- **Zoom Functionality**: Click-and-drag to zoom into specific time ranges
- **Multi-Axis Support**: Display X, Y, Z vibration axes with distinct colors
- **Dynamic Subtitles**: Shows data type and time range information

### Performance Metrics
- **Skeleton Loading**: Modern loading states with animated placeholders
- **Real-time Updates**: Automatic refresh of performance data
- **Time Range Selection**: View performance over different periods (24h, 7d, 30d)
- **Incident Tracking**: Count and analyze downtime incidents

### Work Orders
- **AI Auto Fill**: Intelligent form pre-filling using document RAG
- **Calendar View**: Visual timeline with actual timestamp positioning
- **Priority Coding**: Color-coded work orders by priority level
- **Machine Filtering**: View work orders for specific machines
- **Status Management**: Track work order lifecycle

### Alert System
- **24-Hour Tracking**: Monitor alerts from the past 24 hours
- **Detailed Breakdown**: Categorized by type and severity
- **No Alert States**: Clear messaging when no alerts are present
- **Real-time Updates**: Automatic refresh of alert data

## API Endpoints

### Monitoring
- `GET /api/influxdb/vibration` - Fetch vibration data
- `GET /api/influxdb/downtime` - Get downtime statistics
- `GET /api/influxdb/last-seen` - Get last seen timestamps
- `POST /api/monitoring/analysis` - Generate AI analysis

### AI Insights
- `POST /api/ai-insights/wise-analysis` - Generate comprehensive AI insights
- `GET /api/influxdb/downtime` - Performance statistics
- `GET /api/shift-utilization` - Shift utilization data

### Work Orders
- `GET /api/work-orders` - List work orders
- `POST /api/work-order` - Create work order
- `POST /api/work-order/autofill` - AI auto-fill work order

### Alerts
- `GET /api/alarm-events` - Get alert history

## Data Flow

1. **Data Collection**: MQTT messages → InfluxDB (time-series data)
2. **Data Storage**: Machine metadata → MongoDB
3. **Data Retrieval**: Frontend → API Routes → InfluxDB/MongoDB
4. **AI Processing**: OpenAI API → Analysis generation
5. **RAG System**: Document uploads → Pinecone → AI context

## Recent Updates

### Latest Features (January 2026)
- ✅ AI Analysis section on monitoring page
- ✅ Calendar feature for date range selection on AI Insights
- ✅ 5-minute time range option for vibration charts
- ✅ Skeleton loading states for Performance sections
- ✅ Work orders display on monitoring page
- ✅ Last seen timestamps for machines
- ✅ Improved alert history display
- ✅ Enhanced vibration chart with zoom and aggregation
- ✅ PDF parsing support for AI Library (pdf-parse library)

## Development

### Running in Development
```bash
npm run dev
```

### Building for Production
```bash
npm run build
npm start
```

## Repository Structure

This project uses a monorepo structure with:
- Main repository: `mqtt-ot-network` (full stack)
- Frontend repository: `sage-ai-frontend` (frontend-only, synced via git subtree)

## Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Commit and push to your branch
5. Create a pull request

## License

Private project - All rights reserved

## Support

For issues or questions, please contact the development team.
