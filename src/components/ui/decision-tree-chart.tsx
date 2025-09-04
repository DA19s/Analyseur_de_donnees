"use client"

import React from 'react'

interface TreeNode {
  type: 'node' | 'leaf' | 'multi_node'
  variable?: string
  variance?: number
  branches?: { [key: string]: BranchData }
  path?: string[]
  message?: string
  nodes?: { [key: string]: TreeNode }
}

interface BranchData {
  count: number
  percentage: number
  subtree?: TreeNode
}

interface DecisionTreeChartProps {
  treeData: TreeNode
  title: string
  width?: number
  height?: number
}

export default function DecisionTreeChart({ treeData, title, width = 800, height = 600 }: DecisionTreeChartProps) {
  // Version simplifiée - affiche juste un résumé textuel de l'arbre
  const renderTreeSummary = (node: TreeNode, level: number = 0): string[] => {
    const lines: string[] = []
    const indent = '  '.repeat(level)
    
    if (node.type === 'leaf') {
      lines.push(`${indent}📊 Feuille finale: ${node.message || 'Résultat'}`)
    } else if (node.type === 'multi_node' && node.nodes) {
      lines.push(`${indent}🔀 Nœud multiple`)
      Object.entries(node.nodes).forEach(([key, childNode]) => {
        lines.push(`${indent}  └─ ${key}:`)
        lines.push(...renderTreeSummary(childNode, level + 2))
      })
    } else if (node.branches) {
      lines.push(`${indent}🌳 ${node.variable || 'Nœud de décision'}`)
      Object.entries(node.branches).forEach(([value, branch]) => {
        lines.push(`${indent}  ├─ ${value} (${branch.count} cas, ${branch.percentage.toFixed(1)}%)`)
        if (branch.subtree) {
          lines.push(...renderTreeSummary(branch.subtree, level + 2))
        }
      })
    }
    
    return lines
  }

  const treeLines = renderTreeSummary(treeData)

  return (
    <div className="w-full bg-white rounded-lg border p-4" style={{ width: width, height: height }}>
      <h3 className="text-lg font-bold mb-4 text-center">{title}</h3>
      <div className="bg-gray-50 p-4 rounded-lg font-mono text-sm overflow-auto" style={{ height: height - 80 }}>
        {treeLines.map((line, index) => (
          <div key={index} className="text-gray-700">
            {line}
          </div>
        ))}
      </div>
    </div>
  )
}
