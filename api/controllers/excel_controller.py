import pandas as pd
import numpy as np

# Stockage temporaire en mémoire
uploaded_files = {}

async def preview_excel(file):
    if not file.filename.endswith((".xls", ".xlsx")):
        return {"error": "Le fichier doit être un Excel (.xls ou .xlsx)"}
    
    df = pd.read_excel(file.file)
    df = df.replace([np.nan, np.inf, -np.inf], None)

    uploaded_files[file.filename] = df

    return {
        "filename": file.filename,
        "rows": int(len(df)),  # Convertir en int natif
        "columns": df.columns.tolist(),
        "preview": df.head(5).to_dict(orient="records")
    }

async def select_columns(filename: str, variables_explicatives: list[str], variable_a_expliquer: list[str], selected_data: dict = None):
    if filename not in uploaded_files:
        return {"error": "Fichier non trouvé. Faites d'abord /excel/preview."}
    
    df = uploaded_files[filename]

    # Vérifier que toutes les colonnes existent
    all_columns = variables_explicatives + variable_a_expliquer
    for col in all_columns:
        if col not in df.columns:
            return {"error": f"La colonne '{col}' n'existe pas dans {filename}"}

    # Identifier les colonnes restantes (celles qui ne sont ni explicatives ni à expliquer)
    all_df_columns = set(df.columns)
    remaining_columns = list(all_df_columns - set(all_columns))
    
    # Si selected_data n'est pas fourni, retourner les données des colonnes restantes
    if selected_data is None:
        remaining_data = {}
        for col in remaining_columns:
            # Récupérer toutes les valeurs uniques de la colonne
            unique_values = df[col].dropna().unique()
            # Convertir en types Python natifs
            converted_values = []
            for val in unique_values:
                if pd.isna(val):
                    converted_values.append(None)
                elif isinstance(val, (np.integer, np.floating)):
                    converted_values.append(float(val) if isinstance(val, np.floating) else int(val))
                else:
                    converted_values.append(str(val))
            
            remaining_data[str(col)] = converted_values
        
        return {
            "filename": str(filename),
            "variables_explicatives": [str(col) for col in variables_explicatives],
            "variables_a_expliquer": [str(var) for var in variable_a_expliquer],
            "remaining_columns": [str(col) for col in remaining_columns],
            "remaining_data": remaining_data,
            "message": "Veuillez sélectionner les données des colonnes restantes sur lesquelles vous voulez travailler"
        }
    
    # Si selected_data est fourni, traiter la sélection finale
    # Préparer les données explicatives
    X = df[variables_explicatives]
    
    # Préparer les variables à expliquer (chacune séparément)
    y_variables = {}
    for var in variable_a_expliquer:
        y_variables[var] = df[var]

    # Préparer les résultats pour chaque variable à expliquer
    results = []
    for var in variable_a_expliquer:
        # Convertir les données pandas en types Python natifs
        y_data = df[var]
        
        # Calculer les statistiques avec conversion en types natifs
        y_stats = {
            "count": int(y_data.count()),  # Convertir en int natif
            "mean": None,
            "std": None,
            "min": None,
            "max": None
        }
        
        # Vérifier si la colonne est numérique pour calculer les stats
        if y_data.dtype in ['int64', 'float64']:
            try:
                y_stats["mean"] = float(y_data.mean()) if not pd.isna(y_data.mean()) else None
                y_stats["std"] = float(y_data.std()) if not pd.isna(y_data.std()) else None
                y_stats["min"] = float(y_data.min()) if not pd.isna(y_data.min()) else None
                y_stats["max"] = float(y_data.max()) if not pd.isna(y_data.max()) else None
            except:
                # En cas d'erreur, garder None
                pass
        
        # Convertir les aperçus en types natifs
        y_preview = []
        for val in y_data.head(5):
            if pd.isna(val):
                y_preview.append(None)
            elif isinstance(val, (np.integer, np.floating)):
                y_preview.append(float(val) if isinstance(val, np.floating) else int(val))
            else:
                y_preview.append(str(val))
        
        result = {
            "variable_a_expliquer": str(var),  # Convertir en string natif
            "variables_explicatives": [str(col) for col in variables_explicatives],  # Convertir en strings natifs
            "X_preview": X.head(5).to_dict(orient="records"),
            "y_preview": y_preview,
            "y_stats": y_stats
        }
        results.append(result)

    # Préparer les données sélectionnées par l'utilisateur
    selected_data_with_columns = {}
    for col_name, selected_values in selected_data.items():
        if col_name in df.columns:
            # Filtrer le DataFrame pour ne garder que les lignes où la colonne contient les valeurs sélectionnées
            mask = df[col_name].isin(selected_values)
            filtered_df = df[mask]
            
            # Récupérer les données de cette colonne filtrée
            col_data = filtered_df[col_name].tolist()
            # Convertir en types Python natifs
            converted_col_data = []
            for val in col_data:
                if pd.isna(val):
                    converted_col_data.append(None)
                elif isinstance(val, (np.integer, np.floating)):
                    converted_col_data.append(float(val) if isinstance(val, np.floating) else int(val))
                else:
                    converted_col_data.append(str(val))
            
            selected_data_with_columns[str(col_name)] = converted_col_data

    return {
        "filename": str(filename),  # Convertir en string natif
        "variables_explicatives": [str(col) for col in variables_explicatives],  # Convertir en strings natifs
        "variables_a_expliquer": [str(var) for var in variable_a_expliquer],  # Convertir en strings natifs
        "selected_data": selected_data_with_columns,  # Données choisies par l'utilisateur avec noms de colonnes
        "results": results,
        "summary": {
            "total_variables_explicatives": int(len(variables_explicatives)),  # Convertir en int natif
            "total_variables_a_expliquer": int(len(variable_a_expliquer)),  # Convertir en int natif
            "total_rows": int(len(df)),  # Convertir en int natif
            "total_selected_columns": int(len(selected_data))  # Nombre de colonnes avec données sélectionnées
        }
    }

async def get_column_unique_values(filename: str, column_name: str):
    if filename not in uploaded_files:
        return {"error": "Fichier non trouvé. Faites d'abord /excel/preview."}
    
    df = uploaded_files[filename]
    
    if column_name not in df.columns:
        return {"error": f"La colonne '{column_name}' n'existe pas dans {filename}"}
    
    # Récupérer toutes les valeurs uniques de la colonne
    unique_values = df[column_name].dropna().unique()
    
    # Convertir en types Python natifs
    converted_values = []
    for val in unique_values:
        if pd.isna(val):
            converted_values.append(None)
        elif isinstance(val, (np.integer, np.floating)):
            converted_values.append(float(val) if isinstance(val, np.floating) else int(val))
        else:
            converted_values.append(str(val))
    
    return {
        "filename": str(filename),
        "column_name": str(column_name),
        "unique_values": converted_values,
        "total_unique_values": len(converted_values)
    }
