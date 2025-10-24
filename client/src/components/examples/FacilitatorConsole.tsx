import FacilitatorConsole from '../FacilitatorConsole'

export default function FacilitatorConsoleExample() {
  const participants = [
    { id: '1', name: 'Alice Johnson', isOnline: true },
    { id: '2', name: 'Bob Smith', isOnline: true },
    { id: '3', name: 'Carol White', isOnline: false },
    { id: '4', name: 'David Brown', isOnline: true },
    { id: '5', name: 'Eve Davis', isOnline: true },
  ]

  return (
    <FacilitatorConsole
      sessionStatus="open"
      currentModule="Ideation Whiteboard"
      participants={participants}
      onStartSession={() => console.log('Starting session')}
      onEndSession={() => console.log('Ending session')}
      onTriggerAI={() => console.log('Triggering AI categorization')}
      onNextModule={() => console.log('Moving to next module')}
      onGenerateReport={() => console.log('Generating report')}
    />
  )
}
