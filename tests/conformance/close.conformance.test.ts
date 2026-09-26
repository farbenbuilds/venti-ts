import { WebSocket as WsClient, WebSocketServer as WsServer } from "ws";
import { expect, test } from "vitest";
import { packConnectionHandle } from "../../src/binding/handle";
import { attachNativeSocket } from "../../src/compat/socket/attach";
import { WebSocket } from "../../src/index";
import { TEST_TIMEOUT_MS, startAndWait, type ServerFixture } from "../binding/support";
import { terminateClient } from "../compat/socket/socket-support";

type Outcome =
  | { readonly threw: false; readonly readyState: number }
  | { readonly threw: true; readonly name: string; readonly message: string };

function outcome(close: () => void, socket: { readonly readyState: number }): Outcome {
  try {
    close();
    return { threw: false, readyState: socket.readyState };
  } catch (error) {
    const failure = error as Error;
    return { threw: true, name: failure.constructor.name, message: failure.message };
  }
}

/// Stands up a `ws` server, connects a client, and hands back the accepted
/// server-side socket so its `close` arguments can be exercised.
async function wsAccepted(): Promise<{
  socket: WsClient;
  dispose: () => Promise<void>;
}> {
  const server = new WsServer({ port: 0 });
  const accepted = new Promise<WsClient>((resolve) => {
    server.on("connection", (socket: WsClient) => {
      resolve(socket);
    });
  });
  await new Promise<void>((resolve) => {
    server.once("listening", resolve);
  });
  const port = (server.address() as { port: number }).port;
  const client = new WsClient(`ws://127.0.0.1:${port}/`);
  client.on("error", () => {});
  const socket = await accepted;
  return {
    socket,
    dispose: async () => {
      client.terminate();
      socket.terminate();
      await new Promise<void>((resolve) => {
        server.close(() => {
          resolve();
        });
      });
    },
  };
}

/// The same shape against the native engine, adopted into a compat socket.
async function ourAccepted(): Promise<{
  socket: WebSocket;
  client: WsClient;
  server: ServerFixture;
}> {
  const { server, port } = await startAndWait({ host: "127.0.0.1", port: 0 });
  const client = new WsClient(`ws://127.0.0.1:${port}/`);
  const open = await server.waitFor("connectionOpen");
  const socket = new WebSocket(null);
  attachNativeSocket(socket, server.handle, packConnectionHandle(open.index, open.generation));
  return { socket, client, server };
}

const REASONS: ReadonlyArray<readonly [string, unknown]> = [
  ["undefined", undefined],
  ["an empty string", ""],
  ["a plain string", "done"],
  ["a Uint8Array", new Uint8Array([0x61, 0x62])],
  ["an empty Uint8Array", new Uint8Array(0)],
  ["an empty array", []],
  ["a number", 42],
  ["an object with no length", {}],
  ["a Float32Array", new Float32Array(20)],
  ["a 124-byte string", "a".repeat(124)],
];

/// `ws` is the compatibility contract, so every close reason either maps to the
/// same wire frame or throws the same error. The typed-array case pins
/// GHSA-58qx-3vcg-4xpx: a `Float32Array` reports a smaller element count than
/// its `byteLength`, and `ws` has refused it since 8.20.1.
test.each(REASONS)(
  "close reason parity for %s",
  { timeout: TEST_TIMEOUT_MS },
  async (_name, reason) => {
    const reference = await wsAccepted();
    let expected: Outcome;
    try {
      expected = outcome(() => reference.socket.close(1000, reason as never), reference.socket);
    } finally {
      await reference.dispose();
    }

    const ours = await ourAccepted();
    let actual: Outcome;
    try {
      actual = outcome(() => ours.socket.close(1000, reason as never), ours.socket);
    } finally {
      terminateClient(ours.client);
      await ours.server.dispose();
    }

    if (!expected.threw) {
      expect(actual).toEqual(expected);
      return;
    }
    if (!actual.threw) throw new Error(`expected a throw: ${expected.message}`);
    expect(actual.name).toBe(expected.name);
    expect(actual.message).toBe(expected.message);
  },
);
