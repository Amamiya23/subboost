import type { SVGProps } from "react";

export function BrandMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 256"
      fill="currentColor"
      {...props}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M28 32H84L160 108H228V148H160L84 224H28L124 128Z" />
    </svg>
  );
}
