import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, HelpCircle, X } from "lucide-react";
import type { Faq } from "@shared/schema";

interface FAQModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FAQModal({ isOpen, onClose }: FAQModalProps) {
  const [openItems, setOpenItems] = useState<number[]>([]);

  const { data: faqs, isLoading } = useQuery<Faq[]>({
    queryKey: ["/api/faqs"],
  });

  const toggleItem = (index: number) => {
    setOpenItems(prev => 
      prev.includes(index) 
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  };

  const defaultFAQs = [
    {
      id: 1,
      question: "Where do I find my ticket number?",
      answer: "Your ticket number is printed on the valet ticket you received when dropping off your vehicle. It's typically a 5-6 digit number located at the top of the ticket."
    },
    {
      id: 2,
      question: "How long does vehicle retrieval take?",
      answer: "Vehicle retrieval typically takes 13 minutes total: 5 minutes for locating your car, 5 minutes for transit to pickup area, and 3 minutes for final preparation."
    },
    {
      id: 3,
      question: "What if I lost my ticket?",
      answer: "If you've lost your ticket, please contact our valet staff at the front desk. You'll need to provide identification and vehicle details for verification."
    },
    {
      id: 4,
      question: "Can I track my vehicle's location?",
      answer: "Yes! Once you submit your ticket number, you'll see real-time updates showing which stage your vehicle retrieval is in, with countdown timers for each phase."
    },
    {
      id: 5,
      question: "What are the parking sectors?",
      answer: "Our vehicles are parked in different sectors: A, B, C (main levels), T (tower), and E (east wing). Each sector has numbered spots like A3, C12, T21, etc."
    },
    {
      id: 6,
      question: "Is the camera scanner secure?",
      answer: "Yes, our camera scanner only reads your ticket number and doesn't store any images. All data is processed securely and encrypted."
    }
  ];

  const displayFAQs = faqs && faqs.length > 0 ? faqs : defaultFAQs;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden">
        <DialogHeader className="pb-4">
          <DialogTitle className="flex items-center text-regis-navy">
            <HelpCircle className="mr-2 text-regis-gold" size={20} />
            Frequently Asked Questions
          </DialogTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="absolute right-4 top-4 w-6 h-6"
          >
            <X size={16} />
          </Button>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[60vh] space-y-3">
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">
              Loading FAQs...
            </div>
          ) : (
            displayFAQs.map((faq, index) => (
              <Card key={faq.id || index} className="shadow-sm">
                <Collapsible>
                  <CollapsibleTrigger
                    onClick={() => toggleItem(index)}
                    className="w-full"
                  >
                    <CardContent className="p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium text-regis-navy text-left">
                          {faq.question}
                        </h3>
                        <ChevronDown 
                          className={`text-regis-gold transition-transform ${
                            openItems.includes(index) ? 'rotate-180' : ''
                          }`} 
                          size={16} 
                        />
                      </div>
                    </CardContent>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="px-4 pb-4 pt-0 text-gray-600 leading-relaxed">
                      {faq.answer}
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            ))
          )}
        </div>

        <div className="mt-6 pt-4 border-t text-center">
          <p className="text-sm text-gray-500">
            Need more help? Contact our valet team at the front desk.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}