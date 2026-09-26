"""
Layout analysis — reading-order reconstruction and geometry utilities.

Public API:
  - reorder_page(page)      — reorder a single page's lines into reading order
  - reorder_result(pages)   — reorder all pages
  - y_centre(line)          — vertical centre of a bbox
  - x_centre(line)          — horizontal centre of a bbox
  - line_height(line)       — height of a bbox
"""

from .reading_order import reorder_page, reorder_result_pages as reorder_result
from .reading_order import _y_centre as y_centre
from .reading_order import _x_centre as x_centre
from .reading_order import _line_height as line_height
