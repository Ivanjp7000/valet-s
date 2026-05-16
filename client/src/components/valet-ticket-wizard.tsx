import React, { useState, useMemo, useRef, useEffect } from "react";
import { useOCR } from "@/hooks/useOCR";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { 
  Car, Camera, User, ChevronRight, ChevronLeft, Check, 
  Hotel, UtensilsCrossed, Users, X, Ticket, CalendarDays, Plus, Printer, RefreshCw
} from "lucide-react";
import qrCodeUrl from "@/assets/qr-valet-s.jpg";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  VISITOR_TYPES, RESTAURANT_SUB_TYPES, CAR_COLORS, CAR_MAKES 
} from "@shared/schema";
import type { User as UserType } from "@shared/schema";

const stripHonorifics = (name: string) =>
  name.replace(/^(Mr\.|Mrs\.|Ms\.|Mx\.|Dr\.|Miss|Sir|Lord)\s*/i, '').trim();
const fmtGuest = (name: string | null | undefined) =>
  name ? stripHonorifics(name) : '';

/**
 * Generate a 30×38mm name label PDF and trigger a local file download.
 * iPhone: Safari downloads → tap download icon → open file → share to Phomemo → Print
 * Desktop: Ctrl/Cmd+P → select Phomemo M110s → paper 30×38mm
 */
/** Generate a random PIN: 2 uppercase letters + 2 digits, e.g. "AC36" */
function generatePin(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I/O to avoid confusion
  const digits = '0123456789';
  return (
    letters[Math.floor(Math.random() * letters.length)] +
    letters[Math.floor(Math.random() * letters.length)] +
    digits[Math.floor(Math.random() * digits.length)] +
    digits[Math.floor(Math.random() * digits.length)]
  );
}

