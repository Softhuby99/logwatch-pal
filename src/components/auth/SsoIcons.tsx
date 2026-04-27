import type { SVGProps } from "react";

export const GoogleIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...props}>
    <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.5 14.6 2.6 12 2.6 6.8 2.6 2.6 6.8 2.6 12s4.2 9.4 9.4 9.4c5.4 0 9-3.8 9-9.2 0-.6-.07-1.1-.16-1.6H12z"/>
  </svg>
);

export const MicrosoftIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...props}>
    <path fill="#F25022" d="M2 2h10v10H2z"/>
    <path fill="#7FBA00" d="M12 2h10v10H12z"/>
    <path fill="#00A4EF" d="M2 12h10v10H2z"/>
    <path fill="#FFB900" d="M12 12h10v10H12z"/>
  </svg>
);

export const SamlIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
    <path d="M12 2 4 5v6c0 5 3.4 9.3 8 11 4.6-1.7 8-6 8-11V5l-8-3z"/>
  </svg>
);

export const OidcIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
    <circle cx="12" cy="12" r="9"/>
    <path d="M12 7v10M9 9l6 6M9 15l6-6"/>
  </svg>
);
