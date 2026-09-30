import type { AnchorHTMLAttributes, ReactNode } from "react";

/** next/link replacement for the single-file build: routes live in the URL hash. */
export default function Link({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children?: ReactNode }) {
  const to = href.startsWith("/") ? `#${href}` : href;
  return (
    <a href={to} {...rest}>
      {children}
    </a>
  );
}
