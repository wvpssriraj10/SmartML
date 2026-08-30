"""
LLM Agent for SmartML Dashboard.
Uses OpenRouter (free models) or Google Gemini API for dataset understanding and model explanation.
Falls back to rule-based responses if no API key is set.
"""
import os
import json
import re
from typing import Optional
import requests
from dotenv import load_dotenv

# Load environment variables from a root .env file when imported.
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False


GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "").strip()
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "").strip()


def _get_gemini_client():
    if not GEMINI_AVAILABLE or not GEMINI_API_KEY:
        return None
    genai.configure(api_key=GEMINI_API_KEY)
    return genai.GenerativeModel("gemini-1.5-flash")


def _build_system_prompt(inspection: dict, job_context: dict) -> str:
    col_names = inspection.get("column_names", [])
    num_cols = inspection.get("numeric_columns", [])
    cat_cols = inspection.get("categorical_columns", [])
    rows = inspection.get("rows", "?")
    cols = inspection.get("columns", "?")
    missing = inspection.get("missing_values", {})
    total_missing = sum(v for v in missing.values() if v)

    # Compact column stats: show up to 10 columns with type, missing pct, unique count
    col_stats = inspection.get("column_stats") or {}
    stats_lines = []
    try:
        for c in col_names[:10]:
            cs = col_stats.get(c, {})
            typ = cs.get('dtype') or ('numeric' if c in num_cols else ('categorical' if c in cat_cols else 'unknown'))
            missing_pct = cs.get('missing_pct')
            if missing_pct is None:
                try:
                    missing_val = cs.get('missing', 0)
                    missing_pct = round((missing_val / max(1, rows)) * 100, 2) if isinstance(rows, int) else cs.get('missing_pct', 0)
                except Exception:
                    missing_pct = cs.get('missing_pct', 0)
            unique = cs.get('unique_count') or cs.get('unique') or 'N/A'
            stats_lines.append(f"- {c}: type={typ}, missing={missing_pct}%, unique={unique}")
    except Exception:
        stats_lines = []

    # Sample rows (up to 5), converted to compact JSON lines
    sample = inspection.get('sample') or []
    sample_lines = []
    try:
        for r in sample[:5]:
            row_repr = {k: (str(v)[:120] + '...' if isinstance(v, str) and len(v) > 120 else v) for k, v in r.items()}
            sample_lines.append(json.dumps(row_repr, ensure_ascii=False))
    except Exception:
        sample_lines = []

    job_ctx = json.dumps(job_context, indent=2) if job_context else 'No training results yet.'

    return f"""You are SmartML Assistant, a versatile general-purpose AI assistant and expert data scientist embedded in the SmartML Dashboard.

GENERAL CAPABILITIES & INSTRUCTIONS:
- You are a full general-purpose LLM. Answer ANY question on ANY topic (general knowledge, coding, mathematics, science, machine learning, writing, logic, general queries, etc.).
- You are NOT restricted to talking about datasets or machine learning. If the user asks a question unrelated to the dataset or ML (e.g. "What is quicksort?", "How do HTTP requests work?", "Explain quantum computing"), answer their question accurately, completely, and directly.
- The dataset information below is provided as ADDITIONAL CONTEXT for reference when relevant. Use it whenever the user asks about their dataset, columns, data cleaning, modeling, or evaluation metrics, but do not force dataset context into responses when the user is asking general questions.

DATASET CONTEXT (REFERENCE WHEN RELEVANT):
- Active Dataset Dimensions: {rows} rows, {cols} columns
- Column names: {', '.join(col_names[:20])}{'...' if len(col_names) > 20 else ''}
- Numeric columns: {', '.join(num_cols[:10])}
- Categorical columns: {', '.join(cat_cols[:10])}
- Total missing values: {total_missing}

COLUMN STATS SAMPLE:
{chr(10).join(stats_lines) if stats_lines else 'No column stats available.'}

SAMPLE ROWS:
{chr(10).join(sample_lines) if sample_lines else 'No sample available.'}

MODEL & TRAINING CONTEXT:
{job_ctx}

RECOMMENDATION FORMAT (ONLY WHEN SUGGESTING TARGETS):
When explicitly suggesting a target column or problem type for ML training, end your message with a JSON block in this exact format:
<suggestion>{{"target_column": "column_name", "problem_type": "classification|regression"}}</suggestion>
Only include this if you are confident about a target suggestion.
"""


