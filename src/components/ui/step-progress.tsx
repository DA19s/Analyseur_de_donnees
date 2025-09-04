"use client"

import { useState, useEffect } from "react"
import { Check, Circle } from "lucide-react"

interface Step {
  title: string
  description: string
  color: string
}

const steps: Step[] = [
  {
    title: "Upload du fichier",
    description: "Étape 1",
    color: "blue"
  },
  {
    title: "Sélection des variables à expliquer",
    description: "Étape 2",
    color: "green"
  },
  {
    title: "Sélection des variables explicatives",
    description: "Étape 3",
    color: "blue"
  },
  {
    title: "Définition de l'échantillon à traiter",
    description: "Étape 4",
    color: "orange"
  },
  {
    title: "Vérification des variables",
    description: "Étape 5",
    color: "purple"
  },
  {
    title: "Arbre de décision",
    description: "Étape 6",
    color: "green"
  }
]

interface StepProgressProps {
  currentStep: number
}

export default function StepProgress({ currentStep }: StepProgressProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0)

  useEffect(() => {
    // Convertir le numéro d'étape en index (0-based)
    setCurrentStepIndex(currentStep - 1)
  }, [currentStep])

  return (
    <div className="fixed top-4 left-2 z-50 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg border p-2 max-w-30">
      <div className="space-y-1.5">
        {steps.map((step, index) => {
          const isCompleted = index < currentStepIndex
          const isCurrent = index === currentStepIndex
          const isUpcoming = index > currentStepIndex

          return (
            <div key={index} className="flex items-center space-x-1.5 relative">
              {/* Indicateur d'étape */}
              <div className="flex-shrink-0">
                {isCompleted ? (
                  <div className="w-5 h-5 bg-gray-300 rounded-full flex items-center justify-center">
                    <Check className="w-3 h-3 text-gray-500" />
                  </div>
                ) : isCurrent ? (
                  <div className={`w-5 h-5 bg-${step.color}-500 rounded-full flex items-center justify-center animate-pulse`}>
                    <Circle className="w-3 h-3 text-white fill-current" />
                  </div>
                ) : (
                  <div className="w-5 h-5 bg-gray-300 rounded-full flex items-center justify-center">
                    <Circle className="w-3 h-3 text-gray-500" />
                  </div>
                )}
              </div>

              {/* Contenu de l'étape */}
              <div className="flex-1 min-w-0">
                <div className={`text-xs font-medium ${
                  isCompleted ? 'text-gray-500' : 
                  isCurrent ? `text-${step.color}-600` : 
                  'text-gray-400'
                }`}>
                  {step.description}
                </div>
                <div className={`text-xs break-words leading-tight ${
                  isCompleted ? 'text-gray-400' : 
                  isCurrent ? `text-${step.color}-500` : 
                  'text-gray-400'
                }`}>
                  {step.title}
                </div>
              </div>

              {/* Ligne de connexion */}
              {index < steps.length - 1 && (
                <div className="absolute left-2.5 top-5 w-0.5 h-5 bg-gray-200 transform translate-x-1/2">
                  {isCompleted && (
                    <div className="w-full h-full bg-gray-300"></div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}