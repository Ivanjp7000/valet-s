import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Camera } from "lucide-react";
import { useOCR } from "@/hooks/useOCR";

interface CameraScannerProps {
  onScanComplete: (ticketNumber: string) => void;
  onClose: () => void;
}

export function CameraScanner({ onScanComplete, onClose }: CameraScannerProps) {
  const [manualInput, setManualInput] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { recognizeText } = useOCR();

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error("Error accessing camera:", error);
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
    }
  };

  const captureAndScan = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    setIsScanning(true);
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    
    if (context) {
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      context.drawImage(videoRef.current, 0, 0);
      
      try {
        const text = await recognizeText(canvas);
        const ticketMatch = text.match(/\b\d{5,6}\b/);
        
        if (ticketMatch) {
          onScanComplete(ticketMatch[0]);
        } else {
          alert("No ticket number found. Please try again or enter manually.");
        }
      } catch (error) {
        console.error("OCR Error:", error);
        alert("Failed to scan ticket. Please try again or enter manually.");
      }
    }
    
    setIsScanning(false);
  };

  const handleManualSubmit = () => {
    if (manualInput.length >= 5 && manualInput.length <= 6) {
      onScanComplete(manualInput);
    }
  };

  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-md mx-auto">
        {/* Camera Header */}
        <div className="bg-regis-navy text-white px-6 py-4 flex items-center justify-between">
          <h2 className="font-medium">Scan Ticket</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-white hover:text-gray-300"
          >
            <X size={20} />
          </Button>
        </div>

        {/* Camera View */}
        <div className="relative h-96 bg-black flex items-center justify-center">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
          
          {/* Scanning Frame */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-48 h-24 border-2 border-regis-gold rounded-lg relative">
              <div className="absolute inset-0 border border-white border-dashed rounded-lg animate-pulse"></div>
            </div>
          </div>

          {/* Capture Button */}
          <Button
            onClick={captureAndScan}
            disabled={isScanning}
            className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-regis-gold hover:bg-yellow-600 text-white rounded-full w-16 h-16"
          >
            <Camera size={24} />
          </Button>
        </div>

        {/* Manual Backup */}
        <div className="p-6 bg-white">
          <p className="text-center text-sm text-gray-600 mb-4">Can't scan? Enter manually:</p>
          <div className="flex space-x-2">
            <Input
              type="text"
              placeholder="Enter ticket number"
              maxLength={6}
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value.replace(/\D/g, ''))}
              className="flex-1 text-center"
            />
            <Button 
              onClick={handleManualSubmit}
              disabled={manualInput.length < 5}
              className="bg-regis-navy hover:bg-blue-900"
            >
              Submit
            </Button>
          </div>
        </div>

        {/* Hidden canvas for image processing */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>
    </div>
  );
}
