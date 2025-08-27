"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Home, TreePine, Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import StepProgress from "@/components/ui/step-progress"
import DecisionTree from "@/components/ui/decision-tree"

// Composant pour afficher les variables avec leurs modalités directement visibles
function VariableDisplay({ 
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
  const colorClasses = {
    blue: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-800',
      iconBg: 'bg-blue-100',
      iconText: 'text-blue-600'
    },
    green: {
      bg: 'bg-green-50',
      border: 'border-green-200',
      text: 'text-green-800',
      iconBg: 'bg-green-100',
      iconText: 'text-green-600'
    },
    purple: {
      bg: 'bg-purple-50',
      border: 'border-purple-200',
      text: 'text-purple-800',
      iconBg: 'bg-purple-100',
      iconText: 'text-purple-600'
    }
  }
  
  const classes = colorClasses[color]
  const uniqueValues = Array.from(new Set(values))

  return (
    <div className={`border rounded-lg p-4 ${classes.border} ${classes.bg}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 flex-shrink-0 ${classes.iconBg}`}>
            <span className={`text-sm ${classes.iconText}`}>{icon}</span>
          </div>
          <div>
            <h4 className={`font-medium ${classes.text}`}>{columnName}</h4>
            <p className="text-sm text-gray-600">
              {uniqueValues.length} élément(s) unique(s) sélectionné(s)
            </p>
          </div>
        </div>
        
        {/* Modalités affichées à droite */}
        <div className="flex flex-wrap gap-2 ml-4">
          {uniqueValues.map((value, index) => (
            <div key={index} className={`text-xs px-2 py-1 rounded-full border ${classes.border} bg-white`}>
              {String(value)}
            </div>
          ))}
        </div>
      </div>
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

interface DecisionTreeData {
  filename: string
  variables_explicatives: string[]
  variables_a_expliquer: string[]
  filtered_sample_size: number
  original_sample_size: number
  decision_trees: { [variable: string]: { [value: string]: any } }
  pdf_base64?: string
  pdf_generated?: boolean
}

export default function Results() {
  const router = useRouter()
  
  // États pour stocker les données
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [columnSelection, setColumnSelection] = useState<ColumnSelection>({})
  const [previewData, setPreviewData] = useState<PreviewData | null>(null)
  const [selectedColumnValues, setSelectedColumnValues] = useState<{ [columnName: string]: any[] }>({})
  const [selectedRemainingData, setSelectedRemainingData] = useState<{ [columnName: string]: any[] }>({})
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
        
        // Créer un objet previewData minimal à partir des données stockées
        if (data.filename && data.rows && data.columns) {
          setPreviewData({
            filename: data.filename,
            rows: data.rows,
            columns: data.columns,
            preview: [] // On n'a plus les données de prévisualisation complètes
          })
        }
        
        setSelectedColumnValues(data.selectedColumnValues || {})
        setSelectedRemainingData(data.selectedRemainingData || {})
        
        // Log pour déboguer
        console.log("🔍 Données récupérées dans /results:", {
          selectedRemainingData: data.selectedRemainingData,
          selectedColumnValues: data.selectedColumnValues,
          analysisResult: data.analysisResult
        })
        
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
      <StepProgress currentStep={5} />
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
          Etape 5 : Vérification des variables
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
                  <VariableDisplay
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



        {/* Modalités de l'échantillon sélectionnées */}
        {selectedRemainingData && Object.keys(selectedRemainingData).length > 0 && (
          <Card className="mb-6 shadow-lg">
            <CardHeader>
              <CardTitle>📊 Modalités de l'échantillon sélectionnées</CardTitle>
              <p className="text-sm text-gray-600">
                Données spécifiques sélectionnées pour filtrer l'échantillon d'analyse
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(selectedRemainingData).map(([columnName, values]) => (
                  <VariableDisplay
                    key={columnName}
                    columnName={columnName}
                    values={values}
                    color="purple"
                    icon="📊"
                  />
                ))}
              </div>
              <div className="mt-4 p-3 bg-purple-50 rounded-lg border border-purple-200">
                <p className="text-sm text-purple-700">
                  <strong>ℹ️ Information :</strong> Ces modalités filtrent votre échantillon d'analyse. 
                  Plus la sélection est restrictive, moins l'arbre aura de variables explicatives disponibles.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Section Arbre de Décision */}
        <Card className="mb-6 shadow-lg border-2 border-green-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <TreePine className="h-8 w-8 text-green-600 mr-3" />
                <CardTitle className="text-2xl text-green-800">🌳 Arbre de Décision</CardTitle>
              </div>
              <Button 
                onClick={() => router.push('/decision-tree')}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <TreePine className="h-4 w-4 mr-2" />
                Construire l'arbre
              </Button>
            </div>
            <p className="text-sm text-gray-600">
              Cliquez pour accéder à la page de construction de l'arbre de décision
            </p>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <TreePine className="h-16 w-16 text-green-300 mx-auto mb-4" />
              <p className="text-lg text-green-700 mb-2">
                Prêt à construire votre arbre de décision ?
              </p>
              <p className="text-sm text-gray-600 mb-4">
                L'arbre analysera vos variables explicatives pour expliquer chaque valeur 
                de vos variables à expliquer, en utilisant uniquement les données sélectionnées.
              </p>
              <div className="p-3 bg-green-50 rounded-lg max-w-md mx-auto">
                <p className="text-sm text-green-700">
                  <strong>🎯 Analyse ciblée :</strong> Seules les valeurs sélectionnées seront analysées<br/>
                  <strong>🌿 Structure arborescente :</strong> Affichage clair avec branches gauche/droite<br/>
                  <strong>📊 Pourcentages détaillés :</strong> Statistiques précises sur chaque branche<br/>
                  <strong>📄 PDF téléchargeable :</strong> Rapport complet et structuré
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  )
}