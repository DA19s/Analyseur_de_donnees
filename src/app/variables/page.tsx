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
    console.log(`🔄 Étape mise à jour: ${step} - ${title}`)
  }

  useEffect(() => {
    // Déterminer l'étape actuelle basée sur le localStorage
    const remainingData = localStorage.getItem('remainingData')
    const hasExplanatoryVars = localStorage.getItem('explanatoryVariables')
    const hasToExplainVars = localStorage.getItem('toExplainVariables')
    
    console.log("🔍 État du localStorage:", {
      remainingData: !!remainingData,
      hasExplanatoryVars: !!hasExplanatoryVars,
      hasToExplainVars: !!hasToExplainVars
    })
    
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
      console.log("✅ Retour à l'étape 2 : Sélection des variables à expliquer")
    } else {
      setStepTitle("Sélection des variables à expliquer")
      setCurrentStep(2)
      console.log("✅ Étape 2 : Sélection des variables à expliquer")
    }
  }, [])

  const clearStoredData = () => {
    localStorage.removeItem('excelAnalysisData')
    router.push('/')
  }

  return (
    <div className="bg-gradient-to-br from-blue-100 to-emerald-100 min-h-screen p-8">
      <StepProgress currentStep={currentStep} />
      <div className="max-w-6xl mx-auto">
        {/* Navigation */}
        <div className="flex gap-2 mb-6 ml-20">
          <Button variant="outline" onClick={clearStoredData}>
            <Home className="h-4 w-4 mr-2" />
            Accueil
          </Button>
        </div>

        <h1 className="text-4xl font-bold text-center mb-8 bg-blue-500 bg-clip-text text-transparent">
          Etape {currentStep} : {stepTitle}
        </h1>
        
        <ExcelPreview onStepChange={handleStepChange} />
      </div>
    </div>
  )
}