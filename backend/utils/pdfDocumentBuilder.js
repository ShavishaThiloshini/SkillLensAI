/**
 * SkillLens AI — Pure Node.js PDF Document Builder
 * Day 31: Report Generation
 *
 * Implements a standards-compliant PDF 1.4 document generator in pure JavaScript:
 * - A4 Page Dimensions (595.28 x 841.89 pt) with standard margins.
 * - Standard Type 1 Core Fonts: Helvetica, Helvetica-Bold, Helvetica-Oblique.
 * - Text measurement, automatic word wrapping, and multi-line paragraph layout.
 * - Vector graphics: colored rectangles, divider lines, badges, and progress bars.
 * - Automatic page overflow and multi-page continuation.
 * - Running headers and footers with SkillLens AI branding and "Page X of Y" numbering.
 * - Zero external binary or npm dependencies; 100% portable, secure, and fast.
 */

class PdfDocumentBuilder {
  constructor(options = {}) {
    this.pageWidth = options.pageWidth || 595.28; // A4 standard width (pt)
    this.pageHeight = options.pageHeight || 841.89; // A4 standard height (pt)
    this.marginLeft = options.marginLeft || 45;
    this.marginRight = options.marginRight || 45;
    this.marginTop = options.marginTop || 55;
    this.marginBottom = options.marginBottom || 55;

    this.contentWidth = this.pageWidth - this.marginLeft - this.marginRight;
    this.contentHeight = this.pageHeight - this.marginTop - this.marginBottom;

    this.pages = [];
    this.currentPageIndex = -1;
    this.currentY = this.pageHeight - this.marginTop;

    this.headerTitle = options.headerTitle || "SkillLens AI — Skill Gap Report";
    this.footerText = options.footerText || "SkillLens AI — AI-Powered Resume & Skill Gap Analyzer";

    // Start with page 1
    this.addPage();
  }

  /**
   * Adds a new page to the document.
   */
  addPage() {
    this.pages.push({
      commands: [],
      pageNumber: this.pages.length + 1,
    });
    this.currentPageIndex = this.pages.length - 1;
    this.currentY = this.pageHeight - this.marginTop;

    // Draw running header for pages after page 1
    if (this.currentPageIndex > 0) {
      this.drawRunningHeader();
    }
  }

  /**
   * Checks if adding content of neededHeight will exceed bottom margin.
   * If so, creates a new page and returns true.
   */
  checkPageBreak(neededHeight) {
    if (this.currentY - neededHeight < this.marginBottom) {
      this.addPage();
      return true;
    }
    return false;
  }

  /**
   * Draws running header on subsequent pages.
   */
  drawRunningHeader() {
    const y = this.pageHeight - 35;
    // Header title
    this.drawRawText(this.headerTitle, this.marginLeft, y, {
      font: "Helvetica",
      fontSize: 8,
      color: [0.4, 0.45, 0.55], // Muted slate
    });
    // Header divider line
    this.drawLine(this.marginLeft, y - 6, this.pageWidth - this.marginRight, y - 6, {
      color: [0.85, 0.88, 0.92],
      lineWidth: 0.5,
    });
    this.currentY = this.pageHeight - this.marginTop;
  }

