import DuelCard from '../DuelCard'
import { Badge } from '@/components/ui/badge'
import { useState } from 'react'

export default function DuelCardExample() {
  const [selected, setSelected] = useState<'left' | 'right' | null>(null)

  return (
    <div className="p-6">
      <div className="mb-4 text-center">
        <div className="text-lg font-semibold mb-1">Which is more important?</div>
        <div className="text-sm text-muted-foreground">1 of 15</div>
      </div>
      <div className="grid grid-cols-2 gap-8 max-w-4xl mx-auto">
        <DuelCard
          content="Improve customer onboarding with personalized tutorials and guided tours"
          category="User Experience"
          position="left"
          selected={selected === 'left'}
          onClick={() => {
            setSelected('left')
            console.log('Selected left option')
          }}
        />
        <div className="flex items-center justify-center">
          <Badge variant="outline" className="text-lg px-4 py-2">vs</Badge>
        </div>
        <DuelCard
          content="Implement real-time collaboration features for remote teams"
          category="Product Features"
          position="right"
          selected={selected === 'right'}
          onClick={() => {
            setSelected('right')
            console.log('Selected right option')
          }}
        />
      </div>
    </div>
  )
}
