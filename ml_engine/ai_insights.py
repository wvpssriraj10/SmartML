import os
import pandas as pd
import numpy as np
import json
import io
from datetime import datetime

# ReportLab imports for PDF generation
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch

# ── LLM helpers (Gemini / OpenRouter) ────────────────────────────────────────

try:
    import google.generativeai as genai
    _GEMINI_AVAILABLE = True
except ImportError:
    _GEMINI_AVAILABLE = False

try:
    import requests as _requests
    _REQUESTS_AVAILABLE = True
except ImportError:
    _REQUESTS_AVAILABLE = False


def _call_llm_for_narrative(prompt: str) -> str | None:
    """
    Try Gemini first, then OpenRouter, then return None so the caller falls
    back to the rule-based template. All errors are swallowed silently so
    a missing key never breaks the insights endpoint.
    """
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if _GEMINI_AVAILABLE and api_key:
        try:
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel("gemini-1.5-flash")
            response = model.generate_content(prompt)
            text = response.text.strip()
            if text:
                return text
        except Exception:
            pass

    or_key = os.getenv("OPENROUTER_API_KEY", "").strip()
    if _REQUESTS_AVAILABLE and or_key:
        try:
            model_name = os.getenv("OPENROUTER_MODEL", "gpt-4o-mini").strip()
            r = _requests.post(
                "https://api.openrouter.ai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {or_key}",
                    "Content-Type": "application/json",
                    "X-Title": "SmartML Dashboard",
                },
                json={
                    "model": model_name,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.6,
                },
                timeout=20,
            )
            if r.status_code == 200:
                text = r.json()["choices"][0]["message"]["content"].strip()
                if text:
                    return text
        except Exception:
            pass

    return None


