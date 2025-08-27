import pandas as pd
import numpy as np
import json
from typing import Dict, List, Any, Optional, Tuple
from reportlab.lib.pagesizes import letter, A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
import io
import base64

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

async def select_columns(filename: str, variables_explicatives: List[str], variable_a_expliquer: List[str], selected_data: Dict = None):
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

# ============================================================================
# NOUVELLES FONCTIONS POUR L'ARBRE DE DÉCISION
# ============================================================================

def calculate_percentage_variance(df: pd.DataFrame, explanatory_var: str, target_var: str, target_value: Any) -> float:
    """
    Calcule l'écart-type des pourcentages des valeurs d'une variable explicative
    pour une valeur cible donnée.
    
    CORRECTION: Les pourcentages sont calculés par rapport au total des accidents
    de chaque valeur de la variable explicative, pas par rapport au total filtré.
    """
    try:
        # Filtrer pour la valeur cible (exclure les NaN)
        target_mask = (df[target_var] == target_value) & (df[target_var].notna())
        filtered_df = df[target_mask]
        
        if len(filtered_df) == 0:
            return 0.0
        
        # Obtenir toutes les valeurs uniques de la variable explicative dans le dataset complet
        all_explanatory_values = df[explanatory_var].dropna().unique()
        
        if len(all_explanatory_values) == 0:
            return 0.0
        
        # Pour chaque valeur de la variable explicative, calculer le pourcentage
        # d'accidents de type "target_value" parmi tous les accidents de cette valeur
        percentages = []
        
        for explanatory_value in all_explanatory_values:
            # Nombre total d'accidents avec cette valeur explicative
            total_explanatory = len(df[df[explanatory_var] == explanatory_value])
            
            # Nombre d'accidents avec cette valeur explicative ET la valeur cible
            target_and_explanatory = len(
                df[(df[explanatory_var] == explanatory_value) & 
                   (df[target_var] == target_value) & 
                   (df[target_var].notna())]
            )
            
            # Calculer le pourcentage
            if total_explanatory > 0:
                percentage = (target_and_explanatory / total_explanatory) * 100
                percentages.append(percentage)
        
        # Calculer l'écart-type des pourcentages
        if len(percentages) > 1:
            return float(np.std(percentages))
        else:
            return 0.0
            
    except Exception as e:
        print(f"Erreur dans calculate_percentage_variance: {e}")
        return 0.0

def select_best_explanatory_variable(df: pd.DataFrame, available_vars: List[str], 
                                   target_var: str, target_value: Any) -> Tuple[str, float]:
    """
    Sélectionne la variable explicative avec le plus grand écart-type des pourcentages.
    """
    print(f"🔍 Sélection de la meilleure variable explicative pour {target_var} = {target_value}")
    print(f"   📊 Variables disponibles: {available_vars}")
    
    best_var = None
    best_variance = -1
    
    var_variances = {}
    for var in available_vars:
        variance = calculate_percentage_variance(df, var, target_var, target_value)
        var_variances[var] = variance
        print(f"   📊 {var}: écart-type = {variance:.4f}")
    
    # Sélectionner la variable avec la plus grande variance
    if var_variances:
        best_var = max(var_variances, key=var_variances.get)
        best_variance = var_variances[best_var]
        print(f"   🎯 Variable sélectionnée: {best_var} (écart-type: {best_variance:.4f})")
    
    return best_var, best_variance

