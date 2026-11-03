import { useEffect, useRef, useState } from 'react';
import { Camera, ImageUp, Loader2, ScanLine, X } from 'lucide-react';

// Loaded on demand so the jsqr dependency never enters the app's initial
// module graph (it is only needed once a scan actually runs).
const loadJsQR = async () => (await import('jsqr')).default;
import { Button } from '@/components/ui/button';
import { parseClaimToken, parseQrPayload } from '@/lib/qrPayload';

export { parseClaimToken };

export default function QrScanner({ onDetected, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const canvasRef = useRef(document.createElement('canvas'));
  const fileInputRef = useRef(null);
  const jsqrRef = useRef(null);
  const [mode, setMode] = useState('camera'); // 'camera' | 'idle'
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [websiteCode, setWebsiteCode] = useState(false);
  const [busy, setBusy] = useState(false);

  const stopCamera = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const handleDetected = (data) => {
    const payload = parseQrPayload(data);
    stopCamera();
    setBusy(false);
    if (!payload.token && !payload.serial && !payload.tradeShow) {
      setWebsiteCode(Boolean(payload.registration) || /^https?:\/\//i.test(String(data)));
      setError('This QR has no individual charger reference. For a stand test, use the tradeshow test charger below. For a real installation, scan its charger label or enter its serial number and PIN.');
      setMode('idle');
      return;
    }
    onDetected?.(payload, data);
  };

  const tick = () => {
    const video = videoRef.current;
    if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }
    const canvas = canvasRef.current;
    if (video.videoWidth && video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const jsQR = jsqrRef.current;
      if (!jsQR) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'attemptBoth' });
      if (code && code.data) {
        handleDetected(code.data);
        return;
      }
    }
    rafRef.current = requestAnimationFrame(tick);
  };

  const startCamera = async () => {
    setError('');
    setWebsiteCode(false);
    setStarting(true);
    try {
      if (!jsqrRef.current) jsqrRef.current = await loadJsQR();
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera access is not available in this browser. Try uploading a photo of the QR code instead.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setMode('camera');
      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      const denied = err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError';
      setError(
        denied
          ? 'Camera permission was blocked. Allow camera access, or upload a photo of the QR code from your gallery.'
          : err?.message || 'Could not start the camera. Try uploading a photo of the QR code instead.',
      );
      setMode('idle');
    } finally {
      setStarting(false);
    }
  };

  useEffect(() => {
    startCamera();
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const decodeImage = async (file) => {
    if (!file) return;
    setError('');
    setWebsiteCode(false);
    setBusy(true);
    try {
      if (!jsqrRef.current) jsqrRef.current = await loadJsQR();
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.src = url;
      await img.decode();
      const canvas = canvasRef.current;
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsqrRef.current(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'attemptBoth' });
      if (code && code.data) {
        handleDetected(code.data);
      } else {
        setError('No QR code found in that image. Try a clearer, well-lit photo of the charger label.');
        setBusy(false);
      }
    } catch {
      setError('That image could not be read. Try another photo of the QR code.');
      setBusy(false);
    }
  };

  return (
    <div className="rounded-3xl border border-border bg-muted/60 p-5 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ScanLine className="h-5 w-5 text-accent" />
          <h3 className="text-base font-semibold">Scan charger QR code</h3>
        </div>
        <Button type="button" variant="ghost" size="icon" onClick={() => { stopCamera(); onClose?.(); }} aria-label="Close scanner">
          <X className="h-5 w-5" />
        </Button>
      </div>

      {mode === 'camera' && (
        <div className="relative overflow-hidden rounded-2xl border border-border bg-black aspect-[4/3]">
          <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-2/3 w-2/3 rounded-xl border-2 border-white/80 shadow-[0_0_0_2000px_rgba(0,0,0,0.25)]" />
          </div>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1 text-xs text-white">
            Point the camera at the charger label
          </div>
        </div>
      )}

      {starting && (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Starting camera…
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <p>{error}</p>
          {websiteCode && (
            <div className="mt-3 space-y-2">
              <Button type="button" className="w-full" onClick={() => onDetected?.({ tradeShow: true })}>
                Use tradeshow test charger
              </Button>
              <Button type="button" variant="outline" className="w-full text-foreground" onClick={() => onDetected?.({ registration: true })}>
                Enter real charger details
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        {mode !== 'camera' && (
          <Button type="button" onClick={startCamera} disabled={starting || busy} className="bg-primary text-white">
            <Camera className="mr-2 h-4 w-4" /> Use camera
          </Button>
        )}
        <Button type="button" variant="outline" disabled={busy} onClick={() => fileInputRef.current?.click()} className="border-accent/30 text-accent">
          {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Reading…</> : <><ImageUp className="mr-2 h-4 w-4" />Upload from gallery</>}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(event) => decodeImage(event.target.files?.[0] || null)}
        />
      </div>

      <p className="text-xs leading-5 text-muted-foreground/80">
        Scan the QR code on the charger label with your camera, or choose a photo of it from your camera roll. The charger will be identified automatically.
      </p>
    </div>
  );
}