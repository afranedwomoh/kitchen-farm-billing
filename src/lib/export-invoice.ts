import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export async function exportNodeAsPng(node: HTMLElement, filename: string) {
  const canvas = await html2canvas(node, { scale: 2, backgroundColor: "#ffffff", useCORS: true, allowTaint: true });
  const url = canvas.toDataURL("image/png");
  triggerDownload(url, filename);
}

export async function exportNodeAsPdf(node: HTMLElement, filename: string) {
  const canvas = await html2canvas(node, { scale: 2, backgroundColor: "#ffffff", useCORS: true, allowTaint: true });
  const imgData = canvas.toDataURL("image/png");
  // A5 portrait: 148 x 210 mm
  const pdf = new jsPDF({ unit: "mm", format: "a5", orientation: "portrait" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const imgRatio = canvas.width / canvas.height;
  const pageRatio = pageW / pageH;
  let w = pageW, h = pageH;
  if (imgRatio > pageRatio) h = pageW / imgRatio; else w = pageH * imgRatio;
  const x = (pageW - w) / 2, y = (pageH - h) / 2;
  pdf.addImage(imgData, "PNG", x, y, w, h);
  pdf.save(filename);
}

function triggerDownload(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
