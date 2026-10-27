const assert = require("node:assert/strict");
const { test, beforeEach, afterEach } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { transformSync } = require("esbuild");
const { JSDOM } = require("jsdom");
const dom = new JSDOM('<div id="root"></div>', { url: "https://nsoj.test/notifications" });
Object.assign(global, {
  window: dom.window,
  document: dom.window.document,
  HTMLElement: dom.window.HTMLElement,
  IS_REACT_ACT_ENVIRONMENT: true
});
Object.defineProperty(global, "navigator", { value: dom.window.navigator, configurable: true });
const React = require("react");
const { act } = React;
const { createRoot } = require("react-dom/client");
const { observable, runInAction } = require("mobx");
const { observer } = require("mobx-react-lite");
const messages = new Function(
  fs.readFileSync(path.join(__dirname, "../src/locales/messages/zh-CN/notifications.js"), "utf8")
)();
const text = (key, parameters = {}) =>
  (messages[key.replace(/^\./, "")] || key).replace(/\{(\w+)\}/g, (_, name) => parameters[name]);
const Box = ({ children, content }) => React.createElement("div", null, children || content);
const Button = ({ children, onClick, disabled, type = "button", "aria-label": label }) =>
  React.createElement("button", { onClick, disabled, type, "aria-label": label }, children);
const Modal = ({ open, children }) => (open ? React.createElement("div", { role: "dialog" }, children) : null);
Modal.Header = Modal.Content = Modal.Actions = Box;
const Form = ({ children, onSubmit }) =>
  React.createElement(
    "form",
    {
      onSubmit: event => {
        event.preventDefault();
        onSubmit(event);
      }
    },
    children
  );
Form.Select = ({ options, value, onChange, disabled, "aria-label": label }) =>
  React.createElement(
    "select",
    { value, disabled, "aria-label": label, onChange: event => onChange(event, { value: event.target.value }) },
    options.map(option => React.createElement("option", { key: option.value, value: option.value }, option.text))
  );
Form.TextArea = ({ id, value, onChange, disabled }) =>
  React.createElement("textarea", {
    id,
    value,
    disabled,
    onChange: event => onChange(event, { value: event.target.value })
  });
Form.Input = () => null;
Form.Field = Box;
const List = Box;
List.Item = Box;
const Checkbox = ({ label }) => React.createElement("label", null, label);
const Message = ({ children, content, header, negative }) =>
  React.createElement(
    "div",
    { role: negative ? "alert" : undefined },
    header && React.createElement("strong", null, header),
    children || content
  );
