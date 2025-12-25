import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  X,
  RefreshCw,
  Camera as CameraIcon,
  ImageIcon,
  Loader2,
} from "lucide-react";
import { LocationTarget } from "../types";

interface CameraInterfaceProps {
  target: LocationTarget;
  onClose: () => void;
  onCapture: (imageSrc: string) => void;
}

export const CameraInterface: React.FC<CameraInterfaceProps> = ({
  target,
  onClose,
  onCapture,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [streamActive, setStreamActive] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">(
    "environment"
  );
  const [isProcessing, setIsProcessing] = useState(false);

  const startCamera = useCallback(async () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setStreamActive(true);
      }
    } catch (err) {
      console.error("Camera error:", err);
    }
  }, [facingMode]);

  useEffect(() => {
    startCamera();
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [startCamera]);

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current || isProcessing) return;

    setIsProcessing(true);
    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (facingMode === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0);
    const base64 = canvas.toDataURL("image/jpeg", 0.8).split(",")[1];

    // On envoie directement à App.tsx pour la génération Toon
    onCapture(base64);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = (e.target?.result as string).split(",")[1];
        onCapture(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        className="hidden"
        onChange={handleFileUpload}
      />

      <div className="absolute top-0 left-0 right-0 z-20 p-6 flex justify-between items-center">
        <div className="flex flex-col">
          <span className="text-pink-400 font-black text-[10px] tracking-widest">
            MODE CAPTURE
          </span>
          <span className="text-white font-display text-lg">
            {target.characterName}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-full bg-white/10 text-white"
        >
          <X />
        </button>
      </div>

      <div className="relative flex-1 bg-black overflow-hidden flex items-center justify-center">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover ${
            facingMode === "user" ? "scale-x-[-1]" : ""
          }`}
        />
        <div className="absolute inset-0 pointer-events-none border-[40px] border-black/20 flex items-center justify-center">
          <div className="w-64 h-80 border-2 border-white/40 rounded-3xl"></div>
        </div>
        <canvas ref={canvasRef} className="hidden" />
      </div>

      <div className="bg-[#0f0518] p-8 pb-12 flex items-center justify-around border-t border-white/10">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-4 bg-white/5 rounded-2xl text-gray-400"
        >
          <ImageIcon />
        </button>
        <button
          onClick={capturePhoto}
          disabled={!streamActive}
          className="w-20 h-20 rounded-full border-4 border-white bg-white/10 flex items-center justify-center active:scale-90 transition-transform"
        >
          <div className="w-14 h-14 bg-white rounded-full"></div>
        </button>
        <button
          onClick={() =>
            setFacingMode((f) => (f === "environment" ? "user" : "environment"))
          }
          className="p-4 bg-white/5 rounded-2xl text-gray-400"
        >
          <RefreshCw />
        </button>
      </div>
    </div>
  );
};
