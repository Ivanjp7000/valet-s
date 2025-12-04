import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { 
  Car, Camera, User, ChevronRight, ChevronLeft, Check, 
  Hotel, UtensilsCrossed, Users, X, Ticket
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  VISITOR_TYPES, RESTAURANT_SUB_TYPES, CAR_COLORS, CAR_MAKES 
} from "@shared/schema";
import type { User as UserType } from "@shared/schema";

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
  guestName: string;
  ticketNumber: string;
}

const STEPS = [
  { id: 1, title: "Visitor & Vehicle", icon: Car },
  { id: 2, title: "Registration & Guest", icon: Camera },
  { id: 3, title: "Ticket & Confirm", icon: Ticket },
];

export function ValetTicketWizard({ isOpen, onClose, user }: ValetTicketWizardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(1);
  const [showPreview, setShowPreview] = useState(false);
  const [carMakeSearch, setCarMakeSearch] = useState("");
  const [showCarMakeDropdown, setShowCarMakeDropdown] = useState(false);

  const [formData, setFormData] = useState<TicketFormData>({
    visitorType: "",
    visitorSubType: "",
    carMake: "",
    carModel: "",
    carColor: "",
    platePhotoUrl: "",
    guestName: "",
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
        carMake: data.carMake,
        carModel: data.carModel,
        carColor: data.carColor,
        platePhotoUrl: data.platePhotoUrl || null,
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
      guestName: "",
      ticketNumber: "",
    });
    setCarMakeSearch("");
    onClose();
  };

  const canProceedStep1 = formData.visitorType && 
    (formData.visitorType !== "restaurant" || formData.visitorSubType) &&
    formData.carMake && formData.carModel && formData.carColor;

  const canProceedStep2 = formData.guestName.trim().length > 0;

  const canProceedStep3 = formData.ticketNumber.length === 5 && /^\d{5}$/.test(formData.ticketNumber);

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
      case "others": return <Users className="w-6 h-6" />;
    }
  };

  const renderStep1 = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-regis-navy mb-3">Visitor Type</h3>
        <div className="grid grid-cols-1 gap-3">
          {(Object.entries(VISITOR_TYPES) as [VisitorType, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFormData({ ...formData, visitorType: key, visitorSubType: "" })}
              className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${
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
          ))}
        </div>
      </div>

      {formData.visitorType === "restaurant" && (
        <div>
          <h3 className="text-lg font-semibold text-regis-navy mb-3">Restaurant</h3>
          <div className="grid grid-cols-2 gap-2">
            {(Object.entries(RESTAURANT_SUB_TYPES) as [RestaurantSubType, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFormData({ ...formData, visitorSubType: key })}
                className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                  formData.visitorSubType === key 
                    ? "border-regis-gold bg-regis-gold/10" 
                    : "border-gray-200 hover:border-gray-300"
                }`}
                data-testid={`restaurant-${key}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 className="text-lg font-semibold text-regis-navy mb-3">Vehicle Details</h3>
        <div className="space-y-3">
          <div className="relative">
            <label className="text-sm font-medium text-gray-700">Car Make</label>
            <Input
              value={carMakeSearch}
              onChange={(e) => {
                setCarMakeSearch(e.target.value);
                setShowCarMakeDropdown(true);
                if (e.target.value.length < 2) {
                  setFormData({ ...formData, carMake: "" });
                }
              }}
              onFocus={() => setShowCarMakeDropdown(true)}
              placeholder="Type at least 2 letters (e.g., Hon, Fer, BMW)"
              className="mt-1"
              data-testid="input-car-make"
            />
            {showCarMakeDropdown && filteredCarMakes.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {filteredCarMakes.map((make) => (
                  <button
                    key={make}
                    onClick={() => {
                      setFormData({ ...formData, carMake: make });
                      setCarMakeSearch(make);
                      setShowCarMakeDropdown(false);
                    }}
                    className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center justify-between"
                    data-testid={`car-make-option-${make}`}
                  >
                    {make}
                    {formData.carMake === make && <Check size={16} className="text-regis-gold" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Model / Name</label>
            <Input
              value={formData.carModel}
              onChange={(e) => setFormData({ ...formData, carModel: e.target.value })}
              placeholder="e.g., SL55, R1, Passat, Civic"
              className="mt-1"
              data-testid="input-car-model"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Color</label>
            <div className="grid grid-cols-5 gap-2 mt-2">
              {CAR_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => setFormData({ ...formData, carColor: color })}
                  className={`p-2 rounded-lg border-2 text-xs font-medium transition-all ${
                    formData.carColor === color 
                      ? "border-regis-gold bg-regis-gold/10" 
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                  data-testid={`color-${color}`}
                >
                  {color}
                </button>
              ))}
            </div>
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
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setFormData({ ...formData, platePhotoUrl: "" })}
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
                  variant="outline"
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*';
                    input.capture = 'environment';
                    input.onchange = (e) => {
                      const file = (e.target as HTMLInputElement).files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (e) => {
                          setFormData({ ...formData, platePhotoUrl: e.target?.result as string });
                        };
                        reader.readAsDataURL(file);
                      }
                    };
                    input.click();
                  }}
                  data-testid="button-capture-plate"
                >
                  <Camera className="w-4 h-4 mr-2" />
                  Capture
                </Button>
              </div>
              <p className="text-xs text-gray-400">(Optional - can skip if not available)</p>
            </div>
          )}
        </div>
      </div>

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
              <label className="text-sm font-medium text-gray-700">5-Digit Ticket Number *</label>
              <Input
                value={formData.ticketNumber}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 5);
                  setFormData({ ...formData, ticketNumber: value });
                }}
                placeholder="Enter 5-digit ticket number (e.g., 12345)"
                className="mt-1 text-center text-2xl font-bold tracking-widest"
                maxLength={5}
                data-testid="input-ticket-number"
              />
              {formData.ticketNumber.length > 0 && formData.ticketNumber.length < 5 && (
                <p className="text-sm text-orange-600 mt-1">
                  Enter {5 - formData.ticketNumber.length} more digit(s)
                </p>
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
            <p className="font-medium">{formData.guestName}</p>
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

        {formData.platePhotoUrl && (
          <div className="bg-gray-50 p-3 rounded-lg">
            <span className="text-gray-500 text-sm">Registration Plate</span>
            <img 
              src={formData.platePhotoUrl} 
              alt="License plate" 
              className="max-h-24 mt-2 rounded"
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
    </Dialog>
  );
}
