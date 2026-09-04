"""
Google Gemini AI client wrapper using the official google-genai SDK.
The API key is loaded from environment only — never exposed to the frontend.
"""
import logging
from typing import Optional
from config import settings
from ai.llm import llm_client

logger = logging.getLogger(__name__)


class GeminiClient:
    """Thin wrapper around the shared LLM layer for test analysis."""

    def __init__(self):
        self._model = settings.gemini_model
        logger.info(f"Gemini client initialised — model: {self._model}")

    async def generate_analysis(self, prompt: str, system_instruction: Optional[str] = None) -> str:
        """
        Send a prompt to the AI provider and return the text response.
        Routes through the shared LLM layer, which falls back to Groq if
        Gemini is rate-limited or out of quota.
        """
        try:
            return await llm_client.generate(
                prompt,
                system=system_instruction,
                max_tokens=8192,
                temperature=0.2,
            )
        except Exception as e:
            logger.error(f"AI generation error: {e}")
            raise

    async def classify_issues(self, raw_findings: dict) -> dict:
        """
        Ask Gemini to classify and enrich raw test findings.
        Returns structured JSON with categorised issues and summary.
        """
        system = """You are an expert QA engineer and web accessibility specialist.
Analyse the provided raw test findings from a Playwright browser automation session.
Return a valid JSON object (no markdown fences) with this exact structure:
{
  "overall_health": "Good|Fair|Poor|Critical",
  "ai_summary": "<2-3 sentence plain-English summary>",
  "performance_score": <0-100 float or null>,
  "accessibility_score": <0-100 float or null>,
  "issues": [
    {
      "category": "broken_link|js_error|accessibility|performance|form|navigation|ui|api|other",
      "severity": "critical|high|medium|low|info",
      "title": "<short title>",
      "description": "<detailed description>",
      "recommendation": "<actionable fix>",
      "page_url": "<url or null>",
      "element_selector": "<css selector or null>"
    }
  ]
}
Be concise but thorough. Prioritise actionable findings."""

        prompt = f"Raw test findings:\n{str(raw_findings)}"
        return await self._structured_analysis(prompt, system)

    async def classify_source_issues(self, raw_findings: dict) -> dict:
        """
        Ask Gemini to classify and enrich findings from a codebase (GitHub repo
        or uploaded ZIP). Returns the same structure as classify_issues so the
        downstream pipeline is identical for both intakes.
        """
        system = """You are an expert QA engineer performing a static review of a codebase.
You are given an inventory of a project (languages, file counts, manifests, test
frameworks, CI configuration) together with concrete rule detections found by a
static pass over its source files.

Judge the project's *testability and quality*, not its security — a separate tool
covers vulnerabilities, secrets and dependency CVEs, so do not report those.
Weigh test coverage, accessibility of the UI code, error handling, broken
references, form correctness and performance risk.

Return a valid JSON object (no markdown fences) with this exact structure:
{
  "overall_health": "Good|Fair|Poor|Critical",
  "ai_summary": "<2-3 sentence plain-English summary>",
  "performance_score": <0-100 float or null>,
  "accessibility_score": <0-100 float or null>,
  "issues": [
    {
      "category": "broken_link|js_error|accessibility|performance|form|navigation|ui|api|other",
      "severity": "critical|high|medium|low|info",
      "title": "<short title>",
      "description": "<detailed description>",
      "recommendation": "<actionable fix>",
      "page_url": "<repo-relative file path, optionally with :line, or null>",
      "element_selector": "<offending code snippet or null>"
    }
  ]
}
Keep the file paths from the detections so each issue is traceable.
Be concise but thorough. Prioritise actionable findings."""

        prompt = f"Project analysis input:\n{str(raw_findings)}"
        return await self._structured_analysis(prompt, system)

    async def _structured_analysis(self, prompt: str, system: str) -> dict:
        """Run a prompt that must return the structured analysis JSON object."""
        import json
        text = await self.generate_analysis(prompt, system_instruction=system)

        # Strip potential markdown code fences
        text = llm_client.strip_code_fences(text)

        try:
            return json.loads(text)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse Gemini JSON response: {e}\nRaw: {text[:500]}")
            # Return a minimal fallback structure
            return {
                "overall_health": "Unknown",
                "ai_summary": "AI analysis encountered a parsing error. Raw findings are available.",
                "performance_score": None,
                "accessibility_score": None,
                "issues": [],
            }


# Singleton instance
gemini_client = GeminiClient()
