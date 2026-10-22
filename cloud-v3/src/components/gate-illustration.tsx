export function GateIllustration({ open }: { open: boolean }) {
  return (
    <svg
      className={`gate-illustration ${open ? 'is-open' : ''}`}
      viewBox="0 0 600 240"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id="ground"
          x1="300"
          y1="170"
          x2="300"
          y2="240"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="currentColor" stopOpacity=".07" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
        <pattern
          id="gate-bars"
          width="17"
          height="130"
          patternUnits="userSpaceOnUse"
        >
          <path d="M8 0v130" stroke="currentColor" strokeWidth="4" />
        </pattern>
      </defs>
      <path d="M40 192h520l38 48H2Z" fill="url(#ground)" />
      <path
        d="M0 192h600M50 221h500M300 194v46"
        stroke="currentColor"
        strokeOpacity=".12"
      />
      <path
        d="M2 163h85m426 0h85M2 143h85m426 0h85"
        stroke="currentColor"
        strokeOpacity=".3"
        strokeWidth="3"
      />
      <path
        d="M18 130v60m23-60v60m23-60v60m472-60v60m23-60v60m23-60v60"
        stroke="currentColor"
        strokeOpacity=".3"
        strokeWidth="3"
      />
      <g className="gate-leaf gate-leaf-left">
        <rect x="106" y="67" width="189" height="115" fill="url(#gate-bars)" />
        <path
          d="M106 67h189v115H106ZM106 88h189m-189 75h189"
          stroke="currentColor"
          strokeWidth="5"
        />
        <path
          d="M282 113v18"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </g>
      <g className="gate-leaf gate-leaf-right">
        <rect x="305" y="67" width="189" height="115" fill="url(#gate-bars)" />
        <path
          d="M305 67h189v115H305ZM305 88h189m-189 75h189"
          stroke="currentColor"
          strokeWidth="5"
        />
        <path
          d="M318 113v18"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </g>
      <path d="M88 50h17v142H88Zm407 0h17v142h-17Z" fill="currentColor" />
      <path
        d="M85 48h23m384 0h23"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <circle cx="96.5" cy="34" r="5" fill="currentColor" opacity=".5" />
      <circle cx="503.5" cy="34" r="5" fill="currentColor" opacity=".5" />
    </svg>
  );
}
