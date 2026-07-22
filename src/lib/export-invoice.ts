import html2canvas from "html2canvas-pro";
import jsPDF from "jspdf";
import { toast } from "sonner";

async function shareOrOpen(blob: Blob, filename: string, mimeType: string) {
  const file = new File([blob], filename, { type: mimeType });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return;
    } catch (e) {
      // user cancelled the share sheet, or share failed — fall through to opening a tab
    }
  }
  const blobUrl = URL.createObjectURL(blob);
  window.open(blobUrl, "_blank");
}

export async function exportNodeAsPng(node: HTMLElement, filename: string) {
  try {
    const canvas = await html2canvas(node, { scale: 3, backgroundColor: "#ffffff", useCORS: true, allowTaint: true });
    canvas.toBlob(async (blob) => {
      if (!blob) return toast.error("Export failed: could not generate image");
      await shareOrOpen(blob, filename, "image/png");
    }, "image/png");
  } catch (e: any) {
    toast.error(`Export failed: ${e.message ?? e}`);
  }
}

export async function exportNodeAsPdf(node: HTMLElement, filename: string) {
  try {
    const canvas = await html2canvas(node, { scale: 3, backgroundColor: "#ffffff", useCORS: true, allowTaint: true });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ unit: "mm", format: "a5", orientation: "portrait" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgRatio = canvas.width / canvas.height;
    const pageRatio = pageW / pageH;
    let w = pageW, h = pageH;
    if (imgRatio > pageRatio) h = pageW / imgRatio; else w = pageH * imgRatio;
    const x = (pageW - w) / 2, y = (pageH - h) / 2;
    pdf.addImage(imgData, "PNG", x, y, w, h);
    const blob = pdf.output("blob") as Blob;
    await shareOrOpen(blob, filename, "application/pdf");
  } catch (e: any) {
    toast.error(`Export failed: ${e.message ?? e}`);
  }
}
