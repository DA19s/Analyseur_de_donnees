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
  const [step, setStep] = useState<'columns' | 'explanatory-variables' | 'remaining-data'>('columns')
  const [columnSearchTerm, setColumnSearchTerm] = useState('')
  const [dataSearchTerm, setDataSearchTerm] = useState('')
  
  // Nouveaux states pour gérer l'affichage des valeurs des colonnes
  const [expandedColumns, setExpandedColumns] = useState<{ [columnName: string]: boolean }>({})
  const [columnValues, setColumnValues] = useState<{ [columnName: string]: any[] }>({})
  const [selectedColumnValues, setSelectedColumnValues] = useState<{ [columnName: string]: any[] }>({})

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

  // Mettre à jour automatiquement columnSelection.isToExplain basé sur selectedColumnValues
  useEffect(() => {
    setColumnSelection(prev => {
      const newSelection = { ...prev }
      
      // Pour chaque colonne, vérifier si elle a des valeurs sélectionnées
      Object.keys(newSelection).forEach(columnName => {
        const hasSelectedValues = selectedColumnValues[columnName] && selectedColumnValues[columnName].length > 0
        newSelection[columnName] = {
          ...newSelection[columnName],
          isToExplain: hasSelectedValues
        }
      })
      
      return newSelection
    })
  }, [selectedColumnValues])

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
      
      // Permettre à une variable d'être à la fois explicative et à expliquer
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

  // Nouvelle fonction pour gérer l'expansion des colonnes
  const handleColumnExpansion = async (columnName: string) => {
    if (!previewData) return

    const isExpanded = expandedColumns[columnName]
    
    if (!isExpanded && !columnValues[columnName]) {
      // Charger les valeurs de la colonne depuis l'API
      try {
        console.log("🔄 Chargement des valeurs pour la colonne:", columnName)
        const formData = new FormData()
        formData.append("filename", previewData.filename)
        formData.append("column_name", columnName)

        console.log("📤 Envoi de la requête avec:", {
          filename: previewData.filename,
          column_name: columnName
        })

        const response = await fetch("http://localhost:8000/excel/get-column-values", {
          method: "POST",
          body: formData,
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.error("❌ Erreur API:", response.status, errorText)
          throw new Error(`Erreur HTTP: ${response.status} - ${errorText}`)
        }

        const result = await response.json()
        console.log("✅ Réponse reçue pour", columnName, ":", result)
        
        setColumnValues(prev => ({
          ...prev,
          [columnName]: result.unique_values
        }))
        
        console.log("✅ Valeurs mises à jour pour", columnName, ":", result.unique_values)
      } catch (err) {
        console.error("❌ Erreur lors du chargement des valeurs:", err)
        setError(err instanceof Error ? err.message : "Erreur lors du chargement des valeurs")
        return
      }
    }

    // Basculer l'état d'expansion
    setExpandedColumns(prev => ({
      ...prev,
      [columnName]: !isExpanded
    }))
    
    console.log("🔄 État d'expansion pour", columnName, ":", !isExpanded)
  }

  // Fonction pour gérer la sélection de la checkbox "Variable à expliquer"
  const handleVariableToExplainCheckbox = async (columnName: string, checked: boolean) => {
    if (checked) {
      // Si on coche la checkbox, charger les valeurs si elles ne sont pas encore disponibles
      if (!columnValues[columnName]) {
        try {
          console.log("🔄 Chargement automatique des valeurs pour", columnName)
          const formData = new FormData()
          formData.append("filename", previewData?.filename || '') // Use optional chaining
          formData.append("column_name", columnName)

          const response = await fetch("http://localhost:8000/excel/get-column-values", {
            method: "POST",
            body: formData,
          })

          if (!response.ok) {
            const errorText = await response.text()
            throw new Error(`Erreur HTTP: ${response.status} - ${errorText}`)
          }

          const result = await response.json()
          setColumnValues(prev => ({
            ...prev,
            [columnName]: result.unique_values
          }))
          
          // Maintenant cocher toutes les valeurs
          setSelectedColumnValues(prev => ({
            ...prev,
            [columnName]: [...result.unique_values]
          }))
        } catch (err) {
          console.error("❌ Erreur lors du chargement automatique des valeurs:", err)
          setError(err instanceof Error ? err.message : "Erreur lors du chargement des valeurs")
          return
        }
      } else {
        // Si les valeurs sont déjà disponibles, cocher toutes les valeurs
        const values = columnValues[columnName]
        setSelectedColumnValues(prev => ({
          ...prev,
          [columnName]: [...values]
        }))
      }
    } else {
      // Si on décoche la checkbox, décocher toutes les valeurs
      setSelectedColumnValues(prev => {
        const newSelection = { ...prev }
        delete newSelection[columnName]
        return newSelection
      })
    }
  }

  // Fonction pour gérer la sélection des valeurs individuelles
  const handleColumnValueSelection = (columnName: string, value: any, checked: boolean) => {
    setSelectedColumnValues(prev => {
      const newSelection = { ...prev }
      
      if (!newSelection[columnName]) {
        newSelection[columnName] = []
      }
      
      if (checked) {
        // Ajouter la valeur
        if (!newSelection[columnName].includes(value)) {
          newSelection[columnName] = [...newSelection[columnName], value]
        }
      } else {
        // Retirer la valeur
        newSelection[columnName] = newSelection[columnName].filter(v => v !== value)
        if (newSelection[columnName].length === 0) {
          delete newSelection[columnName]
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

    // Permettre de sélectionner d'abord les variables à expliquer
    if (variablesToExplain.length === 0) {
      alert("Veuillez sélectionner au moins une variable à expliquer")
      return
    }

    // Vérifier qu'on a au moins quelques éléments sélectionnés dans les variables à expliquer
    const hasSelectedValues = variablesToExplain.some(col => 
      selectedColumnValues[col] && selectedColumnValues[col].length > 0
    )
    
    if (!hasSelectedValues) {
      alert("Veuillez sélectionner au moins quelques éléments dans vos variables à expliquer")
      return
    }

    setIsSubmitting(true)

    try {
      if (step === 'columns') {
        // Passer à l'étape de sélection des variables explicatives
        setStep('explanatory-variables')
        setIsSubmitting(false)
      } else if (step === 'explanatory-variables') {
        // Vérifier qu'on a au moins une variable explicative
        if (explanatoryVariables.length === 0) {
          alert("Veuillez sélectionner au moins une variable explicative")
          setIsSubmitting(false)
          return
        }

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
        // Inclure les valeurs sélectionnées des colonnes à expliquer
        const finalSelectedData = {
          ...selectedRemainingData,
          ...selectedColumnValues
        }

        const formData = new FormData()
        formData.append("filename", previewData.filename)
        formData.append("variables_explicatives", remainingData!.variables_explicatives.join(','))
        formData.append("variable_a_expliquer", remainingData!.variables_a_expliquer.join(','))
        formData.append("selected_data", JSON.stringify(finalSelectedData))

        console.log("📤 Envoi final avec données sélectionnées:", {
          filename: previewData.filename,
          variables_explicatives: remainingData!.variables_explicatives,
          variable_a_expliquer: remainingData!.variables_a_expliquer,
          selected_data: finalSelectedData
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
          selectedRemainingData: selectedRemainingData,
          selectedColumnValues: selectedColumnValues
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

            <div className="max-h-96 overflow-y-auto space-y-6 pr-2">
              {/* Section 1: Variables à expliquer */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-gray-950 border-b border-gray-200 pb-2">
                  🎯 Variables à expliquer
                </h3>
                <p className="text-sm text-gray-600 mb-3">
                  Cliquez sur une colonne pour la sélectionner et voir ses valeurs uniques
                </p>
                {filteredColumns.map((column, index) => (
                  <div key={`toExplain-${index}`} className="border border-green-200 rounded-lg overflow-hidden">
                    {/* Bouton principal de la colonne */}
                    <div 
                      className={`flex items-center justify-between p-4 transition-colors ${
                        columnSelection[column]?.isToExplain 
                          ? 'bg-green-100 border-l-4 border-l-white' 
                          : 'bg-white hover:bg-green-100'
                      }`}
                      onClick={() => handleColumnExpansion(column)}
                    >
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{column}</h4>
                        <p className="text-sm text-gray-500">Colonne {index + 1}</p>
                        {columnSelection[column]?.isToExplain && (
                          <p className="text-xs text-green-600 mt-1">✅ Variable sélectionnée</p>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-4">
                        {/* Checkbox pour sélectionner toute la colonne */}
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={`toExplain-${index}`}
                            checked={columnSelection[column]?.isToExplain || false}
                            onChange={(e) => 
                              handleVariableToExplainCheckbox(column, e.target.checked)
                            }
                            className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <label htmlFor={`toExplain-${index}`} className="text-sm font-medium text-gray-700 cursor-pointer">
                            Variable à expliquer
                          </label>
                        </div>
                        
                        {/* Icône d'expansion */}
                        {expandedColumns[column] ? (
                          <ChevronDown className="h-5 w-5 text-green-600" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-green-600" />
                        )}
                      </div>
                    </div>
                    
                    {/* Contenu expandable avec les valeurs de la colonne */}
                    {expandedColumns[column] && (
                      <div className="p-4 bg-white border-t border-green-200">
                        {/* Affichage des valeurs uniques */}
                        {columnValues[column] ? (
                          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 max-h-64 overflow-y-auto">
                            {columnValues[column].map((value, valueIndex) => (
                              <label key={valueIndex} className="flex items-center space-x-2 p-2 border rounded hover:bg-gray-50 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={selectedColumnValues[column]?.includes(value) || false}
                                  onChange={(e) => 
                                    handleColumnValueSelection(column, value, e.target.checked)
                                  }
                                  className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                                />
                                <span className="text-sm truncate" title={String(value)}>
                                  {String(value)}
                                </span>
                              </label>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-4">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600 mx-auto mb-2"></div>
                            <p className="text-sm text-gray-500">Chargement des valeurs...</p>
                            <p className="text-xs text-gray-400 mt-1">
                              Debug: expandedColumns[{column}] = {String(expandedColumns[column])}
                            </p>
                            <p className="text-xs text-gray-400">
                              Debug: columnValues[{column}] = {String(columnValues[column])}
                            </p>
                          </div>
                        )}
                        
                        {/* Résumé de la sélection */}
                        {selectedColumnValues[column] && selectedColumnValues[column].length > 0 && (
                          <div className="mt-4 p-3 bg-green-50 rounded-lg">
                            <p className="text-sm text-green-700">
                              <strong>{selectedColumnValues[column].length}</strong> valeur(s) sélectionnée(s) sur {columnValues[column]?.length || 0}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Séparateur */}
              <div className="border-t border-gray-300 my-6"></div>

              {/* Section 2: Variables explicatives */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-blue-600 border-b border-blue-200 pb-2">
                  🔍 Variables explicatives (Variables indépendantes)
                </h3>
                <p className="text-sm text-gray-600 mb-3">
                  Sélectionnez les colonnes qui vont expliquer ou prédire vos variables cibles
                </p>
                {filteredColumns.map((column, index) => (
                  <div key={`explanatory-${index}`} className="flex items-center justify-between p-4 border border-blue-200 rounded-lg hover:bg-blue-50">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{column}</h4>
                      <p className="text-sm text-gray-500">Colonne {index + 1}</p>
                    </div>
                    
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
                      <label htmlFor={`explanatory-${index}`} className="text-sm font-medium text-blue-700">
                        Variable explicative
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="mt-6 pt-4 border-t">
              <Button 
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="w-full bg-green-600 hover:bg-green-700 text-lg py-3"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Analyse en cours...
                  </>
                ) : (
                  "🔍 Sélectionner les variables explicatives"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Étape 2 : Sélection des variables explicatives
  if (step === 'explanatory-variables') {
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

        {/* Sélection des variables explicatives */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl">🔍 Sélection des variables explicatives</CardTitle>
            <p className="text-sm text-gray-600">
              ✅ Sélectionnez les colonnes qui vont expliquer ou prédire vos variables cibles
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
                <div key={`explanatory-${index}`} className="flex items-center justify-between p-4 border border-blue-200 rounded-lg hover:bg-blue-50">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{column}</h4>
                    <p className="text-sm text-gray-500">Colonne {index + 1}</p>
                  </div>
                  
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
                    <label htmlFor={`explanatory-${index}`} className="text-sm font-medium text-blue-700">
                      Variable explicative
                    </label>
                  </div>
                </div>
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
              ← Retour à la sélection des variables à expliquer
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-lg py-3"
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
        </div>
      </div>
    )
  }

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
                  className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
              className="flex-1 bg-purple-600 hover:bg-purple-700 text-lg py-3"
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
