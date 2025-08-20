"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Home } from "lucide-react"
import { useEffect, useState } from "react"
import StepProgress from "@/components/ui/step-progress"

interface AnalysisResult {
  filename: string
  variables_explicatives: string[]
  variables_a_expliquer: string[]
  selected_data: { [columnName: string]: any[] }
  results: Array<{
    variable_a_expliquer: string
    variables_explicatives: string[]
    X_preview: Record<string, any>[]
    y_preview: any[]
    y_stats: {
      count: number
      mean: number | null
      std: number | null
      min: number | null
      max: number | null
    }
  }>
  summary: {
    total_variables_explicatives: number
    total_variables_a_expliquer: number
    total_rows: number
    total_selected_columns: number
  }
}

interface ColumnSelection {
  [columnName: string]: {
    isExplanatory: boolean
    isToExplain: boolean
  }
}

interface PreviewData {
  filename: string
  rows: number
  columns: string[]
  preview: Record<string, any>[]
}

export default function Results() {
  const router = useRouter()
  
  // États pour stocker les données
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [columnSelection, setColumnSelection] = useState<ColumnSelection>({})
  const [previewData, setPreviewData] = useState<PreviewData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Récupérer les données depuis le localStorage
    const storedData = localStorage.getItem('excelAnalysisData')
    
    if (storedData) {
      try {
        const data = JSON.parse(storedData)
        console.log("📊 Données récupérées du localStorage:", data)
        setAnalysisResult(data.analysisResult)
        setColumnSelection(data.columnSelection)
        setPreviewData(data.previewData)
        setLoading(false)
      } catch (error) {
        console.error('Erreur lors du parsing des données:', error)
        setLoading(false)
      }
    } else {
      // Si pas de données, rediriger vers la page précédente
      router.push('/variables')
    }
  }, [router])

  const clearStoredData = () => {
    localStorage.removeItem('excelAnalysisData')
  }

  if (loading) {
    return (
      <div className="text-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p>Chargement des résultats...</p>
      </div>
    )
  }

  if (!analysisResult) {
    return (
      <div className="text-center p-8">
        <h3 className="text-lg font-semibold mb-2">Aucun résultat disponible</h3>
        <p>Veuillez retourner à la page précédente</p>
        <Button onClick={() => router.push('/variables')} className="mt-4">
          Retour aux variables
        </Button>
      </div>
    )
  }

  // Vérification de sécurité pour les résultats
  if (!analysisResult.results || analysisResult.results.length === 0) {
    return (
      <div className="text-center p-8">
        <h3 className="text-lg font-semibold mb-2">Aucun résultat d'analyse disponible</h3>
        <p>Les données d'analyse sont incomplètes ou corrompues</p>
        <div className="mt-4 space-y-2">
          <Button onClick={() => router.push('/variables')} className="mr-2">
            Retour aux variables
          </Button>
          <Button onClick={() => {
            clearStoredData()
            router.push('/')
          }} variant="outline">
            Recommencer
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-br from-blue-100 to-emerald-100 min-h-screen p-8">
      <StepProgress />
      <div className="max-w-6xl mx-auto">
        {/* Navigation */}
        <div className="flex gap-2 mb-6">
          <Button variant="outline" onClick={() => router.push('/variables')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour aux variables
          </Button>
          <Button variant="outline" onClick={() => {
            clearStoredData()
            router.push('/')
          }}>
            <Home className="h-4 w-4 mr-2" />
            Accueil
          </Button>
        </div>

        <h1 className="text-4xl font-bold text-center mb-8 bg-gradient-to-r from-blue-500 to-emerald-500 bg-clip-text text-transparent">
          Variables à analyser
        </h1>

        {/* Résumé de la sélection */}
        <Card className="mb-6 shadow-lg">
          <CardHeader>
            <CardTitle>📋 Variables sélectionnées</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold text-green-600 mb-2">Variables explicatives :</h4>
                <ul className="space-y-1">
                  {Object.keys(columnSelection || {}).filter(col => columnSelection[col].isExplanatory).map(col => (
                    <li key={col} className="text-sm bg-green-50 p-2 rounded">• {col}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-blue-600 mb-2">Variables à expliquer :</h4>
                <ul className="space-y-1">
                  {Object.keys(columnSelection || {}).filter(col => columnSelection[col].isToExplain).map(col => (
                    <li key={col} className="text-sm bg-blue-50 p-2 rounded">• {col}</li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Données sélectionnées par l'utilisateur */}
        {analysisResult.selected_data && Object.keys(analysisResult.selected_data).length > 0 && (
          <Card className="mb-6 shadow-lg">
            <CardHeader>
              <CardTitle>🎯 Données sélectionnées pour l'analyse</CardTitle>
              <p className="text-sm text-gray-600">
                Données des colonnes restantes choisies par l'utilisateur
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(analysisResult.selected_data).map(([columnName, values]) => (
                  <div key={columnName} className="border rounded-lg p-4">
                    <h4 className="font-semibold text-purple-600 mb-2">📊 {columnName}</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                      {Array.from(new Set(values)).map((value, index) => (
                        <div key={index} className="text-sm bg-purple-50 p-2 rounded border">
                          {String(value)}
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      {Array.from(new Set(values)).length} valeur(s) unique(s) sélectionnée(s)
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  )
}