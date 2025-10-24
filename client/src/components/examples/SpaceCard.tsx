import SpaceCard from '../SpaceCard'

export default function SpaceCardExample() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
      <SpaceCard
        name="Product Vision 2025"
        purpose="Envision the future of our product roadmap and prioritize key initiatives"
        status="open"
        participantCount={24}
        onEnter={() => console.log('Entering space')}
      />
      <SpaceCard
        name="Customer Experience Workshop"
        purpose="Brainstorm and rank improvements to enhance customer satisfaction"
        status="draft"
        participantCount={0}
        onEnter={() => console.log('Entering space')}
      />
      <SpaceCard
        name="Q4 Strategy Session"
        purpose="Collaborative planning for quarterly objectives and key results"
        status="closed"
        participantCount={18}
        onEnter={() => console.log('Entering space')}
      />
    </div>
  )
}