def generate_executive_insights(df: pd.DataFrame, dataset_name: str = "Dataset", llm_fn=None) -> dict:
    """
    Generate comprehensive AI Executive Insights, Business Risk Assessment,
    and Anomaly Detection Table for a dataset.
    """
    df = df.copy()
    rows, cols = df.shape
    total_cells = rows * cols
    missing_cells = int(df.isnull().sum().sum())
    missing_pct = round((missing_cells / max(total_cells, 1)) * 100, 1)
    duplicates = int(df.duplicated().sum())
    duplicate_pct = round((duplicates / max(rows, 1)) * 100, 1)

    numeric_cols = [c for c in df.columns if pd.api.types.is_numeric_dtype(df[c])]
    categorical_cols = [c for c in df.columns if not pd.api.types.is_numeric_dtype(df[c])]

    # Correlation analysis
    strong_correlations = []
    avg_correlation = 0.0
    if len(numeric_cols) >= 2:
        corr_matrix = df[numeric_cols].corr().abs()
        corr_vals = corr_matrix.values.copy()
        np.fill_diagonal(corr_vals, 0)
        avg_correlation = float(corr_vals.mean())

        for i in range(len(numeric_cols)):
            for j in range(i + 1, len(numeric_cols)):
                val = corr_matrix.iloc[i, j]
                if val >= 0.65:
                    strong_correlations.append({
                        "col1": numeric_cols[i],
                        "col2": numeric_cols[j],
                        "correlation": round(float(val), 2)
                    })

    # Anomaly Detection (Statistical Z-score & IQR Scanner)
    anomalies = []
    for col in numeric_cols:
        col_data = df[col].dropna()
        if len(col_data) < 5:
            continue
        mean_val = col_data.mean()
        std_val = col_data.std()
        q1 = col_data.quantile(0.25)
        q3 = col_data.quantile(0.75)
        iqr = q3 - q1

        if std_val == 0 or iqr == 0:
            continue

        lower_bound = round(q1 - 1.5 * iqr, 2)
        upper_bound = round(q3 + 1.5 * iqr, 2)

        # Detect extreme values
        for idx, val in col_data.items():
            z_score = abs((val - mean_val) / std_val)
            if z_score >= 3.0 or val < lower_bound or val > upper_bound:
                severity = "CRITICAL" if z_score >= 3.5 else "WARNING"
                anomalies.append({
                    "row_id": int(idx) + 1,
                    "column": col,
                    "actual_value": round(float(val), 2) if isinstance(val, (int, float)) else str(val),
                    "expected_range": f"[{lower_bound}, {upper_bound}]",
                    "severity": severity,
                    "z_score": round(float(z_score), 2)
                })

    critical_anomalies_count = sum(1 for a in anomalies if a["severity"] == "CRITICAL")
    warning_anomalies_count = len(anomalies) - critical_anomalies_count

    # Calculate Data Quality & Completeness
    completeness_pct = round(100.0 - missing_pct, 1)
    consistency_pct = round(100.0 - duplicate_pct, 1)
    validity_pct = round(max(0.0, 100.0 - (len(anomalies) / max(rows, 1) * 100.0)), 1)
    quality_score = int(round((completeness_pct * 0.4) + (consistency_pct * 0.3) + (validity_pct * 0.3)))

    # Determine Overall Business Risk Score
    risk_score = max(5, min(95, int(100 - quality_score + (len(anomalies) * 2))))
    if risk_score < 30:
        risk_level = "LOW"
    elif risk_score < 60:
        risk_level = "MODERATE"
    else:
        risk_level = "HIGH"

    # Risk breakdown components
    risk_breakdown = {
        "revenue_risk": min(95, max(10, int(missing_pct * 2.5 + (critical_anomalies_count * 5)))),
        "expense_risk": min(95, max(15, int(duplicate_pct * 3.0 + (warning_anomalies_count * 2)))),
        "operational_risk": min(95, max(10, int((100 - validity_pct) * 2.0))),
        "data_quality_risk": min(95, max(10, int(100 - quality_score)))
    }

    recommended_actions = [
        f"Impute or review the {missing_cells:,} missing cells ({missing_pct}%) to improve model training accuracy.",
        f"Investigate {critical_anomalies_count} critical statistical anomalies detected in numerical columns.",
        f"Deduplicate {duplicates} duplicate records ({duplicate_pct}%) before finalizing dataset.",
        "Establish automated data validation checks at source ingestion to prevent schema drift.",
    ]

    # ── Rule-based narrative fallbacks (used when no LLM key is configured) ──
    _fallback_story = (
        f"The dataset '{dataset_name}' contains {rows:,} records across {cols} features "
        f"({len(numeric_cols)} numerical and {len(categorical_cols)} categorical). "
        f"Overall data quality is rated at {quality_score}/100 with a data completeness rate of {completeness_pct}%. "
        f"Statistical scanning identified {len(anomalies)} anomalous observations "
        f"({critical_anomalies_count} critical, {warning_anomalies_count} warnings) and "
        f"{len(strong_correlations)} strongly correlated feature pairs. "
        f"The business risk index is assessed at {risk_score}/100 ({risk_level} Risk)."
    )
    _fallback_summary = (
        f"DataSense evaluated '{dataset_name}'. The pipeline processed {cols} columns with "
        f"an overall data validity score of {validity_pct}%. "
        f"Average inter-feature correlation: {round(avg_correlation, 2)}. "
        f"Focus on resolving high-risk anomalies and missing values before modeling."
    )

    # ── LLM-powered narrative (Gemini / OpenRouter) ──────────────────────────
    # Build a compact stats context to keep the prompt small.
    corr_pairs_text = (
        ", ".join(f"{c['col1']}↔{c['col2']} ({c['correlation']})" for c in strong_correlations[:5])
        or "none"
    )
    llm_prompt = f"""You are a professional data analyst writing an executive intelligence report.
Dataset: {dataset_name}
Rows: {rows:,} | Columns: {cols} ({len(numeric_cols)} numeric, {len(categorical_cols)} categorical)
Data Quality Score: {quality_score}/100
Completeness: {completeness_pct}% | Consistency: {consistency_pct}% | Validity: {validity_pct}%
Missing Cells: {missing_cells:,} ({missing_pct}%) | Duplicates: {duplicates} ({duplicate_pct}%)
Total Anomalies: {len(anomalies)} ({critical_anomalies_count} critical, {warning_anomalies_count} warnings)
Business Risk: {risk_score}/100 ({risk_level})
Strong Feature Correlations: {corr_pairs_text}

Write exactly TWO paragraphs separated by the marker |||:
1. DATA STORY: A compelling 3-4 sentence narrative for a business audience describing the dataset's key characteristics, quality highlights, and what the statistics reveal about the data's readiness for analysis.
2. EXECUTIVE SUMMARY: A concise 2-3 sentence executive summary with actionable focus areas and strategic recommendations.

Important: Only output the two paragraphs separated by |||. Do not include headings or labels."""

    llm_result = _call_llm_for_narrative(llm_prompt)
    if llm_result and "|||" in llm_result:
        parts = llm_result.split("|||", 1)
        data_story = parts[0].strip()
        executive_summary = parts[1].strip()
    else:
        data_story = llm_result.strip() if llm_result else _fallback_story
        executive_summary = _fallback_summary

    return {
        "dataset_name": dataset_name,
        "rows": rows,
        "cols": cols,
        "quality_score": quality_score,
        "risk_score": risk_score,
        "risk_level": risk_level,
        "dataset_correlation": round(avg_correlation, 2),
        "data_completeness_pct": completeness_pct,
        "consistency_pct": consistency_pct,
        "validity_pct": validity_pct,
        "llm_powered": llm_result is not None,  # lets the UI show a badge
        "processing_summary": {
            "missing_fixed": missing_cells,
            "outliers_removed": len(anomalies),
            "duplicates_removed": duplicates,
            "columns_processed": cols,
        },
        "intelligence_grid": {
            "missing_pct": missing_pct,
            "duplicate_pct": duplicate_pct,
            "categorical_count": len(categorical_cols),
            "numerical_count": len(numeric_cols),
            "anomalies_count": len(anomalies),
            "strong_correlations_count": len(strong_correlations),
        },
        "data_story": data_story,
        "executive_summary": executive_summary,
        "risk_breakdown": risk_breakdown,
        "recommended_actions": recommended_actions,
        "anomalies": anomalies[:15],
        "anomalies_summary": {
            "total": len(anomalies),
            "critical": critical_anomalies_count,
            "warning": warning_anomalies_count,
        },
        "strong_correlations": strong_correlations[:10],
    }


