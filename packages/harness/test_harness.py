"""Unit tests for the harness (no network, no Docker)."""
from harness import extract_code, parse_pytest, sha256


def test_extract_python_block():
    assert extract_code("text\n```python\nx = 1\n```\nmore") == "x = 1\n"

def test_extract_longest_of_several_blocks():
    assert extract_code("```python\na=1\n```\n```python\ndef f():\n    return 2\n```") == "def f():\n    return 2\n"

def test_extract_bare_and_py_tag():
    assert extract_code("```py\ny=2\n```") == "y=2\n"
    assert extract_code("  z = 3  ") == "z = 3"

def test_parse_all_passed():
    assert parse_pytest("..........\n10 passed in 0.05s") == (10, 10)

def test_parse_mixed():
    assert parse_pytest("3 failed, 7 passed in 0.2s") == (7, 10)

def test_parse_errors():
    assert parse_pytest("1 error in 0.1s") == (0, 1)
    assert parse_pytest("2 passed, 2 errors in 0.1s") == (2, 4)

def test_parse_collection_failure_counts_zero():
    assert parse_pytest("ERROR collecting\nInterrupted: 1 error during collection") == (0, 1)

def test_parse_timeout():
    assert parse_pytest("TIMEOUT") == (0, 0)

def test_sha256_stable():
    assert sha256("abc") == "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    assert sha256(b"abc") == sha256("abc")
