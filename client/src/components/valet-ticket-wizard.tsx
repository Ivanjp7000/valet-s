import { useState, useMemo } from "react";
import { useOCR } from "@/hooks/useOCR";
import { CameraScanner } from "@/components/camera-scanner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { 
  Car, Camera, User, ChevronRight, ChevronLeft, Check, 
  Hotel, UtensilsCrossed, Users, X, Ticket, CalendarDays, Plus, ChevronUp, ScanLine
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  VISITOR_TYPES, RESTAURANT_SUB_TYPES, CAR_COLORS, CAR_MAKES 
} from "@shared/schema";
import type { User as UserType } from "@shared/schema";

const stripHonorifics = (name: string) =>
  name.replace(/^(Mr\.|Mrs\.|Ms\.|Mx\.|Dr\.|Miss|Sir|Lord)\s*/i, '').trim();
const fmtGuest = (name: string | null | undefined) =>
  name ? stripHonorifics(name) + ' 様' : '';

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
}

const STEPS = [
  { id: 1, title: "Visitor & Vehicle", icon: Car },
  { id: 2, title: "Registration & Guest", icon: Camera },
  { id: 3, title: "Ticket & Confirm", icon: Ticket },
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

export function ValetTicketWizard({ isOpen, onClose, user }: ValetTicketWizardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(1);
  const [showPreview, setShowPreview] = useState(false);
  const [carMakeSearch, setCarMakeSearch] = useState("");
  const [showCarMakeDropdown, setShowCarMakeDropdown] = useState(false);
  const [showBrandGrid, setShowBrandGrid] = useState(true);
  const [editingBrands, setEditingBrands] = useState(false);
  const [newBrandInput, setNewBrandInput] = useState("");

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
  const [isTicketOcrRunning, setIsTicketOcrRunning] = useState(false);
  const [showTicketScanner, setShowTicketScanner] = useState(false);
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
  });

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
    });
    setCarMakeSearch("");
    onClose();
  };

  const canProceedStep1 = formData.visitorType && 
    (formData.visitorType !== "restaurant" || formData.visitorSubType) &&
    formData.carMake && formData.carModel && formData.carColor &&
    formData.guestName.trim().length > 0;

  const canProceedStep2 = formData.platePhotoUrl.length > 0 && formData.licensePlate.trim().length > 0;

  const PSEUDO_TICKET = 'X7777';
  const canProceedStep3 = formData.ticketNumber === PSEUDO_TICKET || (formData.ticketNumber.length === 5 && /^\d{5}$/.test(formData.ticketNumber));

  const handleNext = () => {
    if (currentStep < 3) {
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
      case "hotel_guest": return <Hotel className="w-6 h-6" />;
      case "restaurant": return <UtensilsCrossed className="w-6 h-6" />;
      case "event": return <CalendarDays className="w-6 h-6" />;
      case "others": return <Users className="w-6 h-6" />;
    }
  };

  const renderStep1 = () => (
    <div className="space-y-6">
      {/* Guest Information — top of step 1 */}
      <div>
        <h3 className="text-lg font-semibold text-regis-navy mb-3">Guest Information</h3>
        <div>
          <label className="text-sm font-medium text-gray-700">Full Name *</label>
          <Input
            value={formData.guestName}
            onChange={(e) => setFormData({ ...formData, guestName: e.target.value })}
            placeholder="Enter guest's full name"
            className="mt-1"
            data-testid="input-guest-name"
          />
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-regis-navy mb-3">Visitor Type</h3>
        <div className="grid grid-cols-1 gap-3">
          {(Object.entries(VISITOR_TYPES) as [VisitorType, string][]).map(([key, label]) => (
            <div key={key}>
              <button
                onClick={() => {
                  const autoRoom = key === 'hotel_guest' ? '' : key === 'event' ? 'Event' : key === 'others' ? 'Others' : '';
                  setFormData({ ...formData, visitorType: key, visitorSubType: "", roomNumber: autoRoom });
                }}
                className={`w-full flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${
                  formData.visitorType === key
                    ? "border-regis-gold bg-regis-gold/10"
                    : "border-gray-200 hover:border-gray-300"
                }`}
                data-testid={`visitor-type-${key}`}
              >
                {getVisitorTypeIcon(key)}
                <span className="font-medium">{label}</span>
                {formData.visitorType === key && <Check className="ml-auto text-regis-gold" size={20} />}
              </button>

              {/* Restaurant sub-options appear inline, immediately below */}
              {key === 'restaurant' && formData.visitorType === 'restaurant' && (
                <div className="mt-2 ml-4 grid grid-cols-2 gap-2">
                  {(Object.entries(RESTAURANT_SUB_TYPES) as [RestaurantSubType, string][]).map(([rKey, rLabel]) => (
                    <button
                      key={rKey}
                      onClick={() => setFormData({ ...formData, visitorSubType: rKey, roomNumber: rLabel })}
                      className={`px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all text-left ${
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
        <h3 className="text-lg font-semibold text-regis-navy mb-3">Vehicle Details</h3>
        <div className="space-y-3">
          <div className="relative">
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-gray-700">Car Make</label>
              <button
                type="button"
                onClick={() => setShowBrandGrid(!showBrandGrid)}
                className="flex items-center gap-1 text-xs font-medium text-regis-gold hover:text-yellow-600 border border-regis-gold hover:border-yellow-600 rounded-md px-2 py-1 transition-colors"
              >
                {showBrandGrid ? <ChevronUp size={12} /> : <Plus size={12} />}
                {showBrandGrid ? "Hide Brands" : "Add Brand"}
              </button>
            </div>
            {showBrandGrid && (
              <div className="mb-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex flex-wrap gap-2">
                  {quickBrands.map((brand, idx) => {
                    const palette = [
                      "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100",
                      "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100",
                      "bg-violet-50 border-violet-200 text-violet-700 hover:bg-violet-100",
                      "bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100",
                      "bg-pink-50 border-pink-200 text-pink-700 hover:bg-pink-100",
                      "bg-teal-50 border-teal-200 text-teal-700 hover:bg-teal-100",
                    ];
                    const color = palette[idx % palette.length];
                    return (
                      <div key={brand} className="relative">
                        {editingBrands ? (
                          <span className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border ${color}`}>
                            {brand}
                            <button
                              type="button"
                              onClick={() => handleRemoveBrand(brand)}
                              className="ml-0.5 text-red-400 hover:text-red-600 transition-colors"
                            >
                              <X size={11} />
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setFormData({ ...formData, carMake: brand });
                              setCarMakeSearch(brand);
                              setShowCarMakeDropdown(false);
                              setShowBrandGrid(false);
                            }}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                              formData.carMake === brand
                                ? "bg-regis-gold border-regis-gold text-white shadow-sm"
                                : color
                            }`}
                          >
                            {brand}
                          </button>
                        )}
                      </div>
                    );
                  })}

                  {/* Edit toggle button at the end */}
                  {!editingBrands && (
                    <button
                      type="button"
                      onClick={() => setEditingBrands(true)}
                      className="px-3 py-1.5 rounded-full text-xs font-medium border border-red-300 bg-red-50 text-red-500 hover:bg-red-100 hover:border-red-400 transition-colors"
                    >
                      Edit
                    </button>
                  )}
                </div>

                {/* Edit mode: add new brand + done */}
                {editingBrands && (
                  <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newBrandInput}
                        onChange={(e) => setNewBrandInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddBrand()}
                        placeholder="Type a brand name and press Add"
                        className="flex-1 text-xs px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:border-regis-gold"
                      />
                      <button
                        type="button"
                        onClick={handleAddBrand}
                        disabled={!newBrandInput.trim()}
                        className="px-3 py-1.5 text-xs font-medium bg-regis-navy text-white rounded-md hover:bg-blue-900 disabled:opacity-40 transition-colors"
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
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-regis-navy mb-3">Registration Plate Photo</h3>
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
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
              <Camera className="w-12 h-12 mx-auto text-gray-400" />
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
                    input.onchange = async (e) => {
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
        <h3 className="text-lg font-semibold text-regis-navy mb-1">General Car Photo</h3>
        <p className="text-xs text-gray-400 mb-3">Optional — take a photo of the whole car for reference</p>
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-5 text-center">
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
                  <Camera className="w-10 h-10 mx-auto text-gray-400" />
                  <p className="text-sm text-gray-500">Take a general photo of the car</p>
                  <Button
                    variant="outline"
                    className="border-regis-navy text-regis-navy hover:bg-regis-navy hover:text-white"
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = 'image/*';
                      input.capture = 'environment';
                      input.onchange = async (e) => {
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
        <h3 className="text-lg font-semibold text-regis-navy mb-3">Room Number</h3>
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
    </div>
  );

  const renderStep3 = () => {
    const now = new Date();
    const staffName = user?.firstName && user?.lastName 
      ? `${user.firstName} ${user.lastName}` 
      : user?.username || "Unknown Staff";

    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-regis-navy mb-3">Valet Ticket Number</h3>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-700">Ticket Number *</label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={formData.ticketNumber}
                  onChange={(e) => {
                    if (formData.ticketNumber === PSEUDO_TICKET) return;
                    const value = e.target.value.replace(/\D/g, '').slice(0, 5);
                    setFormData({ ...formData, ticketNumber: value });
                  }}
                  placeholder="12345"
                  className={`text-center text-2xl font-bold tracking-widest ${formData.ticketNumber === PSEUDO_TICKET ? 'text-purple-600 bg-purple-50 border-purple-300' : ''}`}
                  maxLength={5}
                  disabled={isTicketOcrRunning}
                  data-testid="input-ticket-number"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0 border-regis-navy text-regis-navy hover:bg-regis-navy hover:text-white"
                  onClick={() => setShowTicketScanner(true)}
                  data-testid="button-scan-ticket-number"
                >
                  <ScanLine className="w-4 h-4 mr-1" />
                  Scan
                </Button>
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full border-dashed border-purple-400 text-purple-600 hover:bg-purple-50 hover:border-purple-500 text-sm font-medium"
                onClick={() => setFormData({ ...formData, ticketNumber: PSEUDO_TICKET })}
              >
                + Add Pseudo Ticket
              </Button>
              {formData.ticketNumber === PSEUDO_TICKET && (
                <div className="flex items-center justify-between bg-purple-50 border border-purple-200 rounded-md px-3 py-2">
                  <p className="text-xs text-purple-700 font-medium">Pseudo ticket <strong>X7777</strong> — can be reused unlimited times</p>
                  <button
                    className="text-xs text-gray-400 hover:text-gray-600 ml-2"
                    onClick={() => setFormData({ ...formData, ticketNumber: '' })}
                  >✕</button>
                </div>
              )}
              {formData.ticketNumber !== PSEUDO_TICKET && formData.ticketNumber.length > 0 && formData.ticketNumber.length < 5 && (
                <p className="text-sm text-orange-600 mt-1">
                  Enter {5 - formData.ticketNumber.length} more digit(s)
                </p>
              )}
              {isTicketOcrRunning && (
                <p className="text-sm text-regis-navy animate-pulse mt-1">Reading ticket number from image...</p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-regis-navy mb-3">Auto-filled Information</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Date:</span>
              <p className="font-medium">{now.toLocaleDateString()}</p>
            </div>
            <div>
              <span className="text-gray-500">Time:</span>
              <p className="font-medium">{now.toLocaleTimeString()}</p>
            </div>
            <div className="col-span-2">
              <span className="text-gray-500">Staff:</span>
              <p className="font-medium">{staffName}</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

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
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ticket className="w-5 h-5 text-regis-gold" />
            {showPreview ? "Confirm Ticket Details" : "New Valet Ticket"}
          </DialogTitle>
        </DialogHeader>

        {!showPreview && (
          <div className="flex justify-between mb-6">
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
            {currentStep === 3 && renderStep3()}

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
                  (currentStep === 2 && !canProceedStep2) ||
                  (currentStep === 3 && !canProceedStep3)
                }
                data-testid="button-next-step"
              >
                {currentStep === 3 ? "Preview" : "Next"}
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </>
        )}
      </DialogContent>

      {/* Full-screen CameraScanner overlay */}
      {showTicketScanner && (
        <div className="fixed inset-0 z-[200]">
          <CameraScanner
            onScanComplete={(number) => {
              setFormData(prev => ({ ...prev, ticketNumber: number }));
              setShowTicketScanner(false);
            }}
            onClose={() => setShowTicketScanner(false)}
          />
        </div>
      )}
    </Dialog>
  );
}
