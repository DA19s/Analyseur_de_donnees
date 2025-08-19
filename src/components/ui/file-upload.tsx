"use client"

import { useState, useRef, type DragEvent, type ChangeEvent } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { X, FileSpreadsheet, ArrowRight } from "lucide-react"
import { useRouter } from "next/navigation"

interface ExcelFile extends File {
  id: string
  uploadedAt: Date
}

export default function ExcelUploadForm() {
  const [file, setFile] = useState<ExcelFile | null>(null)
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
    console.log(
      "[v0] Files received:",
      newFiles.map((f) => ({ name: f.name, type: f.type, size: f.size })),
    )

    const excelFiles = newFiles.filter((file) => {
      const isExcel =
        file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
        file.type === "application/vnd.ms-excel" ||
        file.name.toLowerCase().endsWith(".xlsx") ||
        file.name.toLowerCase().endsWith(".xls")

      console.log("[v0] File check:", file.name, "Type:", file.type, "Is Excel:", isExcel)
      return isExcel
    })

    console.log("[v0] Excel files processed:", excelFiles.length)

    if (excelFiles.length > 0) {
      const originalFile = excelFiles[0]
      const selectedFile = {
        name: originalFile.name,
        size: originalFile.size,
        type: originalFile.type,
        lastModified: originalFile.lastModified,
        stream: originalFile.stream.bind(originalFile),
        text: originalFile.text.bind(originalFile),
        arrayBuffer: originalFile.arrayBuffer.bind(originalFile),
        slice: originalFile.slice.bind(originalFile),
        id: Math.random().toString(36).substr(2, 9),
        uploadedAt: new Date(),
      } as ExcelFile

      console.log("[v0] Created file object:", {
        name: selectedFile.name,
        size: selectedFile.size,
        type: selectedFile.type,
      })
      setFile(selectedFile)
    }

    if (excelFiles.length === 0 && newFiles.length > 0) {
      alert("Aucun fichier Excel valide détecté. Veuillez sélectionner un fichier .xlsx ou .xls")
    }
  }

  const removeFile = () => {
    setFile(null)
  }

  const openFileDialog = () => {
    fileInputRef.current?.click()
  }

  const proceedToAnalysis = () => {
    if (!file) return

    router.push("/analysis")
  }

  const formatFileSize = (bytes: number) => {
    console.log("[v0] Formatting file size:", bytes, typeof bytes)
    if (!bytes || bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    const result = Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
    console.log("[v0] Formatted size result:", result)
    return result
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

          <Button onClick={openFileDialog} className="mb-2 bg-emerald-600 hover:bg-emerald-700">
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
              Procéder à l'analyse
            </Button>
          </div>

          <Card className="p-4">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <FileSpreadsheet className="h-6 w-6 text-emerald-600" />
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
                  {formatFileSize(file.size)} • Ajouté le {file.uploadedAt.toLocaleTimeString()}
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
