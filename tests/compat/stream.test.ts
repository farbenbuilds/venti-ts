import { expect, test } from "vitest";
import { createWebSocketStream } from "../../src/compat/stream";
import { TEST_TIMEOUT_MS } from "../binding/support";
import { attached } from "./socket-support";

test(
  "createWebSocketStream writes through the socket transport",
  { timeout: TEST_TIMEOUT_MS },
  async () => {
    const { server, client, socket } = await attached();
    try {
      const stream = createWebSocketStream(socket);
      await new Promise<void>((resolve, reject) => {
        stream.write("streamed", (error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
      expect(socket.bufferedAmount).toBe(8);
      stream.destroy();
    } finally {
      client.terminate();
      await server.dispose();
    }
  },
);
