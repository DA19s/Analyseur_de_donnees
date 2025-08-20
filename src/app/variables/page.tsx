"use client"

import ExcelPreview from "@/components/ui/excel-preview"
import StepProgress from "@/components/ui/step-progress"
import { Button } from "@/components/ui/button"
import { Home } from "lucide-react"
import { useRouter } from "next/navigation"

export default function Var() {
  const router = useRouter()

  const clearStoredData = () => {
    localStorage.removeItem('excelAnalysisData')
    router.push('/')
  }

  return (
    <div className="bg-gradient-to-br from-blue-100 to-emerald-100 min-h-screen p-8">
      <StepProgress />
      <div className="max-w-6xl mx-auto">
        {/* Navigation */}
        <div className="flex gap-2 mb-6 ml-20">
          <Button variant="outline" onClick={clearStoredData}>
            <Home className="h-4 w-4 mr-2" />
            Accueil
          </Button>
        </div>

        <h1 className="text-4xl font-bold text-center mb-8 bg-gradient-to-r from-blue-500 to-emerald-500 bg-clip-text text-transparent">
          Analyse des Variables
        </h1>
        
        <ExcelPreview />
      </div>
    </div>
  )
}