async function printNameLabel(guestName: string): Promise<void> {
  const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');

  const mmToPt = (mm: number) => mm * 2.8346;
  const W = mmToPt(30);
  const H = mmToPt(38);

  const doc  = await PDFDocument.create();
  const page = doc.addPage([W, H]);
  page.setMediaBox(0, 0, W, H);

  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const font     = await doc.embedFont(StandardFonts.Helvetica);

  let qrImage: Awaited<ReturnType<typeof doc.embedJpg>> | null = null;
  try {
    const resp  = await fetch(qrCodeUrl);
    const bytes = new Uint8Array(await resp.arrayBuffer());
    try { qrImage = await doc.embedJpg(bytes); } catch { qrImage = await doc.embedPng(bytes); }
  } catch { /* skip */ }

  const pad    = mmToPt(2);
  const innerW = W - pad * 2;
  let cursor   = H - pad;

  // QR code
  const qrSize = mmToPt(18);
  if (qrImage) page.drawImage(qrImage, { x: (W - qrSize) / 2, y: cursor - qrSize, width: qrSize, height: qrSize });
  cursor -= qrSize + mmToPt(1.5);

  // "Visit Valet-s.com"
  const visitSize = 6;
  const visitText = 'Visit  Valet-s.com';
  page.drawText(visitText, {
    x: pad + (innerW - font.widthOfTextAtSize(visitText, visitSize)) / 2,
    y: cursor - visitSize, font, size: visitSize, color: rgb(0.4, 0.4, 0.4),
  });
  cursor -= visitSize + mmToPt(1.5);

  // Gold divider
  page.drawRectangle({ x: pad, y: cursor, width: innerW, height: 0.6, color: rgb(0.79, 0.66, 0.3) });

  // Guest name at bottom
  const displayName = guestName.trim();
  let nameSize = 10;
  while (nameSize > 6 && fontBold.widthOfTextAtSize(displayName, nameSize) > innerW) nameSize -= 0.5;
  page.drawText(displayName, {
    x: pad + (innerW - fontBold.widthOfTextAtSize(displayName, nameSize)) / 2,
    y: pad, font: fontBold, size: nameSize, color: rgb(0.1, 0.12, 0.27),
  });

  // Download the PDF file
  const pdfBytes = await doc.save();
  const blob     = new Blob([pdfBytes], { type: 'application/pdf' });
  const url      = URL.createObjectURL(blob);
  const a        = document.createElement('a');
  a.href         = url;
  a.download     = `${guestName.trim()}.pdf`;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Generate a 30×38mm PIN label PDF and trigger a local file download.
 * Label shows "PIN  XX00" instead of the guest name.
 */
async function printPinLabel(pin: string): Promise<void> {
  const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');

  const mmToPt = (mm: number) => mm * 2.8346;
  const W = mmToPt(30);
  const H = mmToPt(38);

  const doc  = await PDFDocument.create();
  const page = doc.addPage([W, H]);
  page.setMediaBox(0, 0, W, H);

  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const font     = await doc.embedFont(StandardFonts.Helvetica);

  let qrImage: Awaited<ReturnType<typeof doc.embedJpg>> | null = null;
  try {
    const { default: qrUrl } = await import('@/assets/qr-valet-s.jpg');
    const resp  = await fetch(qrUrl);
    const bytes = new Uint8Array(await resp.arrayBuffer());
    try { qrImage = await doc.embedJpg(bytes); } catch { qrImage = await doc.embedPng(bytes); }
  } catch { /* skip */ }

  const pad    = mmToPt(2);
  const innerW = W - pad * 2;
  let cursor   = H - pad;

  // QR code
  const qrSize = mmToPt(18);
  if (qrImage) page.drawImage(qrImage, { x: (W - qrSize) / 2, y: cursor - qrSize, width: qrSize, height: qrSize });
  cursor -= qrSize + mmToPt(1.5);

  // "Visit Valet-s.com"
  const visitSize = 6;
  const visitText = 'Visit  Valet-s.com';
  page.drawText(visitText, {
    x: pad + (innerW - font.widthOfTextAtSize(visitText, visitSize)) / 2,
    y: cursor - visitSize, font, size: visitSize, color: rgb(0.4, 0.4, 0.4),
  });
  cursor -= visitSize + mmToPt(1.5);

  // Gold divider
  page.drawRectangle({ x: pad, y: cursor, width: innerW, height: 0.6, color: rgb(0.79, 0.66, 0.3) });

  // PIN label at bottom
  const labelSize = 7;
  const labelText = 'PIN';
  page.drawText(labelText, {
    x: pad,
    y: pad + 14,
    font, size: labelSize, color: rgb(0.5, 0.5, 0.5),
  });
  const pinSize = 13;
  page.drawText(pin, {
    x: pad + (innerW - fontBold.widthOfTextAtSize(pin, pinSize)) / 2,
    y: pad, font: fontBold, size: pinSize, color: rgb(0.1, 0.12, 0.27),
  });

  // Download the PDF file
  const pdfBytes = await doc.save();
  const blob     = new Blob([pdfBytes], { type: 'application/pdf' });
  const url      = URL.createObjectURL(blob);
  const a        = document.createElement('a');
  a.href         = url;
  a.download     = `PIN-${pin}.pdf`;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Generate a 30×38mm label showing ticket number + PIN together.
 */
async function printTicketPinLabel(ticketNumber: string, pin: string): Promise<void> {
  const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');

  const mmToPt = (mm: number) => mm * 2.8346;
  const W = mmToPt(30);
  const H = mmToPt(38);

  const doc  = await PDFDocument.create();
  const page = doc.addPage([W, H]);
  page.setMediaBox(0, 0, W, H);

  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const font     = await doc.embedFont(StandardFonts.Helvetica);

  let qrImage: Awaited<ReturnType<typeof doc.embedJpg>> | null = null;
  try {
    const { default: qrUrl } = await import('@/assets/qr-valet-s.jpg');
    const resp  = await fetch(qrUrl);
    const bytes = new Uint8Array(await resp.arrayBuffer());
    try { qrImage = await doc.embedJpg(bytes); } catch { qrImage = await doc.embedPng(bytes); }
  } catch { /* skip */ }

  const pad    = mmToPt(2);
  const innerW = W - pad * 2;
  let cursor   = H - pad;

  // QR code (slightly smaller to fit both values below)
  const qrSize = mmToPt(14);
  if (qrImage) page.drawImage(qrImage, { x: (W - qrSize) / 2, y: cursor - qrSize, width: qrSize, height: qrSize });
  cursor -= qrSize + mmToPt(1.5);

  // "Visit Valet-s.com"
  const visitSize = 5.5;
  const visitText = 'Visit  Valet-s.com';
  page.drawText(visitText, {
    x: pad + (innerW - font.widthOfTextAtSize(visitText, visitSize)) / 2,
    y: cursor - visitSize, font, size: visitSize, color: rgb(0.4, 0.4, 0.4),
  });
  cursor -= visitSize + mmToPt(1.5);

  // Gold divider
  page.drawRectangle({ x: pad, y: cursor, width: innerW, height: 0.6, color: rgb(0.79, 0.66, 0.3) });
  cursor -= mmToPt(1.5);

  // Ticket label
  const lblSize = 5.5;
  page.drawText('TICKET', { x: pad, y: cursor - lblSize, font, size: lblSize, color: rgb(0.5, 0.5, 0.5) });
  cursor -= lblSize + mmToPt(0.8);

  // Ticket number (large)
  const tktSize = 12;
  page.drawText(ticketNumber, {
    x: pad + (innerW - fontBold.widthOfTextAtSize(ticketNumber, tktSize)) / 2,
    y: cursor - tktSize, font: fontBold, size: tktSize, color: rgb(0.1, 0.12, 0.27),
  });
  cursor -= tktSize + mmToPt(1.5);

  // PIN label
  page.drawText('PIN', { x: pad, y: cursor - lblSize, font, size: lblSize, color: rgb(0.5, 0.5, 0.5) });
  cursor -= lblSize + mmToPt(0.8);

  // PIN value
  const pinSize = 11;
  page.drawText(pin, {
    x: pad + (innerW - fontBold.widthOfTextAtSize(pin, pinSize)) / 2,
    y: pad, font: fontBold, size: pinSize, color: rgb(0.1, 0.12, 0.27),
  });

  const pdfBytes = await doc.save();
  const blob     = new Blob([pdfBytes], { type: 'application/pdf' });
  const url      = URL.createObjectURL(blob);
  const a        = document.createElement('a');
  a.href         = url;
  a.download     = `Ticket-${ticketNumber}-PIN-${pin}.pdf`;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Prepares a plate image for Google Cloud Vision API:
 *  1. Crops to the centre band on portrait shots so Vision sees only the plate area.
 *  2. Scales to at most 1200 px wide (Vision works well at this resolution).
 *  3. Keeps full colour — Vision reads colour images better than greyscale.
 * Returns a JPEG data URL at 80% quality (~50-150 KB), well within Vision's limits.
 */
async function prepareForVisionAPI(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const nw = img.naturalWidth;
      const nh = img.naturalHeight;

      let srcX = 0, srcY = 0, srcW = nw, srcH = nh;
      if (nh > nw * 1.3) {
        const cut = Math.round(nh * 0.25);
        srcY = cut;
        srcH = nh - cut * 2;
      }

      const MAX_WIDTH = 1200;
      const scale = Math.min(1, MAX_WIDTH / srcW);
      const destW = Math.round(srcW * scale);
      const destH = Math.round(srcH * scale);

      const canvas = document.createElement('canvas');
      canvas.width = destW;
      canvas.height = destH;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, destW, destH);

      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/**
 * Compresses a general car photo to ~30 KB for storage.
 * Scales to at most 800 px wide and uses low JPEG quality.
 */
async function processCarPhoto(dataUrl: string): Promise<{ dataUrl: string; sizeKb: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const MAX_WIDTH = 800;
      const JPEG_QUALITY = 0.3;
      const scale = Math.min(1, MAX_WIDTH / img.naturalWidth);
      const destW = Math.round(img.naturalWidth * scale);
      const destH = Math.round(img.naturalHeight * scale);

      const canvas = document.createElement("canvas");
      canvas.width = destW;
      canvas.height = destH;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("canvas not available")); return; }

      ctx.drawImage(img, 0, 0, destW, destH);
      const result = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
      // Estimate size: base64 string length × 0.75 bytes, divided by 1024 for KB
      const sizeKb = Math.round((result.length * 0.75) / 1024);
      resolve({ dataUrl: result, sizeKb });
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/**
 * Processes a plate photo: crops to the centre band (where the plate lives)
 * and compresses to a very small JPEG. Typical result: 15–50 KB vs 3–8 MB raw.
 */
async function processPlateImage(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const MAX_WIDTH = 600;
      const JPEG_QUALITY = 0.4;

      let srcX = 0;
      let srcY = 0;
      let srcW = img.naturalWidth;
      let srcH = img.naturalHeight;

      // If portrait (phone held upright pointing at plate), crop the
      // top and bottom thirds — the plate is almost always in the middle.
      if (srcH > srcW * 1.3) {
        const cropTop = Math.round(srcH * 0.25);
        const cropBot = Math.round(srcH * 0.25);
        srcY = cropTop;
        srcH = srcH - cropTop - cropBot;
      }

      // Scale down so the longest side is at most MAX_WIDTH.
      const scale = Math.min(1, MAX_WIDTH / srcW);
      const destW = Math.round(srcW * scale);
      const destH = Math.round(srcH * scale);

      const canvas = document.createElement("canvas");
      canvas.width = destW;
      canvas.height = destH;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("canvas not available")); return; }

      ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, destW, destH);
      resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/**
 * Post-processes raw Tesseract output for Japanese licence plates.
 *
 * Japanese plate format: [Area kanji] [3-digit class] [hiragana] [4-digit serial]
 * e.g.  品川 500 あ 1234
 *
 * Strategy:
 * 1. Try to find a pattern matching the plate format and return only that.
 * 2. If no pattern found, strip characters that cannot appear on a plate and
 *    return whatever is left — always better than raw garbage.
 */
