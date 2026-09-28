import QRCode from "qrcode";

// Encode the active deployment so labels work before and after domain cutover.
export function guestQrDataUrl() {
  return QRCode.toDataURL(window.location.origin, {width: 512, margin: 2, errorCorrectionLevel: "M"});
}
