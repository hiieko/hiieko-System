"""
Generic reading-order reconstruction for OCR output lines.

Uses bounding-box geometry — y-centre clustering into visual rows,
then left-to-right x-ordering within each row — to produce a reliable
reading order independent of the engine's native line sequence.

The algorithm:
1. Compute each line's y-centre and height from its quadrilateral bbox.
2. Compute median line height across all lines (robust to outliers).
3. Cluster lines into visual rows: lines whose y-centres are within
   `tolerance` of each other (tolerance = median_height × TOLERANCE_FACTOR).
4. Within each row, sort by x-centre (left to right).
5. Flatten rows top-to-bottom to produce the ordered index sequence.
6. Return a new RawOcrPage with the reordered lines and updated engine_order.

This module contains NO sample-specific, merchant-specific, or
coordinate-based rules. It uses only generic geometric relationships.
"""

from ..schemas import RawOcrPage, RawOcrLine


# Tolerance factor: fraction of median line height used as the
# y-centre clustering threshold.  A lower value separates lines
# that are close together; a higher value merges multi-word rows
# that the engine split across multiple bbox entries.
TOLERANCE_FACTOR = 0.6


def _y_centre(line: RawOcrLine) -> float:
    """Return the vertical centre of a line's bounding box."""
    ys = [point[1] for point in line.bbox]
    return (min(ys) + max(ys)) / 2.0


def _line_height(line: RawOcrLine) -> float:
    """Return the height of a line's bounding box."""
    ys = [point[1] for point in line.bbox]
    return max(ys) - min(ys)


def _x_centre(line: RawOcrLine) -> float:
    """Return the horizontal centre of a line's bounding box."""
    xs = [point[0] for point in line.bbox]
    return (min(xs) + max(xs)) / 2.0


def _median(values: list[float]) -> float:
    """Compute the median of a list of floats."""
    if not values:
        return 0.0
    sorted_vals = sorted(values)
    n = len(sorted_vals)
    mid = n // 2
    if n % 2 == 1:
        return sorted_vals[mid]
    return (sorted_vals[mid - 1] + sorted_vals[mid]) / 2.0


def _cluster_into_rows(
    lines: list[RawOcrLine], tolerance: float
) -> list[list[int]]:
    """
    Cluster line indices into visual rows based on y-centre proximity.

    Args:
        lines: The full list of lines.
        tolerance: Maximum y-centre difference for two lines to be
                   considered part of the same visual row.

    Returns:
        A list of rows, where each row is a list of indices into `lines`
        sorted in engine order (to be re-sorted by x within the row).
    """
    if not lines:
        return []

    centres = [(i, _y_centre(lines[i])) for i in range(len(lines))]
    # Sort by y-centre (top to bottom) for greedy clustering
    centres.sort(key=lambda pair: pair[1])

    rows: list[list[int]] = []
    current_row: list[int] = [centres[0][0]]
    current_y = centres[0][1]

    for i in range(1, len(centres)):
        idx, y = centres[i]
        if abs(y - current_y) <= tolerance:
            current_row.append(idx)
        else:
            rows.append(current_row)
            current_row = [idx]
            current_y = y

    if current_row:
        rows.append(current_row)

    return rows


def reorder_page(page: RawOcrPage) -> RawOcrPage:
    """
    Reconstruct reading order for a single page's OCR lines.

    Clusters lines into visual rows by y-centre proximity, sorts each
    row left-to-right, then flattens top-to-bottom.

    Args:
        page: A RawOcrPage with lines in any order.

    Returns:
        A new RawOcrPage with lines reordered into reading order and
        engine_order updated to reflect the original indices.
    """
    if not page.lines:
        return page

    heights = [_line_height(line) for line in page.lines if _line_height(line) > 0]
    median_height = _median(heights) if heights else 10.0
    tolerance = max(median_height * TOLERANCE_FACTOR, 2.0)

    # Original indices before reordering
    original_indices = list(range(len(page.lines)))
    rows = _cluster_into_rows(page.lines, tolerance)

    # Within each row, sort by x-centre (left to right)
    ordered_indices: list[int] = []
    for row in rows:
        row_sorted = sorted(row, key=lambda i: _x_centre(page.lines[i]))
        ordered_indices.extend(row_sorted)

    # Build new lines list in reading order
    new_lines = [page.lines[i] for i in ordered_indices]

    # Update engine_order to track where each original index ended up
    new_engine_order = [ordered_indices.index(i) for i in original_indices]

    return RawOcrPage(
        page=page.page,
        lines=new_lines,
        engine_order=new_engine_order,
    )


def reorder_result_pages(pages: list[RawOcrPage]) -> list[RawOcrPage]:
    """
    Reconstruct reading order across all pages.

    Each page is processed independently (pages are already in order).
    """
    return [reorder_page(p) for p in pages]
