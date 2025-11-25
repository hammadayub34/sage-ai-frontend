# PLC Monitoring Frontend

TypeScript/React frontend for monitoring bottle filler PLC data from InfluxDB.

## Tech Stack

- **Next.js 14** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling (dark theme)
- **Recharts** - Charting library
- **React Query** - Data fetching and caching
- **InfluxDB Client** - Direct connection to InfluxDB

## Features

- Real-time status monitoring (System Running, Fault, Filling, Ready)
- Production counters (Bottles Filled, Rejected, Per Minute)
- Alarm panel (5 alarm types)
- Tank status (Fill Level, Temperature, Pressure)
- Time series charts (Production Rate, Fill Level)
- Circular gauges (Fill Level, Temperature, Conveyor Speed)
- Complete tags table (all 18 fields organized by category)
- Multi-machine support (select machine ID)

## Setup

1. Install dependencies:
```bash
cd frontend
npm install
```

2. Configure environment variables (optional):
Create a `.env.local` file:
```
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
│   ├── page.tsx              # Main dashboard
│   ├── layout.tsx           # Root layout
│   ├── providers.tsx        # React Query provider
│   └── globals.css          # Global styles
├── components/
│   ├── StatusPanel.tsx      # System status indicators
│   ├── ProductionCounters.tsx
│   ├── AlarmsPanel.tsx
│   ├── TankStatus.tsx
│   ├── TimeSeriesChart.tsx
│   ├── GaugePanel.tsx
│   └── TagsTable.tsx        # Complete tags table
├── hooks/
│   └── usePLCData.ts        # React hooks for data fetching
├── lib/
│   ├── influxdb.ts          # InfluxDB client and queries
│   └── react-query.ts       # React Query config
└── types/
    └── plc-data.ts          # TypeScript types
```

## Components

### StatusPanel
Displays 4 critical status indicators with color-coded dots.

### ProductionCounters
Shows production metrics: Bottles Filled (large), Rejected, and Per Minute.

### AlarmsPanel
Lists all 5 alarm types with active/inactive status and count.

### TankStatus
Displays tank metrics: Fill Level, Temperature, Pressure.

### TimeSeriesChart
Line chart for time series data (e.g., BottlesPerMinute, FillLevel).

### GaugePanel
Circular gauge visualization for analog values.

### TagsTable
Complete table of all 18 tags organized by category (Status, Counter, Alarm, Analog, Input).

## Data Flow

1. Frontend queries InfluxDB directly using `@influxdata/influxdb-client`
2. React Query handles caching and automatic refetching (every 2 seconds)
3. Components update in real-time as new data arrives
4. All queries use Flux language to filter by machine_id

## Notes

- The frontend connects directly to InfluxDB (requires CORS configuration if needed)
- Data refreshes automatically every 2 seconds
- Supports multiple machines via machine_id selector
- Dark theme (black/grey) as requested
- All 18 critical tags are displayed

