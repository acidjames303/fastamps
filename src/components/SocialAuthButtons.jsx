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

function FacebookIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#1877F2"
        d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"
      />
    </svg>
  );
}

function AppleIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M16.365 1.43c0 1.14-.42 2.21-1.18 3.04-.79.87-2.1 1.54-3.23 1.45-.14-1.1.43-2.26 1.16-3.05.8-.87 2.2-1.5 3.25-1.44zM20.8 17.37c-.59 1.36-.87 1.96-1.63 3.16-1.06 1.66-2.55 3.73-4.4 3.74-1.65.02-2.08-1.08-4.32-1.07-2.24.01-2.71 1.09-4.36 1.07-1.85-.02-3.26-1.89-4.32-3.55C-.27 16.9-.9 12.6.95 9.74c1.17-1.82 3.02-2.89 4.76-2.89 1.78 0 2.9 1.1 4.37 1.1 1.43 0 2.3-1.11 4.36-1.11 1.55 0 3.19.84 4.35 2.3-3.82 2.1-3.2 7.56.01 8.23z"
      />
    </svg>
  );
}

function ProviderIcon({ type }) {
  if (type === "google") return <GoogleIcon className="h-5 w-5" />;
  if (type === "microsoft") return (
    <span className="fa-microsoft-mark" aria-hidden="true">
      <i /><i /><i /><i />
    </span>
  );
  if (type === "facebook") return <FacebookIcon />;
  return <AppleIcon />;
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