def _rule_based_response(message: str, inspection: dict, results_context: dict) -> dict:
    """Fallback rule-based assistant when no LLM API is available."""
    msg_lower = message.lower()
    col_names = inspection.get("column_names", [])
    num_cols = inspection.get("numeric_columns", [])
    cat_cols = inspection.get("categorical_columns", [])

    # Check for target suggestion queries
    target_keywords = ["predict", "target", "label", "classify", "forecast", "outcome", "what should"]
    if any(k in msg_lower for k in target_keywords):
        preferred = ['target', 'label', 'class', 'output', 'y', 'result', 'churn', 'price', 'salary',
                     'diagnosis', 'survived', 'species', 'type', 'category', 'outcome']
        suggested = None
        for p in preferred:
            for col in col_names:
                if p in col.lower():
                    suggested = col
                    break
            if suggested:
                break

        if not suggested and col_names:
            suggested = col_names[-1]

        if suggested:
            problem_type = "classification" if suggested in cat_cols else (
                "regression" if suggested in num_cols else "classification"
            )
            return {
                "reply": f"Based on your dataset, I suggest using **`{suggested}`** as the target column. "
                         f"It looks like a **{problem_type}** problem. "
                         f"Does that sound right? You can confirm below or pick a different column.",
                "suggested_target": suggested,
                "suggested_problem_type": problem_type
            }

    # Check for results/model questions
    if results_context and any(k in msg_lower for k in ["best model", "result", "accuracy", "performance", "which model"]):
        best = results_context.get("best_model")
        if best:
            name = best.get("name", "Unknown")
            metrics = best.get("metrics", {})
            metric_str = ", ".join(f"{k}: {round(v, 4)}" for k, v in metrics.items() if isinstance(v, (int, float)))
            return {
                "reply": f"🏆 **{name}** is your best performing model!\n\n"
                         f"Key metrics: {metric_str}\n\n"
                         f"This model was selected based on its overall performance on your holdout test set. "
                         f"You can download the deployable code using the Export button.",
                "suggested_target": None,
                "suggested_problem_type": None
            }

    # Missing values question
    if "missing" in msg_lower:
        missing = inspection.get("missing_values", {})
        bad = {k: v for k, v in missing.items() if v and v > 0}
        if bad:
            rows = inspection.get("rows", 1)
            top = sorted(bad.items(), key=lambda x: x[1], reverse=True)[:5]
            details = "\n".join(f"  - `{k}`: {v} missing ({round(v/rows*100, 1)}%)" for k, v in top)
            return {
                "reply": f"Your dataset has missing values in {len(bad)} column(s):\n{details}\n\n"
                         f"SmartML automatically handles these using median imputation for numeric columns.",
                "suggested_target": None,
                "suggested_problem_type": None
            }
        else:
            return {
                "reply": "✅ Great news! Your dataset has **no missing values**. It's clean and ready for training.",
                "suggested_target": None,
                "suggested_problem_type": None
            }

    # General greeting / intro
    if any(k in msg_lower for k in ["hello", "hi", "hey", "help", "start", "what can"]):
        rows = inspection.get("rows", "?")
        cols_count = inspection.get("columns", "?")
        return {
            "reply": f"👋 Hi! I'm your SmartML Assistant.\n\n"
                     f"I'm a general AI assistant! You can ask me **any question** (coding, math, general knowledge, machine learning), "
                     f"or ask specifically about your uploaded dataset (**{rows} rows**, **{cols_count} columns**).\n\n"
                     f"How can I help you today?",
            "suggested_target": None,
            "suggested_problem_type": None
        }

    # Default fallback
    cols_preview = ", ".join(f"`{c}`" for c in col_names[:8]) if col_names else "none"
    return {
        "reply": (
            f"I am ready to answer any question or assist with your dataset.\n\n"
            f"*(Tip: Set `GEMINI_API_KEY` or `OPENROUTER_API_KEY` in `.env` to enable live LLM answers for all topics).* \n\n"
            f"Uploaded dataset context: {rows if 'rows' in inspection else '?'} rows, Columns = {cols_preview}."
        ),
        "suggested_target": None,
        "suggested_problem_type": None
    }


