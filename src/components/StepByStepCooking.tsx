import { Check, Clock } from "lucide-react"
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
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <div className="mb-8">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-600">
            <Check className="h-8 w-8 text-white" aria-hidden="true" />
          </div>
          <h2 className="mb-2 font-bold text-2xl text-gray-100">Recipe Complete!</h2>
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
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      {/* Progress indicator */}
      <div className="border-gray-800 border-b bg-gray-900 px-4 py-3">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <span className="font-medium text-gray-400 text-sm">
            Step {currentStep + 1} of {steps.length}
          </span>
          <span className="text-gray-500 text-sm">
            {Math.round(((currentStep + 1) / steps.length) * 100)}% complete
          </span>
        </div>
        <div className="mt-2 h-2 w-full rounded-full bg-gray-800">
          <div
            className="h-2 rounded-full bg-orange-600 transition-all duration-300"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-4xl">
          <div className="cook-mode-step-active mb-6">
            <div className="mb-4 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-600 font-bold text-white text-xl">
                {currentStep + 1}
              </div>
              <div>
                <h3 className="font-bold text-gray-100 text-xl">
                  {step.title || `Step ${currentStep + 1}`}
                </h3>
              </div>
            </div>

            <div className="cook-mode-text text-gray-100 leading-relaxed">{step.text}</div>
          </div>

          {/* Timer placeholder (could be enhanced with actual timer functionality) */}
          <div className="mb-6 rounded-lg bg-gray-900 p-4">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-orange-400" aria-hidden="true" />
              <span className="text-gray-400 text-sm">Timer available here</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation controls */}
      <div className="border-gray-800 border-t bg-gray-900 px-4 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Button
            onClick={handlePrevious}
            disabled={currentStep === 0}
            variant="secondary"
            className="min-w-[100px]"
          >
            Previous
          </Button>

          <div className="text-center">
            <p className="mb-2 text-gray-500 text-sm">Press Space to continue</p>
          </div>

          <Button onClick={handleNext} className="min-w-[100px]">
            {currentStep === steps.length - 1 ? "Complete" : "Next"}
          </Button>
        </div>
      </div>
    </div>
  )
}
