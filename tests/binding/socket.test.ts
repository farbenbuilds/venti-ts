import { expect, test } from "vitest";
import {
  closeSocket,
  pauseSocket,
  resumeSocket,
  sendSocket,
  socketBufferedAmount,
} from "../../src/binding/socket";
import { connectedSocket } from "./socket-support";
import { TEST_TIMEOUT_MS } from "./support";

const MAX_MESSAGE_BYTES = 32 * 1024;

test(
  "stages outbound payloads and reports the buffered amount",
  { timeout: TEST_TIMEOUT_MS },
  async () => {
    const { server, connection, socket } = await connectedSocket();
    try {
      expect(sendSocket(server.handle, connection, new Uint8Array([1, 2, 3]), true)).toBe("ok");
      expect(socketBufferedAmount(server.handle, connection)).toBe(3);
      expect(sendSocket(server.handle, connection, new TextEncoder().encode("hi"))).toBe("ok");
      expect(socketBufferedAmount(server.handle, connection)).toBe(5);
    } finally {
      socket.close();
      await server.dispose();
    }
  },
);

test(
  "send is bounded by the payload cap and the staging ring",
  { timeout: TEST_TIMEOUT_MS },
  async () => {
    const { server, connection, socket } = await connectedSocket();
    try {
      const exact = new Uint8Array(MAX_MESSAGE_BYTES);
      expect(sendSocket(server.handle, connection, exact, true)).toBe("ok");
      expect(sendSocket(server.handle, connection, new Uint8Array(MAX_MESSAGE_BYTES + 1))).toBe(
        "payload-too-large",
      );

      for (let staged = 0; staged < 7; staged += 1) {
        expect(sendSocket(server.handle, connection, new Uint8Array([staged]))).toBe("ok");
      }
      expect(sendSocket(server.handle, connection, new Uint8Array([0xff]))).toBe("backpressure");
      expect(socketBufferedAmount(server.handle, connection)).toBe(MAX_MESSAGE_BYTES + 7);
    } finally {
      socket.close();
      await server.dispose();
    }
  },
);

test(
  "close transitions exactly once and rejects later sends",
  { timeout: TEST_TIMEOUT_MS },
  async () => {
    const { server, connection, socket } = await connectedSocket();
    try {
      expect(closeSocket(server.handle, connection, 1000, new Uint8Array())).toBe("ok");
      expect(closeSocket(server.handle, connection, 1000, new Uint8Array())).toBe("closing");
      expect(sendSocket(server.handle, connection, new Uint8Array([1]))).toBe("closing");
      expect(closeSocket(server.handle, connection, 1005, new Uint8Array())).toBe("closing");
    } finally {
      socket.close();
      await server.dispose();
    }
  },
);

test("pause and resume are idempotent", { timeout: TEST_TIMEOUT_MS }, async () => {
  const { server, connection, socket } = await connectedSocket();
  try {
    expect(pauseSocket(server.handle, connection)).toBe("ok");
    expect(pauseSocket(server.handle, connection)).toBe("ok");
    expect(resumeSocket(server.handle, connection)).toBe("ok");
    expect(resumeSocket(server.handle, connection)).toBe("ok");
  } finally {
    socket.close();
    await server.dispose();
  }
});
