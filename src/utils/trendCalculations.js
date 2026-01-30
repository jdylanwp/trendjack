export const TIME_RANGES = {
  '7d': { label: '7 Days', days: 7 },
  '30d': { label: '30 Days', days: 30 },
  '90d': { label: '90 Days', days: 90 },
  '1y': { label: '1 Year', days: 365 },
  '5y': { label: '5 Years', days: 1825 },
  'all': { label: 'All Time', days: null },
};

export function calculateGrowthPercentage(data, timeRange) {
  if (!data || data.length < 2) return 0;

  const sortedData = [...data].sort((a, b) => new Date(a.date) - new Date(b.date));

  const now = new Date();
  const cutoffDate = timeRange === 'all'
    ? new Date(0)
    : new Date(now.getTime() - TIME_RANGES[timeRange].days * 24 * 60 * 60 * 1000);

  const recentData = sortedData.filter(d => new Date(d.date) >= cutoffDate);

  if (recentData.length < 2) return 0;

  const firstValue = recentData[0].count;
  const lastValue = recentData[recentData.length - 1].count;

  if (firstValue === 0) return lastValue > 0 ? 100 : 0;

  return ((lastValue - firstValue) / firstValue) * 100;
}

export function filterDataByTimeRange(data, timeRange) {
  if (!data || data.length === 0) return [];

  if (timeRange === 'all') return data;

  const now = new Date();
  const cutoffDate = new Date(now.getTime() - TIME_RANGES[timeRange].days * 24 * 60 * 60 * 1000);

  return data.filter(d => new Date(d.date) >= cutoffDate);
}

export function getHistoricalComparison(data) {
  if (!data || data.length === 0) return null;

  const sortedData = [...data].sort((a, b) => new Date(a.date) - new Date(b.date));
  const now = new Date();

  const comparisons = {};

  [7, 30, 90, 365, 1825].forEach(days => {
    const cutoffDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const historicalData = sortedData.filter(d => new Date(d.date) >= cutoffDate);

    if (historicalData.length >= 2) {
      const firstVal = historicalData[0].count;
      const lastVal = historicalData[historicalData.length - 1].count;
      const growth = firstVal === 0 ? (lastVal > 0 ? 100 : 0) : ((lastVal - firstVal) / firstVal) * 100;

      let label;
      if (days === 7) label = '7d';
      else if (days === 30) label = '30d';
      else if (days === 90) label = '90d';
      else if (days === 365) label = '1y';
      else if (days === 1825) label = '5y';

      comparisons[label] = growth;
    }
  });

  return comparisons;
}

export function aggregateMentionsByDate(mentions) {
  const grouped = mentions.reduce((acc, mention) => {
    const date = mention.mention_date;
    if (!acc[date]) {
      acc[date] = 0;
    }
    acc[date] += mention.mention_count;
    return acc;
  }, {});

  return Object.entries(grouped)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}