def _parse_suggestion_text(text: str) -> Optional[dict]:
    """Try several patterns to extract a suggestion JSON object from model output.
    Returns a dict or None.
    """
    if not text:
        return None

    # 1) <suggestion>...</suggestion>
    m = re.search(r'<suggestion>(.*?)</suggestion>', text, re.DOTALL | re.IGNORECASE)
    if m:
        payload = m.group(1).strip()
        try:
            return json.loads(payload)
        except Exception:
            pass

    # 2) ```json ... ``` fenced block
    m = re.search(r'```json\s*(\{.*?\})\s*```', text, re.DOTALL | re.IGNORECASE)
    if m:
        try:
            return json.loads(m.group(1))
        except Exception:
            pass

    # 3) plain JSON object that includes "target_column"
    m = re.search(r'(\{[\s\S]*?"target_column"[\s\S]*?\})', text)
    if m:
        try:
            return json.loads(m.group(1))
        except Exception:
            pass

    # 4) line starting with SUGGESTION: { ... }
    m = re.search(r'SUGGESTION:\s*(\{.*?\})', text, re.IGNORECASE)
    if m:
        try:
            return json.loads(m.group(1))
        except Exception:
            pass

    return None


def _validate_and_normalize_suggestion(sugg: dict, inspection: dict) -> Optional[dict]:
    """Ensure suggested target exists (or maps) to a real column name and normalize problem type."""
    if not sugg or not isinstance(sugg, dict):
        return None

    col_names = inspection.get('column_names') or [c.get('name') for c in inspection.get('columns', []) if c.get('name')]
    col_names = [c for c in (col_names or [])]
    if not col_names:
        return None

    target = sugg.get('target_column') or sugg.get('target')
    if not target or not isinstance(target, str):
        return None

    # Direct case-insensitive match
    for c in col_names:
        if c and c.lower() == target.strip().lower():
            problem = (sugg.get('problem_type') or sugg.get('problem') or '').lower()
            problem = 'classification' if 'class' in problem else ('regression' if 'regress' in problem else None)
            return {
                'target_column': c,
                'problem_type': problem
            }

    # Substring match
    t_low = target.strip().lower()
    for c in col_names:
        if c and (t_low in c.lower() or c.lower() in t_low):
            problem = (sugg.get('problem_type') or sugg.get('problem') or '').lower()
            problem = 'classification' if 'class' in problem else ('regression' if 'regress' in problem else None)
            return {'target_column': c, 'problem_type': problem}

    # No good match
    return None


def _strip_suggestion_payload(text: str) -> str:
    """Remove any suggestion payload snippets from the assistant reply."""
    text = re.sub(r'<suggestion>.*?</suggestion>', '', text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r'```json\s*\{.*?\}\s*```', '', text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r'SUGGESTION:\s*\{.*?\}', '', text, flags=re.IGNORECASE)
    return text.strip()


