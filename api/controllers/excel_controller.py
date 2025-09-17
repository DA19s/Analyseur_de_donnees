import os
import shutil
import tempfile
import io
import base64
from time import time

import pandas as pd
import numpy as np
from typing import Dict, List, Any, Optional, Tuple

from fastapi import HTTPException
from openpyxl import load_workbook
import xlrd

from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER


# ==============================
# Helpers lecture Excel
# ==============================

def _select_engine(path: str) -> str:
    lower = path.lower()
    if lower.endswith(".xls"):
        return "xlrd"
    return "openpyxl"


def _read_excel(
    path: str,
    nrows: Optional[int] = None,
    usecols: Optional[List[str]] = None,
) -> pd.DataFrame:
    engine = _select_engine(path)
    return pd.read_excel(path, nrows=nrows, usecols=usecols, engine=engine)


# ==============================
# Mémoire et cache
# ==============================

# uploaded_files[filename] = {"path": str, "df": Optional[pd.DataFrame], "uniques_cache": {col: {values, ts}}}
uploaded_files: Dict[str, Dict[str, Any]] = {}
_UNIQUES_TTL_SECONDS = 15 * 60


# ==============================
# Endpoints logiques
# ==============================

async def preview_excel(file):
    if not file.filename.endswith((".xls", ".xlsx")):
        raise HTTPException(status_code=400, detail="Le fichier doit être un Excel (.xls ou .xlsx)")

    try:
        # 1) Sauvegarde éphémère
        suffix = ".xlsx" if file.filename.lower().endswith(".xlsx") else ".xls"
        tmp_dir = tempfile.gettempdir()
        tmp_path = os.path.join(tmp_dir, f"preview_{next(tempfile._get_candidate_names())}{suffix}")

        try:
            file.file.seek(0)
        except Exception:
            pass

        with open(tmp_path, "wb") as out:
            shutil.copyfileobj(file.file, out)

        # 2) Lecture ultra-rapide sans Pandas
        columns: List[str] = []
        preview_records: List[Dict[str, Any]] = []
        total_rows: int = 0

        if tmp_path.lower().endswith('.xlsx'):
            wb = load_workbook(tmp_path, read_only=True, data_only=True)
            ws = wb.active
            total_rows = max(0, (ws.max_row or 0) - 1)
            # En-têtes
            header_row = next(ws.iter_rows(min_row=1, max_row=1, values_only=True), None)
            columns = [str(c) if c is not None else f"Col_{i+1}" for i, c in enumerate(header_row or [])]
            # Premières lignes
            data_iter = ws.iter_rows(min_row=2, max_row=min(ws.max_row, 6), values_only=True)
            for row in data_iter:
                rec: Dict[str, Any] = {}
                for i, val in enumerate(row or []):
                    name = columns[i] if i < len(columns) else f"Col_{i+1}"
                    if isinstance(val, float) and (np.isnan(val) or np.isinf(val)):
                        rec[name] = None
                    else:
                        rec[name] = val
                preview_records.append(rec)
        else:
            # .xls via xlrd (rapide)
            book = xlrd.open_workbook(tmp_path)
            sheet = book.sheet_by_index(0)
            total_rows = max(0, sheet.nrows - 1)
            # En-têtes
            columns = [str(x) if x is not None else f"Col_{i+1}" for i, x in enumerate(sheet.row_values(0))]
            # Premières lignes
            for r in range(1, min(sheet.nrows, 6)):
                row_vals = sheet.row_values(r)
                rec: Dict[str, Any] = {}
                for i, val in enumerate(row_vals):
                    name = columns[i] if i < len(columns) else f"Col_{i+1}"
                    if isinstance(val, float) and (np.isnan(val) or np.isinf(val)):
                        rec[name] = None
                    else:
                        rec[name] = val
                preview_records.append(rec)

        # 3) Mémorisation du fichier (DF complet non chargé ici)
        uploaded_files[file.filename] = {"path": tmp_path, "df": None, "uniques_cache": {}}

        return {
            "filename": file.filename,
            "rows": int(total_rows),
            "columns": columns,
            "preview": preview_records,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Preview failed: {str(e)}")


async def select_columns(
    filename: str,
    variables_explicatives: List[str],
    variable_a_expliquer: List[str],
    selected_data: Dict = None,
):
    if filename not in uploaded_files:
        raise HTTPException(status_code=400, detail="Fichier non trouvé. Faites d'abord /excel/preview.")

    file_ref = uploaded_files[filename]
    if file_ref.get("df") is None:
        try:
            file_ref["df"] = _read_excel(file_ref["path"])  # charge complet
        except Exception:
            raise HTTPException(status_code=400, detail="Impossible de charger le fichier complet pour l'analyse")

    df: pd.DataFrame = file_ref["df"]

    all_columns = variables_explicatives + variable_a_expliquer
    for col in all_columns:
        if col not in df.columns:
            raise HTTPException(status_code=400, detail=f"La colonne '{col}' n'existe pas dans {filename}")

    remaining_columns = list(set(df.columns) - set(all_columns))

    if selected_data is None:
        return {
            "filename": str(filename),
            "variables_explicatives": [str(c) for c in variables_explicatives],
            "variables_a_expliquer": [str(v) for v in variable_a_expliquer],
            "remaining_columns": [str(c) for c in remaining_columns],
            "remaining_data": {},  # lazy-load via /excel/get-column-values
            "message": "Veuillez sélectionner les données des colonnes restantes sur lesquelles vous voulez travailler",
        }

    X = df[variables_explicatives]

    results = []
    for var in variable_a_expliquer:
        y_data = df[var]
        y_stats = {
            "count": int(y_data.count()),
            "mean": None,
            "std": None,
            "min": None,
            "max": None,
        }
        if y_data.dtype in ["int64", "float64"]:
            try:
                y_stats["mean"] = float(y_data.mean()) if not pd.isna(y_data.mean()) else None
                y_stats["std"] = float(y_data.std()) if not pd.isna(y_data.std()) else None
                y_stats["min"] = float(y_data.min()) if not pd.isna(y_data.min()) else None
                y_stats["max"] = float(y_data.max()) if not pd.isna(y_data.max()) else None
            except Exception:
                pass

        y_preview: List[Any] = []
        for val in y_data.head(5):
            if pd.isna(val):
                y_preview.append(None)
            elif isinstance(val, (np.integer, np.floating)):
                y_preview.append(float(val) if isinstance(val, np.floating) else int(val))
            else:
                y_preview.append(str(val))

        results.append(
            {
                "variable_a_expliquer": str(var),
                "variables_explicatives": [str(c) for c in variables_explicatives],
                "X_preview": X.head(5).to_dict(orient="records"),
                "y_preview": y_preview,
                "y_stats": y_stats,
            }
        )

    selected_data_with_columns: Dict[str, List[Any]] = {}
    for col_name, selected_values in (selected_data or {}).items():
        if col_name in df.columns:
            mask = df[col_name].isin(selected_values)
            filtered_df = df[mask]
            converted_col_data: List[Any] = []
            for val in filtered_df[col_name].tolist():
                if pd.isna(val):
                    converted_col_data.append(None)
                elif isinstance(val, (np.integer, np.floating)):
                    converted_col_data.append(float(val) if isinstance(val, np.floating) else int(val))
                else:
                    converted_col_data.append(str(val))
            selected_data_with_columns[str(col_name)] = converted_col_data

    return {
        "filename": str(filename),
        "variables_explicatives": [str(c) for c in variables_explicatives],
        "variables_a_expliquer": [str(v) for v in variable_a_expliquer],
        "selected_data": selected_data_with_columns,
        "results": results,
        "summary": {
            "total_variables_explicatives": int(len(variables_explicatives)),
            "total_variables_a_expliquer": int(len(variable_a_expliquer)),
            "total_rows": int(len(df)),
            "total_selected_columns": int(len(selected_data or {})),
        },
    }


async def get_column_unique_values(filename: str, column_name: str):
    if filename not in uploaded_files:
        raise HTTPException(status_code=400, detail="Fichier non trouvé. Faites d'abord /excel/preview.")

    file_ref = uploaded_files[filename]

    # Cache
    try:
        uniques_cache = file_ref.setdefault("uniques_cache", {})
        cached = uniques_cache.get(column_name)
        if cached and (time() - cached.get("ts", 0) <= _UNIQUES_TTL_SECONDS):
            values = cached["values"]
            return {
                "filename": str(filename),
                "column_name": str(column_name),
                "unique_values": values,
                "total_unique_values": len(values),
            }
    except Exception:
        pass

    df: Optional[pd.DataFrame] = file_ref.get("df")
    try:
        if df is None:
            try:
                col_df = _read_excel(file_ref["path"], usecols=[column_name])
            except Exception:
                col_df = _read_excel(file_ref["path"])  # fallback
            if column_name not in col_df.columns:
                raise HTTPException(status_code=400, detail=f"La colonne '{column_name}' n'existe pas dans {filename}")
            series = col_df[column_name]
        else:
            if column_name not in df.columns:
                raise HTTPException(status_code=400, detail=f"La colonne '{column_name}' n'existe pas dans {filename}")
            series = df[column_name]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Lecture colonne échouée: {str(e)}")

    try:
        unique_values = series.dropna().unique()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Extraction valeurs uniques échouée: {str(e)}")

    converted_values: List[Any] = []
    for val in unique_values:
        if pd.isna(val):
            converted_values.append(None)
        elif isinstance(val, (np.integer, np.floating)):
            converted_values.append(float(val) if isinstance(val, np.floating) else int(val))
        else:
            converted_values.append(str(val))

    try:
        file_ref.setdefault("uniques_cache", {})[column_name] = {"values": converted_values, "ts": time()}
    except Exception:
        pass

    return {
        "filename": str(filename),
        "column_name": str(column_name),
        "unique_values": converted_values,
        "total_unique_values": len(converted_values),
    }


# ==============================
# Arbre de décision (logique)
# ==============================

def calculate_percentage_variance(
    df: pd.DataFrame, explanatory_var: str, target_var: str, target_value: Any
) -> float:
    try:
        target_mask = (df[target_var] == target_value) & (df[target_var].notna())
        filtered_df = df[target_mask]
        if len(filtered_df) == 0:
            return 0.0

        all_explanatory_values = df[explanatory_var].dropna().unique()
        if len(all_explanatory_values) == 0:
            return 0.0

        percentages: List[float] = []
        for explanatory_value in all_explanatory_values:
            total_explanatory = len(df[df[explanatory_var] == explanatory_value])
            target_and_explanatory = len(
                df[(df[explanatory_var] == explanatory_value)
                   & (df[target_var] == target_value)
                   & (df[target_var].notna())]
            )
            if total_explanatory > 0:
                percentages.append((target_and_explanatory / total_explanatory) * 100)

        return float(np.std(percentages)) if len(percentages) > 1 else 0.0
    except Exception:
        return 0.0


def select_best_explanatory_variable(
    df: pd.DataFrame, available_vars: List[str], target_var: str, target_value: Any
) -> Tuple[Optional[str], float]:
    best_var: Optional[str] = None
    best_variance: float = -1
    var_variances: Dict[str, float] = {}
    for var in available_vars:
        variance = calculate_percentage_variance(df, var, target_var, target_value)
        var_variances[var] = variance
    if var_variances:
        best_var = max(var_variances, key=var_variances.get)
        best_variance = var_variances[best_var]
    return best_var, best_variance


def calculate_branch_percentages(
    df: pd.DataFrame, explanatory_var: str, target_var: str, target_value: Any
) -> Dict[str, Dict[str, Any]]:
    try:
        all_explanatory_values = df[explanatory_var].dropna().unique()
        if len(all_explanatory_values) == 0:
            return {}
        branches: Dict[str, Dict[str, Any]] = {}
        for explanatory_value in all_explanatory_values:
            total_explanatory = len(df[df[explanatory_var] == explanatory_value])
            target_and_explanatory = len(
                df[(df[explanatory_var] == explanatory_value)
                   & (df[target_var] == target_value)
                   & (df[target_var].notna())]
            )
            if total_explanatory > 0:
                percentage = (target_and_explanatory / total_explanatory) * 100
                branches[str(explanatory_value)] = {
                    "count": int(target_and_explanatory),
                    "total": int(total_explanatory),
                    "percentage": round(percentage, 2),
                    "subtree": None,
                }
        return branches
    except Exception:
        return {}


def construct_tree_for_value(
    df: pd.DataFrame,
    target_value: Any,
    target_var: str,
    available_explanatory_vars: List[str],
    current_path: Optional[List[str]] = None,
    min_population_threshold: Optional[int] = None,
) -> Dict[str, Any]:
    if current_path is None:
        current_path = []

    if not available_explanatory_vars:
        return {"type": "leaf", "message": "Plus de variables explicatives disponibles"}

    best_var, best_variance = select_best_explanatory_variable(
        df, available_explanatory_vars, target_var, target_value
    )
    if best_var is None:
        return {"type": "leaf", "message": "Aucune variable explicative valide trouvée"}

    branches = calculate_branch_percentages(df, best_var, target_var, target_value)
    tree_node: Dict[str, Any] = {
        "type": "node",
        "variable": best_var,
        "variance": round(best_variance, 4),
        "branches": branches,
        "path": current_path + [best_var],
    }

    remaining_vars = [v for v in available_explanatory_vars if v != best_var]
    for branch_value, branch_data in branches.items():
        cmp_val: Any
        if branch_value == 'False':
            cmp_val = False
        elif branch_value == 'True':
            cmp_val = True
        else:
            cmp_val = branch_value
        mask = (df[best_var] == cmp_val) & (df[best_var].notna())
        filtered_df = df[mask]
        if len(filtered_df) > 0 and remaining_vars:
            if min_population_threshold and min_population_threshold > 0 and len(filtered_df) < min_population_threshold:
                branch_data["subtree"] = {
                    "type": "leaf",
                    "message": f"[ARRET] Branche arrêtée - Effectif insuffisant ({len(filtered_df)} < {min_population_threshold})",
                }
            else:
                branch_data["subtree"] = construct_tree_for_value(
                    filtered_df,
                    target_value,
                    target_var,
                    remaining_vars,
                    current_path + [best_var, branch_value],
                    min_population_threshold,
                )

    return tree_node


async def build_decision_tree(
    filename: str,
    variables_explicatives: List[str],
    variables_a_expliquer: List[str],
    selected_data: Dict[str, Any],
    min_population_threshold: Optional[int] = None,
    treatment_mode: str = 'independent',
) -> Dict[str, Any]:
    if filename not in uploaded_files:
        raise HTTPException(status_code=400, detail="Fichier non trouvé. Faites d'abord /excel/preview.")

    file_ref = uploaded_files[filename]
    if file_ref.get("df") is None:
        try:
            file_ref["df"] = _read_excel(file_ref["path"])  # charge complet
        except Exception:
            raise HTTPException(status_code=400, detail="Impossible de charger le fichier complet pour l'analyse")
    df: pd.DataFrame = file_ref["df"]

    # Colonnes restantes
    all_columns = variables_explicatives + variables_a_expliquer
    remaining_columns = [c for c in df.columns if c not in all_columns]

    # Filtrage initial
    initial_mask = pd.Series([True] * len(df), index=df.index)
    for col_name, selected_values in (selected_data or {}).items():
        if col_name in remaining_columns and selected_values:
            converted: List[Any] = []
            for val in selected_values:
                if isinstance(val, str):
                    if val.lower() == 'true':
                        converted.append(True)
                    elif val.lower() == 'false':
                        converted.append(False)
                    else:
                        converted.append(val)
                else:
                    converted.append(val)
            initial_mask = initial_mask & df[col_name].isin(converted)
    filtered_df = df[initial_mask].copy()

    # Construction selon mode
    decision_trees: Dict[str, Any] = {}

    if treatment_mode == 'together':
        combined_mask = pd.Series([False] * len(filtered_df), index=filtered_df.index)
        if len(variables_a_expliquer) == 1:
            target_var = variables_a_expliquer[0]
            if target_var in selected_data and selected_data[target_var]:
                combined_mask = filtered_df[target_var].isin(selected_data[target_var])
            else:
                combined_mask = filtered_df[target_var].notna()
        else:
            for target_var in variables_a_expliquer:
                if target_var in selected_data and selected_data[target_var]:
                    var_mask = filtered_df[target_var].isin(selected_data[target_var])
                else:
                    var_mask = filtered_df[target_var].notna()
                combined_mask = combined_mask | var_mask
        combined_df = filtered_df.copy()
        combined_df['_combined_target'] = combined_mask
        tree = construct_tree_for_value(
            combined_df, True, '_combined_target', variables_explicatives.copy(), [], min_population_threshold
        )
        combined_name = variables_a_expliquer[0] if len(variables_a_expliquer) == 1 else " + ".join(variables_a_expliquer)
        decision_trees[combined_name] = {"Combined": tree}
    else:
        for target_var in variables_a_expliquer:
            if target_var in selected_data and selected_data[target_var]:
                target_values = selected_data[target_var]
            else:
                target_values = filtered_df[target_var].dropna().unique()
            target_trees: Dict[str, Any] = {}
            for target_value in target_values:
                tree = construct_tree_for_value(
                    filtered_df, target_value, target_var, variables_explicatives.copy(), [], min_population_threshold
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
        "treatment_mode": treatment_mode,
    }


# ==============================
# PDF (texte) – conservé
# ==============================

def generate_tree_pdf(decision_trees: Dict[str, Any], filename: str) -> str:
    try:
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4)
        story: List[Any] = []

        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'CustomTitle', parent=styles['Heading1'], fontSize=20, spaceAfter=25, alignment=TA_CENTER, textColor=colors.darkblue
        )
        subtitle_style = ParagraphStyle('CustomSubtitle', parent=styles['Heading2'], fontSize=16, spaceAfter=20, textColor=colors.darkgreen)
        node_style = ParagraphStyle('NodeStyle', parent=styles['Normal'], fontSize=12, spaceAfter=8, textColor=colors.darkblue, leftIndent=20)
        branch_style = ParagraphStyle('BranchStyle', parent=styles['Normal'], fontSize=11, spaceAfter=6, textColor=colors.purple, leftIndent=40)
        leaf_style = ParagraphStyle('LeafStyle', parent=styles['Normal'], fontSize=10, spaceAfter=4, textColor=colors.darkgreen, leftIndent=60)

        story.append(Paragraph("🌳 ARBRE DE DÉCISION - ANALYSE STATISTIQUE", title_style))
        story.append(Spacer(1, 25))
        story.append(Paragraph(f"📁 <b>Fichier:</b> {filename}", styles['Normal']))
        story.append(Spacer(1, 15))

        def add_tree_to_story(node, level=0, path=""):
            try:
                if node.get("type") == "leaf":
                    story.append(Paragraph(f"🍃 {node.get('message', 'Fin de branche')}", leaf_style))
                else:
                    indent = "&nbsp;" * (level * 8)
                    story.append(Paragraph(f"{indent}🌿 <b>{node['variable']}</b> (Écart-type: {node['variance']})", node_style))
                    branches = list(node['branches'].items())
                    mid_point = len(branches) // 2
                    if mid_point > 0:
                        story.append(Paragraph(f"{indent}&nbsp;&nbsp;├─ <b>BRANCHES GAUCHES:</b>", branch_style))
                        for branch_value, branch_data in branches[:mid_point]:
                            story.append(Paragraph(f"{indent}&nbsp;&nbsp;&nbsp;&nbsp;├─ <b>{branch_value}</b>: {branch_data['count']} ({branch_data['percentage']}%)", branch_style))
                            if branch_data.get('subtree'):
                                add_tree_to_story(branch_data['subtree'], level + 1, f"{path} → {branch_value}")
                    if len(branches) > mid_point:
                        story.append(Paragraph(f"{indent}&nbsp;&nbsp;├─ <b>BRANCHES DROITES:</b>", branch_style))
                        for branch_value, branch_data in branches[mid_point:]:
                            story.append(Paragraph(f"{indent}&nbsp;&nbsp;&nbsp;&nbsp;├─ <b>{branch_value}</b>: {branch_data['count']} ({branch_data['percentage']}%)", branch_style))
                            if branch_data.get('subtree'):
                                add_tree_to_story(branch_data['subtree'], level + 1, f"{path} → {branch_value}")
                    story.append(Spacer(1, 10))
            except Exception:
                story.append(Paragraph("❌ Erreur lors de l'affichage du nœud", styles['Normal']))

        for target_var, target_trees in decision_trees.items():
            try:
                story.append(Paragraph(f"🎯 <b>VARIABLE À EXPLIQUER: {target_var}</b>", subtitle_style))
                story.append(Spacer(1, 15))
                for target_value, tree in target_trees.items():
                    try:
                        story.append(Paragraph(f"📊 <b>VALEUR CIBLE: {target_value}</b>", styles['Heading3']))
                        story.append(Spacer(1, 10))
                        add_tree_to_story(tree, 0, target_value)
                        story.append(Spacer(1, 20))
                    except Exception:
                        story.append(Paragraph(f"❌ Erreur lors du traitement de la valeur {target_value}", styles['Normal']))
                story.append(Spacer(1, 25))
            except Exception:
                story.append(Paragraph(f"❌ Erreur lors du traitement de la variable {target_var}", styles['Normal']))

        doc.build(story)
        pdf_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
        buffer.close()
        return pdf_base64
    except Exception:
        return ""


