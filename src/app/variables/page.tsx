"use client"

import ExcelPreview from "@/components/ui/excel-preview"
import StepProgress from "@/components/ui/step-progress"
import { Button } from "@/components/ui/button"
import { Home } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"

export default function Var() {
  const router = useRouter()
  const [stepTitle, setStepTitle] = useState("Sélection des variables à expliquer")
  const [currentStep, setCurrentStep] = useState(2)

  // Fonction pour mettre à jour l'étape depuis le composant enfant
  const handleStepChange = (step: number, title: string) => {
    setCurrentStep(step)
    setStepTitle(title)

  }

  useEffect(() => {
    // Vérifier s'il y a une étape spécifique demandée depuis les pages de résultats/arbre
    const requestedStep = localStorage.getItem('currentStep')
    const requestedTitle = localStorage.getItem('stepTitle')
    
    if (requestedStep && requestedTitle) {
      // Utiliser l'étape demandée
      setCurrentStep(parseInt(requestedStep))
      setStepTitle(requestedTitle)
      // Nettoyer les indicateurs de retour
      localStorage.removeItem('currentStep')
      localStorage.removeItem('stepTitle')

    } else {
      // Déterminer l'étape actuelle basée sur le localStorage
      const remainingData = localStorage.getItem('remainingData')
      const hasExplanatoryVars = localStorage.getItem('explanatoryVariables')
      const hasToExplainVars = localStorage.getItem('toExplainVariables')
      

      
      // Quand on revient de la page des résultats, on revient TOUJOURS à l'étape 2
      // On nettoie le localStorage pour repartir de zéro
      if (hasToExplainVars || hasExplanatoryVars || remainingData) {
        // Nettoyer le localStorage pour revenir à l'étape 2
        localStorage.removeItem('remainingData')
        localStorage.removeItem('excelAnalysisData')
        localStorage.removeItem('toExplainVariables')
        localStorage.removeItem('explanatoryVariables')
        setStepTitle("Sélection des variables à expliquer")
        setCurrentStep(2)

      } else {
        setStepTitle("Sélection des variables à expliquer")
        setCurrentStep(2)

      }
    }
  }, [])

  const clearStoredData = () => {
    localStorage.removeItem('excelAnalysisData')
    router.push('/')
  }

  // Fonction pour obtenir les couleurs selon l'étape
  const getStepColors = (step: number) => {
    switch (step) {
      case 2: // Variables à expliquer
        return {
          background: "from-green-100 to-emerald-100",
          title: "bg-green-500",
          button: "border-green-300 text-green-700 hover:bg-green-50"
        }
      case 3: // Variables explicatives
        return {
          background: "from-blue-100 to-emerald-100",
          title: "bg-blue-500",
          button: "border-blue-300 text-blue-700 hover:bg-blue-50"
        }
      case 4: // Définition de l'échantillon
        return {
          background: "from-yellow-100 to-orange-100",
          title: "bg-orange-500",
          button: "border-yellow-300 text-yellow-700 hover:bg-yellow-50"
        }
      default:
        return {
          background: "from-green-100 to-emerald-100",
          title: "bg-green-500",
          button: "border-green-300 text-green-700 hover:bg-green-50"
        }
    }
  }

  const colors = getStepColors(currentStep)

  return (
    <div className={`bg-gradient-to-br ${colors.background} min-h-screen p-8`}>
      <StepProgress currentStep={currentStep} />
      <div className="max-w-6xl mx-auto">
        {/* Navigation */}
        <div className="flex gap-2 mb-6 ml-20">
          <Button variant="outline" onClick={clearStoredData} className={colors.button}>
            <Home className="h-4 w-4 mr-2" />
            Accueil
          </Button>
        </div>

        <h1 className={`text-4xl font-bold text-center mb-8 ${colors.title} bg-clip-text text-transparent`}>
          Etape {currentStep} : {stepTitle}
        </h1>
        
        <ExcelPreview onStepChange={handleStepChange} />
      </div>
    </div>
  )
}