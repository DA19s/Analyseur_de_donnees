import pandas as pd
import numpy as np
import json
from typing import Dict, List, Any, Optional, Tuple
from reportlab.lib.pagesizes import letter, A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
import io
import base64
# Imports matplotlib supprimés - les diagrammes sont maintenant générés côté frontend

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
        
        # Obtenir toutes les valeurs uniques de la variable explicative dans le dataset filtré
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
        return 0.0

def select_best_explanatory_variable(df: pd.DataFrame, available_vars: List[str], 
                                   target_var: str, target_value: Any) -> Tuple[str, float]:
    """
    Sélectionne la variable explicative avec le plus grand écart-type des pourcentages.
    """
    best_var = None
    best_variance = -1
    
    var_variances = {}
    for var in available_vars:
        variance = calculate_percentage_variance(df, var, target_var, target_value)
        var_variances[var] = variance
    
    # Sélectionner la variable avec la plus grande variance
    if var_variances:
        best_var = max(var_variances, key=var_variances.get)
        best_variance = var_variances[best_var]
    
    return best_var, best_variance

def calculate_branch_percentages(df: pd.DataFrame, explanatory_var: str, 
                               target_var: str, target_value: Any) -> Dict[str, Dict[str, Any]]:
    """
    Calcule les pourcentages et comptages pour chaque branche d'une variable explicative.
    
    CORRECTION: Les pourcentages sont calculés par rapport au total des accidents
    de chaque valeur de la variable explicative, pas par rapport au total filtré.
    """
    try:

        
        # Obtenir toutes les valeurs uniques de la variable explicative dans le dataset filtré
        all_explanatory_values = df[explanatory_var].dropna().unique()
        
        if len(all_explanatory_values) == 0:
            return {}
        
        branches = {}
        
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
                branches[str(explanatory_value)] = {
                    "count": int(target_and_explanatory),   # cas cibles
                    "total": int(total_explanatory),         # effectif total de la branche
                    "percentage": round(percentage, 2),
                    "subtree": None  # Sera rempli récursivement
                }
        
        return branches
        
    except Exception as e:
        return {}

def construct_tree_for_value(df: pd.DataFrame, target_value: Any, target_var: str, 
                           available_explanatory_vars: List[str], current_path: List[str] = None,
                           min_population_threshold: Optional[int] = None) -> Dict[str, Any]:
    """
    Construit récursivement l'arbre de décision pour une valeur cible donnée.
    """
    if current_path is None:
        current_path = []
    
    # Critère d'arrêt : plus de variables explicatives disponibles
    if not available_explanatory_vars:
        return {
            "type": "leaf",
            "message": "Plus de variables explicatives disponibles"
        }
    
    # Sélectionner la meilleure variable explicative
    best_var, best_variance = select_best_explanatory_variable(
        df, available_explanatory_vars, target_var, target_value
    )
    
    if best_var is None:
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
    
    # Construire récursivement les sous-arbres pour chaque branche
    for branch_value, branch_data in branches.items():
        # Filtrer le DataFrame pour cette branche
        # Convertir branch_value en type approprié pour la comparaison
        if branch_value == 'False':
            branch_value_converted = False
        elif branch_value == 'True':
            branch_value_converted = True
        else:
            branch_value_converted = branch_value
        
        branch_mask = (df[best_var] == branch_value_converted) & (df[best_var].notna())
        filtered_df = df[branch_mask]
        
        if len(filtered_df) > 0 and remaining_vars:
            # Vérifier le seuil d'effectif minimum (0 = pas de limite)
            if min_population_threshold and min_population_threshold > 0 and len(filtered_df) < min_population_threshold:
                # Arrêter la construction si l'effectif est trop faible
                branch_data["subtree"] = {
                    "type": "leaf",
                    "message": f"[ARRET] Branche arrêtée - Effectif insuffisant ({len(filtered_df)} < {min_population_threshold})"
                }
            else:
                # Construire le sous-arbre récursivement
                subtree = construct_tree_for_value(
                    filtered_df, target_value, target_var, 
                    remaining_vars, current_path + [best_var, branch_value],
                    min_population_threshold
                )
                branch_data["subtree"] = subtree
    
    return tree_node

