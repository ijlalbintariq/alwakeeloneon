#!/usr/bin/env python3
"""
PaddleOCR Worker — Standalone OCR script for Al Wakeelo.

Called by Node.js via child_process.execFile to OCR scanned PDFs.
Uses PP-OCRv5 Mobile models (lightweight, CPU-only, memory-efficient).

Usage:
  python3 paddle-ocr-worker.py <pdf_path> [max_pages] [language] [timeout_ms]

Output (JSON to stdout):
  {"ok": true, "payload": {"text": "...", "pageCount": 5, "language": "en"}}
  {"ok": false, "error": "..."}

Designed for 1-CPU / 2GB RAM servers:
  - CPU inference only (no GPU)
  - Page-by-page processing (no batch)
  - Memory cleanup between pages
  - Lightweight mobile detection + recognition models
"""

import gc
import json
import os
import sys
import signal
import tempfile
import time

# Suppress PaddlePaddle verbose logging
os.environ["GLOG_minloglevel"] = "3"
os.environ["FLAGS_log_dir"] = ""
os.environ["FLAGS_logtostderr"] = "0"
os.environ["PADDLEOCR_HOME"] = os.path.join(tempfile.gettempdir(), "paddleocr_models")
# Force CPU, prevent GPU probing
os.environ["CUDA_VISIBLE_DEVICES"] = ""
os.environ["FLAGS_use_gpu"] = "0"
# Limit CPU threads for 1-CPU server
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["OPENBLAS_NUM_THREADS"] = "1"

