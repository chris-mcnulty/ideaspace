import WaitingRoom from '../WaitingRoom'

export default function WaitingRoomExample() {
  return (
    <WaitingRoom
      orgName="Acme Corporation"
      spaceName="Product Strategy Workshop"
      spacePurpose="Join us to envision the future of our product line and prioritize key initiatives for Q1 2025"
      status="open"
      onJoinAnonymous={(guestName) => console.log('Joining as:', guestName)}
      onRegister={(data) => console.log('Registration data:', data)}
    />
  )
}
