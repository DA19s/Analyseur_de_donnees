import ExcelAnalyzer from "@/components/ui/file-upload"
import StepProgress from "@/components/ui/step-progress"

export default function Home() {
  return (
    <div className=" bg-gradient-to-br from-blue-100 to-emerald-100 flex justify-center h-screen">
      <StepProgress currentStep={1} />
      <div className="absolute top-10 gap-2 flex flex-col items-center">
      <h1 className="text-4xl font-bold bg-blue-500 bg-clip-text text-transparent">
        Etape 1 : Upload du fichier à traiter
      </h1>
      <p className=" text-lg bg-blue-400 bg-clip-text text-transparent"> Veuillez télécharger le fichier excel contenant les données </p>
      <p className=" text-lg bg-blue-400 bg-clip-text text-transparent"> La première ligne du fichier doit contenir les noms des variables </p>
      </div>


      <div className=" absolute top-20 flex flex-col items-center py-24 px-4 ">
        <ExcelAnalyzer />
      </div>

    </div>

  );
}