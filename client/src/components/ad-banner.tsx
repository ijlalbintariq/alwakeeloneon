import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";

interface AdsterraNativeProps {
  type: "native";
  scriptSrc: string;
  containerId: string;
  className?: string;
}

interface AdsterraBannerProps {
  type: "banner";
  atKey: string;
  width: number;
  height: number;
  className?: string;
}

type AdBannerProps = AdsterraNativeProps | AdsterraBannerProps;

/**
 * Adsterra ad component for Alwakeelo.
 * - Automatically hidden for paid subscribers (standard, pro, chamber, enterprise).
 * - Supports two Adsterra formats: Native Banner and Banner (iframe).
 */
export function AdBanner(props: AdBannerProps) {
  const { user } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const scriptLoadedRef = useRef(false);

  // Hide ads for paid users
  const tier = user?.subscriptionTier?.toLowerCase() || "free";
  const isPaid = tier !== "free";

  useEffect(() => {
    if (isPaid || scriptLoadedRef.current || !containerRef.current) return;
    scriptLoadedRef.current = true;

    if (props.type === "native") {
      // Native Banner: inject the invoke.js script
      const script = document.createElement("script");
      script.async = true;
      script.setAttribute("data-cfasync", "false");
      script.src = props.scriptSrc;
      containerRef.current.appendChild(script);
    } else {
      // Banner (iframe): inject atOptions + invoke script
      const optionsScript = document.createElement("script");
      optionsScript.textContent = `
        atOptions = {
          'key' : '${props.atKey}',
          'format' : 'iframe',
          'height' : ${props.height},
          'width' : ${props.width},
          'params' : {}
        };
      `;
      containerRef.current.appendChild(optionsScript);

      const invokeScript = document.createElement("script");
      invokeScript.async = true;
      invokeScript.setAttribute("data-cfasync", "false");
      invokeScript.src = `//www.topcpmcreativeformat.com/${props.atKey}/invoke.js`;
      containerRef.current.appendChild(invokeScript);
    }

    return () => {
      // Cleanup on unmount
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
      scriptLoadedRef.current = false;
    };
  }, [isPaid]);

  if (isPaid) return null;

  const className = props.className || "";

  if (props.type === "native") {
    return (
      <div className={`ad-wrapper ${className}`} data-testid="ad-native-banner">
        <div ref={containerRef}>
          <div id={props.containerId} />
        </div>
      </div>
    );
  }

  // Banner type
  return (
    <div
      className={`ad-wrapper flex justify-center ${className}`}
      data-testid="ad-banner-300x250"
    >
      <div ref={containerRef} />
    </div>
  );
}

/* ─── Pre-configured ad units for easy use ─── */

export function NativeBannerAd({ className = "" }: { className?: string }) {
  return (
    <AdBanner
      type="native"
      scriptSrc="https://pl30088072.effectivecpmnetwork.com/10f18ae62d62276718a63c20d2a9c9b1/invoke.js"
      containerId="container-10f18ae62d62276718a63c20d2a9c9b1"
      className={className}
    />
  );
}

export function Banner300x250Ad({ className = "" }: { className?: string }) {
  return (
    <AdBanner
      type="banner"
      atKey="3f2c86fbf54bda7bdd48d319bc36c89"
      width={300}
      height={250}
      className={className}
    />
  );
}
