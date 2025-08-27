"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight, Download, TreePine } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

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
}

interface DecisionTreeProps {
  decisionTrees: { [variable: string]: { [value: string]: TreeNode } }
  filename: string
  pdfBase64?: string
  pdfGenerated?: boolean
}

export default function DecisionTree({ decisionTrees, filename, pdfBase64, pdfGenerated }: DecisionTreeProps) {
  const [expandedNodes, setExpandedNodes] = useState<{ [key: string]: boolean }>({})
  const [expandedTrees, setExpandedTrees] = useState<{ [key: string]: boolean }>({})

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

  const downloadPDF = () => {
    if (pdfBase64) {
      const byteCharacters = atob(pdfBase64)
      const byteNumbers = new Array(byteCharacters.length)
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
      }
      const byteArray = new Uint8Array(byteNumbers)
      const blob = new Blob([byteArray], { type: 'application/pdf' })
      
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `arbre_decision_${filename.replace('.xlsx', '').replace('.xls', '')}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    }
  }

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
                          <span className="font-semibold text-purple-800 text-lg">{branchValue}</span>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-purple-600">{branchData.count}</div>
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
                          <span className="font-semibold text-purple-800 text-lg">{branchValue}</span>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-purple-600">{branchData.count}</div>
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
                  🎯 Variable à expliquer: {targetVar}
                </CardTitle>
                <p className="text-sm text-green-600">
                  {Object.keys(targetTrees).length} valeur(s) à analyser
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
              {Object.entries(targetTrees).map(([targetValue, tree]) => (
                <div key={targetValue} className="border-l-4 border-green-300 pl-4">
                  <h4 className="text-lg font-semibold text-green-700 mb-3">
                    📊 Valeur: {targetValue}
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
        
        {pdfGenerated && pdfBase64 && (
          <Button 
            onClick={downloadPDF}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <Download className="h-4 w-4 mr-2" />
            Télécharger PDF
          </Button>
        )}
      </div>

      {/* Indicateur de statut PDF */}
      {pdfGenerated !== undefined && (
        <div className={`p-3 rounded-lg ${
          pdfGenerated 
            ? 'bg-green-100 border border-green-300 text-green-800' 
            : 'bg-red-100 border border-red-300 text-red-800'
        }`}>
          <div className="flex items-center">
            {pdfGenerated ? (
              <>
                <span className="text-green-600 mr-2">✅</span>
                <span>PDF généré avec succès - Disponible au téléchargement</span>
              </>
            ) : (
              <>
                <span className="text-red-600 mr-2">❌</span>
                <span>Erreur lors de la génération du PDF</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Arbres de décision */}
      <div className="space-y-4">
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
    </div>
  )
}
