"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import DecisionTreeGraph from "@/components/ui/decision-tree-graph"

export default function DecisionTreeChartPage() {
  const router = useRouter()
  const [data, setData] = useState<any | null>(null)

  useEffect(() => {
    try {
      const stored = localStorage.getItem('excelAnalysisData')
      if (!stored) {
        router.push('/decision-tree')
        return
      }
      const parsed = JSON.parse(stored)
      if (!parsed?.decisionTreeData?.decision_trees) {
        router.push('/decision-tree')
        return
      }
      setData(parsed.decisionTreeData)
    } catch {
      router.push('/decision-tree')
    }
  }, [router])

  const trees = useMemo(() => {
    const out: Array<{ variable: string; value: string; tree: any }> = []
    if (!data?.decision_trees) return out
    for (const [variable, values] of Object.entries<any>(data.decision_trees)) {
      for (const [value, tree] of Object.entries<any>(values)) {
        out.push({ variable, value: String(value), tree })
      }
    }
    return out
  }, [data])

  if (!data) {
    return (
      <div className="p-8 text-center">
        <p>Chargement…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-6 bg-gradient-to-br from-blue-50 to-indigo-50">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-blue-800">Dessin de l'arbre (Chart)</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push('/decision-tree')}>↩️ Retour</Button>
          </div>
        </div>

        {trees.length > 0 ? (
          <div className="space-y-8">
            {trees.map((t, idx) => (
              <DecisionTreeGraph
                key={`${t.variable}_${t.value}_${idx}`}
                treeData={t.tree}
                title={`Arbre de décision - ${t.variable} = ${t.value}`}
                width={1100}
                height={700}
              />
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-500">Aucun arbre disponible</div>
        )}
      </div>
    </div>
  )
}