function extractJapanesePlate(raw: string): string {
  // Normalise: collapse whitespace, remove newlines
  const text = raw.replace(/[\r\n]+/g, ' ').replace(/\s{2,}/g, ' ').trim();

  // ── Pattern match ────────────────────────────────────────────────────────
  // CJK kanji (area name) + digits (class) + hiragana + digits (serial)
  const pattern =
    /([\u4e00-\u9faf\u3400-\u4dbf]{1,4})\s*(\d{2,3})\s*([\u3041-\u3096])\s*(\d{1,4})/;
  const m = text.match(pattern);
  if (m) {
    return `${m[1]} ${m[2]} ${m[3]} ${m[4]}`;
  }

  // ── Partial match: at least digits + hiragana ────────────────────────────
  const partial = /([\u4e00-\u9faf\u3400-\u4dbf]{1,4}\s*)?(\d{2,3})\s*([\u3041-\u3096])\s*(\d{1,4})/;
  const p = text.match(partial);
  if (p) {
    const area = p[1] ? p[1].trim() + ' ' : '';
    return `${area}${p[2]} ${p[3]} ${p[4]}`;
  }

  // ── Fallback: keep only plate-legal characters ───────────────────────────
  // CJK kanji | hiragana | digits | spaces | middle-dot
  const kept = text.replace(/[^\u4e00-\u9faf\u3400-\u4dbf\u3041-\u3096\d\s・]/g, '');
  return kept.replace(/\s{2,}/g, ' ').trim();
}

interface ValetTicketWizardProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserType | null | undefined;
}

type VisitorType = keyof typeof VISITOR_TYPES;
type RestaurantSubType = keyof typeof RESTAURANT_SUB_TYPES;

interface TicketFormData {
  visitorType: VisitorType | "";
  visitorSubType: RestaurantSubType | "";
  carMake: string;
  carModel: string;
  carColor: string;
  platePhotoUrl: string;
  licensePlate: string;
  carPhotoUrl: string;
  carPhotoSize: number;
  guestName: string;
  roomNumber: string;
  ticketNumber: string;
  guestPin: string;
}

const STEPS = [
  { id: 1, title: "Guest & Vehicle", icon: Car },
  { id: 2, title: "Photos & Details", icon: Camera },
];

const COLOR_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  'Black': { bg: 'bg-black', text: 'text-white', border: 'border-black' },
  'White': { bg: 'bg-white', text: 'text-gray-800', border: 'border-gray-300' },
  'Silver': { bg: 'bg-gray-300', text: 'text-gray-800', border: 'border-gray-400' },
  'Grey': { bg: 'bg-gray-500', text: 'text-white', border: 'border-gray-600' },
  'Gray': { bg: 'bg-gray-500', text: 'text-white', border: 'border-gray-600' },
  'Red': { bg: 'bg-red-600', text: 'text-white', border: 'border-red-700' },
  'Blue': { bg: 'bg-blue-600', text: 'text-white', border: 'border-blue-700' },
  'Navy': { bg: 'bg-blue-900', text: 'text-white', border: 'border-blue-950' },
  'Green': { bg: 'bg-green-600', text: 'text-white', border: 'border-green-700' },
  'Gold': { bg: 'bg-yellow-500', text: 'text-gray-900', border: 'border-yellow-600' },
  'Brown': { bg: 'bg-amber-800', text: 'text-white', border: 'border-amber-900' },
  'Beige': { bg: 'bg-amber-100', text: 'text-gray-800', border: 'border-amber-200' },
  'Orange': { bg: 'bg-orange-500', text: 'text-white', border: 'border-orange-600' },
  'Yellow': { bg: 'bg-yellow-400', text: 'text-gray-900', border: 'border-yellow-500' },
  'Purple': { bg: 'bg-purple-600', text: 'text-white', border: 'border-purple-700' },
  'Other': { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300' },
};

// ─── iOS-style drum wheel picker for car brand ──────────────────────────────
const WHEEL_ITEM_H = 56;

function BrandWheelPicker({
  brands,
  value,
  fontSizeOffset = 0,
  onSelect,
  onClose,
}: {
  brands: string[];
  value: string;
  fontSizeOffset?: number;
  onSelect: (brand: string) => void;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(() => Math.max(0, brands.indexOf(value)));
  const [dragDelta, setDragDelta] = useState(0);
  const dragging = useRef(false);
  const startClientY = useRef(0);

  // Clamp idx whenever brands list changes (e.g. after deleting a brand)
  useEffect(() => {
    if (brands.length === 0) return;
    setIdx(prev => Math.min(prev, brands.length - 1));
  }, [brands.length]);

  const effectiveIdx = idx - dragDelta / WHEEL_ITEM_H;

  const commit = (raw: number) => {
    const clamped = Math.max(0, Math.min(brands.length - 1, Math.round(raw)));
    setIdx(clamped);
    setDragDelta(0);
  };

  // Touch
  const onTouchStart = (e: React.TouchEvent) => {
    dragging.current = true;
    startClientY.current = e.touches[0].clientY;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragging.current) return;
    e.preventDefault();
    setDragDelta(e.touches[0].clientY - startClientY.current);
  };
  const onTouchEnd = () => {
    if (!dragging.current) return;
    dragging.current = false;
    commit(idx - dragDelta / WHEEL_ITEM_H);
  };

  // Mouse drag
  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = true;
    startClientY.current = e.clientY;
    e.preventDefault();
  };

  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!dragging.current) return;
      setDragDelta(e.clientY - startClientY.current);
    };
    const up = (e: MouseEvent) => {
      if (!dragging.current) return;
      const delta = e.clientY - startClientY.current;
      dragging.current = false;
      commit(idx - delta / WHEEL_ITEM_H);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
  }, [idx]);

  // Mouse wheel
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setIdx(prev => Math.max(0, Math.min(brands.length - 1, prev + (e.deltaY > 0 ? 1 : -1))));
  };

  // Keyboard — skip when focus is on an input/textarea (e.g. "Add new brand" field)
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(p => Math.min(brands.length - 1, p + 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx(p => Math.max(0, p - 1)); }
      else if (e.key === 'Enter') onSelect(brands[idx]);
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [idx, brands, onSelect, onClose]);

  // translateY so brands[idx] sits in the middle row of the 3-row window
  const translateY = (1 - idx) * WHEEL_ITEM_H + dragDelta;
  const isAnimating = !dragging.current;

  if (brands.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 w-full py-6">
        <p className="text-sm text-gray-400">No brands in list. Add one below.</p>
        <button
          type="button"
          onClick={onClose}
          className="px-6 py-2.5 rounded-xl border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      {/* Drum */}
      <div
        className="relative w-full overflow-hidden cursor-grab active:cursor-grabbing"
        style={{ height: WHEEL_ITEM_H * 3, touchAction: 'none' }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        onWheel={onWheel}
      >
        {/* Top fade */}
        <div
          className="absolute inset-x-0 top-0 z-10 pointer-events-none"
          style={{ height: WHEEL_ITEM_H, background: 'linear-gradient(to bottom, white 60%, transparent 100%)' }}
        />
        {/* Bottom fade */}
        <div
          className="absolute inset-x-0 bottom-0 z-10 pointer-events-none"
          style={{ height: WHEEL_ITEM_H, background: 'linear-gradient(to top, white 60%, transparent 100%)' }}
        />
        {/* Centre selection band */}
        <div
          className="absolute inset-x-6 z-10 pointer-events-none rounded-xl"
          style={{
            top: WHEEL_ITEM_H,
            height: WHEEL_ITEM_H,
            background: 'rgba(197,168,76,0.08)',
            border: '1.5px solid rgba(197,168,76,0.5)',
          }}
        />
        {/* Scrolling drum */}
        <div
          style={{
            transform: `translateY(${translateY}px)`,
            transition: isAnimating ? 'transform 0.28s cubic-bezier(0.25,0.46,0.45,0.94)' : 'none',
            willChange: 'transform',
          }}
        >
          {brands.map((brand, i) => {
            const dist = Math.abs(i - effectiveIdx);
            const isCenter = dist < 0.5;
            const opacity = dist > 1.5 ? 0 : dist > 1 ? 0.2 : dist > 0.5 ? 0.45 : 1;
            return (
              <div
                key={brand}
                style={{
                  height: WHEEL_ITEM_H,
                  opacity,
                  fontSize: isCenter ? 22 + fontSizeOffset * 2 : 15 + fontSizeOffset,
                  fontWeight: isCenter ? 700 : 400,
                  color: isCenter ? '#1a1f44' : '#9ca3af',
                  transition: isAnimating ? 'opacity 0.2s, font-size 0.2s, color 0.2s' : 'none',
                }}
                className="flex items-center justify-center px-4 text-center leading-tight"
                onClick={() => {
                  if (i === idx) { onSelect(brand); }
                  else { setIdx(i); setDragDelta(0); }
                }}
              >
                {brand}
              </div>
            );
          })}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex w-full gap-3 px-2">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 py-2.5 rounded-xl border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onSelect(brands[idx])}
          className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-colors"
          style={{ background: 'linear-gradient(135deg, #1a1f44 0%, #2d3561 100%)' }}
        >
          Select
        </button>
      </div>
    </div>
  );
}
// ────────────────────────────────────────────────────────────────────────────

