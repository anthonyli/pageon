/**
 * Build an offline PDF 1.4 with one JPEG-backed page per input page.
 * Page width/height are CSS pixels (96 dpi); JPEG dimensions are read separately
 * so high-resolution captures retain their intended physical page size.
 * This is a visual/raster export: text is not selectable or searchable.
 *
 * No imports or outer-scope helpers: the runtime embeds this function.toString().
 * Supports 8-bit grayscale/RGB baseline and progressive JPEGs. Rejects pages
 * larger than PDF 1.4's 14,400-point limit instead of silently rescaling them.
 * @param {{width: number, height: number, jpeg: Uint8Array}[]} pages
 * @returns {Uint8Array}
 */
export function createRasterPdf(pages) {
  if (!Array.isArray(pages) || pages.length === 0 || pages.length > 10000) {
    throw new RangeError("PDF requires between 1 and 10000 pages.");
  }

  function readJpeg(bytes, index) {
    const invalid = () => new TypeError(`Page ${index + 1} has an invalid or unsupported JPEG.`);
    if (!(bytes instanceof Uint8Array) || bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
      throw invalid();
    }
    let offset = 2;
    let frame;
    let scan = false;
    let scanCount = 0;
    while (offset < bytes.length) {
      // Entropy-coded bytes can contain escaped FF bytes and restart markers.
      // Inspect framing only; decoding/re-encoding the image is unnecessary.
      if (scan) {
        let hasData = false;
        while (offset < bytes.length) {
          if (bytes[offset] !== 0xff) {
            offset++;
            hasData = true;
            continue;
          }
          let next = offset + 1;
          while (bytes[next] === 0xff) next++;
          if (bytes[next] === 0 || (bytes[next] >= 0xd0 && bytes[next] <= 0xd7)) {
            offset = next + 1;
            hasData = true;
            continue;
          }
          break;
        }
        if (!hasData) throw invalid();
        scan = false;
      }
      if (bytes[offset++] !== 0xff) throw invalid();
      while (bytes[offset] === 0xff) offset++;
      const marker = bytes[offset++];
      if (marker === 0xd9) {
        if (!frame || !scanCount || offset !== bytes.length) throw invalid();
        return frame;
      }
      if (marker === 0x01) continue;
      if (marker === undefined || marker === 0 || marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) {
        throw invalid();
      }
      if (offset + 2 > bytes.length) throw invalid();
      const length = bytes[offset] * 256 + bytes[offset + 1];
      if (length < 2 || offset + length > bytes.length) throw invalid();
      const isFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
      if (isFrame) {
        if (frame || ![0xc0, 0xc1, 0xc2].includes(marker) || length < 8) throw invalid();
        const bits = bytes[offset + 2];
        const height = bytes[offset + 3] * 256 + bytes[offset + 4];
        const width = bytes[offset + 5] * 256 + bytes[offset + 6];
        const components = bytes[offset + 7];
        if (bits !== 8 || !width || !height || ![1, 3].includes(components) || length !== 8 + 3 * components) {
          throw invalid();
        }
        frame = { width, height, components };
      }
      if (marker === 0xda) {
        const components = bytes[offset + 2];
        if (!frame || !components || components > frame.components || length !== 6 + 2 * components) {
          throw invalid();
        }
        scanCount++;
        scan = true;
      }
      offset += length;
    }
    throw invalid();
  }

  // PDF numbers do not support exponent notation. Retain precision even for
  // fractional CSS sizes, without rounding a small positive dimension to zero.
  function pdfNumber(value) {
    const text = String(value);
    if (!text.includes("e")) return text;
    const [mantissa, exponent] = text.split("e");
    const digits = mantissa.replace(".", "");
    return `0.${"0".repeat(-Number(exponent) - 1)}${digits}`;
  }

  // Validate the entire input before writing so a bad page cannot be omitted.
  const images = Array.from(pages, (page, index) => {
    if (!page || typeof page.width !== "number" || typeof page.height !== "number" ||
        !Number.isFinite(page.width) || !Number.isFinite(page.height) || page.width <= 0 || page.height <= 0) {
      throw new RangeError(`Page ${index + 1} requires finite, positive CSS dimensions.`);
    }
    const width = page.width * 0.75;
    const height = page.height * 0.75;
    if (width <= 0 || height <= 0 || width > 14400 || height > 14400) {
      throw new RangeError(`Page ${index + 1} exceeds the supported PDF page dimensions (maximum 14400 points).`);
    }
    return { ...readJpeg(page.jpeg, index), pageWidth: pdfNumber(width), pageHeight: pdfNumber(height), jpeg: page.jpeg };
  });

  const encoder = new TextEncoder();
  const chunks = [];
  const offsets = [0];
  let size = 0;
  function append(value) {
    const bytes = typeof value === "string" ? encoder.encode(value) : value;
    // Bound allocations and guarantee every classic-xref offset fits 10 digits.
    if (size + bytes.byteLength > 0x7fffffff) throw new RangeError("PDF exceeds the supported file size.");
    chunks.push(bytes);
    size += bytes.byteLength;
  }
  function object(id, body, stream) {
    offsets[id] = size;
    append(`${id} 0 obj\n${body}`);
    if (stream !== undefined) {
      append("\nstream\n");
      append(stream);
      append("\nendstream");
    }
    append("\nendobj\n");
  }

  append("%PDF-1.4\n");
  append(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));
  object(1, "<< /Type /Catalog /Pages 2 0 R >>");
  const kids = images.map((_, index) => `${3 + index * 3} 0 R`).join(" ");
  object(2, `<< /Type /Pages /Count ${images.length} /Kids [${kids}] >>`);
  images.forEach((image, index) => {
    const id = 3 + index * 3;
    const { pageWidth, pageHeight, width, height, components, jpeg } = image;
    object(id, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Im0 ${id + 1} 0 R >> >> /Contents ${id + 2} 0 R >>`);
    object(id + 1, `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /Device${components === 1 ? "Gray" : "RGB"} /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.byteLength} >>`, jpeg);
    const content = encoder.encode(`q\n${pageWidth} 0 0 ${pageHeight} 0 0 cm\n/Im0 Do\nQ\n`);
    object(id + 2, `<< /Length ${content.byteLength} >>`, content);
  });

  const xref = size;
  append(`xref\n0 ${offsets.length}\n0000000000 65535 f \n`);
  for (let id = 1; id < offsets.length; id++) {
    append(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`);
  }
  append(`trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const pdf = new Uint8Array(size);
  let cursor = 0;
  for (const chunk of chunks) {
    pdf.set(chunk, cursor);
    cursor += chunk.byteLength;
  }
  return pdf;
}
