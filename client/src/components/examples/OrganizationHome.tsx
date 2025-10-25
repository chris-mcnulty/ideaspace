import OrganizationHome from '../OrganizationHome'

export default function OrganizationHomeExample() {
  const spaces = [
    {
      id: '1',
      name: 'Product Vision 2025',
      purpose: 'Envision the future of our product roadmap and prioritize key initiatives',
      status: 'open' as const,
      participantCount: 24,
    },
    {
      id: '2',
      name: 'Customer Experience Workshop',
      purpose: 'Brainstorm and rank improvements to enhance customer satisfaction',
      status: 'draft' as const,
      participantCount: 0,
    },
    {
      id: '3',
      name: 'Q4 Strategy Session',
      purpose: 'Collaborative planning for quarterly objectives and key results',
      status: 'closed' as const,
      participantCount: 18,
    },
  ]

  return (
    <OrganizationHome
      orgName="Acme Corporation"
      userName="Sarah Johnson"
      userRole="org_admin"
      spaces={spaces}
      onEnterSpace={(id) => console.log('Entering space:', id)}
      onCreateSpace={() => console.log('Creating new space')}
      onManageOrg={() => console.log('Managing organization')}
    />
  )
}
