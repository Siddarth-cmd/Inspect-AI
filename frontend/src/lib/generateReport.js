import jsPDF from 'jspdf';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';

/**
 * Draw bounding boxes on a canvas copy of the image and return base64 JPEG.
 */
async function buildAnnotatedImage(imageUrl, defects = []) {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width  = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      const SEV_COLORS = { High: '#ef4444', Medium: '#f59e0b', Low: '#10b981' };

      defects.forEach((defect) => {
        if (!defect.bbox) return;
        const [ymin, xmin, ymax, xmax] = defect.bbox;
        const x = xmin * canvas.width;
        const y = ymin * canvas.height;
        const w = (xmax - xmin) * canvas.width;
        const h = (ymax - ymin) * canvas.height;
        const color = SEV_COLORS[defect.severity] || '#ef4444';

        // Bounding box
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(3, canvas.width / 200);
        ctx.strokeRect(x, y, w, h);

        // Semi-transparent fill
        ctx.fillStyle = color + '22';
        ctx.fillRect(x, y, w, h);

        // Label background
        const labelH   = Math.max(22, canvas.height / 30);
        const fontSize = Math.max(13, canvas.height / 45);
        const label    = `${(defect.type || '').toUpperCase()}  ${Math.round((defect.confidence || 0) * 100)}%`;
        ctx.font = `bold ${fontSize}px sans-serif`;
        const textW = ctx.measureText(label).width + 12;
        ctx.fillStyle = color;
        ctx.fillRect(x, Math.max(0, y - labelH), textW, labelH);

        // Label text
        ctx.fillStyle = '#ffffff';
        ctx.fillText(label, x + 6, y - 5);
      });

      resolve(canvas.toDataURL('image/jpeg', 0.88));
    };
    img.onerror = () => resolve(null);
    img.src = imageUrl;
  });
}

/**
 * Clean a string so jsPDF (Helvetica) can render it without corruption.
 * Strips emoji and replaces common Unicode punctuation with ASCII equivalents.
 */
function safe(str = '') {
  return String(str)
    .replace(/[\u2013\u2014]/g, '-')   // em/en dash -> hyphen
    .replace(/[\u2018\u2019]/g, "'")   // curly single quotes
    .replace(/[\u201c\u201d]/g, '"')   // curly double quotes
    .replace(/\u2022/g, '-')           // bullet
    .replace(/[^\x00-\x7F]/g, '');    // strip any remaining non-ASCII (incl. emoji)
}

/**
 * Generate and download a full InspectAI PDF report.
 *
 * @param {object} results  - AI analysis result
 * @param {string} imageUrl - Object URL or data URL for the inspected image
 * @param {string} filename - Original filename
 */
