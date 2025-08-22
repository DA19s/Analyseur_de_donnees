"use client"

import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import { Check, Circle } from "lucide-react"

interface Step {
  path: string
  title: string
  description: string
}

const steps: Step[] = [
  {
    path: "/",
    title: "Étape 1",
    description: "Upload du fichier"
  },
  {
    path: "/variables",
    title: "Étape 2",
    description: "Sélection des variables"
  },
  {
    path: "/results",
    title: "Étape 3",
    description: "Résultat de la sélection"
  }
]

export default function StepProgress() {
  const pathname = usePathname()
  const [currentStepIndex, setCurrentStepIndex] = useState(0)

  const updateStepIndex = () => {
    // Détecter l'étape basée sur le pathname
    let stepIndex = steps.findIndex(step => step.path === pathname)
    
    if (stepIndex !== -1) {
      setCurrentStepIndex(stepIndex)
    }
  }

  useEffect(() => {
    updateStepIndex()
    
    // Écouter les changements dans le localStorage
    const handleStorageChange = () => {
      updateStepIndex()
    }
    
    // Écouter les événements de stockage
    window.addEventListener('storage', handleStorageChange)
    
    // Créer un intervalle pour vérifier les changements (plus simple et fiable)
    const interval = setInterval(updateStepIndex, 500)
    
    return () => {
      window.removeEventListener('storage', handleStorageChange)
      clearInterval(interval)
    }
  }, [pathname])

  return (
    <div className="fixed top-4 left-2 z-50 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg border p-2 max-w-48">
      <div className="space-y-1.5">
        {steps.map((step, index) => {
          const isCompleted = index < currentStepIndex
          const isCurrent = index === currentStepIndex
          const isUpcoming = index > currentStepIndex

          return (
            <div key={step.path} className="flex items-center space-x-1.5">
              {/* Indicateur d'étape */}
              <div className="flex-shrink-0">
                {isCompleted ? (
                  <div className="w-5 h-5 bg-gray-300 rounded-full flex items-center justify-center">
                    <Circle className="w-3 h-3 text-gray-500" />
                  </div>
                ) : isCurrent ? (
                  <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center animate-pulse">
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
                  isCurrent ? 'text-blue-600' : 
                  'text-gray-500'
                }`}>
                  {step.title}
                </div>
                <div className={`text-xs ${
                  isCompleted ? 'text-gray-400' : 
                  isCurrent ? 'text-blue-500' : 
                  'text-gray-400'
                }`}>
                  {step.description}
                </div>
              </div>

              {/* Ligne de connexion */}
              {index < steps.length - 1 && (
                <div className="absolute left-2.5 top-5 w-0.5 h-5 bg-gray-200 transform translate-x-1/2">
                  {isCompleted && (
                    <div className="w-full h-full bg-green-500 animate-pulse"></div>
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