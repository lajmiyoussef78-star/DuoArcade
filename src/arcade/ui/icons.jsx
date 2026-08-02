// Line icon set for the dashboard shell — same stroke language as the old feature rail.

const S = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

function Svg({ children, size = 20, ...rest }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" {...S} {...rest}>
      {children}
    </svg>
  );
}

export const Ico = {
  home: p => (
    <Svg {...p}>
      <path d="M4 10.5 12 4l8 6.5V19a1.6 1.6 0 0 1-1.6 1.6h-3.1v-5.2H8.7v5.2H5.6A1.6 1.6 0 0 1 4 19v-8.5Z" />
    </Svg>
  ),
  watch: p => (
    <Svg {...p}>
      <rect x="3" y="5" width="18" height="14" rx="3.5" />
      <path d="M10 9.5 14.5 12 10 14.5v-5Z" />
    </Svg>
  ),
  play: p => (
    <Svg {...p}>
      <rect x="3" y="7" width="18" height="11" rx="4" />
      <path d="M8 11v3M6.5 12.5h3" />
      <circle cx="16" cy="11.4" r="0.7" fill="currentColor" stroke="none" />
      <circle cx="18" cy="13.4" r="0.7" fill="currentColor" stroke="none" />
    </Svg>
  ),
  arena: p => (
    <Svg {...p}>
      <path d="M8 4H4v3c0 2 1.8 4 4 4M16 4h4v3c0 2-1.8 4-4 4" />
      <path d="M8 4h8v6a4 4 0 0 1-8 0V4Z" />
      <path d="M12 14v3M9 20h6M10 17h4" />
    </Svg>
  ),
  snap: p => (
    <Svg {...p}>
      <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.6l1.2-1.7h5.4L15.9 6h1.6A2.5 2.5 0 0 1 20 8.5v7A2.5 2.5 0 0 1 17.5 18h-11A2.5 2.5 0 0 1 4 15.5v-7Z" />
      <circle cx="12" cy="12" r="3.4" />
    </Svg>
  ),
  bucket: p => (
    <Svg {...p}>
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v2.5" />
    </Svg>
  ),
  list: p => (
    <Svg {...p}>
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <path d="M8.5 12.2l2.4 2.4 4.8-5" />
    </Svg>
  ),
  wall: p => (
    <Svg {...p}>
      <path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19l-4 1Z" />
      <path d="M14 7l3 3" />
    </Svg>
  ),
  week: p => (
    <Svg {...p}>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M3 9h18M8 3v4M16 3v4M7 13h3M7 16h5M14 13h3" />
    </Svg>
  ),
  moon: p => (
    <Svg {...p}>
      <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z" />
      <path d="M17 5.5v3M15.5 7h3" />
    </Svg>
  ),
  trophy: p => (
    <Svg {...p}>
      <path d="M8 4H4v2.5c0 2 1.8 3.8 4 3.8M16 4h4v2.5c0 2-1.8 3.8-4 3.8" />
      <path d="M8 4h8v6a4 4 0 0 1-8 0V4Z" />
      <path d="M12 14v3M9 20h6" />
    </Svg>
  ),
  chat: p => (
    <Svg {...p}>
      <path d="M21 11.5a8.5 8.5 0 0 1-12.1 7.6L3 21l1.9-5.7A8.5 8.5 0 1 1 21 11.5Z" />
    </Svg>
  ),
  friends: p => (
    <Svg {...p}>
      <circle cx="9" cy="8" r="3.2" />
      <circle cx="17" cy="9" r="2.6" />
      <path d="M3.5 18.5c.8-3 2.9-4.5 5.5-4.5s4.7 1.5 5.5 4.5" />
      <path d="M14.2 18.5c.5-2 1.9-3.2 3.8-3.2 1.4 0 2.5.6 3.2 1.8" />
    </Svg>
  ),
  bell: p => (
    <Svg {...p}>
      <path d="M18 15.5V11a6 6 0 1 0-12 0v4.5L4.5 18h15L18 15.5Z" />
      <path d="M10 20.5a2.2 2.2 0 0 0 4 0" />
    </Svg>
  ),
  gear: p => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="3.1" />
      <path d="M19.4 14.2a1.5 1.5 0 0 0 .3 1.7l.1.1a1.8 1.8 0 1 1-2.6 2.6l-.1-.1a1.5 1.5 0 0 0-1.7-.3 1.5 1.5 0 0 0-.9 1.4v.2a1.8 1.8 0 1 1-3.6 0v-.1a1.5 1.5 0 0 0-1-1.4 1.5 1.5 0 0 0-1.7.3l-.1.1a1.8 1.8 0 1 1-2.6-2.6l.1-.1a1.5 1.5 0 0 0 .3-1.7 1.5 1.5 0 0 0-1.4-.9h-.2a1.8 1.8 0 1 1 0-3.6h.1a1.5 1.5 0 0 0 1.4-1 1.5 1.5 0 0 0-.3-1.7l-.1-.1a1.8 1.8 0 1 1 2.6-2.6l.1.1a1.5 1.5 0 0 0 1.7.3h.1a1.5 1.5 0 0 0 .9-1.4v-.2a1.8 1.8 0 1 1 3.6 0v.1a1.5 1.5 0 0 0 .9 1.4 1.5 1.5 0 0 0 1.7-.3l.1-.1a1.8 1.8 0 1 1 2.6 2.6l-.1.1a1.5 1.5 0 0 0-.3 1.7v.1a1.5 1.5 0 0 0 1.4.9h.2a1.8 1.8 0 1 1 0 3.6h-.1a1.5 1.5 0 0 0-1.4.9Z" />
    </Svg>
  ),
  search: p => (
    <Svg {...p}>
      <circle cx="11" cy="11" r="6.4" />
      <path d="m16 16 4 4" />
    </Svg>
  ),
  spark: p => (
    <Svg {...p}>
      <path d="M12 4l1.8 4.6L18.5 10l-4.7 1.4L12 16l-1.8-4.6L5.5 10l4.7-1.4L12 4Z" />
      <path d="M18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8Z" />
    </Svg>
  ),
  heart: p => (
    <Svg {...p}>
      <path d="M12 20.5S4 15.3 4 9.9C4 7.2 6 5 8.6 5c1.5 0 2.7.7 3.4 1.8C12.7 5.7 14 5 15.4 5 18 5 20 7.2 20 9.9c0 5.4-8 10.6-8 10.6Z" />
    </Svg>
  ),
  history: p => (
    <Svg {...p}>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />
      <path d="M3.5 4.5V9H8" />
      <path d="M12 8v4.4l2.8 1.7" />
    </Svg>
  ),
  plus: p => (
    <Svg {...p}>
      <path d="M12 5.5v13M5.5 12h13" />
    </Svg>
  ),
  menu: p => (
    <Svg {...p}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Svg>
  ),
  close: p => (
    <Svg {...p}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Svg>
  ),
  chevron: p => (
    <Svg {...p}>
      <path d="m9 5 7 7-7 7" />
    </Svg>
  ),
  chevronDown: p => (
    <Svg {...p}>
      <path d="m5 9 7 7 7-7" />
    </Svg>
  ),
};

export default Ico;
