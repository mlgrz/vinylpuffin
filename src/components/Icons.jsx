import { useId } from "react";

const base = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

export const PlayIcon = (p) => (
  <svg {...base} {...p} fill="currentColor" stroke="none">
    <path d="M7 4.5v15l13-7.5z" />
  </svg>
);
export const PauseIcon = (p) => (
  <svg {...base} {...p} fill="currentColor" stroke="none">
    <rect x="6" y="4.5" width="4" height="15" rx="1" />
    <rect x="14" y="4.5" width="4" height="15" rx="1" />
  </svg>
);
export const CloseIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
export const PlusIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const SearchIcon = (p) => (
  <svg {...base} {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M20 20l-4.2-4.2" />
  </svg>
);
export const BookmarkIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M6 3.5h12v17l-6-4-6 4z" />
  </svg>
);
export const CheckIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M4.5 12.5l5 5 10-11" />
  </svg>
);
export const DiscIcon = (p) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="2.5" />
  </svg>
);
export const PencilIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M15 5l4 4L8 20H4v-4z" />
  </svg>
);
export const ExternalIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6" />
  </svg>
);
export const MenuIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);
export const StarIcon = ({ fill = 0, ...p }) => {
  // fill: 0, 0.5 or 1
  const id = `half${useId().replace(/:/g, "")}`;
  return (
    <svg {...base} {...p} strokeWidth={1.6}>
      {fill === 0.5 && (
        <defs>
          <linearGradient id={id}>
            <stop offset="50%" stopColor="currentColor" />
            <stop offset="50%" stopColor="transparent" />
          </linearGradient>
        </defs>
      )}
      <path
        d="M12 3.2l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 17l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z"
        fill={fill === 1 ? "currentColor" : fill === 0.5 ? `url(#${id})` : "none"}
      />
    </svg>
  );
};
