import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Camera, Upload, X, Check } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface CarPhotoUploaderProps {
  onPhotoUploaded: (photoUrl: string) => void;
  currentPhoto?: string;
}

export function CarPhotoUploader({ onPhotoUploaded, currentPhoto }: CarPhotoUploaderProps) {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      setUploading(true);
      
      // Get upload URL from backend
      const uploadResult = (await apiRequest("POST", "/api/car-photos/upload")) as any;
      const uploadURL = uploadResult?.uploadURL;
      
      // Upload file directly to object storage
      const uploadResponse = await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload photo");
      }

      return uploadURL;
    },
    onSuccess: (uploadURL) => {
      setUploading(false);
      onPhotoUploaded(uploadURL);
      toast({
        title: "Success",
        description: "Car photo uploaded successfully",
      });
    },
    onError: (error) => {
      setUploading(false);
      console.error("Upload error:", error);
      toast({
        title: "Upload Failed",
        description: "Failed to upload car photo. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid File",
        description: "Please select an image file",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      toast({
        title: "File Too Large",
        description: "Please select an image smaller than 10MB",
        variant: "destructive",
      });
      return;
    }

    uploadMutation.mutate(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  return (
    <Card className="w-full">
      <CardContent className="p-4">
        <div className="space-y-4">
          {/* Current Photo Display */}
          {currentPhoto && (
            <div className="relative">
              <img
                src={currentPhoto}
                alt="Current car photo"
                className="w-full h-48 object-cover rounded-lg border"
              />
              <div className="absolute top-2 right-2">
                <Check className="text-green-600 bg-white rounded-full p-1" size={24} />
              </div>
            </div>
          )}

          {/* Upload Area */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive
                ? "border-regis-gold bg-yellow-50"
                : "border-gray-300 hover:border-regis-gold"
            } ${uploading ? "opacity-50 pointer-events-none" : ""}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              type="file"
              accept="image/*"
              onChange={handleFileInput}
              className="hidden"
              id="car-photo-input"
              disabled={uploading}
            />
            
            <div className="space-y-4">
              <Camera className="mx-auto text-gray-400" size={48} />
              
              {uploading ? (
                <div>
                  <p className="text-regis-navy font-medium">Uploading...</p>
                  <p className="text-sm text-gray-500">Please wait</p>
                </div>
              ) : (
                <div>
                  <p className="text-regis-navy font-medium">
                    {currentPhoto ? "Update Car Photo" : "Add Car Photo"}
                  </p>
                  <p className="text-sm text-gray-500">
                    Drag & drop an image here, or click to select
                  </p>
                </div>
              )}

              <Button
                variant="outline"
                onClick={() => document.getElementById("car-photo-input")?.click()}
                disabled={uploading}
                className="border-regis-gold text-regis-gold hover:bg-regis-gold hover:text-white"
              >
                <Upload className="mr-2" size={16} />
                Choose Photo
              </Button>
            </div>
          </div>

          <p className="text-xs text-gray-500 text-center">
            Supported formats: JPG, PNG, WEBP. Max size: 10MB
          </p>
        </div>
      </CardContent>
    </Card>
  );
}