const ui = {
  Button,
  Checkbox,
  Form,
  Header: Box,
  Label: Box,
  List,
  Loader: () => null,
  Message,
  Modal,
  Segment: Box
};
const container = document.getElementById("root");
let root, f;
function fixture() {
  let online = true;
  let savedBinding = null;
  Object.defineProperty(window.navigator, "onLine", { configurable: true, get: () => online });
  const state = observable({ unread: 1, revision: 0 });
  const first = {
    id: "6f6cc862-d251-4940-a329-1887cf682572",
    body: "待删除的通知",
    targetPath: "",
    createdAt: new Date().toISOString(),
    readAt: null
  };
  let received = [first];
  const history = [
    {
      ...first,
      senderId: 1,
      audience: "all",
      audienceLabel: "全站用户",
      recipientCount: 3,
      push: true,
      revokedAt: null,
      revokedById: null
    }
  ];
  const calls = [];
  const searches = {};
  const api = {
    query: async ({ skip = 0, take = 20 }) => ({
      response: { items: received.slice(skip, skip + take), total: received.length }
    }),
    get: async ({ id }) =>
      received.some(item => item.id === id)
        ? { response: { item: received.find(item => item.id === id) } }
        : { requestError: "missing" },
    read: async () => ({ response: { count: 0 } }),
    deleteReceived: async request => {
      calls.push(["delete", request]);
      received = received.filter(item => item.id !== request.id);
      return { response: { count: 0 } };
    },
    history: async () => ({ response: { items: history.map(item => ({ ...item })), total: history.length } }),
    revoke: async request => {
      calls.push(["revoke", request]);
      Object.assign(
        history.find(item => item.id === request.id),
        { revokedAt: new Date().toISOString(), revokedById: 1 }
      );
      return { response: { success: true } };
    },
    pushStatus: async () =>
      online
        ? { response: { enabled: true, subscriptions: savedBinding ? [{ ...savedBinding }] : [] } }
        : { requestError: "offline" },
    send: async request => {
      calls.push(["send", request]);
      return { response: { id: first.id, recipientCount: 2 } };
    }
  };
  const appState = { currentUser: { id: 2, isAdmin: false }, enterNewPage() {} };
  const push = {
    browserPushSupported: () => true,
    browserPushErrorKey: failure => failure.message,
    enableBrowserPush: async () => {
      calls.push(["enable"]);
      savedBinding = { id: "browser", userId: 2, bindingVersion: "v1" };
      return savedBinding;
    },
    disableBrowserPush: async () => {
      calls.push(["disable"]);
      savedBinding = null;
    }
  };
  function component(source) {
    const context = {
      module: { exports: {} },
      console,
      window,
      navigator: window.navigator,
      Notification: { permission: "granted" },
      require: name => {
        const mocks = {
          "semantic-ui-react": ui,
          "mobx-react": { observer },
          "@/appState": { appState },
          "@/AppRouter": { defineRoute: factory => factory, RouteError: Error },
          "@/locales": { makeToBeLocalizedText: key => key },
          "@/utils/hooks": { useLocalizer: () => text, Link: Box },
          "@/components/UserSearch": props => {
            searches.users = props;
            return React.createElement("input", {
              placeholder: props.placeholder,
              disabled: props.disabled,
              "aria-label": "用户搜索"
            });
          },
          "@/components/GroupSearch": props => {
            searches.groups = props;
            return React.createElement("input", {
              placeholder: props.placeholder,
              disabled: props.disabled,
              "aria-label": "用户组搜索"
            });
          },
          "@/notifications/api": { notificationApi: api },
          "@/notifications/state": { notificationState: state },
          "./api": { notificationApi: api },
          "./binding": { browserBinding: async () => savedBinding },
          "./push": push,
          "@/notifications/PushSettings": () => null,
          "@/notifications/notifications.module.less": { pagination: "pagination" }
        };
        return Object.hasOwn(mocks, name) ? mocks[name] : require(name);
      }
    };
    vm.runInNewContext(
      transformSync(fs.readFileSync(path.join(__dirname, "../src", source), "utf8"), {
        loader: "tsx",
        format: "cjs",
        target: "es2020"
      }).code,
      context
    );
    return context.module.exports.default;
  }
  function page(admin = false) {
    appState.currentUser.isAdmin = admin;
    return component(`pages/notifications/${admin ? "NotificationAdminPage" : "NotificationsPage"}.tsx`);
  }
  return {
    api,
    state,
    first,
    history,
    calls,
    searches,
    push,
    pushSettings: () => component("notifications/PushSettings.tsx"),
    setBinding: value => {
      savedBinding = value;
    },
    setOnline: value => {
      online = value;
      window.dispatchEvent(new window.Event(value ? "online" : "offline"));
    },
    page,
    setReceived: items => {
      received = items;
    },
    getReceived: () => received
  };
}
beforeEach(() => {
  root = createRoot(container);
  f = fixture();
});
afterEach(async () => {
  await act(async () => root.unmount());
});
const render = async (admin = false) =>
  act(async () => {
    root.render(await f.page(admin)({ query: {} }));
  });
const dialog = () => container.querySelector('[role="dialog"]');
const button = (label, scope = container) =>
  [...scope.querySelectorAll("button")].find(node => node.textContent.trim() === label);
const click = async node => {
  assert.ok(node, "button exists");
  await act(async () => node.dispatchEvent(new window.MouseEvent("click", { bubbles: true })));
};