export function ValetTicketWizard({ isOpen, onClose, user }: ValetTicketWizardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(1);
  const [showPreview, setShowPreview] = useState(false);
  const [carMakeSearch, setCarMakeSearch] = useState("");
  const [showCarMakeDropdown, setShowCarMakeDropdown] = useState(false);
  const [showBrandPicker, setShowBrandPicker] = useState(false);
  const [editingBrands, setEditingBrands] = useState(false);
  const [newBrandInput, setNewBrandInput] = useState("");
  const [brandFontSize, setBrandFontSize] = useState<number>(() => {
    try { return parseInt(localStorage.getItem('wizard-brand-font') || '0', 10); } catch { return 0; }
  });
  const changeBrandFont = (delta: number) => {
    setBrandFontSize(prev => {
      const next = Math.max(-2, Math.min(6, prev + delta));
      localStorage.setItem('wizard-brand-font', String(next));
      return next;
    });
  };
  const DEFAULT_BRANDS = [
    'Toyota', 'Lexus', 'Honda', 'Nissan', 'Mazda', 'Subaru',
    'Mitsubishi', 'Suzuki', 'Daihatsu', 'Mercedes-Benz', 'BMW', 'Audi',
    'Volkswagen', 'Porsche', 'Ferrari', 'Lamborghini', 'Maserati', 'Alfa Romeo',
    'Peugeot', 'Renault', 'Citroën', 'Rolls-Royce', 'Bentley', 'Aston Martin',
    'Jaguar', 'Land Rover', 'Lotus', 'McLaren', 'Mini Cooper', 'Volvo',
  ];

  const [quickBrands, setQuickBrands] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('valet-quick-brands');
      return saved ? JSON.parse(saved) : DEFAULT_BRANDS;
    } catch {
      return DEFAULT_BRANDS;
    }
  });

  const saveBrands = (brands: string[]) => {
    setQuickBrands(brands);
    localStorage.setItem('valet-quick-brands', JSON.stringify(brands));
  };

  const handleAddBrand = () => {
    const trimmed = newBrandInput.trim();
    if (!trimmed || quickBrands.includes(trimmed)) return;
    saveBrands([...quickBrands, trimmed]);
    setNewBrandInput("");
  };

  const handleRemoveBrand = (brand: string) => {
    saveBrands(quickBrands.filter(b => b !== brand));
  };

  const DEFAULT_COLORS = ['Black', 'Silver', 'White', 'Grey', 'Red', 'Blue', 'Green', 'Brown'];

  const [quickColors, setQuickColors] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('valet-quick-colors');
      return saved ? JSON.parse(saved) : DEFAULT_COLORS;
    } catch {
      return DEFAULT_COLORS;
    }
  });
  const [editingColors, setEditingColors] = useState(false);
  const [newColorInput, setNewColorInput] = useState("");

  const saveColors = (colors: string[]) => {
    setQuickColors(colors);
    localStorage.setItem('valet-quick-colors', JSON.stringify(colors));
  };

  const handleAddColor = () => {
    const trimmed = newColorInput.trim();
    if (!trimmed || quickColors.map(c => c.toLowerCase()).includes(trimmed.toLowerCase())) return;
    const capitalized = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    saveColors([...quickColors, capitalized]);
    setNewColorInput("");
  };

  const handleRemoveColor = (color: string) => {
    saveColors(quickColors.filter(c => c !== color));
    if (formData.carColor === color) setFormData({ ...formData, carColor: "" });
  };

  const { recognizePlate } = useOCR();
  const [isOcrRunning, setIsOcrRunning] = useState(false);
  const [isCarPhotoProcessing, setIsCarPhotoProcessing] = useState(false);

  const [formData, setFormData] = useState<TicketFormData>({
    visitorType: "",
    visitorSubType: "",
    carMake: "",
    carModel: "",
    carColor: "",
    platePhotoUrl: "",
    licensePlate: "",
    carPhotoUrl: "",
    carPhotoSize: 0,
    guestName: "",
    roomNumber: "",
    ticketNumber: "",
    guestPin: generatePin(),
  });

  // Guest name autocomplete
  const [nameSuggestions, setNameSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const nameDebounceRef = React.useRef<ReturnType<typeof setTimeout>|null>(null);

  const fetchNameSuggestions = (prefix: string, visitorType: string) => {
    if (nameDebounceRef.current) clearTimeout(nameDebounceRef.current);
    if (!prefix.trim() || prefix.length < 1 || !visitorType) { setNameSuggestions([]); return; }
    nameDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/name-imports?prefix=${encodeURIComponent(prefix)}&visitorType=${encodeURIComponent(visitorType)}`);
        const data = await res.json();
        setNameSuggestions(Array.isArray(data) ? data : []);
        setShowSuggestions(Array.isArray(data) && data.length > 0);
      } catch { setNameSuggestions([]); }
    }, 200);
  };

  const filteredCarMakes = useMemo(() => {
    if (carMakeSearch.length < 2) return [];
    const search = carMakeSearch.toLowerCase();
    return CAR_MAKES.filter(make => 
      make.toLowerCase().includes(search)
    ).slice(0, 8);
  }, [carMakeSearch]);

  const createTicketMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const staffName = user?.firstName && user?.lastName 
        ? `${user.firstName} ${user.lastName}` 
        : user?.username || "Unknown Staff";
      
      return await apiRequest("POST", "/api/staff/tickets", {
        ticketNumber: data.ticketNumber,
        visitorType: data.visitorType,
        visitorSubType: data.visitorSubType || null,
        guestName: data.guestName,
        guestPin: data.guestPin || null,
        roomNumber: data.roomNumber || null,
        carMake: data.carMake,
        carModel: data.carModel,
        carColor: data.carColor,
        platePhotoUrl: data.platePhotoUrl || null,
        licensePlate: data.licensePlate || null,
        carPhoto: data.carPhotoUrl || null,
        createdByUserId: user?.id,
        createdByName: staffName,
        locationId: user?.locationId || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff/tickets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/staff/stats"] });
      toast({ title: "Valet ticket created successfully!" });
      handleClose();
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to create ticket", 
        description: error.message || "Please try again",
        variant: "destructive" 
      });
    },
  });

  const handleClose = () => {
    setCurrentStep(1);
    setShowPreview(false);
    setFormData({
      visitorType: "",
      visitorSubType: "",
      carMake: "",
      carModel: "",
      carColor: "",
      platePhotoUrl: "",
      licensePlate: "",
      carPhotoUrl: "",
      carPhotoSize: 0,
      guestName: "",
      roomNumber: "",
      ticketNumber: "",
      guestPin: generatePin(),
    });
    setCarMakeSearch("");
    onClose();
  };

  const generateTicketNumber = () => {
    const letter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
    const digits = String(Math.floor(1000 + Math.random() * 9000));
    return letter + digits;
  };

  const canProceedStep1 = formData.visitorType && 
    (formData.visitorType !== "restaurant" || formData.visitorSubType) &&
    formData.carMake && formData.carModel && formData.carColor &&
    formData.guestName.trim().length > 0 &&
    (formData.ticketNumber.length === 5 && /^[A-Za-z0-9]{5}$/.test(formData.ticketNumber));

  const canProceedStep2 = formData.platePhotoUrl.length > 0 && formData.licensePlate.trim().length > 0;

  const handleNext = () => {
    if (currentStep < 2) {
      setCurrentStep(currentStep + 1);
    } else {
      setShowPreview(true);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = () => {
    createTicketMutation.mutate(formData);
  };

  const getVisitorTypeIcon = (type: VisitorType) => {
    switch (type) {
      case "hotel_guest": return <Hotel className="w-4 h-4 shrink-0" />;
      case "restaurant": return <UtensilsCrossed className="w-4 h-4 shrink-0" />;
      case "event": return <CalendarDays className="w-4 h-4 shrink-0" />;
      case "others": return <Users className="w-4 h-4 shrink-0" />;
    }
  };

  const renderStep1 = () => (
    <div className="space-y-3">
      {/* Guest Information — top of step 1 */}
      <div>
        <h3 className="text-sm font-semibold text-regis-navy mb-1.5">Guest Information</h3>
        <div className="relative">
          <label className="text-sm font-medium text-gray-700">Full Name *</label>
          <Input
            value={formData.guestName}
            onChange={(e) => {
              const val = e.target.value;
              setFormData({ ...formData, guestName: val });
              fetchNameSuggestions(val, formData.visitorType);
            }}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            onFocus={() => { if (nameSuggestions.length > 0) setShowSuggestions(true); }}
            placeholder="Enter guest's full name"
            className="mt-1"
            data-testid="input-guest-name"
            autoComplete="off"
          />
          {showSuggestions && nameSuggestions.length > 0 && (
            <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
              {nameSuggestions.map((name, i) => (
                <button
                  key={i}
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-regis-gold/10 hover:text-regis-navy border-b border-gray-100 last:border-0"
                  onMouseDown={() => {
                    setFormData({ ...formData, guestName: name });
                    setShowSuggestions(false);
                    setNameSuggestions([]);
                  }}
                >
                  {name}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <button
            type="button"
            title="Generate Japanese name"
            onClick={() => {
              const first = ["Haruto","Yuto","Sota","Yuki","Hayato","Kento","Ren","Kaito","Shota","Ryota","Takumi","Daiki","Kenji","Naoki","Hiroshi","Sakura","Yui","Hana","Aoi","Rin","Mio","Nana","Saki","Yuna","Misaki","Akemi","Haruka","Miyu","Riko","Natsuki"];
              const last = ["Tanaka","Suzuki","Sato","Yamamoto","Watanabe","Ito","Kobayashi","Nakamura","Kato","Yoshida","Yamada","Sasaki","Yamaguchi","Matsumoto","Inoue","Kimura","Hayashi","Shimizu","Yamazaki","Mori","Abe","Ikeda","Hashimoto","Nishimura","Ogawa","Fujita","Okamoto","Nakajima","Maeda","Fujii"];
              const name = `${last[Math.floor(Math.random()*last.length)]} ${first[Math.floor(Math.random()*first.length)]}`;
              setFormData({ ...formData, guestName: name });
            }}
            className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-800 border border-red-200 hover:border-red-400 bg-red-50 hover:bg-red-100 rounded-md px-2 py-1 transition-colors font-bold tracking-tight"
          >
            JP
          </button>
          <button
            type="button"
            onClick={() => {
              const first = ["Aiden","Blake","Cameron","Dakota","Ellis","Finley","Gray","Harper","Indigo","Jordan","Kendall","Logan","Morgan","Noah","Oakley","Parker","Quinn","Reese","Sage","Taylor","River","Avery","Casey","Drew","Emery","Fallon","Haven","Juno","Kai","Lane","Marlowe","Noel","Onyx","Piper","Remy","Scout","Sloane","Spencer","Sterling","Wynne"];
              const last = ["Ashford","Bennett","Calloway","Davenport","Elsworth","Fairfax","Graham","Harrington","Ingram","Jennings","Kensington","Langley","Merritt","Northcott","Ogilvy","Pemberton","Quinlan","Radcliffe","Stanton","Thornton","Upton","Vane","Whitmore","Xavier","Yardley","Zealand"];
              const name = `Mx. ${first[Math.floor(Math.random()*first.length)]} ${last[Math.floor(Math.random()*last.length)]}`;
              setFormData({ ...formData, guestName: name });
            }}
            className="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 border border-indigo-200 hover:border-indigo-400 bg-indigo-50 hover:bg-indigo-100 rounded-md px-2.5 py-1 transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a5 5 0 1 0 5 5"/><path d="M12 2v4m0 0a5 5 0 0 1 5 5"/><circle cx="12" cy="17" r="5"/></svg>
            Generate Name
          </button>

          <div className="flex items-center gap-1.5 bg-regis-navy/5 border border-regis-navy/20 rounded-lg px-2.5 py-1">
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider shrink-0">PIN</span>
            <span className="font-mono font-bold text-regis-navy text-sm tracking-widest">{formData.guestPin}</span>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, guestPin: generatePin() })}
              title="Generate new PIN"
              className="p-0.5 rounded hover:bg-regis-navy/10 text-gray-400 hover:text-regis-navy transition-colors"
            >
              <RefreshCw size={11} />
            </button>
            <button
              type="button"
              onClick={() => printPinLabel(formData.guestPin)}
              title="Print PIN label"
              className="p-0.5 rounded hover:bg-amber-50 text-amber-600 hover:text-amber-800 transition-colors border border-amber-200 hover:border-amber-400"
            >
              <Printer size={11} />
            </button>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-regis-navy mb-1.5">Valet Ticket Number</h3>
        <div className="space-y-2">
          <div>
            <label className="text-sm font-medium text-gray-700">Ticket Number *</label>
            <div className="flex gap-2 mt-1">
              <Input
                value={formData.ticketNumber}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 5);
                  setFormData({ ...formData, ticketNumber: value });
                }}
                placeholder="12345"
                className="text-center text-2xl font-bold tracking-widest"
                maxLength={5}
                data-testid="input-ticket-number"
              />
              <Button
                type="button"
                variant="outline"
                className="shrink-0 border-amber-500 text-amber-600 hover:bg-amber-50"
                title="Print ticket + PIN"
                disabled={formData.ticketNumber.length !== 5}
                onClick={() => printTicketPinLabel(formData.ticketNumber, formData.guestPin)}
              >
                <Printer className="w-4 h-4" />
              </Button>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full border-dashed border-purple-400 text-purple-600 hover:bg-purple-50 hover:border-purple-500 text-sm font-medium mt-2"
              onClick={() => setFormData({ ...formData, ticketNumber: generateTicketNumber() })}
            >
              + Generate Ticket
            </Button>
            {formData.ticketNumber.length > 0 && formData.ticketNumber.length < 5 && (
              <p className="text-sm text-orange-600 mt-1">
                Enter {5 - formData.ticketNumber.length} more character(s)
              </p>
            )}
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-regis-navy mb-1.5">Visitor Type</h3>
        <div className="grid grid-cols-2 gap-2">
          {(Object.entries(VISITOR_TYPES) as [VisitorType, string][]).map(([key, label]) => (
            <div key={key} className={key === 'restaurant' && formData.visitorType === 'restaurant' ? 'col-span-2' : ''}>
              <button
                onClick={() => {
                  const autoRoom = key === 'hotel_guest' ? '' : key === 'event' ? 'Event' : key === 'others' ? 'Others' : '';
                  setFormData({ ...formData, visitorType: key, visitorSubType: "", roomNumber: autoRoom });
                }}
                className={`w-full flex items-center gap-2 p-2 px-3 rounded-lg border-2 transition-all ${
                  formData.visitorType === key
                    ? "border-regis-gold bg-regis-gold/10"
                    : "border-gray-200 hover:border-gray-300"
                }`}
                data-testid={`visitor-type-${key}`}
              >
                {getVisitorTypeIcon(key)}
                <span className="font-medium text-sm">{label}</span>
                {formData.visitorType === key && <Check className="ml-auto text-regis-gold" size={16} />}
              </button>

              {/* Restaurant sub-options — full width below the button */}
              {key === 'restaurant' && formData.visitorType === 'restaurant' && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {(Object.entries(RESTAURANT_SUB_TYPES) as [RestaurantSubType, string][]).map(([rKey, rLabel]) => (
                    <button
                      key={rKey}
                      onClick={() => setFormData({ ...formData, visitorSubType: rKey, roomNumber: rLabel })}
                      className={`px-3 py-1.5 rounded-lg border-2 text-sm font-medium transition-all text-left ${
                        formData.visitorSubType === rKey
                          ? "border-regis-gold bg-regis-gold/10 text-regis-navy"
                          : "border-gray-200 hover:border-gray-300 text-gray-700"
                      }`}
                      data-testid={`restaurant-${rKey}`}
                    >
                      {rLabel}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-regis-navy mb-1.5">Vehicle Details</h3>
        <div className="space-y-2">
          <div className="relative">
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-gray-700">Car Make</label>
              <button
                type="button"
                onClick={() => setShowBrandPicker(true)}
                className="flex items-center gap-1 text-xs font-medium text-regis-gold hover:text-yellow-600 border border-regis-gold hover:border-yellow-600 rounded-md px-2 py-1 transition-colors"
              >
                <Plus size={12} />
                Add Brand
              </button>
            </div>

            {/* iOS wheel picker modal */}
            {showBrandPicker && (
              <div
                className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center"
                style={{ background: 'rgba(0,0,0,0.45)' }}
                onClick={(e) => { if (e.target === e.currentTarget) { setShowBrandPicker(false); setEditingBrands(false); } }}
              >
                <div className="bg-white w-full sm:w-80 sm:rounded-2xl rounded-t-2xl overflow-hidden shadow-2xl">
                  {/* Header */}
                  <div className="flex items-center justify-between px-5 pt-5 pb-2">
                    <span className="text-base font-semibold text-regis-navy">Select Brand</span>
                    <div className="flex items-center gap-2">
                      {/* Font size controls */}
                      <div className="flex items-center gap-1 border border-gray-200 rounded-md overflow-hidden">
                        <button
                          type="button"
                          onClick={() => changeBrandFont(-1)}
                          disabled={brandFontSize <= -2}
                          className="px-1.5 py-0.5 text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-30 transition-colors"
                          title="Smaller text"
                        >A-</button>
                        <span className="px-1 text-[10px] text-gray-400 select-none border-x border-gray-200">
                          {brandFontSize > 0 ? `+${brandFontSize}` : brandFontSize}
                        </span>
                        <button
                          type="button"
                          onClick={() => changeBrandFont(1)}
                          disabled={brandFontSize >= 6}
                          className="px-1.5 py-0.5 text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-30 transition-colors"
                          title="Larger text"
                        >A+</button>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setShowBrandPicker(false); setEditingBrands(false); setNewBrandInput(""); }}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </div>

                  {/* Wheel */}
                  <div className="px-4 pb-2">
                    <BrandWheelPicker
                      brands={quickBrands}
                      value={formData.carMake}
                      fontSizeOffset={brandFontSize}
                      onSelect={(brand) => {
                        setFormData({ ...formData, carMake: brand });
                        setCarMakeSearch(brand);
                        setShowCarMakeDropdown(false);
                        setShowBrandPicker(false);
                        setEditingBrands(false);
                      }}
                      onClose={() => { setShowBrandPicker(false); setEditingBrands(false); }}
                    />
                  </div>

                  {/* Edit list section */}
                  <div className="border-t border-gray-100 mx-4 pt-3 pb-4">
                    {!editingBrands ? (
                      <button
                        type="button"
                        onClick={() => setEditingBrands(true)}
                        className="w-full text-xs text-gray-400 hover:text-red-500 transition-colors py-1"
                      >
                        Edit brand list
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-1.5">
                          {quickBrands.map((brand) => (
                            <span
                              key={brand}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200"
                            >
                              {brand}
                              <button
                                type="button"
                                onClick={() => handleRemoveBrand(brand)}
                                className="text-red-400 hover:text-red-600 transition-colors"
                              >
                                <X size={10} />
                              </button>
                            </span>
                          ))}
                        </div>
                        <div className="flex gap-2 pt-1">
                          <input
                            type="text"
                            value={newBrandInput}
                            onChange={(e) => setNewBrandInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddBrand()}
                            placeholder="Add new brand…"
                            className="flex-1 text-xs px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:border-regis-gold"
                          />
                          <button
                            type="button"
                            onClick={handleAddBrand}
                            disabled={!newBrandInput.trim()}
                            className="px-3 py-1.5 text-xs font-medium bg-regis-navy text-white rounded-lg hover:bg-blue-900 disabled:opacity-40 transition-colors"
                          >
                            Add
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => { setEditingBrands(false); setNewBrandInput(""); }}
                          className="w-full text-xs font-medium text-regis-gold hover:text-yellow-600 py-1 transition-colors"
                        >
                          Done Editing
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            {formData.carMake && (
              <p className="mt-1 text-xs text-gray-500">
                Selected: <span className="font-medium text-regis-navy">{formData.carMake}</span>
              </p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Model</label>
            <Input
              value={formData.carModel}
              onChange={(e) => setFormData({ ...formData, carModel: e.target.value })}
              placeholder="e.g., SL55, R1, Passat, Civic"
              className="mt-1"
              data-testid="input-car-model"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Color</label>
              {!editingColors && (
                <button
                  type="button"
                  onClick={() => setEditingColors(true)}
                  className="flex items-center gap-1 text-xs font-medium border border-red-300 bg-red-50 text-red-500 hover:bg-red-100 hover:border-red-400 rounded-md px-2 py-1 transition-colors"
                >
                  <Plus size={12} />
                  Edit
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {quickColors.map((color) => {
                const colorStyle = COLOR_STYLES[color] || COLOR_STYLES['Other'];
                const isSelected = formData.carColor === color;
                return (
                  <div key={color} className="relative">
                    {editingColors ? (
                      <span className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border-2 ${colorStyle.bg} ${colorStyle.text} ${colorStyle.border}`}>
                        {color}
                        <button
                          type="button"
                          onClick={() => handleRemoveColor(color)}
                          className="ml-0.5 opacity-70 hover:opacity-100 transition-opacity"
                        >
                          <X size={11} />
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, carColor: color })}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-all ${colorStyle.bg} ${colorStyle.text} ${colorStyle.border} ${
                          isSelected ? "ring-2 ring-regis-gold ring-offset-2 scale-105" : "hover:scale-105"
                        }`}
                        data-testid={`color-${color}`}
                      >
                        {color}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {editingColors && (
              <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newColorInput}
                    onChange={(e) => setNewColorInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddColor()}
                    placeholder="Type a color name and press Add"
                    className="flex-1 text-xs px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:border-regis-gold"
                  />
                  <button
                    type="button"
                    onClick={handleAddColor}
                    disabled={!newColorInput.trim()}
                    className="px-3 py-1.5 text-xs font-medium bg-regis-navy text-white rounded-md hover:bg-blue-900 disabled:opacity-40 transition-colors"
                  >
                    Add
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => { setEditingColors(false); setNewColorInput(""); }}
                  className="w-full text-xs font-medium text-regis-gold hover:text-yellow-600 py-1 transition-colors"
                >
                  Done Editing
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-regis-navy mb-1.5">Registration Plate Photo</h3>
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 text-center">
          {formData.platePhotoUrl ? (
            <div className="space-y-3">
              <img 
                src={formData.platePhotoUrl} 
                alt="License plate" 
                className="max-h-32 mx-auto rounded"
              />
              {isOcrRunning && (
                <p className="text-sm text-regis-navy animate-pulse">Reading plate number...</p>
              )}
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setFormData({ ...formData, platePhotoUrl: "", licensePlate: "" })}
              >
                Remove Photo
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <Camera className="w-8 h-8 mx-auto text-gray-400" />
              <p className="text-sm text-gray-500">Take a photo of the license plate</p>
              <div className="flex gap-2 justify-center">
                <Button
                  variant="default"
                  className="bg-regis-gold hover:bg-yellow-600 text-regis-navy"
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*';
                    input.capture = 'environment';
                    input.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
                    document.body.appendChild(input);
                    input.onchange = async (e) => {
                      document.body.removeChild(input);
                      const file = (e.target as HTMLInputElement).files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = async (ev) => {
                          const rawDataUrl = ev.target?.result as string;

                          // 1. Compress for storage (small JPEG, cropped)
                          let processedUrl = rawDataUrl;
                          try { processedUrl = await processPlateImage(rawDataUrl); } catch {}

                          // 2. Store the compressed version immediately so the preview shows
                          setFormData(prev => ({ ...prev, platePhotoUrl: processedUrl, licensePlate: "" }));
                          setIsOcrRunning(true);

                          // 3. Send to Google Cloud Vision for accurate Japanese plate reading
                          try {
                            const visionDataUrl = await prepareForVisionAPI(rawDataUrl);
                            const rawText = await recognizePlate(visionDataUrl);
                            const cleaned = extractJapanesePlate(rawText);
                            setFormData(prev => ({ ...prev, licensePlate: cleaned }));
                          } catch (err) {
                            console.error('Plate OCR failed:', err);
                            toast({
                              title: "Plate scan failed",
                              description: "Could not read the plate — please type it manually.",
                              variant: "destructive",
                            });
                          } finally {
                            setIsOcrRunning(false);
                          }
                        };
                        reader.readAsDataURL(file);
                      }
                    };
                    input.click();
                  }}
                  data-testid="button-capture-plate"
                >
                  <Camera className="w-4 h-4 mr-2" />
                  Take Photo
                </Button>
              </div>
              <p className="text-xs text-red-500 font-medium">* Photo is required to proceed</p>
            </div>
          )}
        </div>

        {formData.platePhotoUrl && (
          <div className="mt-4 space-y-1">
            <label className="text-sm font-medium text-gray-700">
              Plate Number <span className="text-gray-400 font-normal">(confirm or correct)</span>
            </label>
            <Input
              value={formData.licensePlate}
              onChange={(e) => setFormData({ ...formData, licensePlate: e.target.value })}
              placeholder={isOcrRunning ? "Reading..." : "e.g. 品川 500 あ 1234"}
              disabled={isOcrRunning}
              className="text-center font-mono text-lg tracking-widest"
              data-testid="input-license-plate"
            />
            {!isOcrRunning && formData.licensePlate.trim().length === 0 && (
              <p className="text-xs text-red-500">* Plate number is required to proceed</p>
            )}
          </div>
        )}
      </div>

      {/* General Car Photo */}
      <div>
        <h3 className="text-sm font-semibold text-regis-navy mb-0.5">General Car Photo <span className="text-xs font-normal text-gray-400">— Optional</span></h3>
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 text-center">
          {formData.carPhotoUrl ? (
            <div className="space-y-2">
              <img
                src={formData.carPhotoUrl}
                alt="Car photo"
                className="max-h-36 mx-auto rounded object-cover"
              />
              <div className="flex items-center justify-center gap-2">
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                  {formData.carPhotoSize} KB
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFormData({ ...formData, carPhotoUrl: "", carPhotoSize: 0 })}
              >
                Remove Photo
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {isCarPhotoProcessing ? (
                <p className="text-sm text-regis-navy animate-pulse">Compressing photo…</p>
              ) : (
                <>
                  <Camera className="w-7 h-7 mx-auto text-gray-400" />
                  <p className="text-sm text-gray-500">Take a general photo of the car</p>
                  <Button
                    variant="outline"
                    className="border-regis-navy text-regis-navy hover:bg-regis-navy hover:text-white"
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = 'image/*';
                      input.capture = 'environment';
                      input.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
                      document.body.appendChild(input);
                      input.onchange = async (e) => {
                        document.body.removeChild(input);
                        const file = (e.target as HTMLInputElement).files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = async (ev) => {
                          const rawDataUrl = ev.target?.result as string;
                          setIsCarPhotoProcessing(true);
                          try {
                            const { dataUrl, sizeKb } = await processCarPhoto(rawDataUrl);
                            setFormData(prev => ({ ...prev, carPhotoUrl: dataUrl, carPhotoSize: sizeKb }));
                          } catch {
                            toast({ title: "Photo error", description: "Could not process photo. Try again.", variant: "destructive" });
                          } finally {
                            setIsCarPhotoProcessing(false);
                          }
                        };
                        reader.readAsDataURL(file);
                      };
                      input.click();
                    }}
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    Take Car Photo
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-regis-navy mb-1.5">Room Number</h3>
        {formData.visitorType === 'hotel_guest' ? (
          <Input
            value={formData.roomNumber}
            onChange={(e) => setFormData({ ...formData, roomNumber: e.target.value })}
            placeholder="Enter room number (optional)"
            data-testid="input-room-number"
          />
        ) : (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-md border border-gray-200 bg-gray-50">
            <span className="font-semibold text-regis-navy">{formData.roomNumber || '—'}</span>
            <span className="ml-auto text-xs text-gray-400 italic">auto-filled</span>
          </div>
        )}
      </div>

      <div className="bg-gray-50 rounded-lg p-3">
        <h3 className="text-sm font-semibold text-regis-navy mb-1.5">Auto-filled Information</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-gray-500">Date:</span>
            <p className="font-medium">{new Date().toLocaleDateString()}</p>
          </div>
          <div>
            <span className="text-gray-500">Time:</span>
            <p className="font-medium">{new Date().toLocaleTimeString()}</p>
          </div>
          <div className="col-span-2">
            <span className="text-gray-500">Staff:</span>
            <p className="font-medium">{user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : user?.username || "Unknown Staff"}</p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderPreview = () => {
    const now = new Date();
    const staffName = user?.firstName && user?.lastName 
      ? `${user.firstName} ${user.lastName}` 
      : user?.username || "Unknown Staff";

    return (
      <div className="space-y-4">
        <div className="bg-regis-navy text-white p-4 rounded-lg text-center">
          <p className="text-sm opacity-80">Valet Ticket</p>
          <p className="text-4xl font-bold tracking-widest">{formData.ticketNumber}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="bg-gray-50 p-3 rounded-lg">
            <span className="text-gray-500">Visitor Type</span>
            <p className="font-medium">{VISITOR_TYPES[formData.visitorType as VisitorType]}</p>
            {formData.visitorSubType && (
              <Badge variant="secondary" className="mt-1">
                {RESTAURANT_SUB_TYPES[formData.visitorSubType as RestaurantSubType]}
              </Badge>
            )}
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <span className="text-gray-500">Guest Name</span>
            <p className="font-medium">{fmtGuest(formData.guestName)}</p>
            {formData.roomNumber && (
              <p className="text-xs text-gray-500 mt-1">Room: {formData.roomNumber}</p>
            )}
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <span className="text-gray-500">Vehicle</span>
            <p className="font-medium">{formData.carMake} {formData.carModel}</p>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <span className="text-gray-500">Color</span>
            <p className="font-medium">{formData.carColor}</p>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <span className="text-gray-500">Date/Time</span>
            <p className="font-medium">{now.toLocaleDateString()} {now.toLocaleTimeString()}</p>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <span className="text-gray-500">Staff</span>
            <p className="font-medium">{staffName}</p>
          </div>
        </div>

        {(formData.licensePlate || formData.platePhotoUrl) && (
          <div className="bg-gray-50 p-3 rounded-lg">
            <span className="text-gray-500 text-sm">Registration Plate</span>
            {formData.licensePlate && (
              <p className="font-mono font-bold text-lg mt-1 tracking-widest">{formData.licensePlate}</p>
            )}
            {formData.platePhotoUrl && (
              <img 
                src={formData.platePhotoUrl} 
                alt="License plate" 
                className="max-h-24 mt-2 rounded"
              />
            )}
          </div>
        )}

        {formData.carPhotoUrl && (
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-500 text-sm">Car Photo</span>
              <span className="text-xs text-gray-400 bg-gray-200 px-2 py-0.5 rounded-full">{formData.carPhotoSize} KB</span>
            </div>
            <img
              src={formData.carPhotoUrl}
              alt="Car"
              className="w-full max-h-40 object-cover rounded"
            />
          </div>
        )}

        <div className="flex gap-3 pt-4">
          <Button 
            variant="outline" 
            className="flex-1"
            onClick={() => setShowPreview(false)}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Edit
          </Button>
          <Button 
            className="flex-1 bg-regis-navy hover:bg-blue-900"
            onClick={handleSubmit}
            disabled={createTicketMutation.isPending}
            data-testid="button-confirm-ticket"
          >
            {createTicketMutation.isPending ? "Creating..." : "Confirm & Create Ticket"}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <>
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[96vh] overflow-y-auto">
        <DialogHeader className="pb-1">
          <DialogTitle className="flex items-center gap-2">
            <Ticket className="w-5 h-5 text-regis-gold" />
            {showPreview ? "Confirm Ticket Details" : "New Valet Ticket"}
          </DialogTitle>
        </DialogHeader>

        {!showPreview && (
          <div className="flex justify-between mb-3">
            {STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                  currentStep >= step.id 
                    ? "bg-regis-navy border-regis-navy text-white" 
                    : "border-gray-300 text-gray-400"
                }`}>
                  {currentStep > step.id ? <Check size={16} /> : step.id}
                </div>
                {index < STEPS.length - 1 && (
                  <div className={`w-12 h-0.5 mx-1 ${
                    currentStep > step.id ? "bg-regis-navy" : "bg-gray-200"
                  }`} />
                )}
              </div>
            ))}
          </div>
        )}

        {showPreview ? renderPreview() : (
          <>
            {currentStep === 1 && renderStep1()}
            {currentStep === 2 && renderStep2()}

            <div className="flex gap-3 pt-4 border-t">
              {currentStep > 1 && (
                <Button variant="outline" onClick={handleBack} className="flex-1">
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              )}
              <Button 
                className="flex-1 bg-regis-navy hover:bg-blue-900"
                onClick={handleNext}
                disabled={
                  (currentStep === 1 && !canProceedStep1) ||
                  (currentStep === 2 && !canProceedStep2)
                }
                data-testid="button-next-step"
              >
                {currentStep === 2 ? "Preview" : "Next"}
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>

    </>
  );
}
