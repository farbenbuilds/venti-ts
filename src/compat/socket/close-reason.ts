import { isValidCloseReason } from "../../protocol/close-codes";
import { createError } from "../errors";

const EMPTY = Buffer.alloc(0);

/// Mirrors `ws` sender argument handling: an argument without a truthy `length`
/// carries no data, a string is encoded as UTF-8, a `Uint8Array` is copied byte
/// for byte, and anything else is refused.
///
/// The `Uint8Array` guard is the fix for the uninitialized-memory disclosure
/// advisory GHSA-58qx-3vcg-4xpx. A differently typed array reports an element
/// count smaller than its `byteLength`, so sizing a close frame from
/// `byteLength` would ship unwritten heap bytes. `ws` refuses such a reason;
/// accepting it silently would diverge from the compatibility contract.
///
/// `null` is the one deliberate divergence: `ws` reads `.length` off it and
/// surfaces a V8-internal `TypeError`, so it counts as "no reason data" here
/// instead of reproducing an engine-specific message.
export function toCloseReason(reason: unknown): Buffer {
  if (reason === undefined) return EMPTY;
  if (typeof reason === "string") return checkedReason(Buffer.from(reason, "utf8"));
  if (reason instanceof Uint8Array) return checkedReason(Buffer.from(reason));
  if (!hasReasonData(reason)) return EMPTY;
  throw createError(
    "ERR_INVALID_OPTION",
    "Second argument must be a string or a Uint8Array",
    TypeError,
  );
}

/// Matches `ws`'s unguarded `!data.length` probe: only a nonzero numeric
/// `length` counts as reason data, so `42`, `{}`, and a lengthless array-like
/// all read as an absent reason. The property read is deliberately not
/// try/caught, so a throwing getter surfaces exactly as it does upstream;
/// `isCodedError` guards its own read because it is a predicate over a foreign
/// thrown value rather than a mirror of a specified argument rule.
function hasReasonData(reason: unknown): boolean {
  if (reason === null) return false;
  const length: unknown = (reason as { readonly length?: unknown }).length;
  return typeof length === "number" && length > 0;
}

function checkedReason(bytes: Buffer): Buffer {
  if (!isValidCloseReason(bytes)) {
    throw createError(
      "ERR_INVALID_CLOSE_REASON",
      "The message must not be greater than 123 bytes",
      RangeError,
    );
  }
  return bytes;
}
