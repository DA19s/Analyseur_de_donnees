import ExcelAnalyzer from "@/components/ui/file-upload"
import StepProgress from "@/components/ui/step-progress"

export default function Home() {
  return (
    <div className=" bg-gradient-to-br from-blue-100 to-emerald-100 flex justify-center h-screen">
      <StepProgress />
      <div className="absolute top-10 gap-6 flex flex-col items-center">
      <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-500 to-emerald-500 bg-clip-text text-transparent">
        Analyseur de données
      </h1>
      <p className=" text-lg bg-gradient-to-r from-emerald-500 to-emerald-600 bg-clip-text text-transparent">Téléchargez votre fichier Excel pour commencer le travail</p>
      </div>


      <div className=" absolute top-20 flex flex-col items-center py-24 px-4 ">
        <ExcelAnalyzer />
      </div>

    </div>

  );
}