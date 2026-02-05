/**
 * Chart Data Generators
 * Utility functions to generate chart data
 */

// Simple seeded random function for consistency
function seededRandom(seed: number) {
  return () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

export function generateFundingRateData(
  duration: string = '1 Week',
  resolution: string = '1 Hour'
) {
  const data = [];
  const random = seededRandom(0.5);

  // Calculate number of data points based on duration and resolution
  const durationMap: Record<string, number> = {
    '1 Week': 7,
    '1 Month': 30,
    '3 Months': 90,
    '1 Year': 365,
  };

  const resolutionMap: Record<string, number> = {
    '1 Hour': 1,
    '4 Hours': 4,
    '1 Day': 24,
  };

  const days = durationMap[duration] || 7;
  const hoursPerPoint = resolutionMap[resolution] || 1;
  const totalHours = days * 24;
  const numPoints = Math.floor(totalHours / hoursPerPoint);

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  for (let i = 0; i < numPoints; i++) {
    const date = new Date(startDate);
    date.setHours(date.getHours() + i * hoursPerPoint);

    const hour = date.getHours();
    const minutes = date.getMinutes();
    const day = date.getDate();
    const month = date.getMonth() + 1;

    // Format time based on resolution
    let timeLabel: string;
    if (hoursPerPoint >= 24) {
      timeLabel = `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`;
    } else {
      timeLabel = `${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }

    // Simulate funding rate fluctuations
    const progress = i / numPoints;
    const hyperliquidBase = Math.sin(progress * Math.PI * 4) * 30;
    const pacificaBase = Math.cos(progress * Math.PI * 3) * 40;
    const noise = () => (random() - 0.5) * 20;

    const isProjected = progress > 0.95;

    data.push({
      time: timeLabel,
      hyperliquid: Number((hyperliquidBase + noise()).toFixed(4)),
      pacifica: Number((pacificaBase + noise()).toFixed(4)),
      projectedHyperliquid: isProjected ? Number((hyperliquidBase + noise()).toFixed(4)) : null,
      projectedPacifica: isProjected ? Number((pacificaBase + noise()).toFixed(4)) : null,
    });
  }

  return data;
}

export function generatePnLData(duration: string = '1 Week', resolution: string = '1 Hour') {
  const data = [];
  const random = seededRandom(0.5);

  // Calculate number of data points based on duration and resolution
  const durationMap: Record<string, number> = {
    '1 Week': 7,
    '1 Month': 30,
    '3 Months': 90,
    '1 Year': 365,
  };

  const resolutionMap: Record<string, number> = {
    '1 Hour': 1,
    '4 Hours': 4,
    '1 Day': 24,
  };

  const days = durationMap[duration] || 7;
  const hoursPerPoint = resolutionMap[resolution] || 1;
  const totalHours = days * 24;
  const numPoints = Math.floor(totalHours / hoursPerPoint);

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  for (let i = 0; i < numPoints; i++) {
    const date = new Date(startDate);
    date.setHours(date.getHours() + i * hoursPerPoint);

    const hour = date.getHours();
    const minutes = date.getMinutes();
    const day = date.getDate();
    const month = date.getMonth() + 1;

    // Format time based on resolution
    let timeLabel: string;
    if (hoursPerPoint >= 24) {
      timeLabel = `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`;
    } else {
      timeLabel = `${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }

    // Generate values that can be positive (profit) or negative (loss)
    let value: number;
    const progress = i / numPoints;

    if (progress < 0.1) {
      // Early period: more losses
      value = -(random() * 2); // Negative values (losses)
    } else if (progress > 0.95) {
      // Projected period: high profits
      value = random() * 5 + 1; // Positive values (profits)
    } else {
      // Mid period: mix with bias towards profit
      value = (random() - 0.2) * 4; // Can be positive or negative
    }

    const isProfit = value >= 0;
    const isProjected = progress > 0.95;

    data.push({
      time: timeLabel,
      value: Number(value.toFixed(2)), // Keep original sign
      profit: isProfit ? value : 0,
      loss: !isProfit ? Math.abs(value) : 0,
      projected: isProjected ? Number((random() * 5 + 1).toFixed(2)) : null,
    });
  }

  return data;
}

export function generateCumulativePnLData(
  duration: string = '1 Week',
  resolution: string = '1 Hour'
) {
  const data = [];
  let cumulative = 10000; // Starting value
  const random = seededRandom(0.5);

  // Calculate number of data points based on duration and resolution
  const durationMap: Record<string, number> = {
    '1 Week': 7,
    '1 Month': 30,
    '3 Months': 90,
    '1 Year': 365,
  };

  const resolutionMap: Record<string, number> = {
    '1 Hour': 1,
    '4 Hours': 4,
    '1 Day': 24,
  };

  const days = durationMap[duration] || 7;
  const hoursPerPoint = resolutionMap[resolution] || 1;
  const totalHours = days * 24;
  const numPoints = Math.floor(totalHours / hoursPerPoint);

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  for (let i = 0; i < numPoints; i++) {
    const date = new Date(startDate);
    date.setHours(date.getHours() + i * hoursPerPoint);

    const hour = date.getHours();
    const minutes = date.getMinutes();
    const day = date.getDate();
    const month = date.getMonth() + 1;

    // Format time based on resolution
    let timeLabel: string;
    if (hoursPerPoint >= 24) {
      timeLabel = `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`;
    } else {
      timeLabel = `${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }

    const change = (random() - 0.4) * 200;
    cumulative += change;

    const progress = i / numPoints;
    const isProjected = progress > 0.95;

    data.push({
      time: timeLabel,
      cumulative: Number(cumulative.toFixed(2)),
      initial: 10000,
      projected: isProjected ? Number((cumulative + change * 2).toFixed(2)) : null,
    });
  }

  return data;
}