  /**
   * Escapes PDF string literal characters: \, (, )
   */
  static escapePdfString(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/\\/g, "\\\\")
      .replace(/\(/g, "\\(")
      .replace(/\)/g, "\\)")
      .replace(/[\r\n\t]/g, " ");
  }

  /**
   * Approximate character width in points for standard Helvetica at 1 pt size.
   */
  static getCharWidth(char, font = "Helvetica") {
    const isBold = font.includes("Bold");
    const factor = isBold ? 1.08 : 1.0;

    // Average proportional widths
    if (/[il1.,':;!|]/.test(char)) return 0.28 * factor;
    if (/[jfrt\s\-]/.test(char)) return 0.35 * factor;
    if (/[abcdeghknopquvxyz0-9]/.test(char)) return 0.52 * factor;
    if (/[wmWMQO#&%]/.test(char)) return 0.78 * factor;
    return 0.55 * factor;
  }

  /**
   * Estimates string width in points for a given font and size.
   */
  measureTextWidth(text, font = "Helvetica", fontSize = 10) {
    if (!text) return 0;
    let totalWidth = 0;
    for (let i = 0; i < text.length; i++) {
      totalWidth += PdfDocumentBuilder.getCharWidth(text[i], font) * fontSize;
    }
    return totalWidth;
  }

  /**
   * Splits a long paragraph into lines wrapped at maxWidth.
   */
  wrapText(text, maxWidth, font = "Helvetica", fontSize = 10) {
    if (!text) return [];
    const words = String(text).split(/\s+/).filter(Boolean);
    const lines = [];
    let currentLine = "";

    for (const word of words) {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      const candidateWidth = this.measureTextWidth(candidate, font, fontSize);

      if (candidateWidth <= maxWidth || !currentLine) {
        currentLine = candidate;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }
    return lines;
  }

  /**
   * Appends raw PDF command string to the current page.
   */
  addCommand(cmd) {
    if (this.currentPageIndex >= 0) {
      this.pages[this.currentPageIndex].commands.push(cmd);
    }
  }

  /**
   * Draws a single un-wrapped line of text at explicit (x, y).
   */
  drawRawText(text, x, y, options = {}) {
    const font = options.font || "Helvetica";
    const fontSize = options.fontSize || 10;
    const color = options.color || [0.1, 0.1, 0.1]; // Default dark charcoal

    const fontRef = font === "Helvetica-Bold" ? "/F2" : font === "Helvetica-Oblique" ? "/F3" : "/F1";
    const [r, g, b] = color;
    const escaped = PdfDocumentBuilder.escapePdfString(text);

    this.addCommand(
      `BT ${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg ${fontRef} ${fontSize} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td (${escaped}) Tj ET`
    );
  }

  /**
   * Draws a multi-line wrapped paragraph, updating currentY automatically.
   */
  drawParagraph(text, options = {}) {
    const font = options.font || "Helvetica";
    const fontSize = options.fontSize || 10;
    const lineHeight = options.lineHeight || fontSize * 1.35;
    const maxWidth = options.maxWidth || this.contentWidth;
    const x = options.x || this.marginLeft;
    const color = options.color || [0.15, 0.18, 0.24];

    const lines = this.wrapText(text, maxWidth, font, fontSize);

    for (const line of lines) {
      this.checkPageBreak(lineHeight);
      this.drawRawText(line, x, this.currentY, { font, fontSize, color });
      this.currentY -= lineHeight;
    }

    if (options.extraSpacing) {
      this.currentY -= options.extraSpacing;
    }
  }

  /**
   * Draws a section header bar with an accent color.
   */
  drawSectionHeader(title, options = {}) {
    const height = 24;
    this.checkPageBreak(height + 15);

    this.currentY -= 6;
    const y = this.currentY;

    // Accent line/block on the left
    const accentColor = options.accentColor || [0.31, 0.27, 0.90]; // Indigo #4f46e5
    this.drawRect(this.marginLeft, y - 2, 4, 16, { fill: accentColor });

    // Section title text
    this.drawRawText(title, this.marginLeft + 10, y + 1, {
      font: "Helvetica-Bold",
      fontSize: 12,
      color: [0.06, 0.09, 0.16], // Navy #0f172a
    });

    // Subtle divider line
    this.drawLine(this.marginLeft + 10, y - 4, this.pageWidth - this.marginRight, y - 4, {
      color: [0.88, 0.91, 0.94],
      lineWidth: 0.75,
    });

    this.currentY -= 18;
  }

  /**
   * Draws a rectangle (filled and/or stroked).
   */
  drawRect(x, y, w, h, options = {}) {
    const commands = [];
    if (options.fill) {
      const [r, g, b] = options.fill;
      commands.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg`);
    }
    if (options.stroke) {
      const [r, g, b] = options.stroke;
      commands.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} RG`);
      const lw = options.lineWidth || 1;
      commands.push(`${lw.toFixed(2)} w`);
    }

    commands.push(`${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re`);

    if (options.fill && options.stroke) {
      commands.push("B");
    } else if (options.fill) {
      commands.push("f");
    } else {
      commands.push("S");
    }

    this.addCommand(commands.join(" "));
  }

  /**
   * Draws a straight line.
   */
  drawLine(x1, y1, x2, y2, options = {}) {
    const color = options.color || [0.8, 0.8, 0.8];
    const lw = options.lineWidth || 1;
    const [r, g, b] = color;
    this.addCommand(
      `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} RG ${lw.toFixed(2)} w ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`
    );
  }

  /**
   * Draws a colored badge / pill tag.
   */
  drawBadge(label, x, y, options = {}) {
    const fontSize = options.fontSize || 8;
    const font = options.font || "Helvetica-Bold";
    const textWidth = this.measureTextWidth(label, font, fontSize);
    const paddingX = 6;
    const badgeW = textWidth + paddingX * 2;
    const badgeH = 14;

    const bgColor = options.bg || [0.93, 0.94, 0.96];
    const textColor = options.textColor || [0.2, 0.25, 0.35];

    // Background rect
    this.drawRect(x, y - 2, badgeW, badgeH, {
      fill: bgColor,
      stroke: options.border ? options.border : null,
      lineWidth: 0.5,
    });

    // Text centered vertically inside badge
    this.drawRawText(label, x + paddingX, y + 1.5, {
      font,
      fontSize,
      color: textColor,
    });

    return badgeW;
  }

  /**
   * Draws a horizontal progress bar with percentage label.
   */
  drawProgressBar(x, y, w, h, percentage, options = {}) {
    const pct = Math.max(0, Math.min(100, Number(percentage) || 0));
    const fillW = (pct / 100) * w;

    // Track
    this.drawRect(x, y, w, h, {
      fill: [0.91, 0.93, 0.96],
    });

    // Fill
    if (fillW > 0) {
      const fillColor = options.color || [0.31, 0.27, 0.90]; // Indigo
      this.drawRect(x, y, fillW, h, {
        fill: fillColor,
      });
    }

    // Border
    this.drawRect(x, y, w, h, {
      stroke: [0.82, 0.85, 0.90],
      lineWidth: 0.5,
    });
  }

  /**
   * Draws a container box / card.
   */
  drawCard(x, y, w, h, options = {}) {
    const fill = options.fill || [0.98, 0.99, 1.0];
    const stroke = options.stroke || [0.88, 0.91, 0.94];
    this.drawRect(x, y, w, h, {
      fill,
      stroke,
      lineWidth: options.lineWidth || 0.75,
    });
  }

  /**
   * Draws a 2-column key-value pair row.
   */
  drawKeyValue(key, value, options = {}) {
    const keyWidth = options.keyWidth || 130;
    const fontSize = options.fontSize || 9;
    const lineHeight = fontSize * 1.35;
    this.checkPageBreak(lineHeight + 4);

    // Key (Bold)
    this.drawRawText(key, this.marginLeft, this.currentY, {
      font: "Helvetica-Bold",
      fontSize,
      color: [0.2, 0.25, 0.35],
    });

    // Value
    const valLines = this.wrapText(value, this.contentWidth - keyWidth, "Helvetica", fontSize);
    if (valLines.length === 0) {
      this.currentY -= lineHeight;
      return;
    }

    for (let i = 0; i < valLines.length; i++) {
      if (i > 0) this.checkPageBreak(lineHeight);
      this.drawRawText(valLines[i], this.marginLeft + keyWidth, this.currentY, {
        font: "Helvetica",
        fontSize,
        color: [0.08, 0.10, 0.15],
      });
      this.currentY -= lineHeight;
    }
  }

  /**
   * Finalizes the PDF binary stream, drawing running footers and compiling xref table.
   * Returns a Buffer.
   */
  toBuffer() {
    const totalPages = this.pages.length;

    // Draw running footers on all pages
    for (let i = 0; i < totalPages; i++) {
      const pageNum = i + 1;
      const footerY = 28;

      // Divider line
      const lineCmd = `0.850 0.880 0.920 RG 0.50 w ${this.marginLeft.toFixed(2)} ${(footerY + 12).toFixed(2)} m ${(this.pageWidth - this.marginRight).toFixed(2)} ${(footerY + 12).toFixed(2)} l S`;
      this.pages[i].commands.push(lineCmd);

      // Left branding text
      const leftText = PdfDocumentBuilder.escapePdfString(this.footerText);
      const leftCmd = `BT 0.450 0.500 0.580 rg /F1 8 Tf ${this.marginLeft.toFixed(2)} ${footerY.toFixed(2)} Td (${leftText}) Tj ET`;
      this.pages[i].commands.push(leftCmd);

      // Right page number text: "Page X of Y"
      const pageStr = `Page ${pageNum} of ${totalPages}`;
      const pageStrWidth = this.measureTextWidth(pageStr, "Helvetica", 8);
      const pageX = this.pageWidth - this.marginRight - pageStrWidth;
      const rightCmd = `BT 0.450 0.500 0.580 rg /F2 8 Tf ${pageX.toFixed(2)} ${footerY.toFixed(2)} Td (${PdfDocumentBuilder.escapePdfString(pageStr)}) Tj ET`;
      this.pages[i].commands.push(rightCmd);
    }

    // Assemble PDF 1.4 objects
    const objects = [];
    let nextObjNum = 1;

    // 1. Catalog Object
    const catalogObjNum = nextObjNum++;
    // 2. Pages Object
    const pagesObjNum = nextObjNum++;
    // Font Objects
    const f1ObjNum = nextObjNum++; // Helvetica
    const f2ObjNum = nextObjNum++; // Helvetica-Bold
    const f3ObjNum = nextObjNum++; // Helvetica-Oblique

    const pageObjNums = [];
    const contentObjNums = [];

    for (let i = 0; i < totalPages; i++) {
      pageObjNums.push(nextObjNum++);
      contentObjNums.push(nextObjNum++);
    }

    // Build Catalog
    objects.push({
      num: catalogObjNum,
      content: `<< /Type /Catalog /Pages ${pagesObjNum} 0 R >>`,
    });

    // Build Pages Collection
    const kidsStr = pageObjNums.map((n) => `${n} 0 R`).join(" ");
    objects.push({
      num: pagesObjNum,
      content: `<< /Type /Pages /Kids [ ${kidsStr} ] /Count ${totalPages} >>`,
    });

    // Build Standard Font Objects
    objects.push({
      num: f1ObjNum,
      content: `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`,
    });
    objects.push({
      num: f2ObjNum,
      content: `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>`,
    });
    objects.push({
      num: f3ObjNum,
      content: `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>`,
    });

    // Build Page Objects & Content Streams
    for (let i = 0; i < totalPages; i++) {
      const pNum = pageObjNums[i];
      const cNum = contentObjNums[i];
      const streamText = this.pages[i].commands.join("\n") + "\n";
      const streamLen = Buffer.byteLength(streamText, "binary");

      // Page Object
      objects.push({
        num: pNum,
        content: `<< /Type /Page /Parent ${pagesObjNum} 0 R /MediaBox [ 0 0 ${this.pageWidth.toFixed(2)} ${this.pageHeight.toFixed(2)} ] /Contents ${cNum} 0 R /Resources << /Font << /F1 ${f1ObjNum} 0 R /F2 ${f2ObjNum} 0 R /F3 ${f3ObjNum} 0 R >> >> >>`,
      });

      // Stream Content Object
      objects.push({
        num: cNum,
        content: `<< /Length ${streamLen} >>\nstream\n${streamText}endstream`,
      });
    }

    // Sort objects by object number
    objects.sort((a, b) => a.num - b.num);

    // Build final binary buffer with XREF table and Trailer
    const chunks = [];
    chunks.push(Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n", "binary"));

    const xrefOffsets = [];
    let currentOffset = chunks[0].length;

    for (const obj of objects) {
      xrefOffsets[obj.num] = currentOffset;
      const str = `${obj.num} 0 obj\n${obj.content}\nendobj\n`;
      const buf = Buffer.from(str, "binary");
      chunks.push(buf);
      currentOffset += buf.length;
    }

    const startXref = currentOffset;
    const totalCount = objects.length + 1;

    let xrefTable = `xref\n0 ${totalCount}\n0000000000 65535 f \n`;
    for (let i = 1; i <= objects.length; i++) {
      const offsetStr = String(xrefOffsets[i]).padStart(10, "0");
      xrefTable += `${offsetStr} 00000 n \n`;
    }

    const trailer = `trailer\n<< /Size ${totalCount} /Root ${catalogObjNum} 0 R >>\nstartxref\n${startXref}\n%%EOF\n`;

    chunks.push(Buffer.from(xrefTable + trailer, "binary"));

    return Buffer.concat(chunks);
  }

  /**
   * Alias for toBuffer() to match standard builder conventions.
   */
  build() {
    return this.toBuffer();
  }
}

module.exports = PdfDocumentBuilder;
