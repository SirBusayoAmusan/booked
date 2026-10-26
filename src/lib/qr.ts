import "server-only";
import QRCode from "qrcode";

export async function qrSvg(text: string) {
  return QRCode.toString(text, { type: "svg", errorCorrectionLevel: "M", margin: 1, color: { dark: "#111111", light: "#ffffff" } });
}

export async function qrPng(text: string, width = 600) {
  return QRCode.toBuffer(text, { type: "png", errorCorrectionLevel: "M", margin: 1, width });
}
