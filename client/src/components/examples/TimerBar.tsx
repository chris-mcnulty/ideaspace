import TimerBar from '../TimerBar'
import { useState, useEffect } from 'react'

export default function TimerBarExample() {
  const [timeRemaining, setTimeRemaining] = useState(300)
  const [isRunning, setIsRunning] = useState(false)

  useEffect(() => {
    if (!isRunning || timeRemaining === 0) return
    const interval = setInterval(() => {
      setTimeRemaining(t => Math.max(0, t - 1))
    }, 1000)
    return () => clearInterval(interval)
  }, [isRunning, timeRemaining])

  return (
    <div>
      <TimerBar
        timeRemaining={timeRemaining}
        totalTime={300}
        isRunning={isRunning}
        onToggle={() => {
          setIsRunning(!isRunning)
          console.log('Timer toggled')
        }}
        onReset={() => {
          setTimeRemaining(300)
          setIsRunning(false)
          console.log('Timer reset')
        }}
        isFacilitator
      />
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Timer controls available for facilitators</p>
      </div>
    </div>
  )
}
