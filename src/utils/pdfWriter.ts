/**
 * A small PDF writer with no dependencies.
 *
 * It uses the two standard Helvetica fonts that every PDF reader has built in, so
 * nothing has to be embedded. Text is written in WinAnsi encoding: Latin letters,
 * accents, °, –, ·, • and the like print as they are; characters outside that set
 * (for example Japanese place names) are reduced to their base letter or dropped.
 *
 * Coordinates are in points (1/72 inch) with the origin at the top-left of the page,
 * which is easier to lay out than PDF's native bottom-left origin.
 */

export type Rgb = [number, number, number];

const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;

/* Glyph widths (per 1000 units of font size) for characters 32–126. */
const HELVETICA = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556,
  556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556,
  556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];
const HELVETICA_BOLD = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556,
  556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611,
  611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
];

/* Characters WinAnsi places in 0x80–0x9F, plus a few replacements. */
const WIN_ANSI: Record<string, number> = {
  "€": 0x80, "‚": 0x82, "„": 0x84, "…": 0x85, "†": 0x86, "‡": 0x87, "‰": 0x89, "‹": 0x8b, "Œ": 0x8c,
  "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97, "™": 0x99, "›": 0x9b, "œ": 0x9c,
};
const REPLACE: Record<string, string> = {
  "−": "-", "≥": ">=", "²": "2", "³": "3", "≤": "<=", "→": "->", "←": "<-", "≈": "~", "✓": "", " ": " ",
  "ș": "s", "Ș": "S", "ş": "s", "Ş": "S", "ț": "t", "Ț": "T", "ţ": "t", "Ţ": "T", "ă": "a", "Ă": "A",
};
const SPECIAL_WIDTH: Record<number, number> = {
  0x85: 1000, 0x91: 222, 0x92: 222, 0x93: 333, 0x94: 333, 0x95: 350, 0x96: 556, 0x97: 1000, 0xb0: 400, 0xb7: 278,
  0xd7: 584, 0xb1: 584,
};

/** Turns a string into WinAnsi character codes. */
function encode(text: string): number[] {
  const codes: number[] = [];
  for (const raw of text) {
    const ch = REPLACE[raw] ?? raw;
    for (const c of ch) {
      const code = c.codePointAt(0) ?? 63;
      if (code >= 32 && code <= 126) codes.push(code);
      else if (WIN_ANSI[c] !== undefined) codes.push(WIN_ANSI[c]);
      else if (code >= 160 && code <= 255) codes.push(code);
      else {
        // Strip accents the encoding does not have (ő → o); drop anything else.
        const base = c.normalize("NFD").replace(/[̀-ͯ]/g, "");
        const b = base.codePointAt(0) ?? 0;
        if (base.length === 1 && b >= 32 && b <= 255) codes.push(b);
      }
    }
  }
  return codes;
}

function charWidth(code: number, bold: boolean) {
  if (code >= 32 && code <= 126) return (bold ? HELVETICA_BOLD : HELVETICA)[code - 32];
  return SPECIAL_WIDTH[code] ?? 556;
}

export function textWidth(text: string, size: number, bold = false) {
  return (encode(text).reduce((sum, code) => sum + charWidth(code, bold), 0) * size) / 1000;
}

function pdfString(text: string) {
  return (
    "(" +
    encode(text)
      .map((code) => {
        if (code === 40 || code === 41 || code === 92) return "\\" + String.fromCharCode(code);
        if (code < 32 || code > 126) return "\\" + code.toString(8).padStart(3, "0");
        return String.fromCharCode(code);
      })
      .join("") +
    ")"
  );
}

const n = (value: number) => (Math.round(value * 100) / 100).toString();
const rgb = (c: Rgb) => c.map((v) => n(v / 255)).join(" ");

export interface TextStyle {
  size?: number;
  bold?: boolean;
  color?: Rgb;
}

export class PdfWriter {
  readonly width = PAGE_W;
  readonly height = PAGE_H;
  readonly margin = 46;
  /** Current vertical position, from the top of the page. */
  y = this.margin;
  private pages: string[] = [];
  private ops: string[] = [];
  /** Called at the top of every page after the first (e.g. to repeat a header). */
  onNewPage?: () => void;

  get contentWidth() {
    return this.width - this.margin * 2;
  }

  get bottom() {
    return this.height - this.margin - 18; // room for the footer
  }

  /* ---------------- drawing primitives ---------------- */