export async function downloadReport(results, imageUrl, filename = 'image.jpg') {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const PW = 210;
  const M  = 15;

  // ─── Header bar ──────────────────────────────────────────────────────────
  doc.setFillColor(99, 102, 241);
  doc.rect(0, 0, PW, 28, 'F');

  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('InspectAI - Defect Inspection Report', M, 16);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(safe(`Generated: ${new Date().toLocaleString()}   |   File: ${filename}`), M, 24);

  // ─── Score banner ─────────────────────────────────────────────────────────
  const score = results.quality_score || 0;
  const REC   = results.recommendation || 'N/A';
  const scoreRGB = score >= 80 ? [16, 185, 129] : score >= 50 ? [245, 158, 11] : [239, 68, 68];

  doc.setFillColor(248, 250, 252);
  doc.roundedRect(M, 32, PW - M * 2, 22, 4, 4, 'F');

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...scoreRGB);
  doc.text(`Quality Score: ${score} / 100`, M + 4, 45);

  const recRGB = REC === 'Pass' ? [16,185,129] : REC === 'Review' ? [245,158,11] : [239,68,68];
  doc.setFillColor(...recRGB);
  doc.roundedRect(PW - M - 38, 34, 38, 16, 4, 4, 'F');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  const recLabel = REC === 'Pass' ? '[PASS]' : REC === 'Review' ? '[REVIEW]' : '[REJECT]';
  doc.text(recLabel, PW - M - 36, 43.5);

  // ─── Summary ─────────────────────────────────────────────────────────────
  let y = 62;
  if (results.overall_explanation) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(60, 60, 60);
    doc.text('SUMMARY', M, y); y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    const summaryLines = doc.splitTextToSize(safe(results.overall_explanation), PW - M * 2);
    doc.text(summaryLines, M, y);
    y += summaryLines.length * 5 + 4;
  }

  // ─── Annotated image ─────────────────────────────────────────────────────
  if (imageUrl) {
    const annotated = await buildAnnotatedImage(imageUrl, results.defects || []);
    if (annotated) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      doc.text('INSPECTED IMAGE (with defect annotations)', M, y); y += 4;

      const imgW = PW - M * 2;
      const imgH = 70;
      doc.addImage(annotated, 'JPEG', M, y, imgW, imgH);
      doc.setDrawColor(200, 200, 200);
      doc.rect(M, y, imgW, imgH);
      y += imgH + 7;
    }
  }

  // ─── Defects ─────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  doc.text(`DEFECTS DETECTED (${results.defects?.length || 0})`, M, y); y += 5;

  if (!results.defects || results.defects.length === 0) {
    doc.setFillColor(236, 253, 245);
    doc.roundedRect(M, y, PW - M * 2, 14, 3, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(16, 185, 129);
    doc.text('No defects detected - Product passes quality inspection.', M + 4, y + 9);
    y += 20;
  } else {
    results.defects.forEach((defect, i) => {
      // New page if needed
      if (y > 245) { doc.addPage(); y = 20; }

      const SEV_RGB  = { High: [239,68,68], Medium: [245,158,11], Low: [16,185,129] };
      const dColor   = SEV_RGB[defect.severity] || [99,102,241];

      // Estimate dynamic card height
      let cardLines = 2; // type row + explanation
      if (defect.explanation) cardLines += Math.ceil(safe(defect.explanation).length / 80);
      if (defect.cause)       cardLines += 1 + Math.ceil(safe(defect.cause).length / 80);
      if (defect.solution)    cardLines += 1 + Math.ceil(safe(defect.solution).length / 80);
      const boxH = Math.max(40, cardLines * 5 + 16);

      doc.setFillColor(250, 250, 252);
      doc.roundedRect(M, y, PW - M * 2, boxH, 3, 3, 'F');
      doc.setDrawColor(...dColor);
      doc.setLineWidth(0.8);
      doc.roundedRect(M, y, PW - M * 2, boxH, 3, 3, 'S');
      doc.setFillColor(...dColor);
      doc.rect(M, y, 4, boxH, 'F');

      let dy = y + 8;

      // Type line
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...dColor);
      doc.text(`${i + 1}. ${(defect.type || 'UNKNOWN').toUpperCase()}`, M + 7, dy);
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text(
        `Severity: ${defect.severity || 'N/A'}   Confidence: ${Math.round((defect.confidence || 0) * 100)}%`,
        M + 60, dy
      );
      dy += 6;

      // Description
      if (defect.explanation) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(9);
        doc.setTextColor(70, 70, 70);
        const el = doc.splitTextToSize(`Description: ${safe(defect.explanation)}`, PW - M * 2 - 14);
        doc.text(el, M + 7, dy);
        dy += el.length * 4.5 + 3;
      }

      // Cause
      if (defect.cause) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(180, 100, 0);
        doc.text('Probable Cause:', M + 7, dy); dy += 4.5;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80, 60, 0);
        const cl = doc.splitTextToSize(safe(defect.cause), PW - M * 2 - 18);
        doc.text(cl, M + 10, dy);
        dy += cl.length * 4.5 + 3;
      }

      // Solution
      if (defect.solution) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(0, 110, 70);
        doc.text('AI Recommended Solution:', M + 7, dy); dy += 4.5;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 80, 50);
        const sl = doc.splitTextToSize(safe(defect.solution), PW - M * 2 - 18);
        doc.text(sl, M + 10, dy);
        dy += sl.length * 4.5;
      }

      y += boxH + 5;
    });
  }

  // ─── Footer on every page ────────────────────────────────────────────────
  const pageCount = doc.internal.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(180);
    doc.text(`InspectAI - AI Defect Detection System  |  Page ${p} of ${pageCount}`, M, 290);
  }

  const pdfFilename = `InspectAI_Report_${Date.now()}.pdf`;

  if (Capacitor.isNativePlatform()) {
    try {
      // Extract pure base64 PDF bytes ignoring the URI header
      const base64pdf = doc.output('datauristring').split(',')[1];
      
      const savedFile = await Filesystem.writeFile({
        path: pdfFilename,
        data: base64pdf,
        directory: Directory.Cache
      });

      await Share.share({
        title: pdfFilename,
        text: 'Attached is the InspectAI Defect Detection Report.',
        url: savedFile.uri,
        dialogTitle: 'Save or Share Report'
      });
      
    } catch (err) {
      console.error('Android Native PDF Save Error:', err);
      // Failsafe web fallback just in case
      doc.save(pdfFilename);
    }
  } else {
    // Standard Desktop / Web output
    doc.save(pdfFilename);
  }
}
