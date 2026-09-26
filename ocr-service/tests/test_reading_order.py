"""
Reading-order reconstruction tests.

All tests use synthetic bounding boxes.
"""

from app.schemas import RawOcrPage, RawOcrLine
from app.layout.reading_order import reorder_page, reorder_result_pages


def _line(text, x1, y1, x2, y2):
    return RawOcrLine(
        text=text, confidence=0.95,
        bbox=[[x1, y1], [x2, y1], [x2, y2], [x1, y2]], page=0,
    )

def _page(lines):
    return RawOcrPage(page=0, lines=lines, engine_order=list(range(len(lines))))


# 1. Normal horizontal lines
def test_normal_horizontal_lines():
    lines = [
        _line('Header', 10, 0, 300, 20),
        _line('Body line 1', 10, 25, 300, 45),
        _line('Body line 2', 10, 50, 300, 70),
        _line('Footer', 10, 75, 300, 95),
    ]
    reordered = reorder_page(_page(lines))
    assert [l.text for l in reordered.lines] == ['Header', 'Body line 1', 'Body line 2', 'Footer']


def test_reversed_vertical_order():
    lines = [
        _line('Footer', 10, 75, 300, 95),
        _line('Body line 2', 10, 50, 300, 70),
        _line('Body line 1', 10, 25, 300, 45),
        _line('Header', 10, 0, 300, 20),
    ]
    reordered = reorder_page(_page(lines))
    assert [l.text for l in reordered.lines] == ['Header', 'Body line 1', 'Body line 2', 'Footer']


# 2. Multiple words on one visual row
def test_multi_word_single_row():
    lines = [
        _line('This', 10, 0, 80, 20),
        _line('is', 85, 0, 115, 20),
        _line('a', 120, 0, 140, 20),
        _line('row', 145, 0, 200, 20),
    ]
    reordered = reorder_page(_page(lines))
    assert [l.text for l in reordered.lines] == ['This', 'is', 'a', 'row']


def test_multi_word_row_reversed_x():
    lines = [
        _line('row', 145, 0, 200, 20),
        _line('a', 120, 0, 140, 20),
        _line('is', 85, 0, 115, 20),
        _line('This', 10, 0, 80, 20),
    ]
    reordered = reorder_page(_page(lines))
    assert [l.text for l in reordered.lines] == ['This', 'is', 'a', 'row']


# 3. Different line heights
def test_mixed_line_heights():
    lines = [
        _line('Tall header', 10, 0, 300, 40),
        _line('Short line', 10, 45, 200, 60),
        _line('Another short', 10, 65, 250, 80),
        _line('Tall footer', 10, 85, 300, 120),
    ]
    reordered = reorder_page(_page(lines))
    assert [l.text for l in reordered.lines] == ['Tall header', 'Short line', 'Another short', 'Tall footer']


# 4. Lines close together vertically
def test_close_vertical_lines():
    lines = [
        _line('Line 1', 10, 0, 200, 15),
        _line('Line 2', 10, 16, 200, 31),
        _line('Line 3', 10, 32, 200, 47),
        _line('Line 4', 10, 48, 200, 63),
    ]
    reordered = reorder_page(_page(lines))
    assert [l.text for l in reordered.lines] == ['Line 1', 'Line 2', 'Line 3', 'Line 4']


def test_overlapping_vertical_lines():
    lines = [
        _line('Left', 10, 0, 100, 20),
        _line('Right', 150, 2, 250, 22),
    ]
    reordered = reorder_page(_page(lines))
    assert [l.text for l in reordered.lines] == ['Left', 'Right']


# 5. Two-column layouts
def test_two_column_layout():
    lines = [
        _line('Item 1', 10, 0, 100, 20),
        _line('Item 2', 10, 25, 100, 45),
        _line('Price 1', 300, 0, 380, 20),
        _line('Price 2', 300, 25, 380, 45),
    ]
    reordered = reorder_page(_page(lines))
    assert [l.text for l in reordered.lines] == ['Item 1', 'Price 1', 'Item 2', 'Price 2']