  text(value: string, x: number, y: number, style: TextStyle = {}) {
    const size = style.size ?? 10;
    const font = style.bold ? "F2" : "F1";
    this.ops.push(
      `BT /${font} ${n(size)} Tf ${rgb(style.color ?? [33, 37, 41])} rg ${n(x)} ${n(this.height - y - size * 0.8)} Td ${pdfString(value)} Tj ET`,
    );
  }

  rect(x: number, y: number, w: number, h: number, fill: Rgb) {
    this.ops.push(`${rgb(fill)} rg ${n(x)} ${n(this.height - y - h)} ${n(w)} ${n(h)} re f`);
  }

  line(x1: number, y1: number, x2: number, y2: number, color: Rgb = [222, 226, 230], width = 0.6) {
    this.ops.push(`${rgb(color)} RG ${n(width)} w ${n(x1)} ${n(this.height - y1)} m ${n(x2)} ${n(this.height - y2)} l S`);
  }

  circle(cx: number, cy: number, r: number, fill: Rgb) {
    // Four Bézier arcs.
    const k = 0.5523 * r;
    const y = this.height - cy;
    this.ops.push(
      `${rgb(fill)} rg ${n(cx + r)} ${n(y)} m ` +
        `${n(cx + r)} ${n(y + k)} ${n(cx + k)} ${n(y + r)} ${n(cx)} ${n(y + r)} c ` +
        `${n(cx - k)} ${n(y + r)} ${n(cx - r)} ${n(y + k)} ${n(cx - r)} ${n(y)} c ` +
        `${n(cx - r)} ${n(y - k)} ${n(cx - k)} ${n(y - r)} ${n(cx)} ${n(y - r)} c ` +
        `${n(cx + k)} ${n(y - r)} ${n(cx + r)} ${n(y - k)} ${n(cx + r)} ${n(y)} c f`,
    );
  }

  /* ---------------- layout helpers ---------------- */

