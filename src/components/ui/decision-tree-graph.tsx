"use client"

import React, { useMemo } from "react"

interface BranchData {
  count: number
  percentage: number
  subtree?: TreeNode
}

interface TreeNode {
  type: 'node' | 'leaf' | 'multi_node'
  variable?: string
  variance?: number
  branches?: { [key: string]: BranchData }
  nodes?: { [key: string]: TreeNode } // multi_node
  message?: string
}

interface DecisionTreeGraphProps {
  treeData: TreeNode
  width?: number
  height?: number
  title?: string
}

type PositionedNode = {
  id: string
  x: number
  y: number
  label: string
  type: 'node' | 'leaf'
}

type PositionedLink = {
  fromId: string
  toId: string
  label: string
  targetCount?: number
  total?: number
  percentage?: number
}

export default function DecisionTreeGraph({ treeData, width = 1200, height = 800, title }: DecisionTreeGraphProps) {
  const { nodes, links, svgWidth, svgHeight } = useMemo(() => {
    const NODE_W = 180
    const NODE_H = 50
    const X_GAP = 240
    const Y_GAP = 80

    const nodes: PositionedNode[] = []
    const links: PositionedLink[] = []

    // Compute subtree sizes for vertical placement
    const computeSize = (node?: TreeNode | null): number => {
      if (!node) return 1
      if (node.type === 'leaf') return 1
      if (node.branches && Object.keys(node.branches).length > 0) {
        const sizes = Object.values(node.branches).map(b => computeSize(b?.subtree ?? null))
        return Math.max(1, sizes.reduce((a, b) => a + b, 0))
      }
      if (node.nodes && Object.keys(node.nodes).length > 0) {
        const sizes = Object.values(node.nodes).map(n => computeSize(n))
        return Math.max(1, sizes.reduce((a, b) => a + b, 0))
      }
      return 1
    }

    const totalLeaves = computeSize(treeData)
    const svgHeight = Math.max(height, totalLeaves * (NODE_H + Y_GAP))

    let currentY = 0

    const place = (node?: TreeNode | null, depth: number = 0, parentId?: string, incomingLabel?: string): { centerY: number, id: string } => {
      const id = Math.random().toString(36).slice(2)
      let centerY: number

      if (!node || node.type === 'leaf' || ((!node.branches || Object.keys(node.branches).length === 0) && (!node.nodes || Object.keys(node.nodes).length === 0))) {
        centerY = currentY + NODE_H / 2
        currentY += NODE_H + Y_GAP
      } else {
        const childCenters: number[] = []
        if (node.branches && Object.keys(node.branches).length > 0) {
          for (const [val, br] of Object.entries(node.branches)) {
            const pct = typeof br?.percentage === 'number' ? br.percentage : 0
            const cnt = typeof br?.count === 'number' ? br.count : 0
            const tot = (br as any)?.total ?? cnt
            const child = br?.subtree ?? { type: 'leaf', message: `${tot} (${pct.toFixed(1)}%)` }
            const childPlaced = place(child, depth + 1, id, String(val))
            childCenters.push(childPlaced.centerY)
            links.push({ fromId: id, toId: childPlaced.id, label: String(val), targetCount: cnt, total: tot, percentage: pct })
          }
        } else if (node.nodes && Object.keys(node.nodes).length > 0) {
          for (const [key, child] of Object.entries(node.nodes)) {
            const childPlaced = place(child, depth + 1, id, key)
            childCenters.push(childPlaced.centerY)
            links.push({ fromId: id, toId: childPlaced.id, label: key })
          }
        }
        centerY = childCenters.length > 0 ? (Math.min(...childCenters) + Math.max(...childCenters)) / 2 : (currentY + NODE_H / 2)
      }

      const x = 40 + depth * X_GAP
      const y = Math.max(20, centerY - NODE_H / 2)

      const label = (!node || node.type === 'leaf')
        ? ((node && node.message) || 'Feuille')
        : (node.variable || 'Nœud')

      nodes.push({ id, x, y, label, type: (!node || node.type === 'leaf') ? 'leaf' : 'node' })
      return { centerY, id }
    }

    place(treeData, 0)
    const maxDepth = Math.max(...nodes.map(n => Math.round((n.x - 40) / X_GAP)))
    const svgWidth = Math.max(width, 40 + (maxDepth + 1) * X_GAP + NODE_W + 60)
    return { nodes, links, svgWidth, svgHeight }
  }, [treeData, width, height])

  return (
    <div className="bg-white rounded-lg border p-4 overflow-auto" style={{ width: width, height: height }}>
      {title && <h3 className="text-lg font-bold mb-3 text-slate-800">{title}</h3>}
      <svg width={svgWidth} height={svgHeight}>
        {/* links */}
        {links.map((l, idx) => {
          const from = nodes.find(n => n.id === l.fromId)!
          const to = nodes.find(n => n.id === l.toId)!
          const x1 = from.x + 180
          const y1 = from.y + 25
          const x2 = to.x
          const y2 = to.y + 25
          const mx = (x1 + x2) / 2
          return (
            <g key={idx}>
              <path d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`} stroke="#94a3b8" fill="none"/>
              <text x={mx} y={(y1 + y2) / 2 - 8} fill="#475569" fontSize={12} textAnchor="middle">{l.label}</text>
              {l.total !== undefined && (
                <>
                  <text x={mx} y={(y1 + y2) / 2 + 6} fill="#0f172a" fontSize={11} textAnchor="middle">{`${l.targetCount ?? 0}/${l.total}`}</text>
                  <text x={mx} y={(y1 + y2) / 2 + 18} fill="#64748b" fontSize={10} textAnchor="middle">{`${(l.percentage ?? 0).toFixed(2)}%`}</text>
                </>
              )}
            </g>
          )
        })}
        {/* nodes */}
        {nodes.map((n, idx) => (
          <g key={idx}>
            <rect x={n.x} y={n.y} width={180} height={50} rx={8} ry={8}
              fill={n.type === 'leaf' ? '#dcfce7' : '#e0f2fe'} stroke={n.type === 'leaf' ? '#16a34a' : '#0284c7'} />
            <text x={n.x + 90} y={n.y + 29} textAnchor="middle" fontSize={13} fill="#0f172a">{n.label}</text>
          </g>
        ))}
      </svg>
    </div>
  )
}


