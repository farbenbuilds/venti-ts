import { createWebSocketStream as upstreamStream } from "ws";
import { expect, test } from "vitest";
import { createWebSocketStream } from "../../src/index";
import { fakeSocket, settle } from "./stream-support";

test("write forwards chunks through send in both implementations", async () => {
  const expected = fakeSocket();
  const actual = fakeSocket();
  const upstream = upstreamStream(expected as never);
  const ours = createWebSocketStream(actual as never);
  upstream.write("hello");
  ours.write("hello");
  await settle();
  expect(actual.sent).toEqual(expected.sent);
  upstream.destroy();
  ours.destroy();
});

test("message events become readable chunks in both implementations", async () => {
  const expected = fakeSocket();
  const actual = fakeSocket();
  const upstream = upstreamStream(expected as never);
  const ours = createWebSocketStream(actual as never);
  const readUpstream: unknown[] = [];
  const readOurs: unknown[] = [];
  upstream.on("data", (chunk: unknown) => readUpstream.push(chunk));
  ours.on("data", (chunk: unknown) => readOurs.push(chunk));
  expected.emit("message", Buffer.from("world"), false);
  actual.emit("message", Buffer.from("world"), false);
  await settle();
  expect(readOurs).toEqual(readUpstream);
  upstream.destroy();
  ours.destroy();
});

test("read backpressure pauses the socket in both implementations", async () => {
  const expected = fakeSocket();
  const actual = fakeSocket();
  const upstream = upstreamStream(expected as never);
  const ours = createWebSocketStream(actual as never);
  const large = Buffer.alloc(64 * 1024);
  expected.emit("message", large, true);
  actual.emit("message", large, true);
  expect(actual.counts.paused).toBe(expected.counts.paused);
  expect(actual.isPaused).toBe(expected.isPaused);
  upstream.destroy();
  ours.destroy();
});

test("destroy terminates an open socket in both implementations", async () => {
  const expected = fakeSocket();
  const actual = fakeSocket();
  const upstream = upstreamStream(expected as never);
  const ours = createWebSocketStream(actual as never);
  upstream.destroy();
  ours.destroy();
  await settle();
  expect(actual.counts.terminated).toBe(expected.counts.terminated);
  expect(actual.readyState).toBe(expected.readyState);
});

test("a socket error destroys the stream without terminating", async () => {
  const expected = fakeSocket();
  const actual = fakeSocket();
  const upstream = upstreamStream(expected as never);
  const ours = createWebSocketStream(actual as never);
  const upstreamErrors: string[] = [];
  const ourErrors: string[] = [];
  upstream.on("error", (error: Error) => upstreamErrors.push(error.message));
  ours.on("error", (error: Error) => ourErrors.push(error.message));
  expected.emit("error", new Error("boom"));
  actual.emit("error", new Error("boom"));
  await settle();
  expect(ourErrors).toEqual(upstreamErrors);
  expect(actual.counts.terminated).toBe(expected.counts.terminated);
  expect(actual.destroyed).toBe(expected.destroyed);
});