def main():
    args = sys.argv[1:]
    if len(args) < 1:
        output_error("Usage: paddle-ocr-worker.py <pdf_path> [max_pages] [language] [timeout_ms]")
        return

    pdf_path = args[0]
    max_pages = min(int(args[1]) if len(args) > 1 and args[1].isdigit() else 8, 50)
    language = (args[2] if len(args) > 2 else "en").strip() or "en"
    timeout_ms = min(int(args[3]) if len(args) > 3 and args[3].isdigit() else 120000, 600000)

    # Map Tesseract-style language codes to PaddleOCR codes
    lang_map = {
        "eng": "en",
        "eng+urd": "en",  # English primary, Urdu in Arabic script
        "urd": "ar",       # Urdu → Arabic script model
        "ara": "ar",
        "english": "en",
        "urdu": "ar",
        "arabic": "ar",
    }
    paddle_lang = lang_map.get(language.lower(), language.lower())
    # PaddleOCR only supports specific lang codes; default to 'en' if unknown
    supported_langs = {
        "ch", "en", "korean", "japan", "chinese_cht", "ta", "te", "ka",
        "latin", "arabic", "ar", "cyrillic", "devanagari", "fr", "german",
        "it", "es", "pt", "ru", "uk", "be", "bg", "hr", "czech", "danish",
        "dutch", "et", "fi", "hu", "id", "is", "ku", "lt", "lv", "mi",
        "ms", "mt", "nl", "no", "oc", "pi", "pl", "ro", "rs_cyrillic",
        "rs_latin", "sk", "sl", "sq", "sv", "sw", "tl", "tr", "uz", "vi",
        "mn", "sa", "hi", "mr", "ne", "bh", "mai", "ang", "bho", "mah",
        "sck", "new", "gom", "awa", "structure",
    }
    if paddle_lang not in supported_langs:
        paddle_lang = "en"

    # Set timeout via alarm signal
    deadline = time.time() + (timeout_ms / 1000.0)

    def timeout_handler(signum, frame):
        output_error(f"PaddleOCR timed out after {timeout_ms}ms")
        sys.exit(1)

    if hasattr(signal, "SIGALRM"):
        signal.signal(signal.SIGALRM, timeout_handler)
        signal.alarm(int(timeout_ms / 1000) + 5)

    try:
        # Import heavy modules only after env is set
        import fitz  # PyMuPDF
        from paddleocr import PaddleOCR

        # Validate PDF exists
        if not os.path.isfile(pdf_path):
            output_error(f"PDF file not found: {pdf_path}")
            return

        # Open PDF and get page count
        pdf_doc = fitz.open(pdf_path)
        total_pages = len(pdf_doc)
        pages_to_process = min(total_pages, max_pages)

        if pages_to_process == 0:
            output_success("", 0, paddle_lang)
            pdf_doc.close()
            return

        # Initialize PaddleOCR with lightweight mobile config
        ocr = PaddleOCR(
            use_angle_cls=False,      # Skip angle classification (saves CPU)
            lang=paddle_lang,
            use_gpu=False,            # CPU only
            det_limit_side_len=960,   # Limit detection image size (saves RAM)
            rec_batch_num=1,          # Process 1 text region at a time (saves RAM)
            show_log=False,           # Suppress verbose logging
            enable_mkldnn=False,      # Disable MKL-DNN on low-memory servers
            cpu_threads=1,            # Single thread for 1-CPU server
            use_mp=False,             # No multiprocessing
        )

        all_text_parts = []

        # Process page by page to control memory
        for page_idx in range(pages_to_process):
            if time.time() > deadline:
                break

            try:
                page = pdf_doc[page_idx]

                # Render page to image at 200 DPI (good balance: quality vs memory)
                # Using a matrix for 200 DPI (default is 72, so scale = 200/72 ≈ 2.78)
                zoom = 200.0 / 72.0
                mat = fitz.Matrix(zoom, zoom)
                pix = page.get_pixmap(matrix=mat, alpha=False)

                # Save to temp file (PaddleOCR reads from file path)
                temp_img = os.path.join(
                    tempfile.gettempdir(),
                    f"alwakeelo_paddle_page_{page_idx}_{os.getpid()}.png"
                )
                pix.save(temp_img)

                # Release pixmap memory immediately
                del pix
                gc.collect()

                # Run OCR on this page
                result = ocr.ocr(temp_img, cls=False)

                # Extract text from result
                page_text = extract_text_from_result(result)
                if page_text.strip():
                    all_text_parts.append(page_text.strip())

                # Clean up temp image
                try:
                    os.unlink(temp_img)
                except OSError:
                    pass

                # Force garbage collection between pages
                gc.collect()

            except Exception as page_err:
                # Log but continue to next page
                sys.stderr.write(f"[PaddleOCR] Page {page_idx + 1} failed: {page_err}\n")
                continue

        pdf_doc.close()

        # Clean up OCR engine
        del ocr
        gc.collect()

        final_text = "\n\n".join(all_text_parts)
        output_success(final_text, pages_to_process, paddle_lang)

    except ImportError as ie:
        output_error(f"Missing dependency: {ie}. Install with: pip install paddlepaddle paddleocr PyMuPDF")
    except Exception as e:
        output_error(str(e))


def extract_text_from_result(result):
    """Extract plain text from PaddleOCR result structure."""
    if not result:
        return ""

    lines = []
    for page_result in result:
        if not page_result:
            continue
        for line in page_result:
            if not line:
                continue
            # Each line is [bbox, (text, confidence)]
            if isinstance(line, (list, tuple)) and len(line) >= 2:
                text_info = line[1]
                if isinstance(text_info, (list, tuple)) and len(text_info) >= 1:
                    text = str(text_info[0]).strip()
                    if text:
                        lines.append(text)
                elif isinstance(text_info, str):
                    if text_info.strip():
                        lines.append(text_info.strip())

    return "\n".join(lines)


def output_success(text, page_count, language):
    """Write success JSON to stdout."""
    payload = {
        "text": text,
        "pageCount": page_count,
        "language": language,
    }
    sys.stdout.write(json.dumps({"ok": True, "payload": payload}))
    sys.stdout.flush()


def output_error(message):
    """Write error JSON to stdout."""
    sys.stdout.write(json.dumps({"ok": False, "error": message}))
    sys.stdout.flush()
    sys.exit(1)


if __name__ == "__main__":
    main()
