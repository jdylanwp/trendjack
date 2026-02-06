export function processChartData(scores) {
  const dataByKeyword = {};

  scores.forEach(score => {
    const keyword = score.monitored_keywords?.keyword || 'Unknown';
    const date = new Date(score.calculated_at).toLocaleDateString();

    if (!dataByKeyword[date]) {
      dataByKeyword[date] = { date };
    }

    const currentScore = parseFloat(score.heat_score);
    if (!dataByKeyword[date][keyword] || dataByKeyword[date][keyword] < currentScore) {
      dataByKeyword[date][keyword] = currentScore;
    }
  });

  return Object.values(dataByKeyword).slice(0, 20).reverse();
}

export function deriveStats(scores) {
  const trendingMap = new Map();
  scores
    .filter(s => s.is_trending)
    .forEach(s => {
      const keyword = s.monitored_keywords?.keyword || 'Unknown';
      const heatScore = parseFloat(s.heat_score);

      if (!trendingMap.has(keyword) || trendingMap.get(keyword).heatScore < heatScore) {
        trendingMap.set(keyword, {
          id: s.id,
          keyword,
          subreddit: s.monitored_keywords?.related_subreddit || 'Unknown',
          heatScore: heatScore.toFixed(2),
          calculatedAt: new Date(s.calculated_at).toLocaleString(),
        });
      }
    });

  const trending = Array.from(trendingMap.values())
    .sort((a, b) => parseFloat(b.heatScore) - parseFloat(a.heatScore))
    .slice(0, 10);

  const trendingScores = scores.filter(s => s.is_trending);
  const avgHeat = trendingScores.reduce((sum, s) => sum + parseFloat(s.heat_score), 0)
    / (trendingScores.length || 1);

  const uniqueKeywords = new Set(scores.map(s => s.monitored_keywords?.keyword).filter(Boolean));

  return {
    trending,
    stats: {
      totalKeywords: uniqueKeywords.size,
      trendingCount: trendingMap.size,
      avgHeatScore: avgHeat.toFixed(2),
    },
  };
}
