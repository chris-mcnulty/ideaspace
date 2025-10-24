import ParticipantList from '../ParticipantList'

export default function ParticipantListExample() {
  const participants = [
    { id: '1', name: 'Alice Johnson', isOnline: true },
    { id: '2', name: 'Bob Smith', isOnline: true },
    { id: '3', name: 'Carol White', isOnline: false },
    { id: '4', name: 'David Brown', isOnline: true },
    { id: '5', name: 'Eve Davis', isOnline: true },
    { id: '6', name: 'Frank Wilson', isOnline: false },
    { id: '7', name: 'Grace Lee', isOnline: true },
    { id: '8', name: 'Henry Moore', isOnline: true },
    { id: '9', name: 'Iris Taylor', isOnline: false },
    { id: '10', name: 'Jack Anderson', isOnline: true },
  ]

  return (
    <div className="p-6 space-y-4">
      <ParticipantList participants={participants} maxVisible={6} />
      <p className="text-sm text-muted-foreground">Shows online count and participant avatars</p>
    </div>
  )
}
