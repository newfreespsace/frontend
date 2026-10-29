const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { transformSync } = require("esbuild");
const io = require("socket.io-client");
const parser = require("socket.io-msgpack-parser");

function fixture() {
  const endpoint = `http://submission-${++fixture.sequence}.test/`;
  const cleanups = [];
  const sockets = [];
  const context = {
    module: { exports: {} },
    window: { apiEndpoint: endpoint },
    console,
    require: name => {
      if (name === "react")
        return {
          useRef: current => ({ current }),
          useEffect: effect => cleanups.push(effect())
        };
      if (name === "socket.io-client")
        return (url, options) => {
          // Use the real Socket.IO manager/cache without opening a network connection.
          const socket = io(url, { ...options, autoConnect: false });
          sockets.push(socket);
          return socket;
        };
      return require(name);
    }
  };
  vm.runInNewContext(
    transformSync(fs.readFileSync(path.join(__dirname, "../src/utils/hooks/useSocket.ts"), "utf8"), {
      loader: "ts",
      format: "cjs"
    }).code,
    context
  );
  return {
    notifications: () => {
      const socket = io(endpoint + "notifications", {
        path: "/api/socket",
        transports: ["websocket"],
        parser,
        auth: { token: "notification-token" },
        autoConnect: false
      });
      sockets.push(socket);
      return socket;
    },
    subscribe: (key, enabled = true) =>
      context.module.exports.useSocket(
        "submission-progress",
        { subscriptionKey: key },
        () => {},
        () => {},
        enabled
      ),
    cleanup: () => {
      for (const cleanup of cleanups) cleanup?.();
      for (const socket of sockets) socket.disconnect();
    },
    sockets
  };
}
fixture.sequence = 0;

test("progress subscription sends its key when notifications created the first connection", t => {
  const f = fixture();
  t.after(f.cleanup);
  const notifications = f.notifications();
  const progress = f.subscribe("submission-123");
  assert.equal(progress.io.opts.query?.subscriptionKey, "submission-123");
  assert.notEqual(progress.io, notifications.io);
});

test("notifications and later subscriptions cannot replace a progress subscription's key", t => {
  const f = fixture();
  t.after(f.cleanup);
  const detail = f.subscribe("detail-123");
  const notifications = f.notifications();
  const list = f.subscribe("list-456");
  assert.equal(detail.io.opts.query?.subscriptionKey, "detail-123");
  assert.equal(list.io.opts.query?.subscriptionKey, "list-456");
  assert.equal(notifications.io.opts.query?.subscriptionKey, undefined);
  assert.notEqual(detail.io, list.io);
});

test("a completed submission does not open a progress connection", t => {
  const f = fixture();
  t.after(f.cleanup);
  assert.equal(f.subscribe(undefined, false), null);
  assert.equal(f.sockets.length, 0);
});
