"use client"

import { useState, useRef, type DragEvent, type ChangeEvent } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { X, FileSpreadsheet, ArrowRight } from "lucide-react"
import { useRouter } from "next/navigation"
import { useFile } from "@/app/context/FileContext"


export default function ExcelUploadForm() {
const { file, setFile } = useFile()
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)

    const droppedFiles = Array.from(e.dataTransfer.files)
    processFiles(droppedFiles)
  }

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files)
      processFiles(selectedFiles)
    }
  }

  const processFiles = (newFiles: File[]) => {
    const excelFiles = newFiles.filter((file) =>
      file.name.toLowerCase().endsWith(".xlsx") || file.name.toLowerCase().endsWith(".xls")
    )

    if (excelFiles.length > 0) {
      setFile(excelFiles[0]) // ✅ on garde le vrai File
    } else if (newFiles.length > 0) {
      alert("Aucun fichier Excel valide détecté. Veuillez sélectionner un fichier .xlsx ou .xls")
    }
  }

  const removeFile = () => {
    setFile(null)
  }

  const openFileDialog = () => {
    fileInputRef.current?.click()
  }

  const proceedToAnalysis = async () => {
    if (!file) return

    const formData = new FormData()
    formData.append("file", file, file.name)
    
    router.push(`/variables`)

  }

  const formatFileSize = (bytes: number) => {
    if (!bytes || bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <Card
        className={`transition-all duration-200 ${
          isDragOver
            ? "border-emerald-500 bg-emerald-50 border-2 border-dashed"
            : "border-2 border-dashed border-border hover:border-emerald-500 hover:bg-emerald-50/50"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <CardContent className="flex flex-col items-center justify-center py-12 px-6 text-center">
          <div className={`rounded-full p-4 mb-4 transition-colors ${isDragOver ? "bg-emerald-100" : "bg-muted"}`}>
            <FileSpreadsheet className={`h-8 w-8 ${isDragOver ? "text-emerald-600" : "text-muted-foreground"}`} />
          </div>

          <h3 className="text-lg font-semibold mb-2">
            {isDragOver ? "Déposez votre fichier Excel ici" : "Téléchargez votre fichier Excel"}
          </h3>

          <p className="text-muted-foreground mb-4">Glissez-déposez votre fichier Excel ou cliquez pour sélectionner</p>

          <Button onClick={openFileDialog} className="mb-2 bg-blue-400 hover:bg-blue-700">
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Sélectionner un fichier Excel
          </Button>

          <p className="text-xs text-muted-foreground">Formats supportés: .xlsx, .xls (Max 50MB)</p>

          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileSelect}
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          />
        </CardContent>
      </Card>

      {file && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-semibold">Fichier sélectionné</h4>
            <Button onClick={proceedToAnalysis} className="bg-blue-600 hover:bg-blue-700">
              <ArrowRight className="h-4 w-4 mr-2" />
              Etape suivante
            </Button>
          </div>

          <Card className="p-4">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <FileSpreadsheet className="h-6 w-6 text-blue-600" />
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium truncate">{file.name}</p>
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                    Prêt pour l'analyse
                  </span>
                </div>

                <p className="text-sm text-muted-foreground">
                  {formatFileSize(file.size)} • Ajouté le {new Date().toLocaleTimeString()}
                </p>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={removeFile}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
