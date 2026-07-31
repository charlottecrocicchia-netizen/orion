export function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="text-primary"
      >
        <path
          d="M4.5 19 10 12.5l4.5 1L19.5 5"
          fill="none"
          stroke="currentColor"
          strokeOpacity=".45"
          strokeWidth="1.2"
        />
        <circle cx="4.5" cy="19" r="1.7" fill="currentColor" />
        <circle cx="10" cy="12.5" r="1.7" fill="currentColor" />
        <circle cx="14.5" cy="13.5" r="1.7" fill="currentColor" />
        <circle cx="19.5" cy="5" r="2.1" fill="currentColor" />
      </svg>
      <span className="text-[17px] font-semibold tracking-tight">Orion</span>
    </div>
  );
}
