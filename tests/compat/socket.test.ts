import { expect, test } from "vitest";
import { createWebSocketStream } from "../../src/compat/stream";
import { WebSocket, WebSocketServer } from "../../src/index";
import { TEST_TIMEOUT_MS } from "../binding/support";
import { attached } from "./socket-support";

const MAX_MESSAGE_BYTES = 32 * 1024;

test("the constructor passes instanceof and carries the ready-state constants", () => {
  const socket = new WebSocket(null);
  expect(socket).toBeInstanceOf(WebSocket);
  expect(socket.CONNECTING).toBe(0);
  expect(socket.OPEN).toBe(1);
  expect(socket.CLOSING).toBe(2);
  expect(socket.CLOSED).toBe(3);
  expect(WebSocket.CONNECTING).toBe(0);
  expect(WebSocket.CLOSED).toBe(3);
  expect(WebSocket.WebSocket).toBe(WebSocket);
  expect(WebSocket.WebSocketServer).toBe(WebSocketServer);
  expect(WebSocket.Server).toBe(WebSocketServer);
  expect(WebSocket.createWebSocketStream).toBe(createWebSocketStream);
});

test("client construction reports the deferred scope", () => {
  expect(() => new WebSocket("ws://127.0.0.1:1")).toThrow(/client construction is deferred/);
});

test("a detached socket closes abnormally and ignores later operations", () => {
  const socket = new WebSocket(null);
  const closes: Array<[number, Buffer]> = [];
  socket.on("close", (code, reason) => {
    closes.push([code, reason]);
  });
  expect(() => socket.send("hello")).toThrow(/readyState 0 \(CONNECTING\)/);
  socket.close();
  expect(socket.readyState).toBe(socket.CLOSED);
  expect(closes).toEqual([[1006, Buffer.alloc(0)]]);
  socket.terminate();
  expect(closes).toHaveLength(1);
});

test(
  "attaching a native connection opens the socket and routes sends",
  { timeout: TEST_TIMEOUT_MS },
  async () => {
    const { server, client, socket } = await attached();
    try {
      expect(socket.readyState).toBe(socket.OPEN);
      expect(socket.bufferedAmount).toBe(0);
      await new Promise<void>((resolve, reject) => {
        socket.send("hello", (error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
      expect(socket.bufferedAmount).toBe(5);
      socket.send(Buffer.from([1, 2, 3]), { binary: true });
      expect(socket.bufferedAmount).toBe(8);
    } finally {
      client.terminate();
      await server.dispose();
    }
  },
);

test("send reports ring overflow through the callback", { timeout: TEST_TIMEOUT_MS }, async () => {
  const { server, client, socket } = await attached();
  try {
    const failures: Error[] = [];
    for (let index = 0; index < 9; index += 1) {
      socket.send(new Uint8Array(MAX_MESSAGE_BYTES), (error) => {
        if (error) failures.push(error);
      });
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(failures.map((error) => (error as { code?: string }).code)).toEqual([
      "ERR_BACKPRESSURE",
    ]);
  } finally {
    client.terminate();
    await server.dispose();
  }
});

test("close latches the closing state exactly once", { timeout: TEST_TIMEOUT_MS }, async () => {
  const { server, client, socket } = await attached();
  try {
    socket.close(1000, "done");
    expect(socket.readyState).toBe(socket.CLOSING);
    expect(() => socket.close(1000, "done")).not.toThrow();
    expect(socket.readyState).toBe(socket.CLOSING);
  } finally {
    client.terminate();
    await server.dispose();
  }
});

test("pause and resume mirror the native dispatch flag", { timeout: TEST_TIMEOUT_MS }, async () => {
  const { server, client, socket } = await attached();
  try {
    expect(socket.isPaused).toBe(false);
    socket.pause();
    expect(socket.isPaused).toBe(true);
    socket.pause();
    expect(socket.isPaused).toBe(true);
    socket.resume();
    expect(socket.isPaused).toBe(false);
  } finally {
    client.terminate();
    await server.dispose();
  }
});
