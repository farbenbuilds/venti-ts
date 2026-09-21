/// Ready-state ordinals shared by the socket record, the constructors, and
/// the duplex adapter. `ws` exposes the same numbers as statics and instance
/// constants.
export const CONNECTING = 0 as const;
export const OPEN = 1 as const;
export const CLOSING = 2 as const;
export const CLOSED = 3 as const;