test("personal deletion requires confirmation, cancellation is harmless, and success updates the unread count and list", async () => {
  await render();
  await click(button("删除"));
  assert.match(dialog().textContent, /不影响其他接收人/);
  assert.equal(f.calls.length, 0);
  await click(button("取消", dialog()));
  assert.equal(dialog(), null);
  assert.equal(f.getReceived().length, 1);
  await click(button("删除"));
  await click(button("删除", dialog()));
  assert.equal(f.calls[0][0], "delete");
  assert.deepEqual(Object.keys(f.calls[0][1]), ["id"]);
  assert.equal(f.calls[0][1].id, f.first.id);
  assert.equal(f.state.unread, 0);
  assert.ok(f.state.revision > 0);
  assert.equal(dialog(), null);
  assert.match(container.textContent, /暂无通知/);
});

test("a failed personal deletion preserves the notification and offers retry", async () => {
  f.api.deleteReceived = async () => ({ requestError: "offline" });
  await render();
  await click(button("删除"));
  await click(button("删除", dialog()));
  assert.ok(dialog());
  assert.match(dialog().textContent, /操作失败/);
  assert.equal(f.getReceived().length, 1);
  assert.equal(f.state.unread, 1);
  assert.equal(button("删除", dialog()).disabled, false);
});

test("deleting the final notification on a later page falls back to the previous page", async () => {
  f.setReceived(Array.from({ length: 21 }, (_, index) => ({ ...f.first, id: String(index), body: `消息 ${index}` })));
  await render();
  await click(button("下一页"));
  assert.match(container.textContent, /消息 20/);
  await click(button("删除"));
  await click(button("删除", dialog()));
  assert.match(container.textContent, /消息 0/);
  assert.doesNotMatch(container.textContent, /消息 20/);
  assert.equal(f.getReceived().length, 20);
});

test("a notification open in another tab closes when a change makes it inaccessible", async () => {
  await render();
  await click(button("查看通知"));
  assert.ok(dialog());
  f.setReceived([]);
  await act(async () =>
    runInAction(() => {
      f.state.revision++;
    })
  );
  assert.equal(dialog(), null);
  assert.doesNotMatch(container.textContent, /待删除的通知/);
});

test("administrator personal deletion remains a personal action", async () => {
  const route = f.page();
  // Set the authenticated role after loading the personal route.
  const personal = await route({ query: {} });
  f.page(true);
  await act(async () => root.render(personal));
  await click(button("删除"));
  await click(button("删除", dialog()));
  assert.equal(f.calls[0][0], "delete");
  assert.equal(f.history[0].revokedAt, null);
});

test("admin withdrawal explains the global scope and retains an audit record without a second withdrawal action", async () => {
  await render(true);
  await click(button("撤回"));
  assert.match(dialog().textContent, /所有接收人/);
  assert.match(dialog().textContent, /3 人/);
  assert.equal(f.calls.length, 0);
  await click(button("撤回", dialog()));
  assert.equal(f.calls[0][0], "revoke");
  assert.deepEqual(Object.keys(f.calls[0][1]), ["id"]);
  assert.equal(f.calls[0][1].id, f.first.id);
  assert.equal(dialog(), null);
  assert.match(container.textContent, /已撤回/);
  assert.match(container.textContent, /待删除的通知/);
  assert.equal(button("撤回"), undefined);
  await click(button("查看发送内容"));
  assert.match(dialog().textContent, /已撤回/);
  assert.equal(button("撤回", dialog()), undefined);
});

test("failed admin withdrawal keeps the confirmation and does not claim success", async () => {
  f.api.revoke = async () => ({ requestError: "offline" });
  await render(true);
  await click(button("撤回"));
  await click(button("撤回", dialog()));
  assert.ok(dialog());
  assert.match(dialog().textContent, /操作失败/);
  assert.equal(f.history[0].revokedAt, null);
  assert.equal(button("撤回", dialog()).disabled, false);
});