def calculate_branch_percentages(df: pd.DataFrame, explanatory_var: str, 
                               target_var: str, target_value: Any) -> Dict[str, Dict[str, Any]]:
    """
    Calcule les pourcentages et comptages pour chaque branche d'une variable explicative.
    
    CORRECTION: Les pourcentages sont calculés par rapport au total des accidents
    de chaque valeur de la variable explicative, pas par rapport au total filtré.
    """
    try:
        print(f"🔍 Calcul des branches pour {explanatory_var}")
        print(f"   📊 DataFrame: {len(df)} lignes")
        print(f"   📊 Variable cible: {target_var} = {target_value}")
        
        # Obtenir toutes les valeurs uniques de la variable explicative dans le dataset complet
        all_explanatory_values = df[explanatory_var].dropna().unique()
        print(f"   📊 Valeurs uniques de {explanatory_var}: {all_explanatory_values}")
        
        if len(all_explanatory_values) == 0:
            print(f"   ❌ Aucune valeur unique trouvée")
            return {}
        
        branches = {}
        
        for explanatory_value in all_explanatory_values:
            print(f"   🌿 Traitement de la valeur: {explanatory_value}")
            
            # Nombre total d'accidents avec cette valeur explicative
            total_explanatory = len(df[df[explanatory_var] == explanatory_value])
            print(f"      📊 Total avec {explanatory_var} = {explanatory_value}: {total_explanatory}")
            
            # Nombre d'accidents avec cette valeur explicative ET la valeur cible
            target_and_explanatory = len(
                df[(df[explanatory_var] == explanatory_value) & 
                   (df[target_var] == target_value) & 
                   (df[target_var].notna())]
            )
            print(f"      📊 Avec {explanatory_var} = {explanatory_value} ET {target_var} = {target_value}: {target_and_explanatory}")
            
            # Calculer le pourcentage
            if total_explanatory > 0:
                percentage = (target_and_explanatory / total_explanatory) * 100
                branches[str(explanatory_value)] = {
                    "count": int(target_and_explanatory),
                    "percentage": round(percentage, 2),
                    "subtree": None  # Sera rempli récursivement
                }
                print(f"      ✅ Branche créée: {explanatory_value} → {percentage:.2f}%")
            else:
                print(f"      ❌ Pas de branche créée: total_explanatory = 0")
        
        print(f"   📊 Branches créées: {list(branches.keys())}")
        return branches
        
    except Exception as e:
        print(f"Erreur dans calculate_branch_percentages: {e}")
        return {}

def construct_tree_for_value(df: pd.DataFrame, target_value: Any, target_var: str, 
                           available_explanatory_vars: List[str], current_path: List[str] = None) -> Dict[str, Any]:
    """
    Construit récursivement l'arbre de décision pour une valeur cible donnée.
    """
    if current_path is None:
        current_path = []
    
    print(f"🌳 Construction de l'arbre pour {target_var} = {target_value}")
    print(f"   📊 Variables explicatives disponibles: {available_explanatory_vars}")
    print(f"   📊 Chemin actuel: {current_path}")
    
    # Critère d'arrêt : plus de variables explicatives disponibles
    if not available_explanatory_vars:
        print(f"   🍃 Plus de variables explicatives disponibles - création d'une feuille")
        return {
            "type": "leaf",
            "message": "Plus de variables explicatives disponibles"
        }
    
    # Sélectionner la meilleure variable explicative
    best_var, best_variance = select_best_explanatory_variable(
        df, available_explanatory_vars, target_var, target_value
    )
    
    if best_var is None:
        print(f"   ❌ Aucune variable explicative valide trouvée")
        return {
            "type": "leaf",
            "message": "Aucune variable explicative valide trouvée"
        }
    
    # Calculer les branches pour cette variable
    branches = calculate_branch_percentages(df, best_var, target_var, target_value)
    
    # Créer le nœud de l'arbre
    tree_node = {
        "type": "node",
        "variable": best_var,
        "variance": round(best_variance, 4),
        "branches": branches,
        "path": current_path + [best_var]
    }
    
    # Variables explicatives restantes pour les sous-arbres
    remaining_vars = [var for var in available_explanatory_vars if var != best_var]
    print(f"   🔄 Variables restantes pour les sous-arbres: {remaining_vars}")
    
    # Construire récursivement les sous-arbres pour chaque branche
    for branch_value, branch_data in branches.items():
        print(f"   🌿 Traitement de la branche: {best_var} = {branch_value}")
        print(f"      🔍 DataFrame reçu: {len(df)} lignes")
        print(f"      🔍 Valeur recherchée: {best_var} = {branch_value}")
        
        # Filtrer le DataFrame pour cette branche
        # Convertir branch_value en type approprié pour la comparaison
        if branch_value == 'False':
            branch_value_converted = False
        elif branch_value == 'True':
            branch_value_converted = True
        else:
            branch_value_converted = branch_value
        
        print(f"      🔍 Valeur convertie: {branch_value} → {branch_value_converted} (type: {type(branch_value_converted)})")
        
        branch_mask = (df[best_var] == branch_value_converted) & (df[best_var].notna())
        filtered_df = df[branch_mask]
        
        print(f"      📊 Lignes filtrées pour cette branche: {len(filtered_df)}")
        print(f"      🔍 Valeurs uniques de {best_var} dans le DataFrame: {df[best_var].dropna().unique()}")
        print(f"      🔍 Masque de filtrage: {branch_mask.sum()} lignes True")
        
        if len(filtered_df) > 0 and remaining_vars:
            print(f"      🔄 Construction du sous-arbre récursif...")
            # Construire le sous-arbre récursivement
            subtree = construct_tree_for_value(
                filtered_df, target_value, target_var, 
                remaining_vars, current_path + [best_var, branch_value]
            )
            branch_data["subtree"] = subtree
        else:
            print(f"      ⚠️ Pas de sous-arbre: lignes={len(filtered_df)}, variables_restantes={len(remaining_vars)}")
    
    return tree_node

