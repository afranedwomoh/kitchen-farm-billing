import html2canvas from "html2canvas-pro";
import jsPDF from "jspdf";
import { toast } from "sonner";

export async function exportNodeAsPng(node: HTMLElement, filename: string) {
  const win = window.open("", "_blank");
  try {
    const canvas = await html2canvas(node, { scale: 2, backgroundColor: "#ffffff", useCORS: true, allowTaint: true });
    canvas.toBlob((blob) => {
      if (!blob) {
        if (win) win.close();
        toast.error("Export failed: could not generate image");
        return;
      }
      const blobUrl = URL.createObjectURL(blob);
      if (win) win.location.href = blobUrl;
      else window.open(blobUrl, "_blank");
    }, "image/png");
  } catch (e: any) {
    if (win) win.close();
    toast.error(`Export failed: ${e.message ?? e}`);
  }
}

export async function exportNodeAsPdf(node: HTMLElement, filename: string) {
  const win = window.open("", "_blank");
  try {
    const canvas = await html2canvas(node, { scale: 2, backgroundColor: "#ffffff", useCORS: true, allowTaint: true });
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
    const blobUrl = pdf.output("bloburl") as unknown as string;
    if (win) win.location.href = blobUrl;
    else window.open(blobUrl, "_blank");
  } catch (e: any) {
    if (win) win.close();
    toast.error(`Export failed: ${e.message ?? e}`);
  }
}
