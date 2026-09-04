"""
Shared LLM text-generation layer with automatic provider failover.

Gemini is the primary provider. If a Gemini call fails with a rate limit,
quota exhaustion, or a transient server error, the same prompt is
transparently retried against Groq so an on-the-spot quota hit never breaks
a running test session or security scan.

Both TestiFy's test analyzer and the TestiFy Security add-on call through
here, so there is a single place to reason about provider behaviour.
"""
import logging
from typing import Optional

import httpx
from google import genai
from google.genai import types

from config import settings

logger = logging.getLogger(__name__)

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

# Substrings that indicate the failure is worth retrying on the fallback
# provider rather than surfacing to the caller.
_FAILOVER_MARKERS = (
    "429",
    "resource_exhausted",
    "resource exhausted",
    "quota",
    "rate limit",
    "ratelimit",
    "too many requests",
    "503",
    "unavailable",
    "500",
    "internal server error",
    "deadline",
    "timeout",
)


def should_failover(exc: Exception) -> bool:
    """True when the error looks like a quota/rate/transient failure."""
    text = f"{type(exc).__name__} {exc}".lower()
    return any(marker in text for marker in _FAILOVER_MARKERS)


class LLMClient:
    """Gemini-primary, Groq-fallback text generation."""

    def __init__(self):
        self._gemini = genai.Client(api_key=settings.gemini_api_key)
        self._gemini_model = settings.gemini_model
        self._groq_key = settings.groq_api_key
        self._groq_model = settings.groq_model
        logger.info(
            f"LLM client ready — primary: gemini/{self._gemini_model}, "
            f"fallback: {'groq/' + self._groq_model if self._groq_key else 'none (no GROQ_API_KEY)'}"
        )

    # ── Providers ────────────────────────────────────────────────────────────
    async def _gemini_generate(
        self, prompt: str, system: Optional[str], max_tokens: int, temperature: float
    ) -> str:
        config = types.GenerateContentConfig(
            temperature=temperature,
            max_output_tokens=max_tokens,
        )
        if system:
            config.system_instruction = system

        response = await self._gemini.aio.models.generate_content(
            model=self._gemini_model,
            contents=prompt,
            config=config,
        )
        return response.text or ""

    async def _groq_generate(
        self, prompt: str, system: Optional[str], max_tokens: int, temperature: float
    ) -> str:
        if not self._groq_key:
            raise RuntimeError("Groq fallback unavailable: GROQ_API_KEY is not set")

        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        async with httpx.AsyncClient(timeout=90.0) as client:
            resp = await client.post(
                GROQ_URL,
                headers={
                    "Authorization": f"Bearer {self._groq_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self._groq_model,
                    "messages": messages,
                    "temperature": temperature,
                    # gpt-oss models spend budget on reasoning before answering,
                    # so keep effort low and leave headroom for the answer.
                    "reasoning_effort": "low",
                    "max_tokens": max_tokens,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"].get("content") or ""

    # ── Public API ───────────────────────────────────────────────────────────
    async def generate(
        self,
        prompt: str,
        system: Optional[str] = None,
        max_tokens: int = 8192,
        temperature: float = 0.2,
    ) -> str:
        """
        Generate text, failing over to Groq on Gemini quota/rate/transient errors.
        Raises only if both providers fail (or Gemini fails non-retryably).
        """
        try:
            text = await self._gemini_generate(prompt, system, max_tokens, temperature)
            if text.strip():
                return text
            logger.warning("Gemini returned an empty response — trying Groq fallback")
        except Exception as e:
            if not should_failover(e):
                logger.error(f"Gemini error (not retryable): {e}")
                raise
            logger.warning(f"Gemini unavailable ({str(e)[:160]}) — failing over to Groq")

        try:
            text = await self._groq_generate(prompt, system, max_tokens, temperature)
            logger.info(f"Groq fallback served the request (model: {self._groq_model})")
            return text
        except Exception as e:
            logger.error(f"Groq fallback also failed: {e}")
            raise

    @staticmethod
    def strip_code_fences(text: str) -> str:
        """Remove ```json / ``` wrappers some models add around JSON output."""
        t = text.strip()
        if t.startswith("```"):
            lines = t.split("\n")
            if lines[-1].strip().startswith("```"):
                lines = lines[:-1]
            t = "\n".join(lines[1:]).strip()
        return t


# Singleton shared by the test analyzer and the security add-on
llm_client = LLMClient()
