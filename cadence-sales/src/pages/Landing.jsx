import React from "react";
import LandingNav from "@/components/landing/LandingNav";
import Hero from "@/components/landing/Hero";
import ProblemSection from "@/components/landing/ProblemSection";
import ProductWorkflow from "@/components/landing/ProductWorkflow";
import Features from "@/components/landing/Features";
import OwnYourCadence from "@/components/landing/OwnYourCadence";
import ProductDemo from "@/components/landing/ProductDemo";
import ProvidersSection from "@/components/landing/ProvidersSection";
import PricingPreview from "@/components/landing/PricingPreview";
import TrustSection from "@/components/landing/TrustSection";
import FinalCTA from "@/components/landing/FinalCTA";
import MobileCTA from "@/components/landing/MobileCTA";
import LandingFooter from "@/components/landing/LandingFooter";

export default function Landing() {
  return (
    <div className="bg-background text-foreground">
      <LandingNav />
      <Hero />
      <ProblemSection />
      <ProductWorkflow />
      <Features />
      <OwnYourCadence />
      <ProductDemo />
      <ProvidersSection />
      <PricingPreview />
      <TrustSection />
      <FinalCTA />
      <MobileCTA />
      <LandingFooter />
    </div>
  );
}