test("non-admin users cannot open the sent history route", async () => {
  const route = f.page(true);
  f.page(false);
  await assert.rejects(route({ query: {} }), /403/);
});

const change = async (node, value) => {
  assert.ok(node, "input exists");
  await act(async () => {
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(node), "value").set.call(node, value);
    node.dispatchEvent(new window.Event(node.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
  });
};
const audience = value => change(container.querySelector('select[aria-label="接收对象"]'), value);
const fillBody = () => change(document.getElementById("notification-body"), "新的训练通知");
const addUser = username =>
  act(async () => f.searches.users.onResultSelect({ id: username === "alice" ? 2 : 3, username }));
const addGroup = (id, name) => act(async () => f.searches.groups.onResultSelect({ id, name, memberCount: 10 }));

test("user search selections deduplicate, support removal and send only selected usernames", async () => {
  await render(true);
  await addUser("alice");
  await addUser("bob");
  await addUser("alice");
  assert.equal(container.querySelectorAll('[aria-label="移除用户 alice"]').length, 1);
  assert.ok(container.querySelector('[aria-label="移除用户 bob"]'));
  await click(container.querySelector('[aria-label="移除用户 alice"]'));
  await fillBody();
  await click(button("预览并确认"));
  assert.match(dialog().textContent, /bob/);
  assert.doesNotMatch(dialog().textContent, /alice/);
  await click(button("发送通知", dialog()));
  const sent = f.calls.find(call => call[0] === "send")[1];
  assert.deepEqual(Array.from(sent.usernames), ["bob"]);
  assert.deepEqual(Array.from(sent.groupIds), []);
  assert.equal(container.querySelector('[aria-label="移除用户 bob"]'), null);
});

test("group search supports multiple groups, deduplicates by ID, and previews names", async () => {
  await render(true);
  await addUser("alice");
  await audience("group");
  await addGroup(10, "基础班");
  await addGroup(11, "提高班");
  await addGroup(10, "基础班");
  assert.equal(container.querySelectorAll('[aria-label="移除用户组 基础班"]').length, 1);
  assert.ok(container.querySelector('[aria-label="移除用户组 提高班"]'));
  await fillBody();
  await click(button("预览并确认"));
  assert.match(dialog().textContent, /基础班, 提高班/);
  assert.doesNotMatch(dialog().textContent, /alice/);
  await click(button("发送通知", dialog()));
  const sent = f.calls.find(call => call[0] === "send")[1];
  assert.deepEqual(Array.from(sent.groupIds), [10, 11]);
  assert.deepEqual(Array.from(sent.usernames), []);
  assert.equal(sent.groupId, undefined);
  await audience("group");
  assert.equal(container.querySelector('[aria-label="移除用户组 基础班"]'), null);
});

test("removing a selected group excludes it from the send request", async () => {
  await render(true);
  await audience("group");
  await addGroup(10, "基础班");
  await addGroup(11, "提高班");
  await click(container.querySelector('[aria-label="移除用户组 基础班"]'));
  await fillBody();
  await click(button("预览并确认"));
  assert.doesNotMatch(dialog().textContent, /基础班/);
  assert.match(dialog().textContent, /提高班/);
  await click(button("发送通知", dialog()));
  assert.deepEqual(Array.from(f.calls.find(call => call[0] === "send")[1].groupIds), [11]);
});

test("an empty user or group selection cannot be previewed", async () => {
  await render(true);
  await fillBody();
  await click(button("预览并确认"));
  assert.equal(dialog(), null);
  await audience("group");
  await click(button("预览并确认"));
  assert.equal(dialog(), null);
  assert.equal(
    f.calls.some(call => call[0] === "send"),
    false
  );
});

test("switching to all users clears hidden user and group selections from the payload", async () => {
  await render(true);
  await addUser("alice");
  await audience("group");
  await addGroup(10, "基础班");
  await audience("all");
  await fillBody();
  await click(button("预览并确认"));
  await click(button("发送给全站用户", dialog()));
  const sent = f.calls.find(call => call[0] === "send")[1];
  assert.equal(sent.audience, "all");
  assert.deepEqual(Array.from(sent.usernames), []);
  assert.deepEqual(Array.from(sent.groupIds), []);
});

test("a failed send retains selected groups and the same request ID for retry", async () => {
  await render(true);
  await audience("group");
  await addGroup(10, "基础班");
  await addGroup(11, "提高班");
  await fillBody();
  f.api.send = async request => {
    f.calls.push(["send", request]);
    return { requestError: () => "发送失败" };
  };
  await click(button("预览并确认"));
  await click(button("发送通知", dialog()));
  assert.ok(dialog());
  assert.match(dialog().textContent, /基础班, 提高班/);
  await click(button("发送通知", dialog()));
  const sends = f.calls.filter(call => call[0] === "send");
  assert.equal(sends.length, 2);
  assert.equal(sends[0][1].requestId, sends[1][1].requestId);
  assert.deepEqual(Array.from(sends[1][1].groupIds), [10, 11]);
});

const renderPushSettings = async () => {
  const Settings = f.pushSettings();
  await act(async () => root.render(React.createElement(Settings)));
};

test("subscription settings explain network dependencies without requesting permission on mount", async () => {
  await renderPushSettings();
  assert.match(container.textContent, /浏览器和网站服务器均需连接推送服务/);
  assert.match(container.textContent, /Chrome 使用 Google 服务/);
  assert.match(container.textContent, /Firefox/);
  assert.match(container.textContent, /站内通知/);
  assert.equal(
    f.calls.some(call => call[0] === "enable"),
    false
  );
  assert.equal(button("在此浏览器开启").disabled, false);
});

test("offline settings recover on the online event without automatically enabling push", async () => {
  f.setOnline(false);
  await renderPushSettings();
  assert.match(container.textContent, /离线状态/);
  assert.equal(button("在此浏览器开启").disabled, true);
  await act(async () => f.setOnline(true));
  assert.doesNotMatch(container.textContent, /离线状态/);
  assert.equal(button("在此浏览器开启").disabled, false);
  assert.equal(
    f.calls.some(call => call[0] === "enable"),
    false
  );
});

for (const key of ["push_network_error", "push_subscription_timeout"]) {
  test(`${key} presents connection guidance and a retry action that can succeed`, async () => {
    const enable = f.push.enableBrowserPush;
    let fail = true;
    f.push.enableBrowserPush = async () => {
      if (fail) {
        fail = false;
        throw new Error(key);
      }
      return enable();
    };
    await renderPushSettings();
    await click(button("在此浏览器开启"));
    const error = container.querySelector('[role="alert"]');
    assert.match(error.textContent, /尚未成功连接推送服务/);
    assert.match(error.textContent, /Firefox/);
    assert.equal(button("重试开启").disabled, false);
    await click(button("重试开启"));
    assert.equal(container.querySelector('[role="alert"]'), null);
    assert.match(container.textContent, /订阅已保存/);
    assert.ok(button("关闭此浏览器推送"));
  });
}

test("permission rejection is not mislabeled as a network connection failure", async () => {
  f.push.enableBrowserPush = async () => {
    throw new Error("push_denied");
  };
  await renderPushSettings();
  await click(button("在此浏览器开启"));
  const error = container.querySelector('[role="alert"]');
  assert.match(error.textContent, /通知权限未开启/);
  assert.doesNotMatch(error.textContent, /尚未成功连接推送服务/);
  assert.ok(button("在此浏览器开启"));
  assert.equal(button("重试开启"), undefined);
});

test("an existing subscription remains enabled when the browser goes offline", async () => {
  f.setBinding({ id: "browser", userId: 2, bindingVersion: "v1" });
  await renderPushSettings();
  assert.ok(button("关闭此浏览器推送"));
  await act(async () => f.setOnline(false));
  assert.match(container.textContent, /离线状态/);
  assert.match(container.textContent, /此浏览器已开启/);
  assert.match(container.textContent, /已开启表示订阅已保存/);
  assert.equal(f.calls.length, 0);
});
