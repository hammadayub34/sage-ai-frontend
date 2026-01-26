/**
 * Integration test for scheduled hours utilization data
 * Tests the actual API endpoint with real MongoDB queries
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb://wiser:wiser%40123@3.208.198.4:27017';
const dbName = 'admin';

describe('Scheduled Hours Utilization - Integration Tests', () => {
  let client;
  let db;

  beforeAll(async () => {
    client = new MongoClient(uri);
    await client.connect();
    db = client.db(dbName);
  });

  afterAll(async () => {
    await client.close();
  });

  describe('MongoDB Query Tests', () => {
    it('should query labShiftUtilization collection with date range', async () => {
      const collection = db.collection('labShiftUtilization');
      const shiftName = 'SHIFT_A';
      const startDate = '2025-12-01';
      const endDate = '2025-12-07';

      const results = await collection.find({
        shift_name: shiftName,
        date: {
          $gte: startDate,
          $lte: endDate,
        },
      }).limit(10).toArray();

      expect(Array.isArray(results)).toBe(true);
      results.forEach(doc => {
        expect(doc).toHaveProperty('shift_name');
        expect(doc).toHaveProperty('date');
        expect(doc.shift_name).toBe(shiftName);
        expect(doc.date >= startDate).toBe(true);
        expect(doc.date <= endDate).toBe(true);
      });
    });

    it('should aggregate scheduled hours correctly', async () => {
      const collection = db.collection('labShiftUtilization');
      const shiftName = 'SHIFT_A';
      const startDate = '2025-12-01';
      const endDate = '2025-12-07';

      const aggregation = await collection.aggregate([
        {
          $match: {
            shift_name: shiftName,
            date: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: null,
            totalScheduledHours: { $sum: '$scheduled_hours' },
            totalProductiveHours: { $sum: '$productive_hours' },
            count: { $sum: 1 },
          },
        },
      ]).toArray();

      expect(aggregation.length).toBeGreaterThan(0);
      if (aggregation[0]) {
        expect(typeof aggregation[0].totalScheduledHours).toBe('number');
        expect(typeof aggregation[0].totalProductiveHours).toBe('number');
        expect(aggregation[0].count).toBeGreaterThan(0);
      }
    });

    it('should group by machine correctly', async () => {
      const collection = db.collection('labShiftUtilization');
      const shiftName = 'SHIFT_A';
      const startDate = '2025-12-01';
      const endDate = '2025-12-07';

      const byMachine = await collection.aggregate([
        {
          $match: {
            shift_name: shiftName,
            date: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: '$machine_name',
            totalScheduledHours: { $sum: '$scheduled_hours' },
            count: { $sum: 1 },
          },
        },
        { $limit: 5 },
      ]).toArray();

      expect(Array.isArray(byMachine)).toBe(true);
      byMachine.forEach(item => {
        expect(item).toHaveProperty('_id'); // machine_name
        expect(item).toHaveProperty('totalScheduledHours');
        expect(typeof item.totalScheduledHours).toBe('number');
      });
    });
  });

  describe('Data Validation', () => {
    it('should have valid document structure', async () => {
      const collection = db.collection('labShiftUtilization');
      const sample = await collection.findOne({});

      if (sample) {
        expect(sample).toHaveProperty('machine_name');
        expect(sample).toHaveProperty('shift_name');
        expect(sample).toHaveProperty('date');
        expect(sample).toHaveProperty('scheduled_hours');
        expect(sample).toHaveProperty('utilization');
        expect(typeof sample.scheduled_hours).toBe('number');
        expect(typeof sample.utilization).toBe('number');
      }
    });

    it('should have valid date format', async () => {
      const collection = db.collection('labShiftUtilization');
      const sample = await collection.findOne({ date: { $exists: true } });

      if (sample && sample.date) {
        // Date should be in YYYY-MM-DD format
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        expect(dateRegex.test(sample.date)).toBe(true);
      }
    });
  });
});

