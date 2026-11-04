import React from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import GoogleIcon from "@/components/GoogleIcon";

const providers = [
  { key: "google", label: "Google" },
  { key: "microsoft", label: "Microsoft" },
  { key: "facebook", label: "Facebook" },
  { key: "apple", label: "Apple" },
];

function ProviderIcon({ type }) {
  if (type === "google") return <GoogleIcon className="h-5 w-5" />;
  if (type === "microsoft") return (
    <span className="fa-microsoft-mark" aria-hidden="true">
      <i /><i /><i /><i />
    </span>
  );
  if (type === "facebook") return <img src="https://cdn.simpleicons.org/facebook/1877F2" className="fa-provider-icon" alt="" aria-hidden="true" />;
  return <img src="https://cdn.simpleicons.org/apple/FFFFFF" className="fa-provider-icon" alt="" aria-hidden="true" />;
}

export default function SocialAuthButtons({ returnTo = "/" }) {
  return (
    <div className="fa-auth-social" aria-label="Other ways to sign in">
      {providers.map(({ key, label }) => (
        <Button
          key={key}
          type="button"
          variant="outline"
          className="w-full h-12 text-sm font-medium"
          onClick={() => base44.auth.loginWithProvider(key, returnTo)}
        >
          <ProviderIcon type={key} />
          Continue with {label}
        </Button>
      ))}
    </div>
  );
}
