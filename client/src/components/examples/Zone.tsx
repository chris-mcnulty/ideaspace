import Zone from '../Zone'
import StickyNote from '../StickyNote'

export default function ZoneExample() {
  return (
    <div className="space-y-6 p-6">
      <Zone name="User Experience" color="border-blue-500">
        <StickyNote
          id="1"
          content="Simplify navigation"
          author="Alice"
        />
        <StickyNote
          id="2"
          content="Add dark mode"
          author="Bob"
        />
      </Zone>
      <Zone name="Performance" color="border-green-500">
        <StickyNote
          id="3"
          content="Optimize images"
        />
      </Zone>
    </div>
  )
}
