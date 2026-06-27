import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";

/**
 * Adsterra ad component for Alwakeelo.
 *
 * Strategy: React only renders the container div. The Adsterra script
 * is injected into document.head (outside React's DOM tree) so React's
 * reconciliation cannot interfere with it. Adsterra's invoke.js finds
 * the container via getElementById and writes ad content into it.
 */

/* ═══════════════════════════════════════════════════════════
 * Native Banner Ad (ID: 29987573)
 * ═══════════════════════════════════════════════════════════ */
export function NativeBannerAd({ className = "" }: { className?: string }) {
  const { user, isLoading } = useAuth();
  const scriptInjected = useRef(false);

  const tier = user?.subscriptionTier?.toLowerCase() || "free";
  const isPaid = tier !== "free";

  useEffect(() => {
    if (isLoading || isPaid || scriptInjected.current) return;

    // Wait for the container div to be committed to DOM
    const timer = setTimeout(() => {
      const container = document.getElementById("container-10f18ae62d62276718a63c20d2a9c9b1");
      if (!container) return;

      // Inject script into document.head — outside React's DOM tree
      const script = document.createElement("script");
      script.async = true;
      script.setAttribute("data-cfasync", "false");
      script.src = "https://pl30088072.effectivecpmnetwork.com/10f18ae62d62276718a63c20d2a9c9b1/invoke.js";
      script.id = "adsterra-native-script";
      document.head.appendChild(script);
      scriptInjected.current = true;
    }, 150);

    return () => clearTimeout(timer);
  }, [isLoading, isPaid]);

  if (!isLoading && isPaid) return null;

  return (
    <div className={`ad-wrapper ${className}`} data-testid="ad-native-banner">
      <div id="container-10f18ae62d62276718a63c20d2a9c9b1" />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
 * Banner 300x250 Ad (ID: 29987574)
 * ═══════════════════════════════════════════════════════════ */
export function Banner300x250Ad({ className = "" }: { className?: string }) {
  const { user, isLoading } = useAuth();
  const bannerRef = useRef<HTMLDivElement>(null);
  const scriptInjected = useRef(false);

  const tier = user?.subscriptionTier?.toLowerCase() || "free";
  const isPaid = tier !== "free";

  useEffect(() => {
    if (isLoading || isPaid || scriptInjected.current) return;
    if (!bannerRef.current) return;

    const timer = setTimeout(() => {
      if (!bannerRef.current || scriptInjected.current) return;

      // Set atOptions on window (global, as Adsterra expects)
      // @ts-ignore
      window.atOptions = {
        key: "3f2c86fbf54bda7bdd48d319bc36c89",
        format: "iframe",
        height: 250,
        width: 300,
        params: {},
      };

      // Inject invoke.js into the banner div directly
      // (Adsterra's banner script writes an iframe next to itself)
      const script = document.createElement("script");
      script.async = true;
      script.setAttribute("data-cfasync", "false");
      script.src = "https://www.topcpmcreativeformat.com/3f2c86fbf54bda7bdd48d319bc36c89/invoke.js";
      bannerRef.current.appendChild(script);
      scriptInjected.current = true;
    }, 150);

    return () => clearTimeout(timer);
  }, [isLoading, isPaid]);

  if (!isLoading && isPaid) return null;

  return (
    <div
      className={`ad-wrapper flex justify-center ${className}`}
      data-testid="ad-banner-300x250"
      ref={bannerRef}
    />
  );
}
