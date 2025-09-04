"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Home } from "lucide-react"
import { useEffect, useState } from "react"
import StepProgress from "@/components/ui/step-progress"

interface RemainingData {
  filename: string
  variables_explicatives: string[]
  variables_a_expliquer: string[]
  remaining_columns: string[]
  remaining_data: { [columnName: string]: any[] }
  message: string
}

export default function DataSelection() {
  const router = useRouter()
  const [remainingData, setRemainingData] = useState<RemainingData | null>(null)
  const [selectedData, setSelectedData] = useState<{ [columnName: string]: any[] }>({})
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    // Récupérer les données depuis le localStorage
    const storedData = localStorage.getItem('excelAnalysisData')
    
    if (storedData) {
      try {
        const data = JSON.parse(storedData)
        if (data.remainingData) {
          setRemainingData(data.remainingData)
          setSelectedData(data.selectedRemainingData || {})
        } else {
          // Si pas de données restantes, rediriger vers la page des variables
          router.push('/variables')
        }
        setLoading(false)
      } catch (error) {
        console.error('Erreur lors du parsing des données:', error)
        setLoading(false)
        router.push('/variables')
      }
    } else {
      // Si pas de données, rediriger vers la page des variables
      router.push('/variables')
    }
  }, [router])

  const handleDataSelection = (columnName: string, value: any, checked: boolean) => {
    setSelectedData(prev => {
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
    if (!remainingData) return

    try {
      const formData = new FormData()
      formData.append("filename", remainingData.filename)
      formData.append("variables_explicatives", remainingData.variables_explicatives.join(','))
      formData.append("variable_a_expliquer", remainingData.variables_a_expliquer.join(','))
      formData.append("selected_data", JSON.stringify(selectedData))

      const response = await fetch("http://localhost:8000/excel/select-columns", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Erreur HTTP: ${response.status} - ${errorText}`)
      }

      const result = await response.json()
      console.log("✅ Résultat final:", result)
      
      // Stocker les données dans le localStorage
      const storedData = localStorage.getItem('excelAnalysisData')
      const dataToStore = {
        ...JSON.parse(storedData || '{}'),
        analysisResult: result,
        selectedRemainingData: selectedData
      }
      localStorage.setItem('excelAnalysisData', JSON.stringify(dataToStore))
      
      // Vérifier s'il faut retourner à une page spécifique
      const returnToPage = localStorage.getItem('returnToPage')
      if (returnToPage) {
        // Nettoyer l'indicateur de retour
        localStorage.removeItem('returnToPage')
        // Retourner à la page d'origine
        router.push(returnToPage)
      } else {
        // Naviguer vers la page des résultats (comportement normal)
        router.push('/results')
      }
    } catch (err) {
      console.error("❌ Erreur lors de la soumission:", err)
      alert("Erreur lors de la soumission: " + (err instanceof Error ? err.message : "Erreur inconnue"))
    }
  }

  // Filtrer les colonnes basé sur la recherche
  const filteredColumns = remainingData?.remaining_columns.filter(column =>
    column.toLowerCase().includes(searchTerm.toLowerCase())
  ) || []

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-100 to-emerald-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Chargement des données...</p>
        </div>
      </div>
    )
  }

  if (!remainingData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-100 to-emerald-100 flex items-center justify-center">
        <div className="text-center">
          <h3 className="text-lg font-semibold mb-2">Aucune donnée disponible</h3>
          <p>Veuillez retourner à la page précédente</p>
          <Button onClick={() => router.push('/variables')} className="mt-4">
            Retour aux variables
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-100 to-orange-100 p-8">
      <StepProgress currentStep={4} />
      <div className="max-w-6xl mx-auto">
        {/* Navigation */}
        <div className="flex gap-2 mb-6">
          <Button variant="outline" onClick={() => router.push('/variables')} className="border-yellow-300 text-yellow-700 hover:bg-yellow-50">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour aux variables
          </Button>
          <Button variant="outline" onClick={() => {
            localStorage.removeItem('excelAnalysisData')
            router.push('/')
          }} className="border-yellow-300 text-yellow-700 hover:bg-yellow-50">
            <Home className="h-4 w-4 mr-2" />
            Accueil
          </Button>
        </div>

        <h1 className="text-4xl font-bold text-center mb-8 bg-gradient-to-r from-yellow-500 to-orange-500 bg-clip-text text-transparent">
          Sélection des données
        </h1>

        {/* Informations du fichier */}
        <Card className="mb-6 shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl">📁 Fichier : {remainingData.filename}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold text-yellow-600 mb-2">Variables explicatives :</h4>
                <ul className="space-y-1">
                  {remainingData.variables_explicatives.map((col, index) => (
                    <li key={index} className="text-sm bg-yellow-50 p-2 rounded">• {col}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-blue-600 mb-2">Variables à expliquer :</h4>
                <ul className="space-y-1">
                  {remainingData.variables_a_expliquer.map((col, index) => (
                    <li key={index} className="text-sm bg-blue-50 p-2 rounded">• {col}</li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sélection des données des colonnes restantes */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl">🔄 Sélection des données des colonnes restantes</CardTitle>
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
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
              {searchTerm && (
                <p className="text-sm text-gray-500 mt-1">
                  {filteredColumns.length} colonne(s) trouvée(s) sur {remainingData.remaining_columns.length}
                </p>
              )}
            </div>
            
            <div className="max-h-96 overflow-y-auto space-y-4 pr-2">
              {filteredColumns.map((columnName) => (
                <div key={columnName} className="border rounded-lg p-4">
                  <h4 className="font-semibold text-purple-600 mb-3">📊 {columnName}</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                    {remainingData.remaining_data[columnName]?.map((value, index) => (
                      <label key={index} className="flex items-center space-x-2 p-2 border rounded hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedData[columnName]?.includes(value) || false}
                          onChange={(e) => handleDataSelection(columnName, value, e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm truncate" title={String(value)}>
                          {String(value)}
                        </span>
                      </label>
                    ))}
                  </div>
                  {selectedData[columnName] && selectedData[columnName].length > 0 && (
                    <p className="text-xs text-purple-500 mt-2">
                      {selectedData[columnName].length} valeur(s) sélectionnée(s)
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 pt-4 border-t">
          <Button 
            onClick={handleSubmit}
                          className="w-full bg-yellow-600 hover:bg-yellow-700 text-lg py-3"
          >
            🚀 Lancer l'analyse finale
          </Button>
        </div>
      </div>
    </div>
  )
}
