import BrandHeader from '../BrandHeader'

export default function BrandHeaderExample() {
  return (
    <>
      <BrandHeader 
        orgName="Synozur"
        userName="John Doe"
        userRole="facilitator"
      />
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Example with different org branding:</p>
      </div>
      <BrandHeader 
        orgName="Acme Corp"
        userName="Jane Smith"
        userRole="participant"
      />
    </>
  )
}
