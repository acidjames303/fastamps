import { Loader2, MapPin } from 'lucide-react';

export default function PhotoLocationNote({ location, locating }) {
  if (locating) {
    return (
      <p className="flex items-center gap-1.5 text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Reading the photo location…
      </p>
    );
  }

  if (!location) {
    return (
      <p className="flex items-start gap-1.5 text-muted-foreground">
        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        No location found for this photo. Allow location access and choose the photo again to record where it was taken.
      </p>
    );
  }

  return (
    <p className="flex items-start gap-1.5 text-muted-foreground">
      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
      Location recorded: {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
      {location.source === 'device' ? ' (device GPS)' : ' (from photo)'}
    </p>
  );
}