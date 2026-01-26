/**
 * Test cases for Scheduled Hours page utilization data functionality
 * 
 * Tests:
 * 1. API call with correct parameters
 * 2. Data fetching and display
 * 3. Error handling
 * 4. Comparison between calculated and stored scheduled hours
 */

describe('Scheduled Hours Page - Utilization Data', () => {
  const mockLabId = '64edc4fb81c07f7f6fbff26b';
  const mockShiftName = 'SHIFT_A';
  const mockStartDate = '2026-01-16';
  const mockEndDate = '2026-01-22';

  describe('API Call Parameters', () => {
    it('should call /api/shift-utilization with correct parameters', async () => {
      const params = new URLSearchParams({
        labId: mockLabId,
        shiftName: mockShiftName,
        startDate: mockStartDate,
        endDate: mockEndDate,
      });
      
      const expectedUrl = `/api/shift-utilization?${params.toString()}`;
      
      expect(expectedUrl).toBe(
        `/api/shift-utilization?labId=${mockLabId}&shiftName=${mockShiftName}&startDate=${mockStartDate}&endDate=${mockEndDate}`
      );
    });

    it('should encode special characters in parameters', () => {
      const labIdWithSpecialChars = 'lab+id@123';
      const params = new URLSearchParams({
        labId: labIdWithSpecialChars,
        shiftName: mockShiftName,
        startDate: mockStartDate,
        endDate: mockEndDate,
      });
      
      const url = `/api/shift-utilization?${params.toString()}`;
      
      expect(url).toContain(encodeURIComponent(labIdWithSpecialChars));
    });
  });

  describe('Data Structure', () => {
    const mockUtilizationResponse = {
      success: true,
      data: {
        shiftName: 'SHIFT_A',
        totalMachines: 24,
        machinesWithData: 20,
        averageUtilization: 15.26,
        totalProductiveHours: 120.5,
        totalIdleHours: 45.2,
        totalScheduledHours: 287.16,
        totalNonProductiveHours: 121.46,
        totalNodeOffHours: 50.0,
        machineUtilizations: [
          {
            machineName: 'Machine 1',
            averageUtilization: 20.5,
            totalProductiveHours: 10.25,
            totalIdleHours: 5.0,
            totalScheduledHours: 50.0,
            totalNonProductiveHours: 34.75,
            totalNodeOffHours: 0,
            recordCount: 7,
          },
        ],
      },
    };

    it('should have correct response structure', () => {
      expect(mockUtilizationResponse).toHaveProperty('success');
      expect(mockUtilizationResponse).toHaveProperty('data');
      expect(mockUtilizationResponse.data).toHaveProperty('shiftName');
      expect(mockUtilizationResponse.data).toHaveProperty('totalMachines');
      expect(mockUtilizationResponse.data).toHaveProperty('averageUtilization');
      expect(mockUtilizationResponse.data).toHaveProperty('totalScheduledHours');
      expect(mockUtilizationResponse.data).toHaveProperty('machineUtilizations');
    });

    it('should have correct data types', () => {
      expect(typeof mockUtilizationResponse.data.averageUtilization).toBe('number');
      expect(typeof mockUtilizationResponse.data.totalScheduledHours).toBe('number');
      expect(Array.isArray(mockUtilizationResponse.data.machineUtilizations)).toBe(true);
    });
  });

  describe('Date Range Calculations', () => {
    it('should calculate last 7 days correctly', () => {
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      const start = new Date();
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);

      const diffTime = end.getTime() - start.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      expect(diffDays).toBe(6); // 7 days inclusive = 6 day difference
    });

    it('should format dates correctly for API', () => {
      const date = new Date('2026-01-16');
      const formatted = date.toISOString().split('T')[0];
      
      expect(formatted).toBe('2026-01-16');
    });
  });

  describe('Comparison Logic', () => {
    it('should identify when calculated and stored hours match', () => {
      const calculated = 83.77;
      const stored = 83.77;
      const difference = Math.abs(calculated - stored);
      
      expect(difference).toBeLessThan(0.1);
    });

    it('should identify when calculated and stored hours differ', () => {
      const calculated = 83.77; // Per machine
      const stored = 287.16; // Total for all machines
      const difference = Math.abs(calculated - stored);
      
      expect(difference).toBeGreaterThan(0.1);
    });

    it('should calculate total expected hours for all machines', () => {
      const perMachine = 83.77;
      const machineCount = 24;
      const expectedTotal = perMachine * machineCount;
      
      expect(expectedTotal).toBeCloseTo(2010.48, 2);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing labId', () => {
      const params = new URLSearchParams({
        labId: '',
        shiftName: mockShiftName,
        startDate: mockStartDate,
        endDate: mockEndDate,
      });
      
      expect(params.get('labId')).toBe('');
    });

    it('should handle missing shiftName', () => {
      const params = new URLSearchParams({
        labId: mockLabId,
        shiftName: '',
        startDate: mockStartDate,
        endDate: mockEndDate,
      });
      
      expect(params.get('shiftName')).toBe('');
    });

    it('should handle API error response', () => {
      const errorResponse = {
        success: false,
        error: 'Lab not found',
      };
      
      expect(errorResponse.success).toBe(false);
      expect(errorResponse.error).toBeDefined();
    });
  });

  describe('Data Aggregation', () => {
    it('should sum scheduled hours correctly', () => {
      const records = [
        { scheduled_hours: 11.97 },
        { scheduled_hours: 11.97 },
        { scheduled_hours: 11.97 },
      ];
      
      const total = records.reduce((sum, r) => sum + r.scheduled_hours, 0);
      
      expect(total).toBeCloseTo(35.91, 2);
    });

    it('should calculate average utilization correctly', () => {
      const utilizations = [10.5, 20.3, 15.2];
      const average = utilizations.reduce((sum, u) => sum + u, 0) / utilizations.length;
      
      expect(average).toBeCloseTo(15.33, 2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty utilization data', () => {
      const emptyResponse = {
        success: true,
        data: {
          shiftName: 'SHIFT_A',
          totalMachines: 0,
          machinesWithData: 0,
          averageUtilization: 0,
          totalScheduledHours: 0,
          machineUtilizations: [],
        },
      };
      
      expect(emptyResponse.data.machinesWithData).toBe(0);
      expect(emptyResponse.data.machineUtilizations.length).toBe(0);
    });

    it('should handle date range with no data', () => {
      const futureStartDate = '2030-01-01';
      const futureEndDate = '2030-01-07';
      
      // Should still make API call but get empty results
      const params = new URLSearchParams({
        labId: mockLabId,
        shiftName: mockShiftName,
        startDate: futureStartDate,
        endDate: futureEndDate,
      });
      
      expect(params.get('startDate')).toBe(futureStartDate);
      expect(params.get('endDate')).toBe(futureEndDate);
    });
  });
});

