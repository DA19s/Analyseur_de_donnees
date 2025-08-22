"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Home, ChevronDown, ChevronRight } from "lucide-react"
import { useEffect, useState } from "react"
import StepProgress from "@/components/ui/step-progress"

// Composant accordéon pour afficher les variables de manière dépliable
function VariableAccordion({ 
  columnName, 
  values, 
  color, 
  icon 
}: { 
  columnName: string
  values: any[]
  color: 'blue' | 'purple' | 'green'
  icon: string
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  
  const colorClasses = {
    blue: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-800',
      hover: 'hover:bg-blue-100',
      iconBg: 'bg-blue-100',
      iconText: 'text-blue-600'
    },
    green: {
      bg: 'bg-green-50',
      border: 'border-green-200',
      text: 'text-green-800',
      hover: 'hover:bg-green-100',
      iconBg: 'bg-green-100',
      iconText: 'text-green-600'
    },
    purple: {
      bg: 'bg-purple-50',
      border: 'border-purple-200',
      text: 'text-purple-800',
      hover: 'hover:bg-purple-100',
      iconBg: 'bg-purple-100',
      iconText: 'text-purple-600'
    }
  }
  
  const classes = colorClasses[color]
  const uniqueValues = Array.from(new Set(values))

  return (
    <div className={`border rounded-lg overflow-hidden ${classes.border}`}>
      {/* En-tête cliquable */}
      <div 
        className={`flex items-center justify-between p-4 cursor-pointer transition-colors ${classes.bg} ${classes.hover}`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${classes.iconBg}`}>
            <span className={`text-sm ${classes.iconText}`}>{icon}</span>
          </div>
          <div>
            <h4 className={`font-medium ${classes.text}`}>{columnName}</h4>
            <p className="text-sm text-gray-600">
              {uniqueValues.length} élément(s) unique(s) sélectionné(s)
            </p>
          </div>
        </div>
        
        {/* Icône d'expansion */}
        {isExpanded ? (
          <ChevronDown className="h-5 w-5 text-gray-500" />
        ) : (
          <ChevronRight className="h-5 w-5 text-gray-500" />
        )}
      </div>
      
      {/* Contenu dépliable */}
      {isExpanded && (
        <div className="p-4 bg-white border-t border-gray-200">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {uniqueValues.map((value, index) => (
              <div key={index} className={`text-sm p-2 rounded border ${classes.bg}`}>
                {String(value)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

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
  const [selectedColumnValues, setSelectedColumnValues] = useState<{ [columnName: string]: any[] }>({})
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
        setSelectedColumnValues(data.selectedColumnValues || {})
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

        <h1 className="text-4xl font-bold text-center mb-8 bg-blue-500 bg-clip-text text-transparent">
          Etape 3 : Résultat de la sélection
        </h1>

        {/* Variables à expliquer et leurs éléments sélectionnés (dépliables) */}
        {selectedColumnValues && Object.keys(selectedColumnValues).length > 0 && (
          <Card className="mb-6 shadow-lg">
            <CardHeader>
              <CardTitle>🎯 Variables à expliquer et leurs éléments sélectionnés</CardTitle>
              <p className="text-sm text-gray-600">
                Variables cibles avec leurs éléments spécifiques choisis (cliquez pour déplier)
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(selectedColumnValues).map(([columnName, values]) => (
                  <VariableAccordion
                    key={columnName}
                    columnName={columnName}
                    values={values}
                    color="green"
                    icon="🎯"
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Variables explicatives */}
        {Object.keys(columnSelection || {}).filter(col => columnSelection[col].isExplanatory).length > 0 && (
          <Card className="mb-6 shadow-lg">
            <CardHeader>
              <CardTitle>🔍 Variables explicatives</CardTitle>
              <p className="text-sm text-gray-600">
                Variables utilisées pour expliquer ou prédire les variables cibles
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.keys(columnSelection || {}).filter(col => columnSelection[col].isExplanatory).map(col => (
                  <div key={col} className="flex items-center p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                      <span className="text-blue-600 text-sm">🔍</span>
                    </div>
                    <div>
                      <h4 className="font-medium text-blue-800">{col}</h4>
                      <p className="text-sm text-blue-600">Variable explicative</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Données des colonnes restantes sélectionnées */}
        {analysisResult.selected_data && Object.keys(analysisResult.selected_data).length > 0 && (
          <Card className="mb-6 shadow-lg">
            <CardHeader>
              <CardTitle>🔄 Données des colonnes restantes sélectionnées</CardTitle>
              <p className="text-sm text-gray-600">
                Données des colonnes restantes (ni explicatives, ni à expliquer) choisies par l'utilisateur
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(analysisResult.selected_data)
                  .filter(([columnName]) => {
                    // Filtrer pour ne montrer que les colonnes qui ne sont ni explicatives ni à expliquer
                    const isExplanatory = analysisResult.variables_explicatives.includes(columnName)
                    const isToExplain = analysisResult.variables_a_expliquer.includes(columnName)
                    return !isExplanatory && !isToExplain
                  })
                  .map(([columnName, values]) => (
                    <VariableAccordion
                      key={columnName}
                      columnName={columnName}
                      values={values}
                      color="purple"
                      icon="🔄"
                    />
                  ))}
              </div>
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  )
}