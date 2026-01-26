# WebSocket Connection Verification Guide

This guide shows you multiple ways to verify that the WebSocket connection is working for real-time alarm notifications.

## ✅ Method 1: Check Backend Terminal Output

When you start the alarm monitor, you should see:

```bash
./start_alarm_monitor.sh
```

**Expected output:**
```
🚨 Alarm Monitor starting...
🔗 Connecting to localhost:8883
📡 Topic: plc/+/bottlefiller/alarms (alarms only)
💾 Events file: /tmp/alarm_events.json (for debugging)
🌐 WebSocket server started on ws://0.0.0.0:8765
⚠️  Tracking: Overfill, Underfill, LowProductLevel, CapMissing

✅ Connected to MQTT broker
📡 Subscribed to: plc/+/bottlefiller/alarms

🔌 WebSocket client connected. Total clients: 1
```

**Key indicators:**
- ✅ `🌐 WebSocket server started on ws://0.0.0.0:8765` - Server is running
- ✅ `🔌 WebSocket client connected. Total clients: 1` - Frontend connected

---

## ✅ Method 2: Check Frontend UI

1. Open your browser to `http://localhost:3005`
2. Look at the **"Alarm Events (Real-time)"** panel
3. Check for the **"● Live"** indicator next to the title

**If connected:**
- You'll see: `Alarm Events (Real-time) ● Live` (green dot)

**If NOT connected:**
- No "● Live" indicator will appear

---

## ✅ Method 3: Check Browser Console

1. Open browser DevTools (F12 or Cmd+Option+I)
2. Go to the **Console** tab
3. Look for these messages:

**If connected:**
```
✅ Connected to alarm WebSocket
```

**If NOT connected:**
```
WebSocket closed
WebSocket error: [error details]
```

---

## ✅ Method 4: Check Browser Network Tab

1. Open browser DevTools (F12 or Cmd+Option+I)
2. Go to the **Network** tab
3. Filter by **WS** (WebSocket)
4. Look for a connection to `ws://localhost:8765`

**If connected:**
- You'll see a WebSocket connection with status **101 Switching Protocols**
- Click on it to see message frames being sent/received

**If NOT connected:**
- No WebSocket connection will appear, or it will show as failed

---

## ✅ Method 5: Use Test Script

Run the test script in a separate terminal:

```bash
python3 test_websocket_connection.py
```

**If connected:**
```
🔍 Testing WebSocket connection to ws://localhost:8765
============================================================
✅ WebSocket connection established!
📡 Listening for alarm messages...
   (Press Ctrl+C to stop)
```

**If NOT connected:**
```
❌ Connection refused to ws://localhost:8765
   Make sure the alarm monitor is running:
   ./start_alarm_monitor.sh
```

---

## ✅ Method 6: Trigger an Alarm and Watch for Toast

1. Make sure alarm monitor is running
2. Make sure a mock PLC agent is running: `./start_mock_plc.sh machine-01`
3. Wait for an alarm to be triggered (alarms are random, may take a few seconds)
4. Watch the top-right corner of your browser

**If WebSocket is working:**
- A toast notification will appear immediately when an alarm is raised/cleared
- The toast will show: `🚨 [AlarmName] on [MachineID]` (red for raised)
- Or: `✅ [AlarmName] on [MachineID] - Cleared` (green for cleared)

**If WebSocket is NOT working:**
- No toast notifications will appear
- Only the table will update (via polling every 5 seconds)

---

## ✅ Method 7: Check JSON File (Backend Verification)

The alarm monitor saves events to `/tmp/alarm_events.json` for debugging:

```bash
cat /tmp/alarm_events.json | jq '.[-5:]'  # Last 5 events
```

**If working:**
- You'll see alarm events with timestamps
- Events will have `state: "RAISED"` or `state: "CLEARED"`

**If NOT working:**
- File might be empty or not exist
- Or events might not be updating

---

## 🔧 Troubleshooting

### WebSocket Not Connecting

1. **Check if alarm monitor is running:**
   ```bash
   ps aux | grep alarm_monitor
   ```

2. **Check if port 8765 is in use:**
   ```bash
   lsof -i :8765
   ```

3. **Check alarm monitor logs for errors:**
   - Look at the terminal where you ran `./start_alarm_monitor.sh`
   - Check for error messages

4. **Check browser console for connection errors:**
   - Open DevTools → Console
   - Look for WebSocket connection errors

### WebSocket Connected But No Notifications

1. **Check if mock PLC agent is running:**
   ```bash
   ps aux | grep mock_plc_agent
   ```

2. **Check if alarms are being published:**
   ```bash
   ./start_data_viewer.sh
   # Look for messages on plc/+/bottlefiller/alarms topic
   ```

3. **Check if alarms are being detected:**
   - Look at alarm monitor terminal for `🚨 ALARM RAISED` or `✅ ALARM CLEARED` messages
   - Check `/tmp/alarm_events.json` for new events

4. **Check browser console for WebSocket messages:**
   - Open DevTools → Console
   - You should see messages being received (if console logging is enabled)

---

## 📊 Quick Verification Checklist

- [ ] Alarm monitor shows "WebSocket server started"
- [ ] Frontend shows "● Live" indicator
- [ ] Browser console shows "Connected to alarm WebSocket"
- [ ] Browser Network tab shows WebSocket connection (status 101)
- [ ] Test script connects successfully
- [ ] Toast notifications appear when alarms are raised/cleared
- [ ] JSON file is being updated with alarm events

---

## 🎯 Expected Behavior When Working

1. **On page load:** "● Live" indicator appears immediately
2. **When alarm raised:** Toast notification appears instantly (no delay)
3. **When alarm cleared:** Toast notification appears instantly
4. **Table updates:** Every 5 seconds (via polling) + immediately when WebSocket message received

If all of these work, your WebSocket connection is fully functional! 🎉

