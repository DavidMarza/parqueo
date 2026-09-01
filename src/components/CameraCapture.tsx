import { useEffect, useRef, useState } from 'react';

interface Props {
  onCapture: (blob: Blob | null) => void;
}

export default function CameraCapture({ onCapture }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [active, setActive] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function activateCamera() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setActive(true);
    } catch {
      setError('No se pudo acceder a la cámara. Verifica los permisos del navegador.');
    }
  }

  function capture() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (blob) {
          setPreviewUrl(URL.createObjectURL(blob));
          onCapture(blob);
        }
      },
      'image/jpeg',
      0.85
    );
    stopCamera();
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setActive(false);
  }

  function retake() {
    setPreviewUrl(null);
    onCapture(null);
    activateCamera();
  }

  return (
    <div className="camera-capture">
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {!active && !previewUrl && (
        <button type="button" className="btn" onClick={activateCamera}>
          Activar cámara
        </button>
      )}

      {error && <div className="auth-error">{error}</div>}

      {active && (
        <div className="camera-live">
          <video ref={videoRef} playsInline muted className="camera-video" />
          <button type="button" className="btn btn-primary" onClick={capture}>
            Capturar fotografía
          </button>
        </div>
      )}

      {previewUrl && (
        <div className="camera-preview">
          <img src={previewUrl} alt="Fotografía capturada" className="camera-video" />
          <div className="camera-preview-actions">
            <span className="camera-confirmed">✓ Fotografía confirmada</span>
            <button type="button" className="btn btn-small" onClick={retake}>
              Volver a tomar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
