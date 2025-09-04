"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Home, TreePine, Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import StepProgress from "@/components/ui/step-progress"
import DecisionTree from "@/components/ui/decision-tree"
import QuickEditModal from "@/components/ui/quick-edit-modal"

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

export default function DecisionTreePage() {
  const router = useRouter()
  
  // États pour stocker les données
  const [decisionTreeData, setDecisionTreeData] = useState<DecisionTreeData | null>(null)
  const [buildingTree, setBuildingTree] = useState(false)
  const [treeError, setTreeError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [minPopulationThreshold, setMinPopulationThreshold] = useState<number>(0)
  const [minPopulationThresholdInput, setMinPopulationThresholdInput] = useState<string>('')
  const [thresholdMode, setThresholdMode] = useState<'count' | 'percent'>('count')
  const [showEditModal, setShowEditModal] = useState<'toExplain' | 'explanatory' | 'sample' | null>(null)
  const [treatmentMode, setTreatmentMode] = useState<'independent' | 'together'>('independent')
  const [originalTreatmentMode, setOriginalTreatmentMode] = useState<'independent' | 'together'>('independent')
  const [selectedColumnValues, setSelectedColumnValues] = useState<{ [columnName: string]: any[] }>({})

  useEffect(() => {
    // Récupérer les données depuis le localStorage
    const storedData = localStorage.getItem('excelAnalysisData')
    
    if (storedData) {
      try {
        const data = JSON.parse(storedData)

        
        // Si l'arbre est déjà construit, l'afficher
        if (data.decisionTreeData) {
          setDecisionTreeData(data.decisionTreeData)
        }
        
        // Récupérer le mode de traitement depuis localStorage
        const storedTreatmentMode = localStorage.getItem('treatmentMode') as 'independent' | 'together' | null
        if (storedTreatmentMode) {
          setTreatmentMode(storedTreatmentMode)
          setOriginalTreatmentMode(storedTreatmentMode)
        }
        
        // Récupérer les valeurs sélectionnées des colonnes
        const columnValues = data.selectedColumnValues || data.columnValues || data.selectedValues || {}
        setSelectedColumnValues(columnValues)
        
        setLoading(false)
      } catch (error) {

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

  const buildDecisionTree = async () => {
    // Récupérer les données nécessaires
    const storedData = localStorage.getItem('excelAnalysisData')
    if (!storedData) return

    const data = JSON.parse(storedData)
    const { analysisResult, filename, selectedColumnValues } = data

    if (!analysisResult || !filename) return

    setBuildingTree(true)
    setTreeError(null)

    try {
      // Préparer les données pour l'API
      const formData = new FormData()
      formData.append("filename", filename)
      formData.append("variables_explicatives", analysisResult.variables_explicatives.join(','))
      formData.append("variable_a_expliquer", analysisResult.variables_a_expliquer.join(','))
      formData.append("min_population_threshold", minPopulationThreshold.toString())
      
      // Récupérer le mode de traitement depuis localStorage
      const treatmentMode = localStorage.getItem('treatmentMode') || 'independent'
      formData.append("treatment_mode", treatmentMode)
      
      // Récupérer les modalités des variables restantes depuis le localStorage
      const storedData = localStorage.getItem('excelAnalysisData')
      let selectedRemainingData = {}
      if (storedData) {
        const parsedData = JSON.parse(storedData)
        selectedRemainingData = parsedData.selectedRemainingData || {}
      }
      
      // Inclure les données sélectionnées des variables restantes ET des variables à expliquer
      const allSelectedData = {
        ...selectedRemainingData,  // ✅ Modalités des variables restantes
        ...selectedColumnValues    // ✅ Valeurs des variables à expliquer
      }
      
      formData.append("selected_data", JSON.stringify(allSelectedData))

      const response = await fetch("http://localhost:8000/excel/build-decision-tree", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Erreur HTTP: ${response.status} - ${errorText}`)
      }

      const result = await response.json()

      if (result.error) {
        throw new Error(result.error)
      }

      setDecisionTreeData(result)
      
      // Mettre à jour le mode original après construction
      setOriginalTreatmentMode(treatmentMode as 'independent' | 'together')
      
      // Sauvegarder dans le localStorage
      const currentData = localStorage.getItem('excelAnalysisData')
      if (currentData) {
        const parsedData = JSON.parse(currentData)
        parsedData.decisionTreeData = result
        localStorage.setItem('excelAnalysisData', JSON.stringify(parsedData))
      }

    } catch (err) {

      setTreeError(err instanceof Error ? err.message : "Erreur lors de la construction de l'arbre")
    } finally {
      setBuildingTree(false)
    }
  }

  if (loading) {
    return (
      <div className="text-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p>Chargement de la page...</p>
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-br from-green-100 to-emerald-100 min-h-screen p-8">
      <StepProgress currentStep={6} />
      <div className="max-w-7xl mx-auto">
        {/* Navigation */}
        <div className="flex gap-2 mb-6 ml-20 flex-wrap">
          <Button variant="outline" onClick={() => router.push('/results')} className="border-green-300 text-green-700 hover:bg-green-50">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour à l'étape précédente
          </Button>
          <Button variant="outline" onClick={() => {
            clearStoredData()
            router.push('/')
          }} className="border-green-300 text-green-700 hover:bg-green-50">
            <Home className="h-4 w-4 mr-2" />
            Retour à l'accueil
          </Button>
          
          {/* Boutons de modification rapide */}
          <div className="flex gap-2 ml-auto">
            <Button 
              variant="outline" 
              onClick={() => setShowEditModal('toExplain')} 
              className="border-blue-300 text-blue-700 hover:bg-blue-50"
            >
              ✏️ Modifier variables à expliquer
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setShowEditModal('explanatory')} 
              className="border-green-300 text-green-700 hover:bg-green-50"
            >
              ✏️ Modifier variables explicatives
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setShowEditModal('sample')} 
              className="border-yellow-300 text-yellow-700 hover:bg-yellow-50"
            >
              ✏️ Modifier échantillon
            </Button>
          </div>

        </div>

        <h1 className="text-4xl font-bold text-center mb-8 bg-green-500 bg-clip-text text-transparent">
          Etape 6 : Arbre de Décision
        </h1>

        {/* Section Mode de Traitement */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6 ml-6">
          <h2 className="text-xl font-semibold text-green-800 mb-4">
            🔄 Mode de traitement des variables à expliquer
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Choisissez comment traiter vos variables à expliquer :
          </p>
          
          <div className="space-y-3">
            <label className="flex items-center space-x-3 p-3 bg-green-50 border border-green-200 rounded-lg cursor-pointer hover:bg-green-100 transition-colors">
              <input
                type="radio"
                name="treatmentMode"
                value="independent"
                checked={treatmentMode === 'independent'}
                onChange={(e) => {
                  setTreatmentMode(e.target.value as 'independent' | 'together')
                  localStorage.setItem('treatmentMode', e.target.value)
                }}
                className="h-4 w-4 text-green-600 focus:ring-green-500"
              />
              <div className="flex-1">
                <div className="font-medium text-gray-900">🔀 Traitement indépendant</div>
                <div className="text-sm text-gray-600">
                  Chaque variable est analysée séparément avec son propre arbre de décision
                </div>
              </div>
            </label>
            
            <label className="flex items-center space-x-3 p-3 bg-green-50 border border-green-200 rounded-lg cursor-pointer hover:bg-green-100 transition-colors">
              <input
                type="radio"
                name="treatmentMode"
                value="together"
                checked={treatmentMode === 'together'}
                onChange={(e) => {
                  setTreatmentMode(e.target.value as 'independent' | 'together')
                  localStorage.setItem('treatmentMode', e.target.value)
                }}
                className="h-4 w-4 text-green-600 focus:ring-green-500"
              />
              <div className="flex-1">
                <div className="font-medium text-gray-900">🔗 Traitement ensemble</div>
                <div className="text-sm text-gray-600">
                  Toutes les variables sont analysées ensemble (lignes ayant l'une OU l'autre valeur)
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Section Arbre de Décision */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6 ml-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <TreePine className="h-8 w-8 text-blue-600 mr-3" />
              <h2 className="text-2xl text-blue-800">🌳 Construction de l'Arbre de Décision</h2>
            </div>
            <div className="flex items-center gap-4">
              {/* Configuration du seuil d'effectif */}
              <div className="flex items-center gap-2">
                <label htmlFor="minPopulationThreshold" className="text-sm font-medium text-gray-700">
                  Effectif minimum par branche:
                </label>
                <span className="text-xs text-gray-500 ml-1">
                  (0 = arbre complet)
                </span>
                {/* Sélecteur de mode: nombre ou pourcentage */}
                <select
                  value={thresholdMode}
                  onChange={(e) => {
                    const mode = (e.target.value as 'count' | 'percent')
                    setThresholdMode(mode)
                    // Recalcule le seuil à partir de la saisie existante
                    const basePop = (decisionTreeData?.filtered_sample_size || decisionTreeData?.original_sample_size || 0)
                    if (mode === 'percent') {
                      const pct = parseFloat(minPopulationThresholdInput || '0')
                      const countFromPct = Math.max(0, Math.floor(basePop * (isNaN(pct) ? 0 : pct) / 100))
                      setMinPopulationThreshold(countFromPct)
                    } else {
                      const count = parseInt(minPopulationThresholdInput || '0') || 0
                      setMinPopulationThreshold(Math.max(0, count))
                    }
                  }}
                  className="px-2 py-1 border border-gray-300 rounded text-sm bg-white"
                  disabled={buildingTree}
                >
                  <option value="count">Nombre</option>
                  <option value="percent">% population</option>
                </select>
                <input
                  id="minPopulationThreshold"
                  type="number"
                  min={0}
                  max={thresholdMode === 'percent' ? 100 : undefined}
                  step={thresholdMode === 'percent' ? 0.1 : 1}
                  value={minPopulationThresholdInput}
                  onChange={(e) => {
                    const inputValue = e.target.value
                    setMinPopulationThresholdInput(inputValue)
                    const basePop = (decisionTreeData?.filtered_sample_size || decisionTreeData?.original_sample_size || 0)
                    if (thresholdMode === 'percent') {
                      const pct = inputValue === '' ? 0 : parseFloat(inputValue)
                      const countFromPct = Math.max(0, Math.floor(basePop * ((isNaN(pct) ? 0 : pct) / 100)))
                      setMinPopulationThreshold(countFromPct)
                    } else {
                      const numericValue = inputValue === '' ? 0 : parseInt(inputValue) || 0
                      setMinPopulationThreshold(Math.max(0, numericValue))
                    }
                  }}
                  className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                  disabled={buildingTree}
                  placeholder={thresholdMode === 'percent' ? '0.0' : '0'}
                />
                {/* Indication de conversion quand en % */}
                {thresholdMode === 'percent' && (
                  <span className="text-xs text-gray-500 ml-1">
                    ≈ {(() => {
                      const basePop = (decisionTreeData?.filtered_sample_size || decisionTreeData?.original_sample_size || 0)
                      const pct = parseFloat(minPopulationThresholdInput || '0')
                      const countFromPct = Math.max(0, Math.floor(basePop * (isNaN(pct) ? 0 : pct) / 100))
                      return countFromPct
                    })()} lignes
                  </span>
                )}
              </div>
              
              {/* Bouton de construction/reconstruction */}
              <Button 
                onClick={buildDecisionTree}
                disabled={buildingTree}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {buildingTree ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Construction en cours...
                  </>
                ) : decisionTreeData ? (
                  <>
                    <TreePine className="h-4 w-4 mr-2" />
                    Reconstruire l'arbre
                  </>
                ) : (
                  <>
                    <TreePine className="h-4 w-4 mr-2" />
                    Construire l'arbre
                  </>
                )}
              </Button>
            </div>
          </div>
          
          <p className="text-sm text-gray-600 mb-4">
            Analyse des variables explicatives pour expliquer chaque valeur des variables à expliquer.
            <span className="block mt-1 text-blue-600">
              💡 <strong>Modifiez le seuil d'effectif ci-dessus et cliquez sur "Reconstruire l'arbre" pour ajuster la profondeur de l'arbre.</strong>
            </span>
            {decisionTreeData && treatmentMode !== originalTreatmentMode && (
              <span className="block mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-yellow-800">
                ⚠️ <strong>Le mode de traitement a été modifié.</strong> Cliquez sur "Reconstruire l'arbre" pour appliquer le nouveau mode.
              </span>
            )}
          </p>



          {/* Indicateur de progression */}
          {buildingTree && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-lg font-medium text-blue-800 mb-2">
                🌳 Construction de l'arbre de décision en cours...
              </p>
              <p className="text-sm text-gray-600">
                Cette opération peut prendre quelques minutes selon la taille de vos données
              </p>
            </div>
          )}

          {/* Erreur */}
          {treeError && (
            <div className="bg-red-100 border border-red-300 text-red-800 p-4 rounded-lg">
              <div className="flex items-center">
                <span className="text-red-600 mr-2">❌</span>
                <span><strong>Erreur:</strong> {treeError}</span>
              </div>
              <Button 
                onClick={buildDecisionTree}
                className="mt-3 bg-red-600 hover:bg-red-700 text-white"
              >
                🔄 Réessayer
              </Button>
            </div>
          )}

          {/* Arbre de décision construit */}
          {decisionTreeData && !buildingTree && (
            <DecisionTree 
              decisionTrees={decisionTreeData.decision_trees}
              filename={decisionTreeData.filename}
              pdfBase64={decisionTreeData.pdf_base64}
              pdfGenerated={decisionTreeData.pdf_generated}
              minPopulationThreshold={minPopulationThreshold}
              variablesToExplain={decisionTreeData.variables_a_expliquer}
              selectedColumnValues={selectedColumnValues}
              basePopulation={decisionTreeData.filtered_sample_size || decisionTreeData.original_sample_size}
              treatmentMode={treatmentMode}
            />
          )}

          {/* Message si aucun arbre */}
          {!decisionTreeData && !buildingTree && (
            <div className="text-center py-8 text-gray-500">
              <TreePine className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-lg mb-2">Aucun arbre de décision construit</p>
              <p className="text-sm">Cliquez sur "Construire l'arbre" pour commencer l'analyse</p>
            </div>
          )}
        </div>
      </div>
      
      {/* Modal de modification rapide */}
      {showEditModal && (
        <QuickEditModal
          editType={showEditModal}
          returnToPage="/decision-tree"
          onClose={() => setShowEditModal(null)}
        />
      )}
    </div>
  )
}

