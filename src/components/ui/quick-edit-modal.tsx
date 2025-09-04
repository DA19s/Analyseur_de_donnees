"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { X, Check, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"

interface QuickEditModalProps {
  editType: 'toExplain' | 'explanatory' | 'sample'
  returnToPage: string
  onClose: () => void
}

export default function QuickEditModal({ editType, returnToPage, onClose }: QuickEditModalProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [previewData, setPreviewData] = useState<any>(null)
  const [selectedVariables, setSelectedVariables] = useState<string[]>([])
  const [selectedValues, setSelectedValues] = useState<{ [key: string]: any[] }>({})
  const [treatmentMode, setTreatmentMode] = useState<'independent' | 'together'>('independent')
  const [error, setError] = useState<string | null>(null)
  const [expandedColumns, setExpandedColumns] = useState<{ [columnName: string]: boolean }>({})
  const [columnValues, setColumnValues] = useState<{ [columnName: string]: any[] }>({})
  const [dataSearchTerm, setDataSearchTerm] = useState("")
  const [columnSearchTerm, setColumnSearchTerm] = useState("")
  const [loadingValues, setLoadingValues] = useState<{ [columnName: string]: boolean }>({})

  useEffect(() => {
    loadExistingData()
  }, [editType])

  const loadExistingData = () => {
    try {
      const storedData = localStorage.getItem('excelAnalysisData')
      if (!storedData) {
        setError("Données d'analyse non trouvées")
        return
      }

      const data = JSON.parse(storedData)
      
      const previewDataWithColumns = {
        ...data,
        analysisResult: {
          ...data.analysisResult,
          columns: data.analysisResult?.columns || data.columns || []
        }
      }
      
      setPreviewData(previewDataWithColumns)

      if (editType === 'toExplain') {
        setSelectedVariables(data.analysisResult?.variables_a_expliquer || [])
        setSelectedValues(data.selectedColumnValues || {})
        const savedMode = localStorage.getItem('treatmentMode')
        if (savedMode) setTreatmentMode(savedMode as 'independent' | 'together')
      } else if (editType === 'explanatory') {
        setSelectedVariables(data.analysisResult?.variables_explicatives || [])
      } else if (editType === 'sample') {
        setSelectedValues(data.selectedRemainingData || {})
      }
    } catch (err) {
      setError("Erreur lors du chargement des données")
    }
  }

  const loadAndSelectAllValues = async (variable: string) => {
    // Si les valeurs ne sont pas encore chargées, les charger
    if (!columnValues[variable]) {
      setLoadingValues(prev => ({ ...prev, [variable]: true }))
      try {
        const formData = new FormData()
        formData.append("filename", previewData.filename)
        formData.append("column_name", variable)

        const response = await fetch("http://localhost:8000/excel/get-column-values", {
          method: "POST",
          body: formData,
        })
        
        if (response.ok) {
          const values = await response.json()
          const valuesArray = Array.isArray(values) ? values : (values.unique_values || values.values || values.data || [])
          setColumnValues(prev => ({ ...prev, [variable]: valuesArray }))
          
          // Sélectionner toutes les valeurs
          setSelectedValues(prev => ({
            ...prev,
            [variable]: valuesArray
          }))
        }
      } catch (err) {

      } finally {
        setLoadingValues(prev => ({ ...prev, [variable]: false }))
      }
    } else {
      // Si les valeurs sont déjà chargées, les sélectionner directement
      setSelectedValues(prev => ({
        ...prev,
        [variable]: columnValues[variable]
      }))
    }
  }

  const handleVariableToggle = async (variable: string) => {
    const isCurrentlySelected = selectedVariables.includes(variable)
    
    if (isCurrentlySelected) {
      // Si on décoche la variable, décocher aussi toutes ses modalités
      setSelectedVariables(prev => prev.filter(v => v !== variable))
      setSelectedValues(prev => {
        const newValues = { ...prev }
        delete newValues[variable]
        return newValues
      })
    } else {
      // Si on coche la variable, la cocher et charger/sélectionner toutes ses modalités
      setSelectedVariables(prev => [...prev, variable])
      await loadAndSelectAllValues(variable)
    }
  }

  const handleValueToggle = (variable: string, value: any) => {
    setSelectedValues(prev => {
      const newValues = {
        ...prev,
        [variable]: prev[variable]?.includes(value)
          ? prev[variable].filter(v => v !== value)
          : [...(prev[variable] || []), value]
      }
      
      // Logique différente selon le type d'édition
      if (editType === 'toExplain') {
        // Pour les variables à expliquer, cocher automatiquement la variable parent
        if (!prev[variable]?.includes(value)) {
          setSelectedVariables(prevVars => {
            if (!prevVars.includes(variable)) {
              return [...prevVars, variable]
            }
            return prevVars
          })
        } else {
          // Si on décoche une modalité et qu'il n'y a plus de modalités sélectionnées, décocher la variable parent
          if (newValues[variable] && newValues[variable].length === 0) {
            setSelectedVariables(prevVars => {
              return prevVars.filter(v => v !== variable)
            })
            delete newValues[variable]
          }
        }
      } else if (editType === 'sample') {
        // Pour l'échantillon, la logique est différente car il n'y a pas de selectedVariables
        // La checkbox "sélectionner toutes les modalités" se base sur selectedValues
        // Elle se coche automatiquement si toutes les modalités sont sélectionnées
        // et se décoche si au moins une modalité est décochée
        // Cette logique est gérée directement dans le rendu de la checkbox
      }
      
      return newValues
    })
  }

  const toggleColumnExpansion = async (columnName: string) => {
    const isExpanded = expandedColumns[columnName]
    
    if (!isExpanded && !columnValues[columnName]) {
      setLoadingValues(prev => ({ ...prev, [columnName]: true }))
      try {
        const formData = new FormData()
        formData.append("filename", previewData.filename)
        formData.append("column_name", columnName)

        const response = await fetch("http://localhost:8000/excel/get-column-values", {
          method: "POST",
          body: formData,
        })
        
        if (response.ok) {
          const values = await response.json()
          const valuesArray = Array.isArray(values) ? values : (values.unique_values || values.values || values.data || [])
          setColumnValues(prev => ({ ...prev, [columnName]: valuesArray }))
        }
      } catch (err) {
        // Erreur silencieuse
      } finally {
        setLoadingValues(prev => ({ ...prev, [columnName]: false }))
      }
    }
    setExpandedColumns(prev => ({ ...prev, [columnName]: !isExpanded }))
  }

  const handleSave = async () => {
    setLoading(true)
    setError(null)

    try {
      const storedData = localStorage.getItem('excelAnalysisData')
      if (!storedData) {
        throw new Error("Données d'analyse non trouvées")
      }

      const data = JSON.parse(storedData)
      const analysisResult = data.analysisResult
      if (!analysisResult) {
        throw new Error("Résultat d'analyse non trouvé")
      }

      const formData = new FormData()
      formData.append("filename", data.filename)

      if (editType === 'toExplain') {
        formData.append("variables_explicatives", analysisResult.variables_explicatives.join(','))
        formData.append("variable_a_expliquer", selectedVariables.join(','))
        formData.append("selected_data", JSON.stringify({
          ...analysisResult.selected_data,
          ...selectedValues
        }))
        localStorage.setItem('treatmentMode', treatmentMode)
      } else if (editType === 'explanatory') {
        formData.append("variables_explicatives", selectedVariables.join(','))
        formData.append("variable_a_expliquer", analysisResult.variables_a_expliquer.join(','))
        formData.append("selected_data", JSON.stringify(analysisResult.selected_data))
      } else if (editType === 'sample') {
        formData.append("variables_explicatives", analysisResult.variables_explicatives.join(','))
        formData.append("variable_a_expliquer", analysisResult.variables_a_expliquer.join(','))
        formData.append("selected_data", JSON.stringify({
          ...analysisResult.selected_data,
          ...selectedValues
        }))
      }

      const response = await fetch("http://localhost:8000/excel/select-columns", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Erreur HTTP: ${response.status} - ${errorText}`)
      }

      const result = await response.json()

      const updatedData = {
        ...data,
        analysisResult: result,
        selectedColumnValues: editType === 'toExplain' ? selectedValues : data.selectedColumnValues,
        selectedRemainingData: editType === 'sample' ? selectedValues : data.selectedRemainingData,
        treatmentMode: treatmentMode
      }
      localStorage.setItem('excelAnalysisData', JSON.stringify(updatedData))

      onClose()
      window.location.href = returnToPage
      
    } catch (err) {
      let errorMessage = "Erreur lors de la sauvegarde"
      
      if (err instanceof Error) {
        if (err.message.includes("Données d'analyse non trouvées")) {
          errorMessage = "Données d'analyse non trouvées. Veuillez recommencer l'analyse."
        } else {
          errorMessage = err.message
        }
      }
      
      setError(errorMessage)
      setLoading(false)
    }
  }

  const getTitle = () => {
    switch (editType) {
      case 'toExplain': return '🎯 Variables à expliquer'
      case 'explanatory': return '🔍 Variables explicatives'
      case 'sample': return '📊 Échantillon'
      default: return 'Modification'
    }
  }

  const getColor = () => {
    switch (editType) {
      case 'toExplain': return 'green'
      case 'explanatory': return 'blue'
      case 'sample': return 'yellow'
      default: return 'blue'
    }
  }

  const color = getColor()

  if (!previewData) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-center">Chargement...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <CardHeader className={`bg-${color}-50 border-b border-${color}-200`}>
          <div className="flex items-center justify-between">
            <CardTitle className={`text-xl text-${color}-800`}>
              {getTitle()}
            </CardTitle>
            <Button
              onClick={onClose}
              variant="ghost"
              size="sm"
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {editType === 'toExplain' && (
            <>
              <div className="mb-8">
                <h2 className="text-2xl font-bold mb-4 text-green-600">
                  🎯 Variables à expliquer
                </h2>
                <p className="text-gray-600 mb-4">
                  Cliquez sur une colonne pour la sélectionner et voir ses valeurs uniques
                </p>
                
                {/* Barre de recherche */}
                <div className="mb-4">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="🔍 Rechercher une colonne..."
                      value={columnSearchTerm}
                      onChange={(e) => setColumnSearchTerm(e.target.value)}
                      className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                  </div>
                  {columnSearchTerm && (
                    <p className="text-sm text-gray-500 mt-1">
                      {(previewData.analysisResult?.columns || previewData.columns)
                        ?.filter((col: string) => 
                          col.toLowerCase().includes(columnSearchTerm.toLowerCase())
                        ).length || 0} colonne(s) trouvée(s) sur {(previewData.analysisResult?.columns || previewData.columns)?.length || 0}
                    </p>
                  )}
                </div>

                <div className="max-h-64 overflow-y-auto space-y-4 pr-2">
                  {(previewData.analysisResult?.columns || previewData.columns)
                    ?.filter((columnName: string) => 
                      columnName.toLowerCase().includes(columnSearchTerm.toLowerCase())
                    )
                    .map((columnName: string, index: number) => (
                      <div key={`toExplain-${index}`} className="border border-green-200 rounded-lg overflow-hidden min-w-0">
                        <div 
                          className={`flex items-center justify-between p-4 transition-colors ${
                            selectedVariables.includes(columnName)
                              ? 'bg-green-100 border-l-4 border-l-white' 
                              : 'bg-white hover:bg-green-100'
                          }`}
                          onClick={() => toggleColumnExpansion(columnName)}
                        >
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900 break-words">{columnName}</h4>
                            <p className="text-sm text-gray-500">Colonne {index + 1}</p>
                            {selectedVariables.includes(columnName) && (
                              <p className="text-xs text-green-600 mt-1">✅ Variable sélectionnée</p>
                            )}
                          </div>
                          
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id={`toExplain-${index}`}
                                checked={Boolean(selectedVariables.includes(columnName))}
                                onChange={(e) => {
                                  e.stopPropagation()
                                  handleVariableToggle(columnName)
                                }}
                                className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                              />
                              <label htmlFor={`toExplain-${index}`} className="text-sm text-gray-600">
                                Sélectionner
                              </label>
                            </div>
                            
                            <div className="text-green-600">
                              {expandedColumns[columnName] ? (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                </svg>
                              ) : (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {expandedColumns[columnName] && (
                          <div className="p-4 bg-white border-t border-green-200">
                            <div className="mb-4">
                              <div className="relative">
                                <input
                                  type="text"
                                  placeholder="🔍 Rechercher une modalité..."
                                  value={dataSearchTerm}
                                  onChange={(e) => setDataSearchTerm(e.target.value)}
                                  className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                />
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                  </svg>
                                </div>
                              </div>
                              {dataSearchTerm && (
                                <p className="text-sm text-gray-500 mt-1">
                                  {columnValues[columnName]?.filter((value: any) => 
                                    String(value).toLowerCase().includes(dataSearchTerm.toLowerCase())
                                  ).length || 0} modalité(s) trouvée(s) sur {columnValues[columnName]?.length || 0}
                                </p>
                              )}
                            </div>
                            
                            {loadingValues[columnName] ? (
                              <div className="text-center py-4">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600 mx-auto mb-2"></div>
                                <p className="text-sm text-gray-500">Chargement des valeurs...</p>
                              </div>
                            ) : columnValues[columnName] && Array.isArray(columnValues[columnName]) ? (
                              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 max-h-64 overflow-y-auto">
                                {columnValues[columnName]
                                  .filter((value: any) => 
                                    !dataSearchTerm || String(value).toLowerCase().includes(dataSearchTerm.toLowerCase())
                                  )
                                  .map((value: any, valueIndex: number) => (
                                  <label key={valueIndex} className="flex items-center space-x-2 p-2 border rounded hover:bg-gray-50 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={Boolean(selectedValues[columnName]?.includes(value))}
                                      onChange={(e) => 
                                        handleValueToggle(columnName, value)
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
                              <div className="text-center py-4 text-gray-500">
                                <p className="text-sm">Aucune valeur trouvée</p>
                              </div>
                            )}
                            
                            {selectedValues[columnName] && selectedValues[columnName].length > 0 && (
                              <div className="mt-4 p-3 bg-green-50 rounded-lg">
                                <p className="text-sm text-green-700">
                                  <strong>{selectedValues[columnName].length}</strong> valeur(s) sélectionnée(s) sur {columnValues[columnName]?.length || 0}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </div>

              {Object.values(selectedValues).reduce((total, values) => total + (values?.length || 0), 0) > 1 && (
                <div className="mb-8">
                  <h3 className="text-lg font-semibold mb-4 text-blue-600">
                    🔄 Mode de traitement des variables
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Choisissez comment traiter vos variables à expliquer :
                  </p>
                  
                  <div className="space-y-3">
                    <label className="flex items-center space-x-3 p-3 bg-white border border-blue-200 rounded-lg cursor-pointer hover:bg-blue-50 transition-colors">
                      <input
                        type="radio"
                        name="treatmentMode"
                        value="independent"
                        checked={Boolean(treatmentMode === 'independent')}
                        onChange={(e) => setTreatmentMode(e.target.value as 'independent' | 'together')}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">🔀 Traitement indépendant</div>
                        <div className="text-sm text-gray-600">
                          Chaque variable est analysée séparément avec son propre arbre de décision
                        </div>
                      </div>
                    </label>
                    <label className="flex items-center space-x-3 p-3 bg-white border border-blue-200 rounded-lg cursor-pointer hover:bg-blue-50 transition-colors">
                      <input
                        type="radio"
                        name="treatmentMode"
                        value="together"
                        checked={Boolean(treatmentMode === 'together')}
                        onChange={(e) => setTreatmentMode(e.target.value as 'independent' | 'together')}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500"
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
              )}
            </>
          )}

          {editType === 'explanatory' && (
            <div className="mb-8">
              <h2 className="text-2xl font-bold mb-4 text-green-600">
                🔍 Variables explicatives (Variables indépendantes)
              </h2>
              <p className="text-gray-600 mb-4">
                Sélectionnez les colonnes qui vont expliquer ou prédire vos variables cibles
              </p>
              
              <div className="mb-4">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="🔍 Rechercher une colonne..."
                    value={columnSearchTerm}
                    onChange={(e) => setColumnSearchTerm(e.target.value)}
                    className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>
                {columnSearchTerm && (
                  <p className="text-sm text-gray-500 mt-1">
                    {((previewData.analysisResult?.columns || previewData.columns)
                      ?.filter((col: string) => 
                        !previewData.analysisResult?.variables_a_expliquer?.includes(col) &&
                        col.toLowerCase().includes(columnSearchTerm.toLowerCase())
                      ) || []).length} colonne(s) trouvée(s) sur {(previewData.analysisResult?.columns || previewData.columns)
                      ?.filter((col: string) => !previewData.analysisResult?.variables_a_expliquer?.includes(col))?.length || 0}
                  </p>
                )}
              </div>
              
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {(previewData.analysisResult?.columns || previewData.columns)
                  ?.filter((col: string) => 
                    !previewData.analysisResult?.variables_a_expliquer?.includes(col) &&
                    col.toLowerCase().includes(columnSearchTerm.toLowerCase())
                  )
                  .map((columnName: string) => (
                    <div key={columnName} className="border rounded-lg p-4">
                      <label className="flex items-center space-x-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(selectedVariables.includes(columnName))}
                          onChange={() => handleVariableToggle(columnName)}
                          className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                        />
                        <span className="font-medium text-gray-900">{columnName}</span>
                      </label>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {editType === 'sample' && (
            <div className="mb-8">
              <h2 className="text-2xl font-bold mb-4 text-yellow-600">
                📊 Sélection de l'échantillon
              </h2>
              <p className="text-gray-600 mb-4">
                Sélectionnez les modalités à inclure dans l'analyse
              </p>
              
              <div className="mb-4">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="🔍 Rechercher une colonne..."
                    value={columnSearchTerm}
                    onChange={(e) => setColumnSearchTerm(e.target.value)}
                    className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  />
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>
                {columnSearchTerm && (
                  <p className="text-sm text-gray-500 mt-1">
                    {((previewData.analysisResult?.remaining_columns || previewData.remainingData?.remaining_columns || [])
                      .filter((col: string) => 
                        col.toLowerCase().includes(columnSearchTerm.toLowerCase())
                      )).length} colonne(s) trouvée(s) sur {(previewData.analysisResult?.remaining_columns || previewData.remainingData?.remaining_columns || []).length}
                  </p>
                )}
              </div>
              
              <div className="max-h-64 overflow-y-auto space-y-4 pr-2">
                {(previewData.analysisResult?.remaining_columns || previewData.remainingData?.remaining_columns || []).length > 0 ? (
                  (previewData.analysisResult?.remaining_columns || previewData.remainingData?.remaining_columns || [])
                    .filter((columnName: string) => 
                      columnName.toLowerCase().includes(columnSearchTerm.toLowerCase())
                    )
                    .map((columnName: string, index: number) => (
                      <div key={`sample-${index}`} className="border border-yellow-200 rounded-lg overflow-hidden min-w-0">
                        <div 
                          className={`flex items-center justify-between p-4 transition-colors ${
                            selectedValues[columnName] && selectedValues[columnName].length > 0
                              ? 'bg-yellow-100 border-l-4 border-l-white' 
                              : 'bg-white hover:bg-yellow-100'
                          }`}
                          onClick={() => toggleColumnExpansion(columnName)}
                        >
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900 break-words">{columnName}</h4>
                            <p className="text-sm text-gray-500">Colonne {index + 1}</p>
                            {selectedValues[columnName] && selectedValues[columnName].length > 0 && (
                              <p className="text-xs text-yellow-600 mt-1">
                                {selectedValues[columnName].length === (previewData.analysisResult?.remaining_data?.[columnName] || []).length 
                                  ? `✅ Toutes les ${selectedValues[columnName].length} valeurs sélectionnées`
                                  : `✅ ${selectedValues[columnName].length} valeur(s) sélectionnée(s)`
                                }
                              </p>
                            )}
                          </div>
                          
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={Boolean(selectedValues[columnName] && selectedValues[columnName].length > 0)}
                                onClick={(e) => e.stopPropagation()}
                                onChange={async (e) => {
                                  e.stopPropagation()
                                  
                                  if (e.target.checked) {
                                    // Si on coche la checkbox parent, charger et sélectionner toutes les modalités
                                    if (!columnValues[columnName]) {
                                      setLoadingValues(prev => ({ ...prev, [columnName]: true }))
                                      try {
                                        const formData = new FormData()
                                        formData.append("filename", previewData.filename)
                                        formData.append("column_name", columnName)

                                        const response = await fetch("http://localhost:8000/excel/get-column-values", {
                                          method: "POST",
                                          body: formData,
                                        })
                                        
                                        if (response.ok) {
                                          const values = await response.json()
                                          const valuesArray = Array.isArray(values) ? values : (values.unique_values || values.values || values.data || [])
                                          setColumnValues(prev => ({ ...prev, [columnName]: valuesArray }))
                                          
                                          // Sélectionner toutes les valeurs
                                          setSelectedValues(prev => ({ ...prev, [columnName]: valuesArray }))
                                        }
                                      } catch (err) {
                                
                                      } finally {
                                        setLoadingValues(prev => ({ ...prev, [columnName]: false }))
                                      }
                                    } else {
                                      // Si les valeurs sont déjà chargées, les sélectionner directement
                                      setSelectedValues(prev => ({ ...prev, [columnName]: columnValues[columnName] }))
                                    }
                                  } else {
                                    // Si on décoche la checkbox parent, désélectionner toutes les modalités
                                    setSelectedValues(prev => {
                                      const newSelection = { ...prev }
                                      delete newSelection[columnName]
                                      return newSelection
                                    })
                                  }
                                }}
                                className="h-4 w-4 rounded border-gray-300 text-yellow-600 focus:ring-yellow-500"
                              />
                            </div>
                            
                            <div className="text-yellow-600">
                              {expandedColumns[columnName] ? (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                </svg>
                              ) : (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              )}
                            </div>
                          </div>
                        </div>
                      
                        {expandedColumns[columnName] && (
                          <div className="p-4 bg-white border-t border-yellow-200">
                            <div className="mb-4">
                              <div className="relative">
                                <input
                                  type="text"
                                  placeholder="🔍 Rechercher une modalité..."
                                  value={dataSearchTerm}
                                  onChange={(e) => setDataSearchTerm(e.target.value)}
                                  className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                                />
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                  </svg>
                                </div>
                              </div>
                              {dataSearchTerm && (
                                <p className="text-sm text-gray-500 mt-1">
                                  {columnValues[columnName]?.filter((value: any) => 
                                    String(value).toLowerCase().includes(dataSearchTerm.toLowerCase())
                                  ).length || 0} modalité(s) trouvée(s) sur {columnValues[columnName]?.length || 0}
                                </p>
                              )}
                            </div>
                            
                            {loadingValues[columnName] ? (
                              <div className="text-center py-4">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-yellow-600 mx-auto mb-2"></div>
                                <p className="text-sm text-gray-500">Chargement des valeurs...</p>
                              </div>
                            ) : columnValues[columnName] && Array.isArray(columnValues[columnName]) ? (
                              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 max-h-64 overflow-y-auto">
                                {columnValues[columnName]
                                  .filter((value: any) => 
                                    !dataSearchTerm || String(value).toLowerCase().includes(dataSearchTerm.toLowerCase())
                                  )
                                  .map((value: any, valueIndex: number) => (
                                  <label key={valueIndex} className="flex items-center space-x-2 p-2 border rounded hover:bg-gray-50 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={Boolean(selectedValues[columnName]?.includes(value))}
                                      onChange={(e) => 
                                        handleValueToggle(columnName, value)
                                      }
                                      className="h-4 w-4 rounded border-gray-300 text-yellow-600 focus:ring-yellow-500"
                                    />
                                    <span className="text-sm truncate" title={String(value)}>
                                      {String(value)}
                                    </span>
                                  </label>
                                ))}
                              </div>
                            ) : (
                              <div className="text-center py-4 text-gray-500">
                                <p className="text-sm">Aucune valeur trouvée</p>
                              </div>
                            )}
                            
                            {selectedValues[columnName] && selectedValues[columnName].length > 0 && (
                              <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
                                <p className="text-sm text-yellow-700">
                                  <strong>{selectedValues[columnName].length}</strong> valeur(s) sélectionnée(s) sur {columnValues[columnName]?.length || 0}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>Aucune colonne d'échantillon trouvée</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>

        <div className={`p-4 border-t border-${color}-200 bg-${color}-50 flex justify-end gap-3`}>
          <Button
            onClick={onClose}
            variant="outline"
            disabled={loading}
          >
            Annuler
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading || (editType !== 'sample' && selectedVariables.length === 0) || (editType === 'sample' && Object.keys(selectedValues).length === 0)}
            className={`bg-${color}-600 hover:bg-${color}-700 text-white`}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enregistrement...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Valider les modifications
              </>
            )}
          </Button>
        </div>
      </Card>
    </div>
  )
}