async def build_decision_tree(filename: str, variables_explicatives: List[str], 
                            variables_a_expliquer: List[str], selected_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Construit l'arbre de décision complet pour toutes les variables à expliquer.
    """
    if filename not in uploaded_files:
        return {"error": "Fichier non trouvé. Faites d'abord /excel/preview."}
    
    df = uploaded_files[filename]
    
    # Étape 1: Filtrer l'échantillon initial basé sur les variables restantes sélectionnées
    print("🔄 Étape 1: Filtrage de l'échantillon initial...")
    
    # Identifier les colonnes restantes (ni explicatives ni à expliquer)
    all_columns = variables_explicatives + variables_a_expliquer
    remaining_columns = [col for col in df.columns if col not in all_columns]
    
    # Filtrer pour les variables restantes sélectionnées
    initial_mask = pd.Series([True] * len(df), index=df.index)
    
    print(f"🔍 Variables restantes disponibles: {remaining_columns}")
    print(f"🔍 Données sélectionnées par l'utilisateur: {selected_data}")
    
    for col_name, selected_values in selected_data.items():
        if col_name in remaining_columns and selected_values:
            col_mask = df[col_name].isin(selected_values)
            initial_mask = initial_mask & col_mask
            print(f"✅ Filtrage pour {col_name} = {selected_values}: {len(df[col_mask])} lignes conservées")
        else:
            print(f"⚠️ {col_name} ignoré: dans remaining_columns={col_name in remaining_columns}, selected_values={bool(selected_values)}")
    
    filtered_df = df[initial_mask].copy()
    print(f"✅ Échantillon initial filtré: {len(filtered_df)} lignes sur {len(df)}")
    
    # Vérifier les valeurs des variables explicatives dans l'échantillon filtré
    print(f"🔍 Vérification des variables explicatives dans l'échantillon filtré:")
    for var in variables_explicatives:
        unique_values = filtered_df[var].dropna().unique()
        print(f"   📊 {var}: {unique_values} ({len(unique_values)} valeurs uniques)")
    
    # Analyser l'impact du filtrage sur les variables explicatives
    filtering_analysis = analyze_sample_filtering_impact(df, filtered_df, variables_explicatives)
    
    # Afficher les avertissements et suggestions
    if filtering_analysis["warnings"]:
        print(f"\n⚠️ AVERTISSEMENTS:")
        for warning in filtering_analysis["warnings"]:
            print(f"  {warning}")
    
    if filtering_analysis["suggestions"]:
        print(f"\n💡 SUGGESTIONS:")
        for suggestion in filtering_analysis["suggestions"]:
            print(f"  {suggestion}")
    
    # Étape 2: Construire l'arbre pour chaque variable à expliquer
    print("🔄 Étape 2: Construction des arbres de décision...")
    
    decision_trees = {}
    total_trees = len(variables_a_expliquer)
    
    for i, target_var in enumerate(variables_a_expliquer):
        print(f"🌳 Construction de l'arbre {i+1}/{total_trees} pour {target_var}...")
        
        # IMPORTANT: Utiliser seulement les valeurs SÉLECTIONNÉES, pas toutes les valeurs uniques
        if target_var in selected_data and selected_data[target_var]:
            # Utiliser les valeurs sélectionnées par l'utilisateur
            target_values = selected_data[target_var]
            print(f"   📊 {len(target_values)} valeur(s) SÉLECTIONNÉE(S) utilisée(s)")
        else:
            # Fallback: utiliser toutes les valeurs uniques si aucune sélection
            target_values = filtered_df[target_var].dropna().unique()
            print(f"   📊 {len(target_values)} valeur(s) uniques trouvée(s) (aucune sélection)")
        
        target_trees = {}
        
        for j, target_value in enumerate(target_values):
            print(f"   🎯 Traitement de la valeur {j+1}/{len(target_values)}: {target_value}")
            
            # Construire l'arbre pour cette valeur
            tree = construct_tree_for_value(
                filtered_df, target_value, target_var, 
                variables_explicatives.copy(), []
            )
            
            target_trees[str(target_value)] = tree
        
        decision_trees[target_var] = target_trees
        print(f"✅ Arbre terminé pour {target_var}")
    
    print("🎉 Construction de tous les arbres terminée !")
    
    return {
        "filename": filename,
        "variables_explicatives": variables_explicatives,
        "variables_a_expliquer": variables_a_expliquer,
        "filtered_sample_size": len(filtered_df),
        "original_sample_size": len(df),
        "decision_trees": decision_trees
    }

def generate_tree_pdf(decision_trees: Dict[str, Any], filename: str) -> str:
    """
    Génère un PDF de l'arbre de décision avec structure arborescente claire et branches gauche/droite.
    """
    try:
        # Créer un buffer en mémoire pour le PDF
        buffer = io.BytesIO()
        
        # Créer le document PDF
        doc = SimpleDocTemplate(buffer, pagesize=A4)
        story = []
        
        # Styles
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=20,
            spaceAfter=25,
            alignment=TA_CENTER,
            textColor=colors.darkblue
        )
        
        subtitle_style = ParagraphStyle(
            'CustomSubtitle',
            parent=styles['Heading2'],
            fontSize=16,
            spaceAfter=20,
            textColor=colors.darkgreen
        )
        
        node_style = ParagraphStyle(
            'NodeStyle',
            parent=styles['Normal'],
            fontSize=12,
            spaceAfter=8,
            textColor=colors.darkblue,
            leftIndent=20
        )
        
        branch_style = ParagraphStyle(
            'BranchStyle',
            parent=styles['Normal'],
            fontSize=11,
            spaceAfter=6,
            textColor=colors.purple,
            leftIndent=40
        )
        
        leaf_style = ParagraphStyle(
            'LeafStyle',
            parent=styles['Normal'],
            fontSize=10,
            spaceAfter=4,
            textColor=colors.darkgreen,
            leftIndent=60
        )
        
        # Titre principal
        story.append(Paragraph("🌳 ARBRE DE DÉCISION - ANALYSE STATISTIQUE", title_style))
        story.append(Spacer(1, 25))
        
        # Informations du fichier
        story.append(Paragraph(f"📁 <b>Fichier:</b> {filename}", styles['Normal']))
        story.append(Spacer(1, 15))
        
        # Fonction récursive pour afficher l'arbre avec structure claire
        def add_tree_to_story(node, level=0, path=""):
            try:
                if node.get("type") == "leaf":
                    # Feuille de l'arbre
                    story.append(Paragraph(f"🍃 {node.get('message', 'Fin de branche')}", leaf_style))
                else:
                    # Nœud principal avec variable explicative
                    indent = "&nbsp;" * (level * 8)
                    story.append(Paragraph(
                        f"{indent}🌿 <b>{node['variable']}</b> (Écart-type: {node['variance']})", 
                        node_style
                    ))
                    
                    # Branches avec structure gauche/droite
                    branches = list(node['branches'].items())
                    mid_point = len(branches) // 2
                    
                    # Branches gauches
                    if mid_point > 0:
                        story.append(Paragraph(f"{indent}&nbsp;&nbsp;├─ <b>BRANCHES GAUCHES:</b>", branch_style))
                        for i, (branch_value, branch_data) in enumerate(branches[:mid_point]):
                            story.append(Paragraph(
                                f"{indent}&nbsp;&nbsp;&nbsp;&nbsp;├─ <b>{branch_value}</b>: {branch_data['count']} ({branch_data['percentage']}%)", 
                                branch_style
                            ))
                            
                            # Sous-arbre récursif
                            if branch_data.get('subtree'):
                                add_tree_to_story(branch_data['subtree'], level + 1, f"{path} → {branch_value}")
                    
                    # Branches droites
                    if len(branches) > mid_point:
                        story.append(Paragraph(f"{indent}&nbsp;&nbsp;├─ <b>BRANCHES DROITES:</b>", branch_style))
                        for i, (branch_value, branch_data) in enumerate(branches[mid_point:]):
                            story.append(Paragraph(
                                f"{indent}&nbsp;&nbsp;&nbsp;&nbsp;├─ <b>{branch_value}</b>: {branch_data['count']} ({branch_data['percentage']}%)", 
                                branch_style
                            ))
                            
                            # Sous-arbre récursif
                            if branch_data.get('subtree'):
                                add_tree_to_story(branch_data['subtree'], level + 1, f"{path} → {branch_value}")
                    
                    story.append(Spacer(1, 10))
            except Exception as e:
                print(f"Erreur dans add_tree_to_story: {e}")
                story.append(Paragraph(f"❌ Erreur lors de l'affichage du nœud", styles['Normal']))
        
        # Pour chaque variable à expliquer
        for target_var, target_trees in decision_trees.items():
            try:
                story.append(Paragraph(f"🎯 <b>VARIABLE À EXPLIQUER: {target_var}</b>", subtitle_style))
                story.append(Spacer(1, 15))
                
                # Pour chaque valeur de cette variable
                for target_value, tree in target_trees.items():
                    try:
                        story.append(Paragraph(f"📊 <b>VALEUR CIBLE: {target_value}</b>", styles['Heading3']))
                        story.append(Spacer(1, 10))
                        
                        # Construire l'arbre récursivement
                        add_tree_to_story(tree, 0, target_value)
                        story.append(Spacer(1, 20))
                    except Exception as e:
                        print(f"Erreur lors du traitement de la valeur {target_value}: {e}")
                        story.append(Paragraph(f"❌ Erreur lors du traitement de la valeur {target_value}", styles['Normal']))
                
                story.append(Spacer(1, 25))
            except Exception as e:
                print(f"Erreur lors du traitement de la variable {target_var}: {e}")
                story.append(Paragraph(f"❌ Erreur lors du traitement de la variable {target_var}", styles['Normal']))
        
        # Construire le PDF
        doc.build(story)
        
        # Obtenir le contenu du buffer
        pdf_content = buffer.getvalue()
        buffer.close()
        
        # Encoder en base64
        pdf_base64 = base64.b64encode(pdf_content).decode('utf-8')
        
        return pdf_base64
        
    except Exception as e:
        print(f"Erreur lors de la génération du PDF: {e}")
        import traceback
        traceback.print_exc()
        return ""

async def build_decision_tree_with_pdf(filename: str, variables_explicatives: List[str], 
                                     variables_a_expliquer: List[str], selected_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Construit l'arbre de décision et génère le PDF correspondant.
    """
    # Construire l'arbre
    tree_result = await build_decision_tree(filename, variables_explicatives, variables_a_expliquer, selected_data)
    
    if "error" in tree_result:
        return tree_result
    
    # Générer le PDF
    print("📄 Génération du PDF...")
    pdf_base64 = generate_tree_pdf(tree_result["decision_trees"], filename)
    
    if pdf_base64:
        tree_result["pdf_base64"] = pdf_base64
        tree_result["pdf_generated"] = True
        print("✅ PDF généré avec succès")
    else:
        tree_result["pdf_generated"] = False
        print("❌ Erreur lors de la génération du PDF")
    
    return tree_result

def analyze_sample_filtering_impact(df: pd.DataFrame, filtered_df: pd.DataFrame, 
                                   variables_explicatives: List[str]) -> Dict[str, Any]:
    """
    Analyse l'impact du filtrage de l'échantillon sur les variables explicatives.
    Retourne des avertissements et suggestions pour l'utilisateur.
    """
    warnings = []
    suggestions = []
    
    print(f"\n🔍 Analyse de l'impact du filtrage sur les variables explicatives...")
    print(f"  📊 Échantillon original: {len(df)} lignes")
    print(f"  📊 Échantillon filtré: {len(filtered_df)} lignes")
    print(f"  📊 Réduction: {((len(df) - len(filtered_df)) / len(df) * 100):.1f}%")
    
    for var in variables_explicatives:
        original_unique = df[var].nunique()
        filtered_unique = filtered_df[var].nunique()
        
        print(f"  📊 {var}: {original_unique} → {filtered_unique} valeurs uniques")
        
        if filtered_unique == 1:
            warnings.append(f"⚠️ Variable '{var}' n'a plus qu'une seule valeur unique dans l'échantillon filtré")
            suggestions.append(f"Considérez élargir la sélection pour '{var}' ou la retirer des variables explicatives")
        elif filtered_unique < original_unique * 0.5:
            warnings.append(f"⚠️ Variable '{var}' a perdu plus de 50% de ses valeurs uniques")
            suggestions.append(f"La variable '{var}' pourrait avoir une variance réduite")
        elif filtered_unique < 3:
            warnings.append(f"⚠️ Variable '{var}' a moins de 3 valeurs uniques dans l'échantillon filtré")
            suggestions.append(f"La variable '{var}' pourrait avoir une variance faible")
    
    return {
        "warnings": warnings,
        "suggestions": suggestions,
        "original_sample_size": len(df),
        "filtered_sample_size": len(filtered_df),
        "reduction_percentage": round(((len(df) - len(filtered_df)) / len(df) * 100), 1)
    }
