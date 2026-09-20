import { WebSocket, WebSocketServer } from "ws";
import { expect, test } from "vitest";
import { normalizeProtocols } from "../../src/compat/options";
import { normalizeServerOptions } from "../../src/compat/server-options";

type Outcome =
  | { readonly threw: false }
  | { readonly threw: true; readonly name: string; readonly message: string };

function outcome(run: () => void): Outcome {
  try {
    run();
    return { threw: false };
  } catch (error) {
    const failure = error as Error;
    return { threw: true, name: failure.constructor.name, message: failure.message };
  }
}

function wsServerOutcome(options: Record<string, unknown>): Outcome {
  return outcome(() => {
    const server = new WebSocketServer(options as never);
    server.close();
  });
}

function ourServerOutcome(options: Record<string, unknown>): Outcome {
  return outcome(() => {
    normalizeServerOptions(options as never);
  });
}

test.each([
  {},
  { port: 0 },
  { noServer: true },
  { port: 0, noServer: true },
  { server: 0 },
  { server: 0, port: 0 },
  { server: 0, noServer: true },
])("listen target parity for %j", (options) => {
  expect(ourServerOutcome(options)).toEqual(wsServerOutcome(options));
});

function wsProtocolOutcome(protocols: unknown): Outcome {
  return outcome(() => {
    const socket = new WebSocket("ws://127.0.0.1:1", protocols as never);
    socket.on("error", () => {});
    socket.terminate();
  });
}

function ourProtocolOutcome(protocols: unknown): Outcome {
  return outcome(() => {
    normalizeProtocols(protocols as never);
  });
}

// A non-null object is the options argument to ws, so the client factory owns
// that case; this table covers the values the typed protocols surface accepts.
test.each(["chat", ["chat", "superchat"], "bad protocol", ["chat", "chat"], 5, null])(
  "subprotocol parity for %j",
  (protocols) => {
    expect(ourProtocolOutcome(protocols)).toEqual(wsProtocolOutcome(protocols));
  },
);
