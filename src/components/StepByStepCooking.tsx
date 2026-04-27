import { useCallback, useEffect, useState } from "react"
import type { RecipeStep } from "../api/generated/types.gen"
import { Button } from "./ui"

interface StepByStepCookingProps {
  steps: RecipeStep[]
  onComplete?: () => void
}

export function StepByStepCooking({ steps, onComplete }: StepByStepCookingProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [isCompleted, setIsCompleted] = useState(false)

  const handleNext = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      setIsCompleted(true)
      onComplete?.()
    }
  }, [currentStep, steps.length, onComplete])

  const handlePrevious = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }, [currentStep])

  const handleReset = () => {
    setCurrentStep(0)
    setIsCompleted(false)
  }

  // Keyboard navigation for step-by-step mode
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "ArrowRight") {
        e.preventDefault()
        handleNext()
      } else if (e.key === "ArrowLeft") {
        e.preventDefault()
        handlePrevious()
      } else if (e.key === "Escape") {
        e.preventDefault()
        onComplete?.()
      }
    }

    window.addEventListener("keydown", handleKeyPress)
    return () => window.removeEventListener("keydown", handleKeyPress)
  }, [onComplete, handleNext, handlePrevious])

  if (isCompleted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="mb-8">
          <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mb-4 mx-auto">
            <svg
              className="w-8 h-8 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-label="Check mark"
            >
              <title>Completed</title>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-100 mb-2">Recipe Complete!</h2>
          <p className="text-gray-400">Enjoy your delicious meal!</p>
        </div>

        <div className="flex gap-3">
          <Button onClick={handleReset} variant="secondary">
            Start Over
          </Button>
          <Button onClick={onComplete}>Finish Cooking</Button>
        </div>
      </div>
    )
  }

  const step = steps[currentStep]

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Progress indicator */}
      <div className="px-4 py-3 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <span className="text-sm font-medium text-gray-400">
            Step {currentStep + 1} of {steps.length}
          </span>
          <span className="text-sm text-gray-500">
            {Math.round(((currentStep + 1) / steps.length) * 100)}% complete
          </span>
        </div>
        <div className="w-full bg-gray-800 rounded-full h-2 mt-2">
          <div
            className="bg-orange-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-4xl mx-auto">
          <div className="cook-mode-step-active mb-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-orange-600 text-white rounded-full flex items-center justify-center text-xl font-bold">
                {currentStep + 1}
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-100">
                  {step.title || `Step ${currentStep + 1}`}
                </h3>
              </div>
            </div>

            <div className="cook-mode-text text-gray-100 leading-relaxed">{step.text}</div>
          </div>

          {/* Timer placeholder (could be enhanced with actual timer functionality) */}
          <div className="bg-gray-900 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-3">
              <svg
                className="w-5 h-5 text-orange-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-label="Timer icon"
              >
                <title>Timer</title>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="text-sm text-gray-400">Timer available here</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation controls */}
      <div className="px-4 py-4 bg-gray-900 border-t border-gray-800">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <Button
            onClick={handlePrevious}
            disabled={currentStep === 0}
            variant="secondary"
            className="min-w-[100px]"
          >
            Previous
          </Button>

          <div className="text-center">
            <p className="text-sm text-gray-500 mb-2">Press Space to continue</p>
          </div>

          <Button onClick={handleNext} className="min-w-[100px]">
            {currentStep === steps.length - 1 ? "Complete" : "Next"}
          </Button>
        </div>
      </div>
    </div>
  )
}
