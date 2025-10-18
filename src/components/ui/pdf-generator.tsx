"use client"

import React, { useRef } from 'react'
import jsPDF from 'jspdf'
import DecisionTreeChart from './decision-tree-chart'

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

interface PDFGeneratorProps {
  decisionTrees: { [variable: string]: { [value: string]: TreeNode } }
  filename: string
  variablesToExplain: string[]
  selectedColumnValues: { [columnName: string]: any[] }
  treatmentMode: 'independent' | 'together'
}

export default function PDFGenerator({ 
  decisionTrees, 
  filename, 
  variablesToExplain, 
  selectedColumnValues,
  treatmentMode 
}: PDFGeneratorProps) {
  const chartRefs = useRef<{ [key: string]: HTMLDivElement | null }>({})

  // Rendu fiable sans html2canvas: on dessine l'arbre sur un canvas
  const renderTreeSummary = (node: TreeNode, level: number = 0): string[] => {
    const lines: string[] = []
    const indent = '  '.repeat(level)
    if (node.type === 'leaf') {
      lines.push(`${indent}Feuille finale: ${node.message || ''}`)
    } else if (node.type === 'multi_node' && node.nodes) {
      lines.push(`${indent}Noeud multiple`)
      Object.entries(node.nodes).forEach(([key, childNode]) => {
        lines.push(`${indent}  └─ ${key}:`)
        lines.push(...renderTreeSummary(childNode, level + 2))
      })
    } else if (node.branches) {
      lines.push(`${indent}${node.variable || 'Nœud de décision'}`)
      Object.entries(node.branches).forEach(([value, branch]) => {
        lines.push(`${indent}  ├─ ${value} (${branch.count} cas, ${branch.percentage.toFixed(1)}%)`)
        if (branch.subtree) {
          lines.push(...renderTreeSummary(branch.subtree, level + 2))
        }
      })
    }
    return lines
  }

  const drawWrappedText = (
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number
  ) => {
    const words = text.split(' ')
    let line = ''
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' '
      const { width } = ctx.measureText(testLine)
      if (width > maxWidth && n > 0) {
        ctx.fillText(line, x, y)
        line = words[n] + ' '
        y += lineHeight
      } else {
        line = testLine
      }
    }
    ctx.fillText(line, x, y)
    return y
  }

  const renderTreeToCanvas = (treeData: TreeNode, title: string, width = 3000, padding = 60) => {
    const lines = renderTreeSummary(treeData)
    const lineHeight = 42
    const contentHeight = lines.length * lineHeight
    const height = Math.max(800, padding * 2 + 80 + contentHeight)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
    // Fond blanc et styles sûrs
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
    // Titre
    ctx.fillStyle = '#0f172a'
    ctx.font = 'bold 56px Arial, sans-serif'
    ctx.fillText(title, padding, padding + 24)
    // Corps en police standard
    ctx.font = '28px Arial, sans-serif'
    let y = padding + 80
    const maxTextWidth = width - padding * 2
    for (const line of lines) {
      // Coloration simple par type
      const trimmed = line.trim()
      if (/\bTrue\b/.test(trimmed)) {
        ctx.fillStyle = '#16a34a' // vert pour True
      } else if (/\bFalse\b/.test(trimmed)) {
        ctx.fillStyle = '#ef4444' // rouge pour False
      } else if (trimmed.startsWith('Feuille finale')) {
        ctx.fillStyle = '#16a34a' // vert
      } else if (trimmed.startsWith('Noeud multiple')) {
        ctx.fillStyle = '#7c3aed' // violet
      } else if (trimmed.startsWith('├') || trimmed.startsWith('└')) {
        ctx.fillStyle = '#374151' // gris sombre
      } else {
        // Ligne de nœud/variable de haut niveau
        const leadingSpaces = line.length - line.trimStart().length
        ctx.fillStyle = leadingSpaces === 0 ? '#2563eb' : '#111827' // bleu pour niveau 0
      }
      y = drawWrappedText(ctx, line, padding, y, maxTextWidth, lineHeight) + lineHeight
    }
    return canvas
  }

  // Dessin du graphe (boîtes + liens) directement sur canvas pour le PDF
  const renderGraphToCanvas = (treeData: TreeNode, title: string) => {
    // Calcul des positions (reprend la logique du composant SVG)
    const NODE_W = 180
    const NODE_H = 50
    const X_GAP = 240
    const Y_GAP = 80

    type PositionedNode = { id: string; x: number; y: number; label: string; type: 'node' | 'leaf' }
    type PositionedLink = { fromId: string; toId: string; label: string; targetCount?: number; total?: number; percentage?: number }

    const nodes: PositionedNode[] = []
    const links: PositionedLink[] = []

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

    let currentY = 0
    const totalLeaves = computeSize(treeData)
    const padding = 20
    const svgHeight = Math.max(600, totalLeaves * (NODE_H + Y_GAP)) + padding * 2

    const place = (node?: TreeNode | null, depth: number = 0): { centerY: number; id: string } => {
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
            const childPlaced = place(child, depth + 1)
            childCenters.push(childPlaced.centerY)
            links.push({ fromId: id, toId: childPlaced.id, label: String(val), targetCount: cnt, total: tot, percentage: pct })
          }
        } else if (node.nodes && Object.keys(node.nodes).length > 0) {
          for (const [key, child] of Object.entries(node.nodes)) {
            const childPlaced = place(child, depth + 1)
            childCenters.push(childPlaced.centerY)
            links.push({ fromId: id, toId: childPlaced.id, label: key })
          }
        }
        centerY = childCenters.length > 0 ? (Math.min(...childCenters) + Math.max(...childCenters)) / 2 : currentY + NODE_H / 2
      }

      const x = padding + 20 + depth * X_GAP
      const y = Math.max(padding, centerY - NODE_H / 2)
      const label = (!node || node.type === 'leaf') ? ((node && node.message) || 'Feuille') : (node.variable || 'Nœud')
      nodes.push({ id, x, y, label, type: (!node || node.type === 'leaf') ? 'leaf' : 'node' })
      return { centerY, id }
    }

    place(treeData, 0)
    const maxDepth = Math.max(...nodes.map(n => Math.round((n.x - (padding + 20)) / X_GAP)))
    const svgWidth = Math.max(1100, padding * 2 + 20 + (maxDepth + 1) * X_GAP + NODE_W + 60)

    // Dessin canvas
    const canvas = document.createElement('canvas')
    canvas.width = svgWidth
    canvas.height = svgHeight + 60
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D

    // Fond
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Titre
    ctx.fillStyle = '#0f172a'
    ctx.font = 'bold 32px Arial, sans-serif'
    // Remonter davantage le titre du graphe
    ctx.fillText(title, padding, 18)

    // Liens
    ctx.strokeStyle = '#94a3b8'
    ctx.fillStyle = '#475569'
    ctx.font = '12px Arial, sans-serif'
    links.forEach(l => {
      const from = nodes.find(n => n.id === l.fromId)!
      const to = nodes.find(n => n.id === l.toId)!
      const x1 = from.x + NODE_W
      const y1 = from.y + NODE_H / 2
      const x2 = to.x
      const y2 = to.y + NODE_H / 2
      const mx = (x1 + x2) / 2
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.bezierCurveTo(mx, y1, mx, y2, x2, y2)
      ctx.stroke()
      // Etiquettes au milieu des liens (comme le composant SVG)
      // 1) libellé de la branche
      ctx.fillStyle = '#475569'
      ctx.font = '12px Arial, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(l.label, mx, (y1 + y2) / 2 - 8)
      // 2) x/X
      if (typeof l.total !== 'undefined') {
        ctx.fillStyle = '#0f172a'
        ctx.font = '11px Arial, sans-serif'
        ctx.fillText(`${l.targetCount ?? 0}/${l.total}`, mx, (y1 + y2) / 2 + 6)
        // 3) pourcentage
        ctx.fillStyle = '#64748b'
        ctx.font = '10px Arial, sans-serif'
        const pctTxt = `${(l.percentage ?? 0).toFixed(2)}%`
        ctx.fillText(pctTxt, mx, (y1 + y2) / 2 + 18)
      }
    })

    // Nœuds
    nodes.forEach(n => {
      ctx.fillStyle = n.type === 'leaf' ? '#dcfce7' : '#e0f2fe'
      ctx.strokeStyle = n.type === 'leaf' ? '#16a34a' : '#0284c7'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      const r = 8
      const x = n.x
      const y = n.y
      // rectangle arrondi
      ctx.moveTo(x + r, y)
      ctx.lineTo(x + NODE_W - r, y)
      ctx.quadraticCurveTo(x + NODE_W, y, x + NODE_W, y + r)
      ctx.lineTo(x + NODE_W, y + NODE_H - r)
      ctx.quadraticCurveTo(x + NODE_W, y + NODE_H, x + NODE_W - r, y + NODE_H)
      ctx.lineTo(x + r, y + NODE_H)
      ctx.quadraticCurveTo(x, y + NODE_H, x, y + NODE_H - r)
      ctx.lineTo(x, y + r)
      ctx.quadraticCurveTo(x, y, x + r, y)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()

      ctx.fillStyle = '#0f172a'
      ctx.font = '13px Arial, sans-serif'
      const text = n.label
      const tw = ctx.measureText(text).width
      ctx.fillText(text, x + NODE_W / 2 - tw / 2, y + NODE_H / 2 + 4)
    })

    return canvas
  }

  // Récupère toutes les feuilles avec chemin, effectif et pourcentage
  type LeafSummary = { path: string[]; count: number; percentage: number }
  const collectLeafSummaries = (node?: TreeNode | null, path: string[] = []): LeafSummary[] => {
    const leaves: LeafSummary[] = []
    if (!node) {
      return leaves
    }
    if (node.type === 'leaf') {
      // Pas d'info de count/percentage au niveau du nœud; sera comblé par l'appelant
      leaves.push({ path: [...path], count: 0, percentage: 0 })
      return leaves
    }
    if (node.branches && Object.keys(node.branches).length > 0) {
      for (const [value, br] of Object.entries(node.branches)) {
        const nextPath = [...path, `${node.variable || 'variable'} = ${value}`]
        const childLeaves = collectLeafSummaries(br?.subtree ?? null, nextPath)
        if (childLeaves.length === 0) {
          // Branche sans sous-arbre: feuille synthétique
          leaves.push({ path: nextPath, count: br?.count ?? 0, percentage: typeof br?.percentage === 'number' ? br!.percentage : 0 })
        } else {
          // Propager les métriques de la branche aux feuilles terminales
          for (const lf of childLeaves) {
            leaves.push({ path: lf.path, count: br?.count ?? lf.count, percentage: typeof br?.percentage === 'number' ? br!.percentage : lf.percentage })
          }
        }
      }
      return leaves
    }
    if (node.nodes && Object.keys(node.nodes).length > 0) {
      for (const [key, child] of Object.entries(node.nodes)) {
        const nextPath = [...path, key]
        const childLeaves = collectLeafSummaries(child, nextPath)
        leaves.push(...childLeaves)
      }
      return leaves
    }
    // Nœud sans enfants -> feuille
    leaves.push({ path: [...path], count: 0, percentage: 0 })
    return leaves
  }

  // Extraction des feuilles au format similaire à la section "Filtrage par Pourcentage Minimum"
  type FilteredLeafLike = { path: string[]; count: number; percentage: number; total?: number }
  const extractLeavesForPdf = (node?: TreeNode | null, currentPath: string[] = []): FilteredLeafLike[] => {
    const leaves: FilteredLeafLike[] = []
    if (!node) return leaves

    if (node.type === 'leaf') {
      const percentMatch = node.message?.match(/\(([-\d.]+)%\)/)
      const countMatch = node.message?.match(/(\d+)/)
      const leafPercentage = parseFloat(percentMatch?.[1] || '0')
      const leafCount = parseInt(countMatch?.[1] || '0')
      if (leafPercentage > 0) {
        leaves.push({ path: [...currentPath], count: leafCount, percentage: leafPercentage })
      }
      return leaves
    }

    if (node.type === 'multi_node' && node.nodes) {
      for (const [varName, varNode] of Object.entries(node.nodes)) {
        leaves.push(...extractLeavesForPdf(varNode, [...currentPath, varName]))
      }
      return leaves
    }

    if (node.branches) {
      for (const [branchValue, branchData] of Object.entries(node.branches)) {
        const newPath = [...currentPath, `${node.variable} = ${branchValue}`]
        if (!branchData.subtree) {
          if ((branchData?.count ?? 0) > 0) {
            leaves.push({
              path: newPath,
              count: branchData.count,
              percentage: branchData.percentage,
              total: (branchData as any)?.total
            })
          }
        } else {
          leaves.push(...extractLeavesForPdf(branchData.subtree, newPath))
        }
      }
    }
    return leaves
  }

  const isCombined = (val: unknown) => {
    const s = String(val || '')
    return /combine|combined|modalit/i.test(s)
  }

  const formatCombinedDisplay = () => {
    // Si chaque variable a une seule modalité sélectionnée, afficher var=val, sinon le nom de la variable
    const parts: string[] = []
    for (const varName of variablesToExplain) {
      const values = (selectedColumnValues && selectedColumnValues[varName]) || [] as any[]
      if (Array.isArray(values) && values.length === 1) {
        parts.push(`${varName}=${String(values[0])}`)
      } else if (Array.isArray(values) && values.length > 1) {
        const preview = values.slice(0, 2).map((v: any) => String(v)).join(' + ')
        parts.push(`${varName}=${preview}${values.length > 2 ? ' + ...' : ''}`)
      } else {
        parts.push(varName)
      }
    }
    return (parts && parts.length ? parts.join(' + ') : '')
  }

  const generatePDF = async () => {
    try {
      const pdf = new jsPDF('l', 'mm', 'a4')
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      let yPosition = 20

      // Titre principal
      pdf.setFontSize(20)
      pdf.setFont('helvetica', 'bold')
      pdf.text('Rapport d\'Analyse - Arbre de Décision', pageWidth / 2, yPosition, { align: 'center' })
      yPosition += 15

      // Informations du fichier
      pdf.setFontSize(12)
      pdf.setFont('helvetica', 'normal')
      pdf.text(`Fichier: ${filename}`, 20, yPosition)
      yPosition += 8
      pdf.text(`Mode de traitement: ${treatmentMode === 'independent' ? 'Indépendant' : 'Ensemble'}`, 20, yPosition)
      yPosition += 8
      pdf.text(`Variables à expliquer: ${(Array.isArray(variablesToExplain) ? variablesToExplain.join(', ') : '')}`, 20, yPosition)
      yPosition += 8

      // Ajouter sur la page de garde: variables explicatives + résumé échantillon
      try {
        const stored = localStorage.getItem('excelAnalysisData')
        if (stored) {
          const parsed = JSON.parse(stored)
          const varsExpl: string[] = parsed?.decisionTreeData?.variables_explicatives || parsed?.analysisResult?.variables_explicatives || []
          const sample: Record<string, any[]> = parsed?.selectedRemainingData || {}
          const filtered = parsed?.decisionTreeData?.filtered_sample_size || parsed?.analysisResult?.filtered_sample_size
          const original = parsed?.decisionTreeData?.original_sample_size || parsed?.analysisResult?.original_sample_size

          // Variables explicatives
          pdf.text(`Variables explicatives: ${varsExpl && varsExpl.length ? varsExpl.join(', ') : '—'}`, 20, yPosition)
          yPosition += 8

          // Tailles d'échantillon (afficher seulement si filtré différent de total)
          if (typeof original === 'number' && typeof filtered === 'number' && original > 0) {
            if (filtered !== original) {
              const line = `Échantillon: ${filtered} sur ${original} lignes`
              pdf.text(line, 20, yPosition)
              yPosition += 8
            }
          }

          // Échantillon: afficher quelques colonnes sélectionnées (valeurs prévisualisées)
          const sampleEntries = Object.entries(sample).filter(([_, v]) => Array.isArray(v) && v.length > 0)
          if (sampleEntries.length > 0) {
            pdf.setFont('helvetica', 'bold')
            pdf.text(`Échantillon (sélections) – Colonnes filtrées: ${sampleEntries.length}`, 20, yPosition)
            yPosition += 8
            pdf.setFont('helvetica', 'normal')
            const maxLines = 8
            for (let i = 0; i < Math.min(maxLines, sampleEntries.length); i++) {
              const [col, vals] = sampleEntries[i]
              const arr = Array.isArray(vals) ? vals : []
              // Dédupliquer pour obtenir les modalités choisies
              const uniqueVals = Array.from(new Set(arr.map(v => String(v))))
              // Titre de la variable sélectionnée
              pdf.text(`${col} (${uniqueVals.length} modalité(s))`, 24, yPosition)
              yPosition += 6
              // Afficher les modalités "-> variable = valeur"
              const maxVals = 8
              for (const v of uniqueVals.slice(0, maxVals)) {
                pdf.text(`-> ${col} = ${v}`, 30, yPosition)
                yPosition += 6
              }
              if (uniqueVals.length > maxVals) {
                pdf.text('…', 30, yPosition)
                yPosition += 6
              }
            }
          }
        }
      } catch {}

      yPosition += 7

      // Générer les diagrammes pour chaque arbre
      for (const [variable, values] of Object.entries(decisionTrees)) {
        for (const [value, treeData] of Object.entries(values)) {
          // Page titre dédiée (au centre)
          pdf.addPage()
          pdf.setFont('helvetica', 'bold')
          pdf.setFontSize(28)
          let displayVar = variable
          let displayVal = String(value)
          if (treatmentMode === 'together' && isCombined(value)) {
            displayVar = Array.isArray(variablesToExplain) ? variablesToExplain.join(' + ') : ''
            displayVal = formatCombinedDisplay()
          }
          const centeredTitle = `Arbre de décision - ${displayVar} : ${displayVal}`
          const titleY = Math.max(30, pageHeight / 2 - 10)
          pdf.text(centeredTitle, pageWidth / 2, titleY, { align: 'center' })

          // Ne pas afficher l'échantillon sur cette page titre

          // Nouvelle page pour le graphe et le texte détaillé
          pdf.addPage()
          yPosition = 20

          // Capturer le diagramme
          const chartElement = chartRefs.current[`${variable}_${value}`]
          if (chartElement) {
            try {
              // Rendu direct sur canvas (évite oklch et fonds noirs)
              const canvas = renderGraphToCanvas(treeData as any, '')

              // Utiliser JPEG (souvent plus tolérant) et basculer sur PNG en secours
              const imgData = canvas.toDataURL('image/jpeg', 0.95)
              // Calculer des dimensions sûres en unités PDF en conservant le ratio
              const margin = 20
              const maxWidth = pageWidth - margin * 2
              let pdfImgWidth = maxWidth
              let pdfImgHeight = 0
              try {
                const imgProps = (pdf as any).getImageProperties(imgData)
                if (imgProps && imgProps.width && imgProps.height) {
                  const ratio = imgProps.height / imgProps.width
                  pdfImgHeight = pdfImgWidth * ratio
                }
              } catch {}
              // Fallback si getImageProperties échoue
              if (!isFinite(pdfImgHeight) || pdfImgHeight <= 0) {
                const ratio = canvas.height && canvas.width ? canvas.height / canvas.width : 0
                pdfImgHeight = isFinite(ratio) && ratio > 0 ? pdfImgWidth * ratio : maxWidth * 0.6
              }
              
              // Pagination verticale si l'image dépasse la hauteur disponible
              const availableMm = pageHeight - margin * 2
              const scaleMmPerPx = pdfImgHeight / canvas.height
              const slicePxHeight = Math.max(1, Math.floor(availableMm / scaleMmPerPx))

              const addImageSlice = (dataUrl: string, slicePx: number, slicePxH: number) => {
                const sliceMmH = slicePxH * scaleMmPerPx
                // Nouvelle page si nécessaire
                if (yPosition + sliceMmH > pageHeight - margin) {
                  pdf.addPage()
                  yPosition = margin
                }
                try {
                  pdf.addImage(dataUrl, 'JPEG', margin, yPosition, pdfImgWidth, sliceMmH)
                } catch (e) {
                  // Fallback PNG
                  pdf.addImage(dataUrl, 'PNG', margin, yPosition, pdfImgWidth, sliceMmH)
                }
                yPosition += sliceMmH + 4
              }

              if (slicePxHeight >= canvas.height) {
                // Une seule page suffit
                // Remonter légèrement le graphique
                const localY = Math.max(margin, yPosition - 6)
                if (localY + pdfImgHeight > pageHeight - margin) {
                  pdf.addPage()
                  yPosition = margin
                }
                try {
                  pdf.addImage(imgData, 'JPEG', margin, localY, pdfImgWidth, pdfImgHeight)
                } catch (e) {
                  const pngData = canvas.toDataURL('image/png')
                  pdf.addImage(pngData, 'PNG', margin, localY, pdfImgWidth, pdfImgHeight)
                }
                // Mettre à jour yPosition à partir du localY utilisé
                yPosition = localY + pdfImgHeight + 10
              } else {
                // Découper le canvas en tranches verticales
                let offsetPx = 0
                // 1) Première tranche: utiliser l'espace restant sur la page actuelle
                const localY = Math.max(margin, yPosition - 6)
                const firstSlicePxH = Math.max(1, Math.floor((pageHeight - margin - localY) / scaleMmPerPx))
                if (firstSlicePxH > 1) {
                  const hPx = Math.min(firstSlicePxH, canvas.height - offsetPx)
                  if (hPx > 0) {
                    const part = document.createElement('canvas')
                    part.width = canvas.width
                    part.height = hPx
                    const pctx = part.getContext('2d') as CanvasRenderingContext2D
                    pctx.fillStyle = '#ffffff'
                    pctx.fillRect(0, 0, part.width, part.height)
                    pctx.drawImage(canvas, 0, -offsetPx)
                    const partUrl = part.toDataURL('image/jpeg', 0.95)
                    // cette tranche s'insère forcément sur la page actuelle
                    const sliceMmH = hPx * scaleMmPerPx
                    try {
                      pdf.addImage(partUrl, 'JPEG', margin, localY, pdfImgWidth, sliceMmH)
                    } catch (e) {
                      pdf.addImage(partUrl, 'PNG', margin, localY, pdfImgWidth, sliceMmH)
                    }
                    yPosition = localY + sliceMmH + 4
                    offsetPx += hPx
                  }
                }
                // 2) Tranches suivantes: utiliser la hauteur pleine des pages
                while (offsetPx < canvas.height) {
                  if (yPosition > pageHeight - margin) {
                    pdf.addPage()
                    yPosition = margin
                  }
                  const hPx = Math.min(slicePxHeight, canvas.height - offsetPx)
                  const part = document.createElement('canvas')
                  part.width = canvas.width
                  part.height = hPx
                  const pctx = part.getContext('2d') as CanvasRenderingContext2D
                  pctx.fillStyle = '#ffffff'
                  pctx.fillRect(0, 0, part.width, part.height)
                  pctx.drawImage(canvas, 0, -offsetPx)
                  const partUrl = part.toDataURL('image/jpeg', 0.95)
                  addImageSlice(partUrl, offsetPx, hPx)
                  offsetPx += hPx
                }
              }
              // Récapitulatif des branches (texte) – rendu identique au "Filtrage par Pourcentage Minimum" avec seuil 0%
              try {
                let leaves = extractLeavesForPdf(treeData as any, [])
                leaves = leaves.sort((a, b) => (b.percentage || 0) - (a.percentage || 0))

                const pctText = (p: number) => `${(p || 0).toFixed(2)}%`
                const baseMarginLeft = 20
                const baseMarginRight = 20
                const lineHeight = 6
                const maxX = pageWidth - baseMarginRight

                const ensureSpace = (needed = lineHeight) => {
                  if (yPosition + needed > pageHeight - 10) {
                    pdf.addPage()
                    yPosition = 20
                  }
                }

                const addLine = (text: string) => {
                  ensureSpace()
                  let x = baseMarginLeft
                  // Wrap words to avoid overflow/overlap
                  const tokens = text.split(/(\s+)/)
                  tokens.forEach(tok => {
                    const w = pdf.getTextWidth(tok)
                    if (x + w > maxX) {
                      yPosition += lineHeight
                      ensureSpace()
                      x = baseMarginLeft
                    }
                    pdf.text(tok, x, yPosition)
                    x += w
                  })
                  yPosition += lineHeight
                }

                const addColoredLine = (text: string, color: [number, number, number]) => {
                  pdf.setTextColor(color[0], color[1], color[2])
                  addLine(text)
                  pdf.setTextColor(0, 0, 0)
                }

                // Render multiple colored segments with wrapping across page width
                const addRichLine = (segments: Array<{ text: string; color: [number, number, number] }>) => {
                  ensureSpace()
                  let x = baseMarginLeft
                  const writeToken = (txt: string, color: [number, number, number]) => {
                    const parts = txt.split(/(\s+)/)
                    for (const part of parts) {
                      const w = pdf.getTextWidth(part)
                      if (x + w > maxX) {
                        // new line
                        yPosition += lineHeight
                        ensureSpace()
                        x = baseMarginLeft
                      }
                      pdf.setTextColor(color[0], color[1], color[2])
                      pdf.text(part, x, yPosition)
                      x += w
                    }
                  }
                  for (const seg of segments) {
                    writeToken(seg.text, seg.color)
                  }
                  pdf.setTextColor(0, 0, 0)
                  yPosition += lineHeight
                }
                const colorForValue = (val: string): [number, number, number] => {
                  const v = (val || '').toLowerCase().trim()
                  if (v === 'true') return [16, 163, 69]
                  if (v === 'false') return [239, 68, 68]
                  return [234, 88, 12]
                }

                pdf.setFont('helvetica', 'normal')
                pdf.setFontSize(12)
                yPosition += 6
                let idx = 1
                for (const leaf of leaves) {
                  addColoredLine(`#${idx}`, [109, 40, 217])
                  const total = leaf.total ?? (leaf.percentage > 0 ? Math.round((leaf.count || 0) / ((leaf.percentage || 0) / 100)) : (leaf.count || 0))
                  addColoredLine(`${pctText(leaf.percentage)} - ${leaf.count} cas avec ${displayVal} sur ${total} cas de cette branche`, [109, 40, 217])
                  addRichLine([
                    { text: 'Variable: ', color: [55, 65, 81] },
                    { text: `${displayVar}`, color: [37, 99, 235] },
                  ])
                  addRichLine([
                    { text: 'Valeur: ', color: [55, 65, 81] },
                    { text: `${displayVal}`, color: colorForValue(String(displayVal)) },
                  ])
                  addColoredLine('Chemin de la branche:', [55, 65, 81])
                  yPosition += 2
                  for (const step of leaf.path) {
                    const parts = step.split('=')
                    if (parts.length === 2) {
                      const varName = parts[0].trim()
                      const value = parts[1].trim()
                      addRichLine([
                        { text: '   → ', color: [147, 51, 234] },
                        { text: `${varName}`, color: [37, 99, 235] },
                        { text: ' = ', color: [107, 114, 128] },
                        { text: `${value}`, color: colorForValue(value) },
                      ])
                    } else {
                      addColoredLine(`   → ${step}`, [147, 51, 234])
                    }
                  }
                  addRichLine([
                    { text: 'Nombre de cas: ', color: [55, 65, 81] },
                    { text: `${leaf.count}`, color: [55, 65, 81] },
                    { text: '   ', color: [55, 65, 81] },
                    { text: `${pctText(leaf.percentage)} avec ${String(displayVal)}`, color: [109, 40, 217] },
                  ])
                  yPosition += 4
                  idx += 1
                }
              } catch {}

            } catch (error) {
              pdf.setFontSize(10)
              pdf.setFont('helvetica', 'normal')
              pdf.text('Erreur lors de la génération du diagramme', 20, yPosition)
              yPosition += 10
            }
          }
        }
      }

      // Sauvegarder le PDF
      const pdfName = `rapport_arbre_decision_${filename.replace(/\.[^/.]+$/, '')}.pdf`
      pdf.save(pdfName)

    } catch (error) {
      console.error('Erreur lors de la génération du PDF:', error)
      alert('Erreur lors de la génération du PDF. Veuillez réessayer.')
    }
  }

  return (
    <div className="space-y-6">
      {/* Bouton de génération PDF */}
      <div className="text-center">
        <button
          onClick={generatePDF}
          className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
        >
          📄 Générer le rapport PDF
        </button>
      </div>

      {/* Diagrammes rendus hors écran pour la capture (ne pas utiliser display:none) */}
      <div aria-hidden style={{ position: 'absolute', left: '-10000px', top: 0, overflow: 'hidden' }}>
        {Object.entries(decisionTrees).map(([variable, values]) =>
          Object.entries(values).map(([value, treeData]) => (
            <div
              key={`${variable}_${value}`}
              ref={(el) => {
                chartRefs.current[`${variable}_${value}`] = el
              }}
              data-pdf-chart={`${variable}_${value}`}
            >
              <DecisionTreeChart
                treeData={treeData}
                title={`Arbre de décision - ${variable} = ${value}`}
                width={600}
                height={400}
              />
            </div>
          ))
        )}
      </div>
    </div>
  )
}