  /** Splits text into lines that fit `width`. Very long words are broken. */
  wrap(value: string, width: number, style: TextStyle = {}): string[] {
    const size = style.size ?? 10;
    const lines: string[] = [];
    for (const paragraph of value.split("\n")) {
      let line = "";
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        const candidate = line ? `${line} ${word}` : word;
        if (textWidth(candidate, size, style.bold) <= width) {
          line = candidate;
          continue;
        }
        if (line) lines.push(line);
        // Break a word that is wider than the line on its own (e.g. a URL).
        let rest = word;
        while (textWidth(rest, size, style.bold) > width) {
          let cut = rest.length - 1;
          while (cut > 1 && textWidth(rest.slice(0, cut), size, style.bold) > width) cut--;
          lines.push(rest.slice(0, cut));
          rest = rest.slice(cut);
        }
        line = rest;
      }
      lines.push(line);
    }
    return lines;
  }

  /** Starts a new page when fewer than `height` points are left. */
  ensure(height: number) {
    if (this.y + height > this.bottom) this.addPage();
  }

  addPage() {
    if (this.ops.length || this.pages.length) this.pages.push(this.ops.join("\n"));
    this.ops = [];
    this.y = this.margin;
    if (this.pages.length) this.onNewPage?.();
  }

  /** Writes wrapped text at the cursor and moves the cursor down. */
  paragraph(value: string, style: TextStyle & { indent?: number; width?: number; gap?: number } = {}) {
    const size = style.size ?? 10;
    const lineHeight = size * 1.38;
    const x = this.margin + (style.indent ?? 0);
    const width = style.width ?? this.contentWidth - (style.indent ?? 0);
    for (const line of this.wrap(value, width, style)) {
      this.ensure(lineHeight);
      this.text(line, x, this.y, style);
      this.y += lineHeight;
    }
    this.y += style.gap ?? 4;
  }

  /** A bulleted list. */
  bullets(items: string[], style: TextStyle & { indent?: number; bullet?: string } = {}) {
    const size = style.size ?? 9.5;
    const lineHeight = size * 1.38;
    const indent = style.indent ?? 0;
    const textX = this.margin + indent + 11;
    const width = this.contentWidth - indent - 11;
    for (const item of items) {
      const lines = this.wrap(item, width, style);
      this.ensure(lineHeight);
      this.text(style.bullet ?? "•", this.margin + indent + 1, this.y, { ...style, size });
      lines.forEach((line) => {
        this.ensure(lineHeight);
        this.text(line, textX, this.y, { ...style, size });
        this.y += lineHeight;
      });
      this.y += 1.5;
    }
    this.y += 3;
  }

  /**
   * A table. `widths` are fractions of the content width. A cell may carry its own
   * colour; the header repeats when the table runs onto a new page.
   */
  table(
    headers: string[],
    rows: (string | { text: string; color?: Rgb; bold?: boolean })[][],
    widths: number[],
    options: { size?: number; zebra?: boolean } = {},
  ) {
    const size = options.size ?? 8.8;
    const lineHeight = size * 1.32;
    const padX = 5;
    const padY = 4;
    const cols = widths.map((w) => w * this.contentWidth);
    const drawHeader = () => {
      const h = lineHeight + padY * 2;
      this.rect(this.margin, this.y, this.contentWidth, h, [237, 242, 238]);
      let x = this.margin;
      headers.forEach((header, i) => {
        this.text(header, x + padX, this.y + padY, { size, bold: true, color: [52, 72, 60] });
        x += cols[i];
      });
      this.y += h;
    };
    this.ensure(lineHeight * 3 + padY * 4);
    drawHeader();
    rows.forEach((row, index) => {
      const cells = row.map((cell) => (typeof cell === "string" ? { text: cell } : cell));
      const wrapped = cells.map((cell, i) => this.wrap(cell.text, cols[i] - padX * 2, { size, bold: cell.bold }));
      const h = Math.max(...wrapped.map((lines) => lines.length)) * lineHeight + padY * 2;
      if (this.y + h > this.bottom) {
        this.addPage();
        drawHeader();
      }
      if (options.zebra !== false && index % 2 === 1) this.rect(this.margin, this.y, this.contentWidth, h, [248, 249, 248]);
      let x = this.margin;
      wrapped.forEach((lines, i) => {
        lines.forEach((line, j) =>
          this.text(line, x + padX, this.y + padY + j * lineHeight, {
            size,
            bold: cells[i].bold,
            color: cells[i].color,
          }),
        );
        x += cols[i];
      });
      this.y += h;
      this.line(this.margin, this.y, this.margin + this.contentWidth, this.y, [230, 233, 231], 0.4);
    });
    this.y += 10;
  }

  /* ---------------- output ---------------- */

  /** Adds "page x of y" footers and returns the finished file. */
  toBlob(footer: string): Blob {
    this.pages.push(this.ops.join("\n"));
    this.ops = [];
    const total = this.pages.length;
    const streams = this.pages.map((content, index) => {
      const label = `Page ${index + 1} of ${total}`;
      const size = 7.5;
      const y = this.height - this.margin + 8;
      const grey: Rgb = [134, 142, 150];
      const foot = [
        `${rgb([222, 226, 230])} RG 0.5 w ${n(this.margin)} ${n(this.height - y + 6)} m ${n(this.width - this.margin)} ${n(this.height - y + 6)} l S`,
        `BT /F1 ${size} Tf ${rgb(grey)} rg ${n(this.margin)} ${n(this.height - y - size)} Td ${pdfString(footer)} Tj ET`,
        `BT /F1 ${size} Tf ${rgb(grey)} rg ${n(this.width - this.margin - textWidth(label, size))} ${n(this.height - y - size)} Td ${pdfString(label)} Tj ET`,
      ].join("\n");
      return `${content}\n${foot}`;
    });

    // Objects: 1 catalog, 2 page tree, 3 + 4 fonts, then a page and its content per page.
    const objects: string[] = [];
    const pageIds = streams.map((_, i) => 5 + i * 2);
    objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
    objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${total} >>`;
    objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
    objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
    streams.forEach((stream, i) => {
      const pageId = pageIds[i];
      objects[pageId] =
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${n(this.width)} ${n(this.height)}] ` +
        `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${pageId + 1} 0 R >>`;
      // Every character is ASCII (non-ASCII is written as octal escapes), so length = bytes.
      objects[pageId + 1] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
    });

    let out = "%PDF-1.4\n";
    const offsets: number[] = [];
    for (let id = 1; id < objects.length; id++) {
      offsets[id] = out.length;
      out += `${id} 0 obj\n${objects[id]}\nendobj\n`;
    }
    const xref = out.length;
    out += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
    for (let id = 1; id < objects.length; id++) out += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
    out += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    return new Blob([out], { type: "application/pdf" });
  }
}