def _call_openrouter(message: str, inspection: dict, history: list, job_context: dict) -> Optional[dict]:
    if not OPENROUTER_API_KEY:
        print("[DEBUG] OpenRouter skipped: no API key")
        return None
    try:
        system_prompt = _build_system_prompt(inspection, job_context)
        
        # Prepare messages
        messages = [{"role": "system", "content": system_prompt}]
        for msg in history:
            role = "user" if msg.get("role") == "user" else "assistant"
            messages.append({"role": role, "content": msg.get("content", "")})
            
        messages.append({"role": "user", "content": message})
        
        model_name = os.environ.get("OPENROUTER_MODEL", "").strip() or "gpt-4o-mini"
        print(f"[DEBUG] Calling OpenRouter model: {model_name}")
        print(f"[DEBUG] Messages count: {len(messages)}")

        def send_request(name):
            return requests.post(
                url="https://api.openrouter.ai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                    "Content-Type": "application/json",
                    "X-Title": "SmartML Dashboard",
                },
                json={
                    "model": name,
                    "messages": messages,
                    "temperature": 0.7,
                },
                timeout=15
            )

        r = send_request(model_name)
        print(f"[DEBUG] OpenRouter status: {r.status_code}")
        if r.status_code != 200:
            print(f"[DEBUG] OpenRouter response: {r.text[:500]}")
            if model_name != "gpt-4o-mini" and r.status_code in (404, 400):
                print(f"[DEBUG] Retrying OpenRouter with fallback model gpt-4o-mini")
                r = send_request("gpt-4o-mini")
                print(f"[DEBUG] OpenRouter retry status: {r.status_code}")
                if r.status_code != 200:
                    print(f"[DEBUG] OpenRouter retry response: {r.text[:500]}")

        if r.status_code == 200:
            res_json = r.json()
            reply_text = res_json.get("choices", [{}])[0].get("message", {}).get("content", "")

            suggestion = _parse_suggestion_text(reply_text)
            validated = _validate_and_normalize_suggestion(suggestion, inspection) if suggestion else None
            if validated:
                reply_text = _strip_suggestion_payload(reply_text)
                return {
                    "reply": reply_text,
                    "suggested_target": validated["target_column"],
                    "suggested_problem_type": validated["problem_type"]
                }

            # Fallback: strip any partial suggestion payload and return plain reply
            return {
                "reply": _strip_suggestion_payload(reply_text),
                "suggested_target": None,
                "suggested_problem_type": None
            }
    except Exception as e:
        print(f"[DEBUG] OpenRouter API call failed: {e}")
    return None


def chat_with_agent(
    message: str,
    inspection: dict,
    history: list,
    results_context: Optional[dict] = None
) -> dict:
    """
    Main chat function. Uses OpenRouter first, then Gemini if available, else rule-based fallback.
    Returns dict with 'reply', 'suggested_target', 'suggested_problem_type'.
    """
    job_context = results_context or {}

    # 1. Try OpenRouter
    if OPENROUTER_API_KEY:
        res = _call_openrouter(message, inspection, history, job_context)
        if res:
            return res

    # 2. Try Gemini
    model = _get_gemini_client()
    if model:
        try:
            system_prompt = _build_system_prompt(inspection, job_context)
            chat_history = []
            for msg in history:
                role = "user" if msg.get("role") == "user" else "model"
                chat_history.append({"role": role, "parts": [msg.get("content", "")]})

            chat = model.start_chat(history=chat_history)
            full_prompt = f"{system_prompt}\n\nUser: {message}"
            response = chat.send_message(full_prompt)
            reply_text = response.text

            suggestion = _parse_suggestion_text(reply_text)
            validated = _validate_and_normalize_suggestion(suggestion, inspection) if suggestion else None
            if validated:
                reply_text = _strip_suggestion_payload(reply_text)
                return {
                    "reply": reply_text,
                    "suggested_target": validated["target_column"],
                    "suggested_problem_type": validated["problem_type"]
                }

            return {
                "reply": _strip_suggestion_payload(reply_text),
                "suggested_target": None,
                "suggested_problem_type": None
            }
        except Exception:
            pass

    # 3. Fallback to rule-based
    return _rule_based_response(message, inspection, job_context)