async def build_decision_tree(filename: str, variables_explicatives: List[str], 
                            variables_a_expliquer: List[str], selected_data: Dict[str, Any], 
                            min_population_threshold: Optional[int] = None,
                            treatment_mode: str = 'independent') -> Dict[str, Any]:
    """
    Construit l'arbre de décision complet pour toutes les variables à expliquer.
    """
    if filename not in uploaded_files:
        return {"error": "Fichier non trouvé. Faites d'abord /excel/preview."}
    
    df = uploaded_files[filename]
    
    # Étape 1: Filtrer l'échantillon initial basé sur les variables restantes sélectionnées
    
    # Identifier les colonnes restantes (ni explicatives ni à expliquer)
    all_columns = variables_explicatives + variables_a_expliquer
    remaining_columns = [col for col in df.columns if col not in all_columns]
    
    # Filtrer pour les variables restantes sélectionnées
    initial_mask = pd.Series([True] * len(df), index=df.index)
    
    for col_name, selected_values in selected_data.items():
        if col_name in remaining_columns and selected_values:
            # Conversion automatique des types pour la correspondance
            converted_values = []
            for val in selected_values:
                if isinstance(val, str):
                    if val.lower() == 'true':
                        converted_values.append(True)
                    elif val.lower() == 'false':
                        converted_values.append(False)
                    else:
                        converted_values.append(val)
                else:
                    converted_values.append(val)
            
            col_mask = df[col_name].isin(converted_values)
            initial_mask = initial_mask & col_mask
    
    filtered_df = df[initial_mask].copy()
    
    # Analyser l'impact du filtrage sur les variables explicatives
    filtering_analysis = analyze_sample_filtering_impact(df, filtered_df, variables_explicatives)
    
    # Étape 2: Construire l'arbre selon le mode de traitement
    
    decision_trees = {}
    
    if treatment_mode == 'together':
        # Mode ensemble : traiter toutes les variables ensemble
        # Créer une variable combinée qui prend la valeur True si l'une des variables cibles est présente
        
        # Créer un masque pour les lignes qui ont l'une des valeurs cibles
        combined_mask = pd.Series([False] * len(filtered_df), index=filtered_df.index)
        
        # Si toutes les modalités sont dans la même variable
        if len(variables_a_expliquer) == 1:
            target_var = variables_a_expliquer[0]
            if target_var in selected_data and selected_data[target_var]:
                # Utiliser toutes les modalités sélectionnées de cette variable
                combined_mask = filtered_df[target_var].isin(selected_data[target_var])
            else:
                combined_mask = filtered_df[target_var].notna()
        else:
            # Si les modalités sont dans plusieurs variables différentes
            for target_var in variables_a_expliquer:
                if target_var in selected_data and selected_data[target_var]:
                    var_mask = filtered_df[target_var].isin(selected_data[target_var])
                else:
                    var_mask = filtered_df[target_var].notna()
                combined_mask = combined_mask | var_mask
        
        # Créer un DataFrame avec une variable combinée
        combined_df = filtered_df.copy()
        combined_df['_combined_target'] = combined_mask
        
        # Construire l'arbre pour la variable combinée
        target_trees = {}
        tree = construct_tree_for_value(
            combined_df, True, '_combined_target', 
            variables_explicatives.copy(), [],
            min_population_threshold
        )
        target_trees['Combined'] = tree
        
        # Créer un nom descriptif avec les noms des variables
        if len(variables_a_expliquer) == 1:
            # Une seule variable : utiliser son nom
            combined_name = variables_a_expliquer[0]
        else:
            # Plusieurs variables : les joindre avec des virgules
            combined_name = " + ".join(variables_a_expliquer)
        
        decision_trees[combined_name] = target_trees
        
    else:
        # Mode indépendant : traiter chaque variable séparément (comportement original)
        for target_var in variables_a_expliquer:
            # IMPORTANT: Utiliser seulement les valeurs SÉLECTIONNÉES, pas toutes les valeurs uniques
            if target_var in selected_data and selected_data[target_var]:
                # Utiliser les valeurs sélectionnées par l'utilisateur
                target_values = selected_data[target_var]
            else:
                # Fallback: utiliser toutes les valeurs uniques si aucune sélection
                target_values = filtered_df[target_var].dropna().unique()
            
            target_trees = {}
            
            for target_value in target_values:
                # Construire l'arbre pour cette valeur
                tree = construct_tree_for_value(
                    filtered_df, target_value, target_var, 
                    variables_explicatives.copy(), [],
                    min_population_threshold
                )
                
                target_trees[str(target_value)] = tree
            
            decision_trees[target_var] = target_trees
    
    return {
        "filename": filename,
        "variables_explicatives": variables_explicatives,
        "variables_a_expliquer": variables_a_expliquer,
        "filtered_sample_size": len(filtered_df),
        "original_sample_size": len(df),
        "decision_trees": decision_trees,
        "treatment_mode": treatment_mode
    }