async def build_decision_tree_with_pdf(
    filename: str,
    variables_explicatives: List[str],
    variables_a_expliquer: List[str],
    selected_data: Dict[str, Any],
    min_population_threshold: Optional[int] = None,
    treatment_mode: str = 'independent',
) -> Dict[str, Any]:
    tree_result = await build_decision_tree(
        filename,
        variables_explicatives,
        variables_a_expliquer,
        selected_data,
        min_population_threshold,
        treatment_mode,
    )
    if "error" in tree_result:
        return tree_result
    pdf_base64 = generate_tree_pdf(tree_result["decision_trees"], filename)
    tree_result["pdf_generated"] = bool(pdf_base64)
    if pdf_base64:
        tree_result["pdf_base64"] = pdf_base64
    return tree_result


def analyze_sample_filtering_impact(df: pd.DataFrame, filtered_df: pd.DataFrame, variables_explicatives: List[str]) -> Dict[str, Any]:
    warnings: List[str] = []
    suggestions: List[str] = []
    for var in variables_explicatives:
        original_unique = df[var].nunique()
        filtered_unique = filtered_df[var].nunique()
        if filtered_unique == 1:
            warnings.append(f"⚠️ Variable '{var}' n'a plus qu'une seule valeur unique dans l'échantillon filtré")
            suggestions.append(f"Considérez élargir la selection pour '{var}' ou la retirer des variables explicatives")
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
        "reduction_percentage": round(((len(df) - len(filtered_df)) / len(df) * 100), 1),
    }

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
                    "count": int(target_and_explanatory),
                    "percentage": round(percentage, 2),
                    "subtree": None  # Sera rempli récursivement
                }
        
        return branches
        
    except Exception as e:
        return {}

def construct_tree_for_value(df: pd.DataFrame, target_value: Any, target_var: str, 
                           available_explanatory_vars: List[str], current_path: List[str] = None) -> Dict[str, Any]:
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
            # Construire le sous-arbre récursivement
            subtree = construct_tree_for_value(
                filtered_df, target_value, target_var, 
                remaining_vars, current_path + [best_var, branch_value]
            )
            branch_data["subtree"] = subtree
    
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
    
    # Étape 2: Construire l'arbre pour chaque variable à expliquer
    
    decision_trees = {}
    
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
                variables_explicatives.copy(), []
            )
            
            target_trees[str(target_value)] = tree
        
        decision_trees[target_var] = target_trees
    
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
                                     variables_a_expliquer: List[str], selected_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Construit l'arbre de décision et génère le PDF correspondant.
    """
    # Construire l'arbre
    tree_result = await build_decision_tree(filename, variables_explicatives, variables_a_expliquer, selected_data)
    
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
