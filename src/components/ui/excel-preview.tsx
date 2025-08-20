"use client"

import { useState, useEffect } from "react"
import { useFile } from "@/app/context/FileContext"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useRouter } from "next/navigation"
import { ChevronDown, ChevronRight, Home } from "lucide-react"

interface PreviewData {
  filename: string
  rows: number
  columns: string[]
  preview: Record<string, any>[]
}

interface ColumnSelection {
  [columnName: string]: {
    isExplanatory: boolean
    isToExplain: boolean
  }
}

interface RemainingData {
  filename: string
  variables_explicatives: string[]
  variables_a_expliquer: string[]
  remaining_columns: string[]
  remaining_data: { [columnName: string]: any[] }
  message: string
}

// Composant accordéon pour la sélection des données
function DataSelectionAccordion({ 
  columnName, 
  data, 
  selectedData, 
  onDataSelection 
}: { 
  columnName: string
  data: any[]
  selectedData: any[]
  onDataSelection: (columnName: string, value: any, checked: boolean) => void
}) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <Card className="border-2">
      <CardHeader 
        className="cursor-pointer hover:bg-gray-50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">📊 {columnName}</CardTitle>
            <p className="text-sm text-gray-600">
              {selectedData.length > 0 
                ? `${selectedData.length} valeur(s) sélectionnée(s)` 
                : "Cliquez pour sélectionner les valeurs"
              }
            </p>
          </div>
          {isExpanded ? (
            <ChevronDown className="h-5 w-5 text-gray-500" />
          ) : (
            <ChevronRight className="h-5 w-5 text-gray-500" />
          )}
        </div>
      </CardHeader>
      
      {isExpanded && (
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {data.map((value, index) => (
              <label key={index} className="flex items-center space-x-2 p-2 border rounded hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedData.includes(value)}
                  onChange={(e) => onDataSelection(columnName, value, e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm truncate" title={String(value)}>
                  {String(value)}
                </span>
              </label>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  )
}

export default function ExcelPreview() {
  const { file } = useFile()
  const router = useRouter()
  const [previewData, setPreviewData] = useState<PreviewData | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [columnSelection, setColumnSelection] = useState<ColumnSelection>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline'>('checking')
  const [remainingData, setRemainingData] = useState<RemainingData | null>(null)
  const [selectedRemainingData, setSelectedRemainingData] = useState<{ [columnName: string]: any[] }>({})
  const [step, setStep] = useState<'columns' | 'remaining-data'>('columns')
  const [columnSearchTerm, setColumnSearchTerm] = useState('')
  const [dataSearchTerm, setDataSearchTerm] = useState('')

  // Vérifier le statut du serveur au chargement
  useEffect(() => {
    checkServerStatus()
  }, [])

  // Charger les données quand le fichier change
  useEffect(() => {
    if (file && serverStatus === 'online') {
      handlePreview()
    }
  }, [file, serverStatus])

  // Filtrer les colonnes basé sur la recherche
  const filteredColumns = previewData?.columns.filter(column =>
    column.toLowerCase().includes(columnSearchTerm.toLowerCase())
  ) || []

  // Filtrer les colonnes restantes basé sur la recherche
  const filteredRemainingColumns = remainingData?.remaining_columns.filter(column =>
    column.toLowerCase().includes(dataSearchTerm.toLowerCase())
  ) || []

  const checkServerStatus = async () => {
    try {
      const response = await fetch("http://localhost:8000/health", {
        method: "GET",
        signal: AbortSignal.timeout(5000) // Timeout de 5 secondes
      })
      if (response.ok) {
        setServerStatus('online')
      } else {
        setServerStatus('offline')
      }
    } catch (err) {
      console.error("❌ Serveur inaccessible:", err)
      setServerStatus('offline')
    }
  }

  const handlePreview = async () => {
    if (!file) return

    setLoading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch("http://localhost:8000/excel/preview", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Erreur HTTP: ${response.status} - ${errorText}`)
      }

      const data: PreviewData = await response.json()
      console.log("✅ Données reçues de l'API:", data)
      setPreviewData(data)
      
      // Initialiser la sélection des colonnes
      const initialSelection: ColumnSelection = {}
      data.columns.forEach(column => {
        initialSelection[column] = {
          isExplanatory: false,
          isToExplain: false
        }
      })
      setColumnSelection(initialSelection)
    } catch (err) {
      console.error("❌ Erreur API:", err)
      setError(err instanceof Error ? err.message : "Une erreur est survenue")
    } finally {
      setLoading(false)
    }
  }

  const handleColumnSelection = (columnName: string, type: 'explanatory' | 'toExplain', checked: boolean) => {
    setColumnSelection(prev => {
      const newSelection = { ...prev }
      
      if (type === 'toExplain') {
        // ✅ MODIFICATION : Permettre plusieurs variables à expliquer
        newSelection[columnName].isToExplain = checked
        // Une variable ne peut pas être explicative ET à expliquer
        if (checked) {
          newSelection[columnName].isExplanatory = false
        }
      } else {
        // Si on coche "variable explicative", décocher "variable à expliquer"
        newSelection[columnName].isToExplain = false
      }
      
      newSelection[columnName][type === 'explanatory' ? 'isExplanatory' : 'isToExplain'] = checked
      return newSelection
    })
  }

  const handleDataSelection = (columnName: string, value: any, checked: boolean) => {
    setSelectedRemainingData(prev => {
      const newSelection = { ...prev }
      
      if (checked) {
        // Ajouter la valeur
        if (!newSelection[columnName]) {
          newSelection[columnName] = []
        }
        if (!newSelection[columnName].includes(value)) {
          newSelection[columnName] = [...newSelection[columnName], value]
        }
      } else {
        // Retirer la valeur
        if (newSelection[columnName]) {
          newSelection[columnName] = newSelection[columnName].filter(v => v !== value)
          if (newSelection[columnName].length === 0) {
            delete newSelection[columnName]
          }
        }
      }
      
      return newSelection
    })
  }

  const handleSubmit = async () => {
    if (!previewData) return

    // Vérifier qu'on a au moins une variable explicative et une variable à expliquer
    const explanatoryVariables = Object.keys(columnSelection).filter(
      col => columnSelection[col].isExplanatory
    )
    const variablesToExplain = Object.keys(columnSelection).filter(
      col => columnSelection[col].isToExplain
    )

    if (explanatoryVariables.length === 0) {
      alert("Veuillez sélectionner au moins une variable explicative")
      return
    }

    if (variablesToExplain.length === 0) {
      alert("Veuillez sélectionner au moins une variable à expliquer")
      return
    }

    setIsSubmitting(true)

    try {
      if (step === 'columns') {
        // Premier appel : obtenir les colonnes restantes
        const formData = new FormData()
        formData.append("filename", previewData.filename)
        formData.append("variables_explicatives", explanatoryVariables.join(','))
        formData.append("variable_a_expliquer", variablesToExplain.join(','))

        console.log("📤 Envoi des données:", {
          filename: previewData.filename,
          variables_explicatives: explanatoryVariables,
          variable_a_expliquer: variablesToExplain
        })

        const response = await fetch("http://localhost:8000/excel/select-columns", {
          method: "POST",
          body: formData,
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.error("❌ Erreur API:", response.status, errorText)
          throw new Error(`Erreur HTTP: ${response.status} - ${errorText}`)
        }

        const result = await response.json()
        console.log("✅ Résultat select-columns (colonnes restantes):", result)
        
        setRemainingData(result)
        setStep('remaining-data')
      } else if (step === 'remaining-data') {
        // Deuxième appel : envoyer les données sélectionnées
        const formData = new FormData()
        formData.append("filename", previewData.filename)
        formData.append("variables_explicatives", remainingData!.variables_explicatives.join(','))
        formData.append("variable_a_expliquer", remainingData!.variables_a_expliquer.join(','))
        formData.append("selected_data", JSON.stringify(selectedRemainingData))

        console.log("📤 Envoi final avec données sélectionnées:", {
          filename: previewData.filename,
          variables_explicatives: remainingData!.variables_explicatives,
          variable_a_expliquer: remainingData!.variables_a_expliquer,
          selected_data: selectedRemainingData
        })

        const response = await fetch("http://localhost:8000/excel/select-columns", {
          method: "POST",
          body: formData,
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.error("❌ Erreur API:", response.status, errorText)
          throw new Error(`Erreur HTTP: ${response.status} - ${errorText}`)
        }

        const result = await response.json()
        console.log("✅ Résultat final:", result)
        
        // Stocker les données dans le localStorage
        const dataToStore = {
          analysisResult: result,
          columnSelection: columnSelection,
          previewData: previewData,
          remainingData: remainingData,
          selectedRemainingData: selectedRemainingData
        }
        localStorage.setItem('excelAnalysisData', JSON.stringify(dataToStore))
        
        // Naviguer vers la page des résultats
        router.push('/results')
      }
    } catch (err) {
      console.error("❌ Erreur lors de la soumission:", err)
      setError(err instanceof Error ? err.message : "Erreur lors de la soumission")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Affichage du statut du serveur
  if (serverStatus === 'checking') {
    return (
      <div className="text-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p>Vérification de la connexion au serveur...</p>
      </div>
    )
  }

  if (serverStatus === 'offline') {
    return (
      <div className="text-center p-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <strong>❌ Serveur inaccessible</strong>
          <p className="mt-2">Le serveur backend n'est pas accessible sur http://localhost:8000</p>
          <p className="text-sm">Vérifiez que votre serveur FastAPI est démarré</p>
        </div>
        <Button onClick={checkServerStatus} className="bg-blue-600 hover:bg-blue-700">
          🔄 Réessayer la connexion
        </Button>
      </div>
    )
  }

  if (!file) {
    return (
      <div className="text-center p-8">
        <h3 className="text-lg font-semibold mb-2">Aucun fichier sélectionné</h3>
        <p>Veuillez retourner à la page principale pour sélectionner un fichier</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="text-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p>Analyse du fichier en cours...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center p-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <strong>Erreur :</strong> {error}
        </div>
        <Button onClick={handlePreview} className="bg-blue-600 hover:bg-blue-700">
          🔄 Réessayer
        </Button>
      </div>
    )
  }

  if (!previewData) {
    return (
      <div className="text-center p-8">
        <Button onClick={handlePreview} className="bg-blue-600 hover:bg-blue-700">
          📊 Analyser le fichier
        </Button>
      </div>
    )
  }

  // Étape 1 : Sélection des colonnes
  if (step === 'columns') {
    return (
      <div className="space-y-6">
        {/* Informations du fichier */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl">📁 Fichier : {file.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{previewData.rows}</div>
                <div className="text-sm text-blue-600">Lignes</div>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{previewData.columns.length}</div>
                <div className="text-sm text-green-600">Colonnes</div>
              </div>
              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <div className="text-lg font-bold text-purple-600">{(file.size / 1024).toFixed(2)} KB</div>
                <div className="text-sm text-purple-600">Taille</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sélection des colonnes */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl">📋 Sélection des variables</CardTitle>
            <p className="text-sm text-gray-600">
              ✅ Sélectionnez vos variables explicatives et vos variables à expliquer (plusieurs possibles)
            </p>
          </CardHeader>
          <CardContent>
            {/* Barre de recherche */}
            <div className="mb-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="🔍 Rechercher une colonne..."
                  value={columnSearchTerm}
                  onChange={(e) => setColumnSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
              {columnSearchTerm && (
                <p className="text-sm text-gray-500 mt-1">
                  {filteredColumns.length} colonne(s) trouvée(s) sur {previewData?.columns.length}
                </p>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto space-y-4 pr-2">
              {filteredColumns.map((column, index) => (
                <div key={index} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{column}</h4>
                    <p className="text-sm text-gray-500">Colonne {index + 1}</p>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`explanatory-${index}`}
                        checked={columnSelection[column]?.isExplanatory || false}
                        onChange={(e) => 
                          handleColumnSelection(column, 'explanatory', e.target.checked)
                        }
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <label htmlFor={`explanatory-${index}`} className="text-sm font-medium text-gray-700">
                        Variable explicative
                      </label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`toExplain-${index}`}
                        checked={columnSelection[column]?.isToExplain || false}
                        onChange={(e) => 
                          handleColumnSelection(column, 'toExplain', e.target.checked)
                        }
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <label htmlFor={`toExplain-${index}`} className="text-sm font-medium text-gray-700">
                        Variable à expliquer
                      </label>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-6 pt-4 border-t">
              <Button 
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="w-full bg-blue-600 hover:bg-blue-700 text-lg py-3"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Analyse en cours...
                  </>
                ) : (
                  "🚀 Etape suivante"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Étape 2 : Sélection des données restantes
  if (step === 'remaining-data') {
    if (!remainingData) {
      return (
        <div className="text-center p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Chargement des colonnes restantes...</p>
          <Button 
            onClick={() => setStep('columns')} 
            variant="outline" 
            className="mt-4"
          >
            ← Retour à la sélection des colonnes
          </Button>
        </div>
      )
    }

    return (
      <div className="space-y-6">
        {/* Informations du fichier */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl">📁 Fichier : {file.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{previewData.rows}</div>
                <div className="text-sm text-blue-600">Lignes</div>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{previewData.columns.length}</div>
                <div className="text-sm text-green-600">Colonnes</div>
              </div>
              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <div className="text-lg font-bold text-purple-600">{(file.size / 1024).toFixed(2)} KB</div>
                <div className="text-sm text-purple-600">Taille</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sélection des données des colonnes restantes */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl">🔄 Sélection des données à filtrer</CardTitle>
            <p className="text-sm text-gray-600">
              Sélectionnez les données des colonnes restantes sur lesquelles vous voulez travailler
            </p>
          </CardHeader>
          <CardContent>
            {/* Barre de recherche */}
            <div className="mb-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="🔍 Rechercher une colonne..."
                  value={dataSearchTerm}
                  onChange={(e) => setDataSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                   </svg>
                </div>
              </div>
              {dataSearchTerm && (
                <p className="text-sm text-gray-500 mt-1">
                  {filteredRemainingColumns.length} colonne(s) trouvée(s) sur {remainingData?.remaining_columns.length}
                </p>
              )}
            </div>
            
            <div className="max-h-96 overflow-y-auto space-y-4 pr-2">
              {filteredRemainingColumns.map((columnName) => (
                <DataSelectionAccordion
                  key={columnName}
                  columnName={columnName}
                  data={remainingData?.remaining_data[columnName] || []}
                  selectedData={selectedRemainingData[columnName] || []}
                  onDataSelection={handleDataSelection}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 pt-4 border-t">
          <div className="flex gap-4">
            <Button 
              onClick={() => setStep('columns')} 
              variant="outline" 
              className="flex-1"
            >
              ← Retour à la sélection des colonnes
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1 bg-green-600 hover:bg-green-700 text-lg py-3"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Analyse en cours...
                </>
              ) : (
                "🚀 Lancer l'analyse finale"
              )}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return null // Should not happen
}