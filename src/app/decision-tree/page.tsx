"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Home, TreePine, Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import StepProgress from "@/components/ui/step-progress"
import DecisionTree from "@/components/ui/decision-tree"

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

  useEffect(() => {
    // Récupérer les données depuis le localStorage
    const storedData = localStorage.getItem('excelAnalysisData')
    
    if (storedData) {
      try {
        const data = JSON.parse(storedData)
        console.log("📊 Données récupérées du localStorage:", data)
        
        // Si l'arbre est déjà construit, l'afficher
        if (data.decisionTreeData) {
          setDecisionTreeData(data.decisionTreeData)
        }
        
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

  const buildDecisionTree = async () => {
    // Récupérer les données nécessaires
    const storedData = localStorage.getItem('excelAnalysisData')
    if (!storedData) return

    const data = JSON.parse(storedData)
    const { analysisResult, previewData, selectedColumnValues } = data

    if (!analysisResult || !previewData) return

    setBuildingTree(true)
    setTreeError(null)

    try {
      // Préparer les données pour l'API
      const formData = new FormData()
      formData.append("filename", previewData.filename)
      formData.append("variables_explicatives", analysisResult.variables_explicatives.join(','))
      formData.append("variable_a_expliquer", analysisResult.variables_a_expliquer.join(','))
      
      // Inclure les données sélectionnées des variables restantes ET des variables à expliquer
      const allSelectedData = {
        ...analysisResult.selected_data,
        ...selectedColumnValues
      }
      formData.append("selected_data", JSON.stringify(allSelectedData))

      console.log("🌳 Construction de l'arbre de décision...")
      console.log("📤 Données envoyées:", {
        filename: previewData.filename,
        variables_explicatives: analysisResult.variables_explicatives,
        variable_a_expliquer: analysisResult.variables_a_expliquer,
        selected_data: allSelectedData
      })

      const response = await fetch("http://localhost:8000/excel/build-decision-tree", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Erreur HTTP: ${response.status} - ${errorText}`)
      }

      const result = await response.json()
      console.log("✅ Arbre de décision construit:", result)

      if (result.error) {
        throw new Error(result.error)
      }

      setDecisionTreeData(result)
      
      // Sauvegarder dans le localStorage
      const currentData = localStorage.getItem('excelAnalysisData')
      if (currentData) {
        const parsedData = JSON.parse(currentData)
        parsedData.decisionTreeData = result
        localStorage.setItem('excelAnalysisData', JSON.stringify(parsedData))
      }

    } catch (err) {
      console.error("❌ Erreur lors de la construction de l'arbre:", err)
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
    <div className="bg-gradient-to-br from-blue-100 to-emerald-100 min-h-screen p-8">
      <StepProgress currentStep={6} />
      <div className="max-w-7xl mx-auto">
        {/* Navigation */}
        <div className="flex gap-2 mb-6 ml-20">
          <Button variant="outline" onClick={() => router.push('/results')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour à l'étape précédente
          </Button>
          <Button variant="outline" onClick={() => {
            clearStoredData()
            router.push('/')
          }}>
            <Home className="h-4 w-4 mr-2" />
            Retour à l'accueil
          </Button>
        </div>

        <h1 className="text-4xl font-bold text-center mb-8 bg-blue-500 bg-clip-text text-transparent">
          Etape 6 : Arbre de Décision
        </h1>

        {/* Section Arbre de Décision */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <TreePine className="h-8 w-8 text-blue-600 mr-3" />
              <h2 className="text-2xl text-blue-800">🌳 Construction de l'Arbre de Décision</h2>
            </div>
            {!decisionTreeData && (
              <Button 
                onClick={buildDecisionTree}
                disabled={buildingTree}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {buildingTree ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Construction en cours...
                  </>
                ) : (
                  <>
                    <TreePine className="h-4 w-4 mr-2" />
                    Construire l'arbre
                  </>
                )}
              </Button>
            )}
          </div>
          
          <p className="text-sm text-gray-600 mb-4">
            Analyse des variables explicatives pour expliquer chaque valeur des variables à expliquer
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
    </div>
  )
}

