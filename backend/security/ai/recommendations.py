"""
AI Recommendations — generates a concrete secure-code fix for a given finding.

Routes through TestiFy's shared LLM layer (Gemini primary, automatic Groq
fallback on quota/rate-limit), so this add-on reuses the same API keys as the
rest of the app. If every provider is unavailable, it returns the
rule-authored static remediation text — already real, just not model-generated
— rather than fabricating an AI response.
"""
from __future__ import annotations
import json
import logging

logger = logging.getLogger(__name__)

SYSTEM = "You are a senior application security engineer. Respond with raw JSON only, no markdown fences."


async def generate_fix(finding: dict) -> dict:
    static_fallback = {
        "source": "rule-engine",
        "explanation": finding.get("description", ""),
        "fixed_code": None,
        "recommendation": finding.get("recommendation", ""),
    }

    prompt = f"""A static analysis tool found this issue:

Rule: {finding.get('title')} ({finding.get('cwe')}, {finding.get('category')})
Severity: {finding.get('severity')}
File: {finding.get('file')} line {finding.get('line')}
Language: {finding.get('language')}
Code snippet: {finding.get('snippet')}
Description: {finding.get('description')}

Respond ONLY with JSON (no markdown fences) in this exact shape:
{{"explanation": "1-2 sentence plain-English risk explanation",
  "fixed_code": "corrected code snippet for this line/block",
  "recommendation": "concrete remediation steps"}}"""

    try:
        # Imported lazily so the security module stays importable even if the
        # AI layer is misconfigured.
        from ai.llm import llm_client

        text = await llm_client.generate(
            prompt, system=SYSTEM, max_tokens=1200, temperature=0.2
        )
        parsed = json.loads(llm_client.strip_code_fences(text))
        return {
            "source": "ai",
            "explanation": parsed.get("explanation") or static_fallback["explanation"],
            "fixed_code": parsed.get("fixed_code"),
            "recommendation": parsed.get("recommendation") or static_fallback["recommendation"],
        }
    except Exception as e:
        logger.warning(f"AI fix generation unavailable, using rule-engine text: {str(e)[:200]}")
        return static_fallback
