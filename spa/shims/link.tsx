import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from "react";
import { spaRouter } from "@/lib/spaRouter";

/** next/link replacement for the single-file build: in-app links navigate the in-memory router. */
export default function Link({ href, children, onClick, target, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children?: ReactNode }) {
  const internal = href.startsWith("/");
  return (
    <a
      href={internal ? `#${href}` : href}
      target={internal ? undefined : target}
      {...rest}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(e);
        if (!internal || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        spaRouter()?.push(href);
      }}
    >
      {children}
    </a>
  );
}
