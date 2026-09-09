import type { EvidenceDocument, Requirement } from './compliance';

export async function readDocument(file: File, role: 'tender' | 'bid'): Promise<EvidenceDocument> {
  if (file.size > 10 * 1024 * 1024) throw new Error('Files must be smaller than 10 MB.');
  if (!/\.(pdf|txt)$/i.test(file.name)) throw new Error('Choose a PDF or UTF-8 text file.');

  const bytes = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hash = Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  let pages: string[] = [];
  if (/\.txt$/i.test(file.name)) {
    pages = new TextDecoder().decode(bytes).split('\f');
  } else {
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
    const task = pdfjs.getDocument({ data: new Uint8Array(bytes) });
    try {
      const pdf = await task.promise;
      if (pdf.numPages > 100) throw new Error('The prototype supports up to 100 pages per PDF.');
      for (let n = 1; n <= pdf.numPages; n++) {
        const page = await pdf.getPage(n);
        const content = await page.getTextContent();
        let text = '', lastY: number | undefined;
        for (const item of content.items) {
          if ('str' in item) {
            const y = item.transform[5];
            if (lastY !== undefined && Math.abs(lastY - y) > 3 && !text.endsWith('\n')) text += '\n';
            text += item.str + (item.hasEOL ? '\n' : ' ');
            lastY = y;
          }
        }
        pages.push(text.trim());
        page.cleanup();
      }
    } finally {
      await task.destroy();
    }
  }

  if (!pages.some(p => p.trim())) {
    throw new Error('No readable text was found. Scanned PDFs need OCR before import; OCR is not included.');
  }
  if (pages.join('').length > 1_000_000) {
    throw new Error('Extracted text exceeds the prototype limit of 1 million characters.');
  }

  return { id: crypto.randomUUID(), name: file.name, role, pages, hash };
}

const patterns = [
  { key: 'experience', unit: 'years', category: 'Eligibility' },
  { key: 'turnover', unit: 'crore', category: 'Financial' },
  { key: 'local content', unit: '%', category: 'Technical' },
  { key: 'warranty', unit: 'months', category: 'Technical' },
  { key: 'completed projects', unit: 'projects', category: 'Eligibility' },
  { key: 'solvency', unit: 'crore', category: 'Financial' },
  { key: 'delivery', unit: 'weeks', category: 'Delivery' }
];

export function extractRequirements(doc: EvidenceDocument): Requirement[] {
  const result: Requirement[] = [];
  doc.pages.forEach((page, index) =>
    page.split('\n').forEach(raw => {
      const line = raw.trim();
      if (!line) return;
      const numeric = patterns.find(p => line.toLowerCase().includes(p.key));
      const portal = line.match(/\b(GST|PAN|Udyam|EPFO|ESIC|DigiLocker|NSIC|MCA21|BIS|FSSAI)\b/i);
      if (!numeric && !portal && !/\b(shall|must|minimum|required|mandatory)\b/i.test(line)) return;

      let minimum: number | undefined;
      if (numeric) {
        const match = line.match(new RegExp('^minimum ' + numeric.key + '\\s*[:=]\\s*(?:₹\\s*)?(\\d+(?:\\.\\d+)?)\\s*' + numeric.unit + '\\s*$', 'i'));
        if (match) minimum = Number(match[1]);
      }

      const weight = numeric?.category === 'Financial' ? 20 : numeric?.category === 'Eligibility' ? 15 : 10;

      result.push({
        id: `REQ-${String(result.length + 1).padStart(3, '0')}`,
        title: line.slice(0, 240),
        category: numeric?.category || (portal ? 'Statutory' : 'General'),
        key: numeric?.key || portal?.[0] || line.slice(0, 60),
        unit: numeric?.unit || '',
        kind: minimum !== undefined ? 'minimum' : portal ? 'portal' : 'manual',
        minimum,
        source: doc.name,
        page: index + 1,
        weight,
        mandatory: true
      });
    })
  );
  return result;
}