def create_tree_diagram(decision_trees: Dict[str, Any]) -> str:
    """
    Crée un diagramme visuel de l'arbre de décision avec matplotlib.
    """
    try:
        fig, ax = plt.subplots(1, 1, figsize=(16, 12))
        ax.set_xlim(0, 12)
        ax.set_ylim(0, 12)
        ax.axis('off')
        
        # Couleurs pour les différents types de nœuds
        node_colors = {
            'root': '#4CAF50',      # Vert pour la racine
            'node': '#2196F3',      # Bleu pour les nœuds
            'leaf': '#FF9800',      # Orange pour les feuilles
            'stopped': '#F44336'    # Rouge pour les branches arrêtées
        }
        
        y_positions = []
        x_positions = []
        
        def draw_node(x, y, text, node_type='node', width=1.5, height=0.8):
            """Dessine un nœud de l'arbre"""
            color = node_colors.get(node_type, node_colors['node'])
            
            # Créer un rectangle arrondi
            rect = FancyBboxPatch(
                (x - width/2, y - height/2), width, height,
                boxstyle="round,pad=0.1",
                facecolor=color,
                edgecolor='black',
                linewidth=1,
                alpha=0.8
            )
            ax.add_patch(rect)
            
            # Ajouter le texte
            ax.text(x, y, text, ha='center', va='center', 
                   fontsize=8, fontweight='bold', color='white',
                   wrap=True)
            
            return x, y
        
        def draw_connection(x1, y1, x2, y2):
            """Dessine une connexion entre deux nœuds"""
            ax.plot([x1, x2], [y1, y2], 'k-', linewidth=1.5, alpha=0.7)
        
        def draw_tree_recursive(tree_data, x, y, level=0, max_level=5):
            """Dessine l'arbre récursivement"""
            if level > max_level:
                return
            
            # Dessiner le nœud actuel
            if level == 0:
                node_type = 'root'
                text = "Racine"
            elif tree_data.get('type') == 'leaf':
                node_type = 'leaf'
                text = f"Feuille\n{tree_data.get('message', '')[:30]}..."
            else:
                node_type = 'node'
                text = f"{tree_data.get('variable', 'Nœud')}\n(σ: {tree_data.get('variance', 0):.2f})"
            
            draw_node(x, y, text, node_type)
            
            # Dessiner les branches
            if tree_data.get('branches') and level < max_level:
                branches = list(tree_data['branches'].items())
                num_branches = len(branches)
                
                if num_branches > 0:
                    # Calculer les positions des branches avec plus d'espace
                    branch_spacing = 1.5
                    start_x = x - (num_branches - 1) * branch_spacing / 2
                    
                    for i, (branch_value, branch_data) in enumerate(branches):
                        branch_x = start_x + i * branch_spacing
                        branch_y = y - 1.5
                        
                        # Dessiner la connexion
                        draw_connection(x, y - 0.4, branch_x, branch_y + 0.4)
                        
                        # Dessiner l'étiquette de la branche
                        ax.text((x + branch_x) / 2, (y + branch_y) / 2, 
                               f"{branch_value}\n({branch_data.get('count', 0)})", 
                               ha='center', va='center', fontsize=6,
                               bbox=dict(boxstyle="round,pad=0.1", facecolor='lightgray', alpha=0.7))
                        
                        # Récursion pour le sous-arbre
                        if branch_data.get('subtree'):
                            draw_tree_recursive(branch_data['subtree'], branch_x, branch_y, level + 1, max_level)
                        else:
                            # Si c'est une feuille finale, la dessiner
                            if branch_data.get('count', 0) > 0:
                                draw_node(branch_x, branch_y, f"Feuille\n{branch_data.get('count', 0)} cas", 'leaf', 1.2, 0.6)
        
        # Dessiner chaque arbre
        y_start = 10
        for i, (target_var, target_trees) in enumerate(decision_trees.items()):
            # Titre de l'arbre
            ax.text(6, y_start + 1, f"Arbre pour: {target_var}", 
                   ha='center', va='center', fontsize=14, fontweight='bold')
            
            # Dessiner le premier arbre de cette variable
            if target_trees:
                first_tree = list(target_trees.values())[0]
                draw_tree_recursive(first_tree, 6, y_start, 0, 5)
            
            y_start -= 5
        
        # Titre général
        ax.text(6, 11.5, "Diagramme de l'Arbre de Décision", 
               ha='center', va='center', fontsize=16, fontweight='bold')
        
        # Légende
        legend_elements = [
            patches.Patch(color=node_colors['root'], label='Racine'),
            patches.Patch(color=node_colors['node'], label='Nœud de décision'),
            patches.Patch(color=node_colors['leaf'], label='Feuille finale'),
            patches.Patch(color=node_colors['stopped'], label='Branche arrêtée')
        ]
        ax.legend(handles=legend_elements, loc='upper right', bbox_to_anchor=(0.98, 0.98))
        
        # Sauvegarder en base64
        buffer = io.BytesIO()
        plt.savefig(buffer, format='png', dpi=150, bbox_inches='tight', 
                   facecolor='white', edgecolor='none')
        buffer.seek(0)
        
        # Convertir en base64
        image_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
        buffer.close()
        plt.close(fig)
        
        return image_base64
        
    except Exception as e:

        return ""

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
        
        # Note: Les diagrammes sont maintenant générés côté frontend avec Chart.js
        story.append(Paragraph("<b>📊 Note:</b> Les diagrammes visuels sont générés côté client avec Chart.js", styles['Normal']))
        story.append(Spacer(1, 10))
        
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
                        story.append(Paragraph(f"❌ Erreur lors du traitement de la valeur {target_value}", styles['Normal']))
                
                story.append(Spacer(1, 25))
            except Exception as e:
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
        return ""

