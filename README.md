# Sage AI Frontend - Industrial Monitoring Dashboard

TypeScript/React frontend for real-time industrial machine monitoring, AI-powered insights, and work order management.

## Tech Stack

- **Next.js 14** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling (dark theme)
- **Recharts** - Charting library
- **React Query** - Data fetching and caching
- **InfluxDB Client** - Direct connection to InfluxDB
- **OpenAI API** - AI-powered analysis
- **React Markdown** - Markdown rendering for AI content

## Features

### 📊 Monitoring Dashboard (`/`)
- **Real-time Machine Monitoring** - Live status and performance metrics
- **Vibration Analysis** - Multi-axis vibration charts with:
  - Time range selection (5m, 30m, 1h, 24h)
  - Aggregated data for 24-hour views
  - Click-and-drag zoom functionality
  - Dynamic axis selection display
- **Performance Metrics** - Downtime/uptime statistics with skeleton loading
- **AI Analysis** - Automated insights based on:
  - Machine performance metrics
  - Alert history
  - Work order status
  - Vibration data availability
- **Alert History** - 24-hour alert tracking with detailed breakdown
- **Work Orders** - Machine-specific work order display and management

### 🤖 AI Insights Dashboard (`/ai-insights`)
- **Performance Analytics** - Comprehensive machine performance statistics
- **Shift Utilization** - Track and analyze shift-based productivity
- **Wise Analysis** - AI-powered insights across all machines in a lab
- **Calendar View** - Date range selection for historical data analysis
- **Events Tracking** - Monitor downtime incidents and alerts over time
- **Comparative Analysis** - Month-over-month performance comparisons

### 📋 Work Orders (`/work-orders`)
- **Create Work Orders** - Comprehensive work order creation
- **AI Auto Fill** - Intelligent form pre-filling using RAG
- **Calendar View** - Visual work order timeline with priority-based color coding
- **List View** - Detailed work order listing
- **Status Management** - Track pending, in-progress, and completed orders

### 🏭 Equipment Management (`/shopfloors`)
- **Machine List** - Browse all machines across labs
- **Last Seen Tracking** - See when each machine last reported data
- **Lab Organization** - Organize machines by facility/lab
- **Machine Details** - View comprehensive machine information

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables (optional):
Create a `.env.local` file:
```env
NEXT_PUBLIC_INFLUXDB_URL=http://localhost:8086
NEXT_PUBLIC_INFLUXDB_TOKEN=my-super-secret-auth-token
NEXT_PUBLIC_INFLUXDB_ORG=myorg
NEXT_PUBLIC_INFLUXDB_BUCKET=plc_data_new
```

3. Start development server:
```bash
npm run dev
```

The app will be available at `http://localhost:3005`

## Project Structure

```
frontend/
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
│       │   └── wise-analysis/      # AI insights generation
│       ├── influxdb/
│       │   ├── vibration/          # Vibration data API
│       │   ├── downtime/           # Downtime statistics
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
│   ├── embeddings.ts               # Embedding generation
│   └── pinecone.ts                 # Pinecone client
└── types/
    └── *.ts                        # TypeScript type definitions
```

## Components

### VibrationChart
- Multi-axis vibration visualization
- Time range selection (5m, 30m, 1h, 24h)
- Aggregated data for long time ranges
- Click-and-drag zoom functionality
- Dynamic axis display

### DowntimeStats
- Performance metrics display
- Skeleton loading states
- Real-time downtime/uptime statistics
- Incident tracking

### AlarmHistory
- 24-hour alert tracking
- Detailed alert breakdown
- No alert state handling
- Real-time updates

### WorkOrderForm
- Work order creation
- AI Auto Fill integration
- Equipment selection
- Priority and status management

### DateRangeCalendar
- Date range selection
- Month navigation
- Visual date selection
- Integration with AI Insights

## Data Flow

1. Frontend queries InfluxDB via API routes
2. React Query handles caching and automatic refetching
3. Components update in real-time as new data arrives
4. AI analysis generated via OpenAI API
5. All queries use Flux language to filter by machine_id

## Key Features

### AI Analysis
- Automatically analyzes machine performance
- Provides structured insights with sections
- Updates dynamically based on selections
- Includes vibration data context

### Vibration Monitoring
- Real-time multi-axis vibration tracking
- Flexible time range selection
- Data aggregation for performance
- Interactive zoom functionality

### Performance Metrics
- Modern skeleton loading states
- Real-time performance tracking
- Time range flexibility
- Incident analysis

### Work Order Management
- AI-powered form pre-filling
- Calendar and list views
- Priority-based organization
- Machine-specific filtering

## Recent Updates

### January 2026
- ✅ Added `pdf-parse` library for PDF document processing
- ✅ AI Analysis section on monitoring page
- ✅ Calendar feature for date range selection
- ✅ 5-minute time range option for vibration charts
- ✅ Skeleton loading states for Performance sections
- ✅ Work orders display on monitoring page
- ✅ Last seen timestamps for machines
- ✅ Improved alert history display
- ✅ Enhanced vibration chart with zoom and aggregation

## Notes

- The frontend connects to backend API routes (not directly to InfluxDB)
- Data refreshes automatically based on React Query configuration
- Supports multiple machines via machine_id selector
- Dark theme (black/grey) with sage green accents
- All critical metrics are displayed with real-time updates

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

## Dependencies

Key dependencies:
- `next`: ^14.0.4
- `react`: ^18.2.0
- `@tanstack/react-query`: ^5.17.0
- `recharts`: ^2.10.3
- `openai`: ^6.9.1
- `pdf-parse`: ^2.4.5 (for document processing)
- `react-markdown`: ^10.1.0
- `@influxdata/influxdb-client`: ^1.33.2

## License

Private project - All rights reserved
