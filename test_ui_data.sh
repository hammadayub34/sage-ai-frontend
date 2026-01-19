#!/bin/bash
# Test script to verify UI data matches InfluxDB

echo "🧪 TESTING UI DATA ACCURACY"
echo "=" | head -c 70 && echo ""
echo ""

echo "📊 Step 1: Get expected data from InfluxDB"
echo "-------------------------------------------"
python3 test_chart_accuracy.py

echo ""
echo "📊 Step 2: Test API endpoint (what UI calls)"
echo "-------------------------------------------"
echo "Testing GET /api/influxdb/latest?machineId=machine-01"
echo ""

# Check if frontend is running
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ Frontend is running on port 3000"
    echo ""
    echo "📋 API Response:"
    curl -s "http://localhost:3000/api/influxdb/latest?machineId=machine-01" | python3 -m json.tool | head -30
    echo ""
    echo "✅ Compare the 'data' object with TEST 3 results above"
else
    echo "⚠️  Frontend not running on port 3000"
    echo "   Start it with: cd frontend && npm run dev"
fi

echo ""
echo "=" | head -c 70 && echo ""
echo "💡 MANUAL TESTING STEPS:"
echo ""
echo "1. Open browser: http://localhost:3000"
echo "2. Open DevTools (F12) → Network tab"
echo "3. Filter by 'influxdb' or 'query'"
echo "4. Click 'Refresh Data' button"
echo "5. Check the requests:"
echo "   - /api/influxdb/latest?machineId=machine-01 (for tags table)"
echo "   - /api/influxdb/query (for charts)"
echo "6. Compare response data with test results above"
echo ""
echo "✅ Charts should show:"
echo "   - BottlesPerMinute: ~20 data points (5min windows)"
echo "   - FillLevel: ~20 data points (5min windows)"
echo ""
echo "✅ Tags table should show:"
echo "   - BottlesFilled: 213 (or current value)"
echo "   - BottlesPerMinute: 9.3 (or current value)"
echo "   - FillLevel: 45.37 (or current value)"
echo "   - SystemRunning: true"