async def build_decision_tree_with_pdf(filename: str, variables_explicatives: List[str], 
                                     variables_a_expliquer: List[str], selected_data: Dict[str, Any], 
                                     min_population_threshold: Optional[int] = None,
                                     treatment_mode: str = 'independent') -> Dict[str, Any]:
    """
    Construit l'arbre de décision et génère le PDF correspondant.
    """
    # Construire l'arbre
    tree_result = await build_decision_tree(filename, variables_explicatives, variables_a_expliquer, selected_data, min_population_threshold, treatment_mode)
    
    if "error" in tree_result:
        return tree_result
    
    # Générer le PDF
    pdf_base64 = generate_tree_pdf(tree_result["decision_trees"], filename)
    
    if pdf_base64:
        tree_result["pdf_base64"] = pdf_base64
        tree_result["pdf_generated"] = True
    else:
        tree_result["pdf_generated"] = False
    
    return tree_result

def analyze_sample_filtering_impact(df: pd.DataFrame, filtered_df: pd.DataFrame, 
                                   variables_explicatives: List[str]) -> Dict[str, Any]:
    """
    Analyse l'impact du filtrage de l'échantillon sur les variables explicatives.
    Retourne des avertissements et suggestions pour l'utilisateur.
    """
    warnings = []
    suggestions = []
    
    for var in variables_explicatives:
        original_unique = df[var].nunique()
        filtered_unique = filtered_df[var].nunique()
        
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
