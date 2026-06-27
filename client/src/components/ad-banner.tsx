import { useEffect, useRef, useState } from "react";
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
 *
 * Native Banner: Adsterra invoke.js uses getElementById to find the container div
 * and writes ad HTML into it. The script must be injected AFTER the container
 * div is in the DOM.
 *
 * Banner 300x250: Uses atOptions global + invoke.js which creates an iframe.
 */
export function AdBanner(props: AdBannerProps) {
  const { user, isLoading } = useAuth();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [injected, setInjected] = useState(false);

  const tier = user?.subscriptionTier?.toLowerCase() || "free";
  const isPaid = tier !== "free";

  useEffect(() => {
    if (isLoading || isPaid || injected) return;
    if (!wrapperRef.current) return;

    // Small delay to ensure the container div (rendered by React) is fully
    // committed to the DOM before Adsterra's script tries to getElementById.
    const timer = setTimeout(() => {
      if (!wrapperRef.current || injected) return;

      if (props.type === "native") {
        // Native Banner: script MUST come after the container div
        // Adsterra's invoke.js calls getElementById("container-xxxx")
        const script = document.createElement("script");
        script.async = true;
        script.setAttribute("data-cfasync", "false");
        script.src = props.scriptSrc;
        // Append script AFTER the container div (as a sibling, not inside it)
        wrapperRef.current.appendChild(script);
      } else {
        // Banner 300x250: set atOptions global, then load invoke.js
        // @ts-ignore
        window.atOptions = {
          key: props.atKey,
          format: "iframe",
          height: props.height,
          width: props.width,
          params: {},
        };

        const invokeScript = document.createElement("script");
        invokeScript.async = true;
        invokeScript.setAttribute("data-cfasync", "false");
        invokeScript.src = `https://www.topcpmcreativeformat.com/${props.atKey}/invoke.js`;
        wrapperRef.current.appendChild(invokeScript);
      }

      setInjected(true);
    }, 100);

    return () => clearTimeout(timer);
  }, [isLoading, isPaid, injected]);

  // Hide for paid users (after auth loads)
  if (!isLoading && isPaid) return null;

  const className = props.className || "";

  if (props.type === "native") {
    return (
      <div className={`ad-wrapper ${className}`} data-testid="ad-native-banner" ref={wrapperRef}>
        {/* Container div that Adsterra's invoke.js finds via getElementById */}
        <div id={props.containerId} />
        {/* Script will be appended here by useEffect as a sibling after the container */}
      </div>
    );
  }

  return (
    <div
      className={`ad-wrapper flex justify-center ${className}`}
      data-testid="ad-banner-300x250"
      ref={wrapperRef}
    >
      {/* invoke.js will create an iframe here */}
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
