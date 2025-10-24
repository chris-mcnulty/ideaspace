import ReadoutViewer from '../ReadoutViewer'

export default function ReadoutViewerExample() {
  return (
    <ReadoutViewer
      cohortSummary="Based on the collective input from 24 participants, the top priorities emerged around enhancing user experience and implementing collaborative features. The group showed strong consensus on improving customer onboarding (87% win rate) and real-time collaboration capabilities (82% win rate). These insights align with current market trends in SaaS platforms and present clear opportunities for differentiation."
      personalSummary="As a Product Manager at TechCorp, your voting patterns align closely with the cohort's emphasis on user experience improvements. However, you showed distinctly higher prioritization of security features compared to your peers, which makes sense given your company's enterprise focus. Your rankings suggest a balanced approach between immediate user needs and long-term platform stability."
      recommendations={[
        {
          title: 'Implement Guided Onboarding Flow',
          description: 'Develop an interactive tutorial system with personalized walkthroughs based on user role and objectives. Consider using Microsoft Power Platform for rapid prototyping.',
        },
        {
          title: 'Add Real-Time Collaboration Features',
          description: 'Integrate Azure SignalR Service to enable live co-editing and presence indicators. Start with document collaboration before expanding to other modules.',
        },
        {
          title: 'Optimize Performance Metrics',
          description: 'Conduct comprehensive performance audit focusing on page load times and asset delivery. Leverage Azure CDN for global content distribution.',
        },
      ]}
      userProfile={{
        name: 'Sarah Johnson',
        role: 'Product Manager',
        company: 'TechCorp',
      }}
      onDownload={() => console.log('Downloading PDF')}
      onEmailMe={() => console.log('Sending email')}
    />
  )
}
