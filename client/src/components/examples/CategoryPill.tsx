import CategoryPill from '../CategoryPill'

export default function CategoryPillExample() {
  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-wrap gap-2">
        <CategoryPill
          name="User Experience"
          count={12}
          onClick={() => console.log('Category clicked: UX')}
        />
        <CategoryPill
          name="Product Features"
          isAiGenerated
          count={8}
          onClick={() => console.log('Category clicked: Features')}
        />
        <CategoryPill
          name="Performance"
          count={5}
        />
        <CategoryPill
          name="Security"
          isAiGenerated
          count={3}
        />
      </div>
      <p className="text-sm text-muted-foreground">AI-generated categories have sparkle icon</p>
    </div>
  )
}