def test_two_column_out_of_order():
    lines = [
        _line('Price 1', 300, 0, 380, 20),
        _line('Item 1', 10, 0, 100, 20),
        _line('Price 2', 300, 25, 380, 45),
        _line('Item 2', 10, 25, 100, 45),
    ]
    reordered = reorder_page(_page(lines))
    assert [l.text for l in reordered.lines] == ['Item 1', 'Price 1', 'Item 2', 'Price 2']


# 6. Different x positions
def test_indented_lines():
    lines = [
        _line('Title', 10, 0, 200, 20),
        _line('  Indented', 30, 25, 200, 45),
        _line('Normal', 10, 50, 200, 70),
        _line('    Deep indent', 50, 75, 200, 95),
    ]
    reordered = reorder_page(_page(lines))
    assert [l.text for l in reordered.lines] == ['Title', '  Indented', 'Normal', '    Deep indent']


# 7. Out-of-order engine results
def test_random_engine_order():
    lines = [
        _line('D', 10, 60, 200, 80),
        _line('A', 10, 0, 200, 20),
        _line('C', 10, 40, 200, 60),
        _line('B', 10, 20, 200, 40),
    ]
    reordered = reorder_page(_page(lines))
    assert [l.text for l in reordered.lines] == ['A', 'B', 'C', 'D']


# 8. Multiple pages
def test_multiple_pages():
    p1 = [_line('Page1 Line2', 10, 30, 200, 50), _line('Page1 Line1', 10, 0, 200, 20)]
    p2 = [_line('Page2 Line2', 10, 30, 200, 50), _line('Page2 Line1', 10, 0, 200, 20)]
    pages = [
        RawOcrPage(page=0, lines=p1, engine_order=[0, 1]),
        RawOcrPage(page=1, lines=p2, engine_order=[0, 1]),
    ]
    reordered = reorder_result_pages(pages)
    assert len(reordered) == 2
    assert [l.text for l in reordered[0].lines] == ['Page1 Line1', 'Page1 Line2']
    assert [l.text for l in reordered[1].lines] == ['Page2 Line1', 'Page2 Line2']


# 9. Empty / no-line input
def test_empty_page():
    reordered = reorder_page(_page([]))
    assert reordered.lines == []
    assert reordered.engine_order == []


def test_single_line():
    reordered = reorder_page(_page([_line('Solo', 10, 0, 200, 20)]))
    assert len(reordered.lines) == 1
    assert reordered.lines[0].text == 'Solo'


# 10. Ambiguous vertical spacing
def test_three_close_groups():
    lines = [
        _line('Band3 Line', 10, 60, 200, 80),
        _line('Band1 Line', 10, 0, 200, 20),
        _line('Band2 Line', 10, 30, 200, 50),
    ]
    reordered = reorder_page(_page(lines))
    assert [l.text for l in reordered.lines] == ['Band1 Line', 'Band2 Line', 'Band3 Line']


# 11. engine_order tracking
def test_engine_order_maps_correctly():
    lines = [
        _line('C', 10, 40, 200, 60),
        _line('A', 10, 0, 200, 20),
        _line('B', 10, 20, 200, 40),
    ]
    reordered = reorder_page(_page(lines))
    assert reordered.engine_order[0] == 2
    assert reordered.engine_order[1] == 0
    assert reordered.engine_order[2] == 1


# 12. Non-rectangular (rotated) bboxes
def test_rotated_bbox():
    line = RawOcrLine(
        text='Rotated', confidence=0.9,
        bbox=[[10, 0], [210, 5], [200, 25], [0, 20]], page=0,
    )
    reordered = reorder_page(_page([line]))
    assert len(reordered.lines) == 1
    assert reordered.lines[0].text == 'Rotated'
