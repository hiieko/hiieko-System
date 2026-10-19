"""
Isolated OCR engine benchmark (PaddleOCR PP-StructureV3 spike).

This package is NOT part of the production OCR path. Nothing under
``app/`` imports it, and importing it never imports ``paddleocr`` or
downloads models. It exists only to run offline comparisons between:

  * the existing HIIEKO extractor,
  * PaddleOCR PP-StructureV3 (opt-in, gated by an env var),
  * direct e-Factura / XML parsing.

See ``benchmarks/__main__.py`` for the command line entry point.
"""

__all__ = ["scoring", "adapters", "harness"]
