import RankListItem from '../RankList'

export default function RankListExample() {
  const items = [
    { id: '1', content: 'Improve customer onboarding experience', category: 'UX' },
    { id: '2', content: 'Implement real-time collaboration', category: 'Features' },
    { id: '3', content: 'Optimize application performance', category: 'Technical' },
    { id: '4', content: 'Add mobile app support', category: 'Platform' },
    { id: '5', content: 'Enhance data security', category: 'Security' },
  ]

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-3">
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-1">Drag to reorder by priority</h3>
        <p className="text-sm text-muted-foreground">Most important at the top</p>
      </div>
      {items.map((item, index) => (
        <RankListItem
          key={item.id}
          id={item.id}
          rank={index + 1}
          content={item.content}
          category={item.category}
        />
      ))}
    </div>
  )
}
