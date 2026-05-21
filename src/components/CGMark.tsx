export function CGMark({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
    >
      <rect x="1" y="1" width="30" height="30" rx="9" fill="#7C5CFF" />
      <path
        d="M5 16 H9 L12 9 L16 23 L19 13 L22 17 H27"
        stroke="#FFFFFF"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}
