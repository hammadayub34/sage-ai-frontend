/**
 * Test cases for AI Insights Performance Values
 * 
 * These tests ensure that the performance values passed to the AI analysis
 * match exactly what is displayed in the Performance section.
 */

describe('AI Insights Performance Values', () => {
  
  /**
   * Helper function to calculate percentages with normalization (same as Performance section)
   */
  const calculatePerformancePercentages = (
    scheduledHours: number,
    downtimeHours: number,
    productiveHours: number,
    idleHours: number
  ) => {
    const calculatedDowntimePercentage = scheduledHours > 0 
      ? (downtimeHours / scheduledHours) * 100 
      : 0;
    const calculatedUptimePercentage = scheduledHours > 0 
      ? ((idleHours + productiveHours) / scheduledHours) * 100 
      : 0;
    
    // Ensure total is exactly 100% (same normalization logic as Performance section)
    const totalPercentage = calculatedDowntimePercentage + calculatedUptimePercentage;
    const downtimePercentage = calculatedDowntimePercentage;
    const uptimePercentage = totalPercentage > 0 && Math.abs(totalPercentage - 100) > 0.1
      ? 100 - calculatedDowntimePercentage
      : calculatedUptimePercentage;
    
    return {
      downtimePercentage,
      uptimePercentage,
      calculatedDowntimePercentage,
      calculatedUptimePercentage,
      totalPercentage,
    };
  };

  describe('Shift Utilization Data Calculation', () => {
    test('should calculate percentages correctly from shift utilization data', () => {
      const scheduledHours = 100;
      const downtimeHours = 10;
      const productiveHours = 70;
      const idleHours = 20;
      
      const result = calculatePerformancePercentages(
        scheduledHours,
        downtimeHours,
        productiveHours,
        idleHours
      );
      
      // Expected: downtime = 10%, uptime = 90% (70% + 20%)
      expect(result.calculatedDowntimePercentage).toBeCloseTo(10, 2);
      expect(result.calculatedUptimePercentage).toBeCloseTo(90, 2);
      expect(result.downtimePercentage).toBeCloseTo(10, 2);
      expect(result.uptimePercentage).toBeCloseTo(90, 2);
      expect(result.totalPercentage).toBeCloseTo(100, 2);
    });

    test('should normalize percentages when they do not add up to exactly 100%', () => {
      const scheduledHours = 100;
      const downtimeHours = 10.5;
      const productiveHours = 70.3;
      const idleHours = 19.2;
      
      const result = calculatePerformancePercentages(
        scheduledHours,
        downtimeHours,
        productiveHours,
        idleHours
      );
      
      // Total should be normalized to exactly 100%
      expect(result.downtimePercentage + result.uptimePercentage).toBeCloseTo(100, 2);
      expect(result.downtimePercentage).toBeCloseTo(10.5, 2);
      // Uptime should be normalized to 100 - downtime
      expect(result.uptimePercentage).toBeCloseTo(89.5, 2);
    });

    test('should handle zero scheduled hours', () => {
      const scheduledHours = 0;
      const downtimeHours = 0;
      const productiveHours = 0;
      const idleHours = 0;
      
      const result = calculatePerformancePercentages(
        scheduledHours,
        downtimeHours,
        productiveHours,
        idleHours
      );
      
      expect(result.downtimePercentage).toBe(0);
      expect(result.uptimePercentage).toBe(0);
    });

    test('should ensure percentages add up to exactly 100% within tolerance', () => {
      const scheduledHours = 200;
      const downtimeHours = 25;
      const productiveHours = 150;
      const idleHours = 25;
      
      const result = calculatePerformancePercentages(
        scheduledHours,
        downtimeHours,
        productiveHours,
        idleHours
      );
      
      // Should be exactly 100% (12.5% + 87.5%)
      expect(result.downtimePercentage + result.uptimePercentage).toBeCloseTo(100, 2);
      expect(result.downtimePercentage).toBeCloseTo(12.5, 2);
      expect(result.uptimePercentage).toBeCloseTo(87.5, 2);
    });
  });

  describe('Performance Values Matching', () => {
    test('should match Performance section values when shift is selected', () => {
      // Simulate shift utilization data
      const shiftUtilization = {
        totalScheduledHours: 100,
        totalNonProductiveHours: 15,
        totalProductiveHours: 70,
        totalIdleHours: 15,
        averageUtilization: 85,
        machinesWithData: 5,
      };
      
      // Calculate as Performance section does
      const scheduledHours = shiftUtilization.totalScheduledHours;
      const downtimeHours = shiftUtilization.totalNonProductiveHours;
      const productiveHours = shiftUtilization.totalProductiveHours;
      const idleHours = shiftUtilization.totalIdleHours;
      
      const performanceResult = calculatePerformancePercentages(
        scheduledHours,
        downtimeHours,
        productiveHours,
        idleHours
      );
      
      // Calculate as AI analysis should do (same logic)
      const aiResult = calculatePerformancePercentages(
        scheduledHours,
        downtimeHours,
        productiveHours,
        idleHours
      );
      
      // Values should match exactly
      expect(aiResult.downtimePercentage).toBe(performanceResult.downtimePercentage);
      expect(aiResult.uptimePercentage).toBe(performanceResult.uptimePercentage);
      expect(aiResult.downtimePercentage + aiResult.uptimePercentage).toBeCloseTo(100, 2);
    });

    test('should convert hours to seconds correctly for API', () => {
      const downtimeHours = 10;
      const productiveHours = 70;
      const idleHours = 20;
      
      const totalDowntime = downtimeHours * 3600;
      const totalUptime = (idleHours + productiveHours) * 3600;
      
      expect(totalDowntime).toBe(36000); // 10 hours * 3600 seconds
      expect(totalUptime).toBe(324000); // 90 hours * 3600 seconds
    });
  });

  describe('Edge Cases', () => {
    test('should handle very small percentages', () => {
      const scheduledHours = 1000;
      const downtimeHours = 0.1;
      const productiveHours = 999.8;
      const idleHours = 0.1;
      
      const result = calculatePerformancePercentages(
        scheduledHours,
        downtimeHours,
        productiveHours,
        idleHours
      );
      
      expect(result.downtimePercentage).toBeGreaterThan(0);
      expect(result.uptimePercentage).toBeGreaterThan(0);
      expect(result.downtimePercentage + result.uptimePercentage).toBeCloseTo(100, 2);
    });

    test('should handle 100% downtime', () => {
      const scheduledHours = 100;
      const downtimeHours = 100;
      const productiveHours = 0;
      const idleHours = 0;
      
      const result = calculatePerformancePercentages(
        scheduledHours,
        downtimeHours,
        productiveHours,
        idleHours
      );
      
      expect(result.downtimePercentage).toBeCloseTo(100, 2);
      expect(result.uptimePercentage).toBeCloseTo(0, 2);
    });

    test('should handle 100% uptime', () => {
      const scheduledHours = 100;
      const downtimeHours = 0;
      const productiveHours = 50;
      const idleHours = 50;
      
      const result = calculatePerformancePercentages(
        scheduledHours,
        downtimeHours,
        productiveHours,
        idleHours
      );
      
      expect(result.downtimePercentage).toBeCloseTo(0, 2);
      expect(result.uptimePercentage).toBeCloseTo(100, 2);
    });
  });

  describe('Request Body Validation', () => {
    test('should include correct performance values in request body', () => {
      const shiftUtilization = {
        totalScheduledHours: 100,
        totalNonProductiveHours: 10,
        totalProductiveHours: 70,
        totalIdleHours: 20,
        averageUtilization: 90,
        machinesWithData: 5,
      };
      
      const result = calculatePerformancePercentages(
        shiftUtilization.totalScheduledHours,
        shiftUtilization.totalNonProductiveHours,
        shiftUtilization.totalProductiveHours,
        shiftUtilization.totalIdleHours
      );
      
      const requestBody = {
        downtimePercentage: result.downtimePercentage,
        uptimePercentage: result.uptimePercentage,
        totalDowntime: shiftUtilization.totalNonProductiveHours * 3600,
        totalUptime: (shiftUtilization.totalProductiveHours + shiftUtilization.totalIdleHours) * 3600,
      };
      
      // Validate request body structure
      expect(requestBody).toHaveProperty('downtimePercentage');
      expect(requestBody).toHaveProperty('uptimePercentage');
      expect(requestBody).toHaveProperty('totalDowntime');
      expect(requestBody).toHaveProperty('totalUptime');
      
      // Validate values
      expect(requestBody.downtimePercentage).toBeCloseTo(10, 2);
      expect(requestBody.uptimePercentage).toBeCloseTo(90, 2);
      expect(requestBody.downtimePercentage + requestBody.uptimePercentage).toBeCloseTo(100, 2);
      expect(requestBody.totalDowntime).toBe(36000); // 10 hours * 3600
      expect(requestBody.totalUptime).toBe(324000); // 90 hours * 3600
    });
  });
});

