import { expect, test } from "vitest";
import { TEST_TIMEOUT_MS } from "../../binding/support";
import { attached, terminateClient } from "./socket-support";

const MAX_MESSAGE_BYTES = 32 * 1024;

test("fractional close codes truncate like ws", { timeout: TEST_TIMEOUT_MS }, async () => {
  const { server, client, socket } = await attached();
  try {
    expect(() => socket.close(1000.5)).not.toThrow();
    expect(socket.readyState).toBe(socket.CLOSING);
  } finally {
    terminateClient(client);
    await server.dispose();
  }
});

test(
  "a close rejected by the ring surfaces an error and latches",
  {
    timeout: TEST_TIMEOUT_MS,
  },
  async () => {
    const { server, client, socket } = await attached();
    try {
      for (let index = 0; index < 9; index += 1) {
        socket.send(new Uint8Array(MAX_MESSAGE_BYTES));
      }
      const failures: Error[] = [];
      socket.on("error", (error) => {
        failures.push(error);
      });
      socket.close(1000);
      await new Promise((resolve) => setImmediate(resolve));
      expect(failures.map((error) => (error as { code?: string }).code)).toEqual([
        "ERR_BACKPRESSURE",
      ]);
      expect(socket.readyState).toBe(socket.CLOSED);
    } finally {
      terminateClient(client);
      await server.dispose();
    }
  },
);
