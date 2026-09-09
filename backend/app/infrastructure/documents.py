from dataclasses import dataclass
from typing import Protocol
import hashlib
import fitz
from app.shared.config import settings

class OCRProvider(Protocol):
    def text(self, page: fitz.Page) -> str: ...
class NoOCR:
    def text(self, page: fitz.Page) -> str:
        return ''
class TesseractOCR:
    def text(self, page: fitz.Page) -> str:
        return page.get_text(textpage=page.get_textpage_ocr(language='eng'))
@dataclass
class ParsedDocument:
    pages: list[str]
    warnings: list[str]
    sha256: str
    mime: str

def parse_document(filename: str, content: bytes, ocr: OCRProvider | None = None) -> ParsedDocument:
    if not content or len(content)>settings.max_file_bytes:
        raise ValueError('Choose a non-empty document up to 10 MB.')
    warnings=[]
    if filename.lower().endswith('.txt'):
        try: pages=content.decode('utf-8-sig').split('\f')
        except UnicodeDecodeError as exc: raise ValueError('Text files must use UTF-8 encoding.') from exc
        mime='text/plain'
    elif filename.lower().endswith('.pdf'):
        if not content.startswith(b'%PDF-'): raise ValueError('This is not a valid PDF file.')
        try:
            with fitz.open(stream=content, filetype='pdf') as pdf:
                if pdf.is_encrypted: raise ValueError('Password-protected PDFs must be unlocked before upload.')
                if len(pdf)>settings.max_pages: raise ValueError('Upload a PDF with at most 100 pages.')
                pages=[]
                for number,page in enumerate(pdf,1):
                    text=page.get_text('text',sort=True)
                    if not text.strip():
                        try: text=(ocr or NoOCR()).text(page)
                        except Exception: warnings.append(f'OCR failed on page {number}.')
                    if not text.strip(): warnings.append(f'Page {number} has no readable text. OCR is required for scanned content.')
                    pages.append(text)
        except (fitz.FileDataError,RuntimeError) as exc:
            raise ValueError('The PDF could not be read. Try exporting an unlocked, text-based PDF.') from exc
        mime='application/pdf'
    else: raise ValueError('Use a PDF or UTF-8 TXT file. DOCX is not supported in this MVP.')
    if not pages or len(pages)>settings.max_pages: raise ValueError('Document must contain 1–100 pages.')
    if not any(p.strip() for p in pages): raise ValueError('No readable text was found. Run OCR on the scanned PDF, then upload it again.')
    if sum(map(len,pages))>1_000_000: raise ValueError('Extracted text exceeds one million characters. Split the document.')
    return ParsedDocument(pages,warnings,hashlib.sha256(content).hexdigest(),mime)

def split_chunks(document_id: str, pages: list[str]) -> list[dict]:
    chunks=[]
    for page_number,text in enumerate(pages,1):
        offset=0
        for line_number,line in enumerate(text.split('\n'),1):
            if line.strip(): chunks.append({'document_id':document_id,'page_number':page_number,'line_number':line_number,'start':offset,'end':offset+len(line),'text':line})
            offset+=len(line)+1
    return chunks