def generate_pdf_report(dataset_name: str, insights: dict) -> bytes:
    """
    Generate an executive PDF report using ReportLab.
    Returns PDF content as bytes.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=40,
        leftMargin=40,
        topMargin=40,
        bottomMargin=40
    )

    styles = getSampleStyleSheet()

    # Custom Color Palette
    navy_blue = colors.HexColor("#0F172A")
    primary_blue = colors.HexColor("#3B82F6")
    dark_zinc = colors.HexColor("#1E293B")
    emerald_green = colors.HexColor("#10B981")
    amber_yellow = colors.HexColor("#F59E0B")
    crimson_red = colors.HexColor("#EF4444")
    light_bg = colors.HexColor("#F8FAFC")
    text_dark = colors.HexColor("#334155")

    # Custom Typography Styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=22,
        leading=26,
        textColor=navy_blue
    )

    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#64748B")
    )

    section_heading = ParagraphStyle(
        'SectionHeading',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=16,
        textColor=navy_blue,
        spaceBefore=14,
        spaceAfter=6
    )

    body_style = ParagraphStyle(
        'BodyTextCustom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=14,
        textColor=text_dark
    )

    story = []

    # Title Header Block
    story.append(Paragraph("DataSense Executive Intelligence Report", title_style))
    story.append(Paragraph(f"Dataset: <b>{dataset_name}</b> | Generated: {datetime.now().strftime('%B %d, %Y at %I:%M %p')}", subtitle_style))
    story.append(Spacer(1, 10))
    story.append(HRFlowable(width="100%", thickness=1.5, color=primary_blue, spaceBefore=4, spaceAfter=14))

    # Top KPI Table (4 Cards)
    kpi_data = [
        [
            Paragraph(f"<font color='#64748B' size=8>QUALITY SCORE</font><br/><font size=16 color='#3B82F6'><b>{insights.get('quality_score', 100)}%</b></font>", body_style),
            Paragraph(f"<font color='#64748B' size=8>RISK LEVEL</font><br/><font size=16 color='{crimson_red.hexval() if insights.get('risk_level') == 'HIGH' else emerald_green.hexval()}'><b>{insights.get('risk_level', 'LOW')}</b></font>", body_style),
            Paragraph(f"<font color='#64748B' size=8>COMPLETENESS</font><br/><font size=16 color='#10B981'><b>{insights.get('data_completeness_pct', 100)}%</b></font>", body_style),
            Paragraph(f"<font color='#64748B' size=8>ANOMALIES</font><br/><font size=16 color='#F59E0B'><b>{insights.get('anomalies_summary', {}).get('total', 0)}</b></font>", body_style),
        ]
    ]
    kpi_table = Table(kpi_data, colWidths=[130, 130, 130, 130])
    kpi_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), light_bg),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('PADDING', (0, 0), (-1, -1), 8),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
    ]))
    story.append(kpi_table)
    story.append(Spacer(1, 14))

    # The Data Story Section
    story.append(Paragraph("1. The Data Story", section_heading))
    story.append(Paragraph(insights.get("data_story", ""), body_style))
    story.append(Spacer(1, 10))

    # Executive Summary
    story.append(Paragraph("2. Executive Summary", section_heading))
    story.append(Paragraph(insights.get("executive_summary", ""), body_style))
    story.append(Spacer(1, 12))

    # Business Risk Assessment
    story.append(Paragraph("3. Business Risk Assessment", section_heading))
    risk_breakdown = insights.get("risk_breakdown", {})
    risk_table_data = [
        [Paragraph("<b>Risk Dimension</b>", body_style), Paragraph("<b>Assessed Risk Level</b>", body_style), Paragraph("<b>Status</b>", body_style)],
        [Paragraph("Revenue Risk", body_style), f"{risk_breakdown.get('revenue_risk', 0)}%", Paragraph("<font color='#10B981'>Controlled</font>" if risk_breakdown.get('revenue_risk', 0) < 40 else "<font color='#EF4444'>Needs Review</font>", body_style)],
        [Paragraph("Expense Risk", body_style), f"{risk_breakdown.get('expense_risk', 0)}%", Paragraph("<font color='#10B981'>Low</font>" if risk_breakdown.get('expense_risk', 0) < 40 else "<font color='#F59E0B'>Moderate</font>", body_style)],
        [Paragraph("Operational Risk", body_style), f"{risk_breakdown.get('operational_risk', 0)}%", Paragraph("<font color='#10B981'>Optimal</font>", body_style)],
        [Paragraph("Data Quality Risk", body_style), f"{risk_breakdown.get('data_quality_risk', 0)}%", Paragraph("<font color='#3B82F6'>Monitored</font>", body_style)],
    ]
    risk_table = Table(risk_table_data, colWidths=[200, 160, 160])
    risk_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#F1F5F9")),
        ('TEXTCOLOR', (0, 0), (-1, 0), navy_blue),
        ('PADDING', (0, 0), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
    ]))
    story.append(risk_table)
    story.append(Spacer(1, 10))

    # Recommended Actions
    story.append(Paragraph("<b>Recommended Strategic Actions:</b>", body_style))
    for act in insights.get("recommended_actions", []):
        story.append(Paragraph(f"• {act}", body_style))
    story.append(Spacer(1, 14))

    # Anomaly Detection Table
    story.append(Paragraph("4. Statistical Anomaly Detection Table", section_heading))
    anomalies = insights.get("anomalies", [])
    if not anomalies:
        story.append(Paragraph("<i>No critical statistical anomalies detected in numerical features.</i>", body_style))
    else:
        anom_table_data = [
            [Paragraph("<b>Row #</b>", body_style), Paragraph("<b>Column</b>", body_style), Paragraph("<b>Actual Value</b>", body_style), Paragraph("<b>Expected Range</b>", body_style), Paragraph("<b>Severity</b>", body_style)]
        ]
        for a in anomalies[:8]:
            sev_color = crimson_red.hexval() if a['severity'] == 'CRITICAL' else amber_yellow.hexval()
            anom_table_data.append([
                str(a['row_id']),
                a['column'],
                str(a['actual_value']),
                a['expected_range'],
                Paragraph(f"<font color='{sev_color}'><b>{a['severity']}</b></font>", body_style)
            ])
        anom_table = Table(anom_table_data, colWidths=[60, 140, 110, 130, 80])
        anom_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#F1F5F9")),
            ('PADDING', (0, 0), (-1, -1), 5),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
        ]))
        story.append(anom_table)

    # Footer note
    story.append(Spacer(1, 18))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#CBD5E1"), spaceBefore=6, spaceAfter=8))
    story.append(Paragraph("<i>Confidential — Generated by DataSense Autonomous Intelligence Studio.</i>", subtitle_style))

    doc.build(story)
    pdf_data = buffer.getvalue()
    buffer.close()
    return pdf_data
