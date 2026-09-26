"""
OCR engine registry.

Add new engines here. Each engine module must expose:
  - run_ocr(content: bytes, mime_type: str) -> RawOcrResult
  - get_version() -> str  (optional, defaults to "")
"""

from . import paddle

_ENGINES = {
    "paddleocr": paddle,
}


def get_engine(name: str = "paddleocr"):
    engine = _ENGINES.get(name)
    if engine is None:
        raise ValueError(f"Unknown OCR engine: {name}")
    return engine


def list_engines() -> list[str]:
    return list(_ENGINES.keys())


def run_ocr(
    content: bytes, mime_type: str, engine: str = "paddleocr"
):
    return get_engine(engine).run_ocr(content, mime_type)


def get_version(engine: str = "paddleocr") -> str:
    try:
        fn = getattr(get_engine(engine), "get_version", None)
        return fn() if fn else getattr(get_engine(engine), "_get_version", lambda: "")()
    except Exception:
        return ""
