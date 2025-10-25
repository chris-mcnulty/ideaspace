import FacilitatorWorkspace from '../FacilitatorWorkspace'
import { useState } from 'react'

export default function FacilitatorWorkspaceExample() {
  const participants = [
    { id: '1', name: 'Alice Johnson', isOnline: true },
    { id: '2', name: 'Bob Smith', isOnline: true },
    { id: '3', name: 'Powerful Andromeda', isOnline: true },
    { id: '4', name: 'Radiant Sirius', isOnline: true },
    { id: '5', name: 'Carol White', isOnline: false },
  ]

  interface Note {
    id: string;
    content: string;
    author: string;
    category?: string;
    isAiCategory?: boolean;
  }

  const [notes, setNotes] = useState<Note[]>([
    {
      id: '1',
      content: 'Improve customer onboarding with personalized tutorials',
      author: 'Alice Johnson',
      category: 'User Experience',
    },
    {
      id: '2',
      content: 'Implement real-time collaboration features',
      author: 'Bob Smith',
      category: 'Product Features',
      isAiCategory: true,
    },
    {
      id: '3',
      content: 'Optimize application performance and reduce load times',
      author: 'Powerful Andromeda',
      category: 'Technical',
    },
    {
      id: '4',
      content: 'Add mobile app support for iOS and Android',
      author: 'Radiant Sirius',
      category: 'Product Features',
      isAiCategory: true,
    },
    {
      id: '5',
      content: 'Enhance data security and privacy controls',
      author: 'Alice Johnson',
      category: 'Security',
    },
  ])

  return (
    <FacilitatorWorkspace
      spaceName="Product Vision 2025"
      sessionStatus="open"
      currentPhase="ideation"
      participants={participants}
      notes={notes}
      onAddNote={(content, category) => {
        const newNote = {
          id: `note-${Date.now()}`,
          content,
          author: 'Facilitator',
          category,
        }
        setNotes([...notes, newNote])
        console.log('Added note:', newNote)
      }}
      onEditNote={(noteId, content) => {
        setNotes(notes.map(n => n.id === noteId ? { ...n, content } : n))
        console.log('Edited note:', noteId, content)
      }}
      onDeleteNote={(noteId) => {
        setNotes(notes.filter(n => n.id !== noteId))
        console.log('Deleted note:', noteId)
      }}
      onMergeNotes={(noteIds, newContent) => {
        const firstNoteId = noteIds[0]
        const firstNote = notes.find(n => n.id === firstNoteId)
        setNotes([
          ...notes.filter(n => !noteIds.includes(n.id)),
          {
            id: `merged-${Date.now()}`,
            content: newContent,
            author: firstNote?.author || 'Facilitator',
            category: firstNote?.category,
          }
        ])
        console.log('Merged notes:', noteIds, newContent)
      }}
      onPreloadNotes={(newNotes) => {
        setNotes([...notes, ...newNotes])
        console.log('Preloaded notes:', newNotes)
      }}
      onStartSession={() => console.log('Starting session')}
      onEndSession={() => console.log('Ending session')}
      onNextPhase={() => console.log('Moving to next phase')}
      onTriggerAI={() => console.log('Triggering AI categorization')}
    />
  )
}
