"""Free English -> Hindi auto-translation for dynamic content (blogs/offerings).

Uses deep-translator's Google backend (no API key, no SLA). Never raises: on
any failure it logs and returns the original text, so a translation-service
outage never blocks content creation.
"""
import logging

from deep_translator import GoogleTranslator

logger = logging.getLogger(__name__)

_CHUNK_LIMIT = 4500  # GoogleTranslator's free endpoint caps ~5000 chars/request


def _chunks(text: str, limit: int = _CHUNK_LIMIT) -> list[str]:
    if len(text) <= limit:
        return [text]
    chunks, current = [], ""
    for para in text.split("\n\n"):
        while len(para) > limit:
            chunks.append(para[:limit])
            para = para[limit:]
        candidate = f"{current}\n\n{para}" if current else para
        if len(candidate) > limit:
            chunks.append(current)
            current = para
        else:
            current = candidate
    if current:
        chunks.append(current)
    return chunks


def auto_translate(text: str, target_lang: str = "hi") -> str:
    """Translate English text to target_lang, falling back to the source text on failure."""
    if not text or not text.strip():
        return text
    try:
        translator = GoogleTranslator(source="en", target=target_lang)
        return "\n\n".join(translator.translate(chunk) for chunk in _chunks(text))
    except Exception:
        logger.warning("auto_translate failed, using source text as fallback", exc_info=True)
        return text


def demo():
    assert auto_translate("") == ""
    assert auto_translate("   ") == "   "
    long_text = "para one. " * 600 + "\n\n" + "para two. " * 600
    assert len(_chunks(long_text)) >= 2
    assert all(len(c) <= _CHUNK_LIMIT for c in _chunks(long_text))


if __name__ == "__main__":
    demo()
    print("translate.py self-check passed")
