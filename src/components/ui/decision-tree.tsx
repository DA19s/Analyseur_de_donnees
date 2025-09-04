"use client"

import { useState, useEffect } from "react"
import { ChevronDown, ChevronRight, Download, TreePine, Filter, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import PDFGenerator from "./pdf-generator"


interface TreeNode {
  type: 'node' | 'leaf' | 'multi_node'
  variable?: string
  variance?: number
  branches?: { [key: string]: BranchData }
  path?: string[]
  message?: string
  nodes?: { [key: string]: TreeNode }  // Pour les nœuds multi_node
}

interface BranchData {
  count: number
  percentage: number
  subtree?: TreeNode
  total?: number
}

interface DecisionTreeProps {
  decisionTrees: { [variable: string]: { [value: string]: TreeNode } }
  filename: string
  pdfBase64?: string
  pdfGenerated?: boolean
  minPopulationThreshold?: number
  variablesToExplain?: string[]
  selectedColumnValues?: { [columnName: string]: any[] }
  treatmentMode?: 'independent' | 'together'
  basePopulation?: number
}

// Interface pour les feuilles finales filtrées
interface FilteredLeaf {
  path: string[]
  count: number
  percentage: number
  targetVariable: string
  targetValue: string
  total?: number
}

export default function DecisionTree({ decisionTrees, filename, pdfBase64, pdfGenerated, minPopulationThreshold, variablesToExplain, selectedColumnValues, treatmentMode, basePopulation }: DecisionTreeProps) {
  const [expandedNodes, setExpandedNodes] = useState<{ [key: string]: boolean }>({})
  const [expandedTrees, setExpandedTrees] = useState<{ [key: string]: boolean }>({})
  const [minPercentage, setMinPercentage] = useState<string>('')
  const [filteredLeaves, setFilteredLeaves] = useState<FilteredLeaf[]>([])
  const [showFilteredResults, setShowFilteredResults] = useState(false)

  // Fonction pour formater les valeurs
  const formatValue = (value: string): string => {
    // Si c'est une valeur "Combined", la remplacer par les modalités avec leurs noms de variables
    if (value.toLowerCase().includes('combined')) {
      if (selectedColumnValues) {
        // Récupérer les modalités sélectionnées avec leurs noms de variables
        const modalitiesWithNames: string[] = []
        
        // Utiliser toutes les variables qui ont des modalités sélectionnées
        const allVariables = Object.keys(selectedColumnValues)
        
        allVariables.forEach(varName => {
          if (selectedColumnValues[varName] && selectedColumnValues[varName].length > 0) {
            // Pour chaque modalité de cette variable, créer "nomVariable=modalité"
            selectedColumnValues[varName].forEach(modality => {
              modalitiesWithNames.push(`${varName}=${modality}`)
            })
          }
        })
        
        if (modalitiesWithNames.length > 0) {
          return modalitiesWithNames.join(' + ')
        }
      }
      return 'Modalités combinées'
    }
    return value
  }

  // Réinitialiser le filtre quand l'arbre change
  useEffect(() => {
    setMinPercentage('')
    setFilteredLeaves([])
    setShowFilteredResults(false)
  }, [decisionTrees])

  const toggleNode = (nodeKey: string) => {
    setExpandedNodes(prev => ({
      ...prev,
      [nodeKey]: !prev[nodeKey]
    }))
  }

  const toggleTree = (treeKey: string) => {
    setExpandedTrees(prev => ({
      ...prev,
      [treeKey]: !prev[treeKey]
    }))
  }

  // Fonction pour extraire toutes les feuilles finales avec leurs chemins
  const extractAllLeaves = (): FilteredLeaf[] => {
    const leaves: FilteredLeaf[] = []
    
    Object.entries(decisionTrees).forEach(([targetVar, targetTrees]) => {
      Object.entries(targetTrees).forEach(([targetValue, tree]) => {
        const treeLeaves = extractLeavesFromNode(tree, [], targetVar, targetValue)
        leaves.push(...treeLeaves)
      })
    })
    

    return leaves
  }

  // Fonction récursive pour extraire les feuilles d'un nœud
  const extractLeavesFromNode = (
    node: TreeNode, 
    currentPath: string[], 
    targetVar: string, 
    targetValue: string
  ): FilteredLeaf[] => {
    const leaves: FilteredLeaf[] = []
    
    if (node.type === 'leaf') {
      // Extraire le pourcentage de la feuille finale
      const leafPercentage = parseFloat(node.message?.match(/\(([\d.]+)%\)/)?.[1] || '0')
      const leafCount = parseInt(node.message?.match(/(\d+)/)?.[1] || '0')
      
      if (leafPercentage > 0) {
        leaves.push({
          path: [...currentPath],
          count: leafCount,
          percentage: leafPercentage,
          targetVariable: targetVar,
          targetValue: targetValue
        })
      }
      return leaves
    }

    if (node.type === 'multi_node' && node.nodes) {
      Object.entries(node.nodes).forEach(([varName, varNode]) => {
        const subLeaves = extractLeavesFromNode(varNode, [...currentPath, varName], targetVar, targetValue)
        leaves.push(...subLeaves)
      })
      return leaves
    }

    if (node.branches) {
      Object.entries(node.branches).forEach(([branchValue, branchData]) => {
        const newPath = [...currentPath, `${node.variable} = ${branchValue}`]
        
        // Si c'est une feuille finale (pas de sous-arbre), utiliser les données de la branche
        if (!branchData.subtree) {
          // Ignorer les branches avec 0 effectif
          if (branchData.count > 0) {
            leaves.push({
              path: [...newPath],
              count: branchData.count,
              percentage: branchData.percentage,
              targetVariable: targetVar,
              targetValue: targetValue,
              total: (branchData as any).total
            })
          }
        } else {
          // Sinon, continuer la récursion
          const subLeaves = extractLeavesFromNode(branchData.subtree, newPath, targetVar, targetValue)
          leaves.push(...subLeaves)
        }
      })
    }
    
    return leaves
  }

  // Fonction pour filtrer les feuilles par pourcentage minimum
  const filterLeavesByPercentage = () => {
    const percentage = parseFloat(minPercentage)
    if (isNaN(percentage) || percentage < 0 || percentage > 100) {
      alert('Veuillez saisir un pourcentage valide entre 0 et 100')
      return
    }

    const allLeaves = extractAllLeaves()

    
    // Filtrer par pourcentage ET par effectif minimum (si défini)
    const filtered = allLeaves
      .filter(leaf => {
        const meetsPercentage = leaf.percentage >= percentage
        const meetsPopulation = minPopulationThreshold ? leaf.count >= minPopulationThreshold : true

        return meetsPercentage && meetsPopulation
      })
      .sort((a, b) => b.percentage - a.percentage) // Ordre décroissant


    setFilteredLeaves(filtered)
    setShowFilteredResults(true)
  }

  // Fonction pour réinitialiser le filtre
  const resetFilter = () => {
    setMinPercentage('')
    setFilteredLeaves([])
    setShowFilteredResults(false)
  }

  // Fonction downloadPDF supprimée - remplacée par PDFGenerator

  const renderTreeNode = (node: TreeNode, level: number = 0, nodeKey: string = '') => {
    const indent = level * 40
    const isExpanded = expandedNodes[nodeKey] || false

    if (node.type === 'leaf') {
      return (
        <div 
          key={nodeKey}
          className="flex items-center py-2 text-gray-600"
          style={{ marginLeft: `${indent}px` }}
        >
          <span className="text-green-500 mr-2">🍃</span>
          <span className="text-sm">{node.message || 'Fin de branche'}</span>
        </div>
      )
    }

    if (node.type === 'multi_node') {
      // Nouveau type : arbre avec plusieurs nœuds
      return (
        <div key={nodeKey} className="mb-6">
          <div 
            className="flex items-center py-3 cursor-pointer hover:bg-green-50 rounded-lg px-3 border-2 border-green-200 bg-green-50"
            onClick={() => toggleNode(nodeKey)}
            style={{ marginLeft: `${indent}px` }}
          >
            <span className="text-green-600 mr-2">🌳</span>
            <span className="font-medium text-green-800">Arbre complet avec {Object.keys(node.nodes || {}).length} variables</span>
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-green-600 ml-auto" />
            ) : (
              <ChevronRight className="h-4 w-4 text-green-600 ml-auto" />
            )}
          </div>
          
          {isExpanded && node.nodes && (
            <div className="mt-3">
              {Object.entries(node.nodes).map(([varName, varNode]) => (
                <div key={`${nodeKey}-${varName}`} className="mb-4">
                  {renderTreeNode(varNode, level + 1, `${nodeKey}-${varName}`)}
                </div>
              ))}
            </div>
          )}
        </div>
      )
    }

    if (!node.variable || !node.branches) {
      return null
    }

    const branchEntries = Object.entries(node.branches)
    const leftBranches = branchEntries.slice(0, Math.ceil(branchEntries.length / 2))
    const rightBranches = branchEntries.slice(Math.ceil(branchEntries.length / 2))

    return (
      <div key={nodeKey} className="mb-4">
        {/* Nœud principal avec ligne de connexion */}
        <div 
          className="flex items-center py-3 cursor-pointer hover:bg-blue-50 rounded-lg px-3 border-2 border-blue-200 bg-blue-50"
          onClick={() => toggleNode(nodeKey)}
          style={{ marginLeft: `${indent}px` }}
        >
          {isExpanded ? (
            <ChevronDown className="h-5 w-5 text-blue-600 mr-3" />
          ) : (
            <ChevronRight className="h-5 w-5 text-blue-600 mr-3" />
          )}
          <span className="text-blue-500 mr-3 text-xl">🌿</span>
          <div className="flex-1">
            <span className="font-bold text-blue-800 text-lg">{node.variable}</span>
            <span className="text-sm text-blue-600 ml-3">
              (Écart-type: {node.variance})
            </span>
          </div>
        </div>

        {/* Branches avec structure gauche/droite */}
        {isExpanded && (
          <div className="ml-8">
            {/* Ligne de connexion verticale */}
            <div className="w-0.5 h-4 bg-blue-300 ml-6"></div>
            
            {/* Container pour les branches gauche et droite */}
            <div className="flex">
              {/* Branches gauches */}
              <div className="flex-1 pr-4">
                {leftBranches.map(([branchValue, branchData], index) => {
                  const branchKey = `${nodeKey}-${branchValue}`
                  
                  // Vérifier si la branche a un effectif suffisant (sur le nombre de cas de la branche)
                  const branchTotal = (branchData.total ?? branchData.count)
                  if (branchTotal === 0 || (minPopulationThreshold && minPopulationThreshold > 0 && branchTotal < minPopulationThreshold)) {
                    return (
                      <div key={branchKey} className="mb-3">
                        {/* Ligne de connexion horizontale gauche */}
                        <div className="flex items-center">
                          <div className="w-8 h-0.5 bg-blue-300"></div>
                          <div className="w-2 h-0.5 bg-blue-300 transform rotate-45 origin-left"></div>
                        </div>
                        
                        {/* Branche arrêtée - population insuffisante */}
                        <div className="ml-6 p-3 bg-red-50 rounded-lg border border-red-200">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold text-red-800 text-lg">{branchValue}</span>
                            <div className="text-right">
                              <div className="text-2xl font-bold text-red-600">{branchData.count}</div>
                              <div className="text-sm text-red-600">({branchData.percentage}%)</div>
                            </div>
                          </div>
                          <div className="text-center py-2">
                            <span className="text-sm text-red-600 font-medium">
                              [ARRET] Branche arrêtée - Population insuffisante ({branchTotal} &lt; {minPopulationThreshold})
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  }
                  
                  return (
                    <div key={branchKey} className="mb-3">
                      {/* Ligne de connexion horizontale gauche */}
                      <div className="flex items-center">
                        <div className="w-8 h-0.5 bg-blue-300"></div>
                        <div className="w-2 h-0.5 bg-blue-300 transform rotate-45 origin-left"></div>
                      </div>
                      
                      {/* Contenu de la branche */}
                      <div className="ml-6 p-3 bg-purple-50 rounded-lg border border-purple-200">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <span className="font-semibold text-purple-800 text-lg">{branchValue}</span>
                            {basePopulation ? (
                              <>
                                <div className="text-xs text-gray-500 mt-1">{branchData.total ?? branchData.count} cas</div>
                                <div className="text-xs text-gray-500">{Math.round(((branchData.total ?? branchData.count) / basePopulation) * 10000) / 100}% de la population</div>
                              </>
                            ) : null}
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-purple-700">{branchData.count} respectent les modalités à expliquer</div>
                            <div className="text-sm text-purple-600">({branchData.percentage}%)</div>
                          </div>
                        </div>
                        
                        {/* Sous-arbre récursif */}
                        {branchData.subtree && (
                          <div className="mt-3 pt-3 border-t border-purple-200">
                            {renderTreeNode(branchData.subtree, level + 1, branchKey)}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Branches droites */}
              <div className="flex-1 pl-4">
                {rightBranches.map(([branchValue, branchData], index) => {
                  const branchKey = `${nodeKey}-${branchValue}`
                  
                  // Vérifier si la branche a un effectif suffisant (sur le nombre de cas de la branche)
                  const branchTotal = (branchData.total ?? branchData.count)
                  if (branchTotal === 0 || (minPopulationThreshold && minPopulationThreshold > 0 && branchTotal < minPopulationThreshold)) {
                    return (
                      <div key={branchKey} className="mb-3">
                        {/* Ligne de connexion horizontale droite */}
                        <div className="flex items-center justify-end">
                          <div className="w-2 h-0.5 bg-blue-300 transform -rotate-45 origin-right"></div>
                          <div className="w-8 h-0.5 bg-blue-300"></div>
                        </div>
                        
                        {/* Branche arrêtée - population insuffisante */}
                        <div className="mr-6 p-3 bg-red-50 rounded-lg border border-red-200">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold text-red-800 text-lg">{branchValue}</span>
                            <div className="text-right">
                              <div className="text-2xl font-bold text-red-600">{branchData.count}</div>
                              <div className="text-sm text-red-600">({branchData.percentage}%)</div>
                            </div>
                          </div>
                          <div className="text-center py-2">
                            <span className="text-sm text-red-600 font-medium">
                              [ARRET] Branche arrêtée - Population insuffisante ({branchTotal} &lt; {minPopulationThreshold})
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  }
                  
                  return (
                    <div key={branchKey} className="mb-3">
                      {/* Ligne de connexion horizontale droite */}
                      <div className="flex items-center justify-end">
                        <div className="w-2 h-0.5 bg-blue-300 transform -rotate-45 origin-right"></div>
                        <div className="w-8 h-0.5 bg-blue-300"></div>
                      </div>
                      
                      {/* Contenu de la branche */}
                      <div className="mr-6 p-3 bg-purple-50 rounded-lg border border-purple-200">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <span className="font-semibold text-purple-800 text-lg">{branchValue}</span>
                            {basePopulation ? (
                              <>
                                <div className="text-xs text-gray-500 mt-1">{branchData.total ?? branchData.count} cas</div>
                                <div className="text-xs text-gray-500">{Math.round(((branchData.total ?? branchData.count) / basePopulation) * 10000) / 100}% de la population</div>
                              </>
                            ) : null}
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-purple-700">{branchData.count} respectent les modalités à expliquer</div>
                            <div className="text-sm text-purple-600">({branchData.percentage}%)</div>
                          </div>
                        </div>
                        
                        {/* Sous-arbre récursif */}
                        {branchData.subtree && (
                          <div className="mt-3 pt-3 border-t border-purple-200">
                            {renderTreeNode(branchData.subtree, level + 1, branchKey)}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  const renderTree = (targetVar: string, targetTrees: { [value: string]: TreeNode }) => {
    const isTreeExpanded = expandedTrees[targetVar] || false

    // Déterminer le titre à afficher
    const getTitle = () => {
      // En mode ensemble, afficher toutes les variables
      if (targetTrees['Combined']) {
        const allVariables = Object.keys(selectedColumnValues || {}).filter(varName => 
          selectedColumnValues?.[varName] && selectedColumnValues[varName].length > 0
        )
        return allVariables.join(' + ')
      }
      // Mode indépendant : afficher juste le nom de la variable
      return targetVar
    }

    const displayTrees = targetTrees

    return (
      <Card key={targetVar} className="mb-6 border-2 border-green-200">
        <CardHeader 
          className="cursor-pointer hover:bg-green-50"
          onClick={() => toggleTree(targetVar)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <TreePine className="h-6 w-6 text-green-600 mr-3" />
              <div>
                <CardTitle className="text-xl text-green-800">
                  🎯 Variable à expliquer: {getTitle()}
                </CardTitle>
                <p className="text-sm text-green-600">
                  {Object.keys(displayTrees).length} valeur(s) à analyser
                </p>
              </div>
            </div>
            {isTreeExpanded ? (
              <ChevronDown className="h-6 w-6 text-green-600" />
            ) : (
              <ChevronRight className="h-6 w-6 text-green-600" />
            )}
          </div>
        </CardHeader>

        {isTreeExpanded && (
          <CardContent className="pt-0">
            <div className="space-y-6">
              {Object.entries(displayTrees).map(([targetValue, tree]) => (
                <div key={targetValue} className="border-l-4 border-green-300 pl-4">
                  <h4 className="text-lg font-semibold text-green-700 mb-3">
                    📊 Valeur: {formatValue(targetValue)}
                    {typeof basePopulation === 'number' && basePopulation > 0 && (
                      <span className="ml-2 text-gray-600">— {basePopulation} lignes</span>
                    )}
                  </h4>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    {renderTreeNode(tree, 0, `${targetVar}-${targetValue}`)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* En-tête avec bouton de téléchargement PDF */}
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <TreePine className="h-8 w-8 text-green-600 mr-3" />
          <div>
            <h2 className="text-2xl font-bold text-green-800">
              🌳 Arbre de Décision
            </h2>
            <p className="text-gray-600">
              Analyse des variables explicatives pour chaque valeur des variables à expliquer
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => { window.location.href = '/decision-tree/chart' }}
            className="border-blue-300 text-blue-700 hover:bg-blue-50"
          >
            👁️ Voir le dessin (Chart)
          </Button>
        <PDFGenerator
          decisionTrees={decisionTrees}
          filename={filename}
          variablesToExplain={variablesToExplain || []}
          selectedColumnValues={selectedColumnValues || {}}
          treatmentMode={treatmentMode || 'independent'}
        />
        </div>
      </div>

      {/* PDF généré côté client avec Chart.js */}

      {/* Arbres de décision */}
      <div id="original-tree" className="space-y-4">
        {Object.entries(decisionTrees).map(([targetVar, targetTrees]) => 
          renderTree(targetVar, targetTrees)
        )}
      </div>

      {/* Message si aucun arbre */}
      {Object.keys(decisionTrees).length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <TreePine className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <p>Aucun arbre de décision disponible</p>
        </div>
      )}

      {/* Section de filtrage par pourcentage */}
      {Object.keys(decisionTrees).length > 0 && (
        <Card className="border-2 border-purple-200 bg-purple-50">
          <CardHeader>
            <div className="flex items-center">
              <Filter className="h-6 w-6 text-purple-600 mr-3" />
              <CardTitle className="text-xl text-purple-800">
                🔍 Filtrage par Pourcentage Minimum
              </CardTitle>
            </div>
            <p className="text-sm text-purple-600">
              Affichez uniquement les branches dont le pourcentage de la feuille finale est supérieur ou égal au seuil spécifié
              {minPopulationThreshold && (
                <span className="block mt-1 text-blue-600 font-medium">
                  📊 Seuil d'effectif actuel : minimum {minPopulationThreshold} patients par branche
                </span>
              )}
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 mb-4">
              <div className="flex-1">
                <label htmlFor="minPercentage" className="block text-sm font-medium text-purple-700 mb-2">
                  Pourcentage minimum (%)
                </label>
                <input
                  id="minPercentage"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={minPercentage}
                  onChange={(e) => setMinPercentage(e.target.value)}
                  placeholder="Ex: 5.0"
                  className="w-full px-3 py-2 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={filterLeavesByPercentage}
                  disabled={!minPercentage}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Filtrer
                </Button>
                <Button 
                  onClick={resetFilter}
                  variant="outline"
                  className="border-purple-300 text-purple-700 hover:bg-purple-50"
                >
                  Réinitialiser
                </Button>
              </div>
            </div>

            {/* Résultats filtrés */}
            {showFilteredResults && (
              <div className="mt-6">
                <div className="flex items-center mb-4">
                  <TrendingUp className="h-5 w-5 text-purple-600 mr-2" />
                  <h3 className="text-lg font-semibold text-purple-800">
                    📊 Taux minimum (≥ {minPercentage}%) - {filteredLeaves.length} résultat(s)
                  </h3>
                  {minPopulationThreshold && (
                    <span className="ml-3 text-sm text-blue-600 bg-blue-100 px-2 py-1 rounded">
                      Effectif ≥ {minPopulationThreshold}
                    </span>
                  )}
                </div>
                
                {filteredLeaves.length > 0 ? (
                  <div className="space-y-3">
                    {filteredLeaves.map((leaf, index) => (
                      <div key={index} className="bg-white p-4 rounded-lg border border-purple-200 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center">
                            <span className="text-purple-600 font-semibold mr-2">
                              #{index + 1}
                            </span>
                            <span className="text-lg font-bold text-purple-800">
                              {leaf.percentage.toFixed(2)}% - {leaf.count} cas avec {formatValue(leaf.targetValue)} sur {(leaf.total ?? (leaf.percentage > 0 ? Math.round(leaf.count / (leaf.percentage / 100)) : leaf.count))} cas de cette branche
                            </span>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-gray-600">
                              Variable: <span className="font-semibold">{leaf.targetVariable}</span>
                            </div>
                            <div className="text-sm text-gray-600">
                              Valeur: <span className="font-semibold">{leaf.targetValue}</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="mb-3">
                          <div className="text-sm text-gray-600 mb-1">
                            <strong>Chemin de la branche:</strong>
                          </div>
                          <div className="bg-gray-50 p-3 rounded border-l-4 border-purple-300">
                            {leaf.path.length > 0 ? (
                              <div className="space-y-1">
                                {leaf.path.map((step, stepIndex) => (
                                  <div key={stepIndex} className="flex items-center">
                                    <span className="text-purple-500 mr-2">→</span>
                                    <span className="text-sm text-gray-700">{step}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-gray-500 italic">Chemin direct</span>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">
                            <strong>Nombre de cas:</strong> {leaf.count}
                          </span>
                          <span className="text-purple-600 font-semibold">
                            {leaf.percentage.toFixed(2)}% avec {formatValue(leaf.targetValue)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-gray-500">
                    <Filter className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-lg">Aucune branche ne correspond au critère de {minPercentage}%</p>
                    <p className="text-sm">Essayez de réduire le pourcentage minimum</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
