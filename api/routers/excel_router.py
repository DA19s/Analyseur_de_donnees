from fastapi import APIRouter, UploadFile, Form
from typing import Optional, Dict, Any
from controllers import excel_controller

router = APIRouter(prefix="/excel", tags=["Excel"])

@router.post("/preview")
async def preview_excel(file: UploadFile):
    return await excel_controller.preview_excel(file)

@router.post("/select-columns")
async def select_columns(
    filename: str = Form(...),
    variables_explicatives: str = Form(...),  # Changé en str pour gérer la séparation
    variable_a_expliquer: str = Form(...),  # Peut contenir plusieurs variables séparées par des virgules
    selected_data: Optional[str] = Form(None)  # Données sélectionnées par l'utilisateur (JSON string)
):
    # Séparer les variables explicatives (elles arrivent comme "col1,col2,col3")
    if variables_explicatives:
        variables_explicatives_list = [col.strip() for col in variables_explicatives.split(',')]
    else:
        variables_explicatives_list = []
    
    # Séparer les variables à expliquer (elles peuvent aussi être multiples)
    if variable_a_expliquer:
        variables_a_expliquer_list = [col.strip() for col in variable_a_expliquer.split(',')]
    else:
        variables_a_expliquer_list = []
    
    # Traiter selected_data si fourni
    selected_data_dict = None
    if selected_data:
        import json
        try:
            selected_data_dict = json.loads(selected_data)
        except json.JSONDecodeError:
            return {"error": "Format invalide pour selected_data"}
    
    return await excel_controller.select_columns(
        filename,
        variables_explicatives_list,  # Passer la liste séparée
        variables_a_expliquer_list,   # Passer la liste des variables à expliquer
        selected_data_dict  # Passer les données sélectionnées ou None
    )

@router.post("/get-column-values")
async def get_column_values(
    filename: str = Form(...),
    column_name: str = Form(...)
):
    return await excel_controller.get_column_unique_values(filename, column_name)

@router.post("/build-decision-tree")
async def build_decision_tree_endpoint(
    filename: str = Form(...),
    variables_explicatives: str = Form(...),
    variable_a_expliquer: str = Form(...),
    selected_data: str = Form(...),
    min_population_threshold: Optional[int] = Form(None),
    treatment_mode: Optional[str] = Form('independent')
):
    """
    Construit l'arbre de décision et génère le PDF correspondant.
    """
    try:
        # Séparer les variables explicatives
        if variables_explicatives:
            variables_explicatives_list = [col.strip() for col in variables_explicatives.split(',')]
        else:
            variables_explicatives_list = []
        
        # Séparer les variables à expliquer
        if variable_a_expliquer:
            variables_a_expliquer_list = [col.strip() for col in variable_a_expliquer.split(',')]
        else:
            variables_a_expliquer_list = []
        
        # Parser selected_data
        import json
        try:
            selected_data_dict = json.loads(selected_data)
        except json.JSONDecodeError:
            return {"error": "Format invalide pour selected_data"}
        
        # Construire l'arbre de décision avec PDF
        result = await excel_controller.build_decision_tree_with_pdf(
            filename,
            variables_explicatives_list,
            variables_a_expliquer_list,
            selected_data_dict,
            min_population_threshold,
            treatment_mode
        )
        
        return result
        
    except Exception as e:
        return {"error": f"Erreur lors de la construction de l'arbre: {str(e)}"}
