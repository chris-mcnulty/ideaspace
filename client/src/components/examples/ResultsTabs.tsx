import ResultsTabs from '../ResultsTabs'

export default function ResultsTabsExample() {
  const items = [
    { id: '1', content: 'Improve customer onboarding experience', category: 'UX', score: 42, winRate: 87 },
    { id: '2', content: 'Implement real-time collaboration', category: 'Features', score: 38, winRate: 82 },
    { id: '3', content: 'Optimize application performance', category: 'Technical', score: 35, winRate: 76 },
    { id: '4', content: 'Add mobile app support', category: 'Platform', score: 28, winRate: 71 },
    { id: '5', content: 'Enhance data security', category: 'Security', score: 24, winRate: 65 },
  ]

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <ResultsTabs
        topByVotes={items}
        topByWinRate={items}
        finalRanking={items}
      />
    </div>
  )
}
