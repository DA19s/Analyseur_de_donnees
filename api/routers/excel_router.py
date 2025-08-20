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
