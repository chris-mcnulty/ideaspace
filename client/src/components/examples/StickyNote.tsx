import StickyNote from '../StickyNote'

export default function StickyNoteExample() {
  return (
    <div className="flex flex-wrap gap-4 p-6">
      <StickyNote
        id="1"
        content="Improve customer onboarding experience with personalized tutorials"
        author="Alice"
        timestamp={new Date()}
        category="User Experience"
      />
      <StickyNote
        id="2"
        content="Implement real-time collaboration features for remote teams"
        author="Bob"
        category="Product Features"
        isAiCategory
        selected
      />
      <StickyNote
        id="3"
        content="Reduce page load time by optimizing asset delivery"
        timestamp={new Date()}
      />
    </div>
  )
}
