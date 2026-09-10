import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { observer } from "mobx-react";
import { v4 as uuid } from "uuid";
import {
  Excalidraw,
  MainMenu,
  exportToBlob,
  exportToSvg,
  serializeAsJSON,
  restore,
  useHandleLibrary
} from "@excalidraw/excalidraw";

import "@excalidraw/excalidraw/index.css";

import { appState } from "@/appState";
import { useConfirmNavigation } from "@/utils/hooks";
import { BoardError, BoardMeta, boardsApi, createLibraryApi } from "./api";
import { AccountLibrarySync } from "./librarySync";
import { Draft, deleteDraft, listDrafts, putDraft } from "./storage";
import style from "./DrawPage.module.less";
import AutoHideMenu from "./AutoHideMenu";

type ExcalidrawImperativeAPI = Parameters<NonNullable<React.ComponentProps<typeof Excalidraw>["excalidrawAPI"]>>[0];

const EMPTY_SCENE = JSON.stringify({ type: "excalidraw", version: 2, elements: [], appState: {}, files: {} });
const MAX_BYTES = 10 * 1024 * 1024;

function blankDraft(userId: number): Draft {
  return {
    localId: uuid(),
    userId,
    id: uuid(),
    title: "未命名画板",
    version: 0,
    scene: EMPTY_SCENE,
    dirty: false,
    savedAt: Date.now()
  };
}
function parseScene(scene: string) {
  const data = JSON.parse(scene);
  if (data?.type !== "excalidraw" || !Array.isArray(data.elements)) throw new Error("请选择有效的 .excalidraw 文件");
  return restore({ ...data, appState: data.appState || {}, files: data.files || {} }, null, null);
}
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

const AccountDrawPage: React.FC = observer(() => {
  const userId = appState.currentUser.id;
  const draft = useRef<Draft>(null);
  const api = useRef<ExcalidrawImperativeAPI>(null);
  const [editorApi, setEditorApi] = useState<ExcalidrawImperativeAPI>(null);
  const [assetStatus, setAssetStatus] = useState("正在加载账号素材库…");
  const [assetError, setAssetError] = useState("");
  const library = useMemo(
    () =>
      new AccountLibrarySync(userId, createLibraryApi(userId), (status, error) => {
        setAssetStatus(status);
        setAssetError(error || "");
      }),
    [userId]
  );
  const bindEditor = useCallback((value: ExcalidrawImperativeAPI) => {
    api.current = value;
    setEditorApi(value);
  }, []);
  useEffect(() => {
    library.start();
    const online = () => {
      void library.sync().catch(() => {});
    };
    window.addEventListener("online", online);
    return () => {
      library.stop();
      window.removeEventListener("online", online);
    };
  }, [library]);
  useHandleLibrary({ excalidrawAPI: editorApi, adapter: library.adapter });
  const localTimer = useRef<ReturnType<typeof setTimeout>>();
  const cloudTimer = useRef<ReturnType<typeof setTimeout>>();
  const cloudTask = useRef<Promise<void>>(null);
  const blocked = useRef(false);
  const alive = useRef(true);
  const localSequence = useRef(0);
  const localSavedSequence = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const [initialData, setInitialData] = useState<ReturnType<typeof parseScene>>(null);
  const [editorKey, setEditorKey] = useState("");
  const [title, setTitle] = useState("");
  const [localStatus, setLocalStatus] = useState("正在恢复本地草稿…");
  const [cloudStatus, setCloudStatus] = useState("尚未保存到云端");
  const [error, setError] = useState("");
  const [localError, setLocalError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [cloudBoards, setCloudBoards] = useState<BoardMeta[]>([]);
  const [localDrafts, setLocalDrafts] = useState<Draft[]>([]);
  const [libraryError, setLibraryError] = useState("");
  const [, confirmNavigation] = useConfirmNavigation();

  async function saveLocal() {
    if (!draft.current) return;
    clearTimeout(localTimer.current);
    const snapshot = { ...draft.current };
    const sequence = localSequence.current;
    try {
      await putDraft(snapshot);
      if (!alive.current || draft.current.localId !== snapshot.localId) return;
      localSavedSequence.current = Math.max(localSavedSequence.current, sequence);
      if (sequence === localSequence.current) {
        setLocalStatus("已保存到本机");
        setLocalError("");
        confirmNavigation(false);
      }
    } catch {
      if (!alive.current || draft.current.localId !== snapshot.localId || sequence !== localSequence.current) return;
      setLocalError("本地保存失败，可能是存储空间不足或浏览器禁用了存储。请保存到云端或导出文件");
      setLocalStatus("本地未保存");
      confirmNavigation(true);
    }
  }

  function scheduleCloud() {
    clearTimeout(cloudTimer.current);
    if (!blocked.current)
      cloudTimer.current = setTimeout(() => {
        void saveCloud();
      }, 1800);
  }

  async function saveCloud(force = false): Promise<void> {
    clearTimeout(cloudTimer.current);
    if (cloudTask.current) {
      await cloudTask.current;
      if (force && draft.current?.dirty && !blocked.current) return saveCloud(true);
      return;
    }
    if (!draft.current || blocked.current || (!force && !draft.current.dirty)) return;
    const snapshot = { ...draft.current };
    if (new Blob([snapshot.scene]).size > MAX_BYTES) {
      setError("画板超过 10 MB，已保留本地草稿。请减少图片大小后重试，或导出文件备份");
      setCloudStatus("云端未保存");
      return;
    }
    if (!snapshot.title.trim()) {
      setError("请输入画板名称");
      return;
    }
    setSaving(true);
    setCloudStatus("正在保存到云端…");
    cloudTask.current = (async () => {
      try {
        const result = await boardsApi.save({
          id: snapshot.id,
          title: snapshot.title,
          version: snapshot.version,
          scene: snapshot.scene
        });
        // Navigation or a different board must never receive this response.
        if (!alive.current || draft.current.localId !== snapshot.localId) return;
        const changed = draft.current.scene !== snapshot.scene || draft.current.title !== snapshot.title;
        draft.current = { ...draft.current, version: result.version, dirty: changed };
        setCloudStatus(changed ? "有更改等待上传" : "已保存到云端");
        setError("");
        await saveLocal();
        if (changed) scheduleCloud();
      } catch (e) {
        if (!alive.current || draft.current.localId !== snapshot.localId) return;
        // Network failures are ambiguous: retry with the same version, never silently overwrite.
        if (e instanceof BoardError && e.status === 409) {
          blocked.current = true;
          setConflict(true);
          setCloudStatus("版本冲突，上传已暂停");
        } else setCloudStatus("云端未保存");
        setError(e.message || "云端保存失败");
      } finally {
        cloudTask.current = null;
        if (alive.current) setSaving(false);
      }
    })();
    await cloudTask.current;
  }

  function changed(scene: string, nextTitle = draft.current.title) {
    if (scene === draft.current.scene && nextTitle === draft.current.title) return;
    draft.current = { ...draft.current, scene, title: nextTitle, dirty: true, savedAt: Date.now() };
    localSequence.current++;
    confirmNavigation(true);
    setLocalStatus("正在保存到本机…");
    if (!blocked.current) setCloudStatus("有更改等待上传");
    clearTimeout(localTimer.current);
    localTimer.current = setTimeout(() => {
      void saveLocal();
    }, 300);
    scheduleCloud();
  }

  function activate(value: Draft) {
    const restored = parseScene(value.scene);
    value = { ...value, scene: serializeAsJSON(restored.elements, restored.appState, restored.files || {}, "local") };
    // Each editor instance gets its own recovery record, protecting drafts in other tabs.
    draft.current = { ...value, localId: uuid(), savedAt: Date.now() };
    blocked.current = false;
    setConflict(false);
    setError("");
    setTitle(value.title);
    setCloudStatus(value.dirty ? "有更改等待上传" : value.version ? "已保存到云端" : "尚未保存到云端");
    setInitialData(restored);
    setEditorKey(draft.current.localId);
    localSequence.current++;
    void saveLocal();
    if (value.dirty) scheduleCloud();
  }

  useEffect(() => {
    appState.enterNewPage("画板", "draw");
    alive.current = true;
    (async () => {
      let value = blankDraft(userId);
      try {
        const drafts = await listDrafts(userId);
        if (drafts.length) {
          value = drafts[0];
          // A clean cached board can be refreshed from the server; unsent work stays local.
          if (!value.dirty && value.version > 0) {
            try {
              const remote = await boardsApi.get(value.id);
              value = { ...value, ...remote, dirty: false };
            } catch {
              /* Offline recovery remains available. */
            }
          }
        }
      } catch {
        if (alive.current) setLocalError("无法读取本地草稿，请检查浏览器存储设置");
      }
      if (alive.current) {
        try {
          activate(value);
        } catch {
          activate(blankDraft(userId));
          setError("本地草稿格式损坏，可在“我的画板”导出原始文件备份");
        }
      }
    })();
    const online = () => {
      void saveCloud();
    };
    const hide = () => {
      if (document.visibilityState === "hidden") {
        void saveLocal();
        void saveCloud();
      }
    };
    window.addEventListener("online", online);
    document.addEventListener("visibilitychange", hide);
    return () => {
      // Start the IndexedDB transaction while the document still exists.
      void saveLocal();
      alive.current = false;
      clearTimeout(localTimer.current);
      clearTimeout(cloudTimer.current);
      window.removeEventListener("online", online);
      document.removeEventListener("visibilitychange", hide);
    };
  }, []);

  async function switchBoard(value: Draft) {
    setBusy(true);
    try {
      await saveLocal();
      if (
        localSavedSequence.current < localSequence.current &&
        draft.current?.dirty &&
        !window.confirm("当前修改尚未保存到本机，切换可能丢失这些修改。仍要继续吗？")
      )
        return;
      if (cloudTask.current) await cloudTask.current;
      clearTimeout(cloudTimer.current);
      activate(value);
      setLibraryOpen(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function showLibrary() {
    setLibraryOpen(true);
    setLibraryError("");
    await saveLocal();
    const results = await Promise.allSettled([boardsApi.list(), listDrafts(userId)]);
    if (!alive.current) return;
    if (results[0].status === "fulfilled") setCloudBoards(results[0].value);
    else setLibraryError(results[0].reason.message);
    if (results[1].status === "fulfilled") setLocalDrafts(results[1].value);
    else setLibraryError("无法读取本地草稿");
  }

  async function openCloud(id: string) {
    setBusy(true);
    try {
      if (cloudTask.current) await cloudTask.current;
      const value = await boardsApi.get(id);
      await switchBoard({ ...blankDraft(userId), ...value, dirty: false });
    } catch (e) {
      setLibraryError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function copyBoard() {
    await switchBoard({
      ...draft.current,
      id: uuid(),
      version: 0,
      title: `${draft.current.title.slice(0, 115)} 副本`,
      dirty: true
    });
  }

  async function importFile(file: File) {
    try {
      if (file.size > MAX_BYTES) throw new Error("导入文件不能超过 10 MB");
      const text = await file.text();
      const restored = parseScene(text);
      const scene = serializeAsJSON(restored.elements, restored.appState, restored.files || {}, "local");
      await switchBoard({
        ...blankDraft(userId),
        title: file.name.replace(/\.excalidraw$/i, "").slice(0, 120) || "导入的画板",
        scene,
        dirty: true
      });
    } catch (e) {
      setError(e.message || "导入失败");
    }
  }

  async function exportFile(format: string) {
    if (!draft.current) return;
    try {
      const name = draft.current.title.replace(/[\\/:*?"<>|]/g, "_") || "画板";
      if (format === "json")
        download(new Blob([draft.current.scene], { type: "application/json" }), `${name}.excalidraw`);
      else if (api.current) {
        const opts = {
          elements: api.current.getSceneElements(),
          appState: api.current.getAppState(),
          files: api.current.getFiles()
        };
        if (format === "png") download(await exportToBlob({ ...opts, maxWidthOrHeight: 4096 }), `${name}.png`);
        if (format === "svg")
          download(new Blob([(await exportToSvg(opts)).outerHTML], { type: "image/svg+xml" }), `${name}.svg`);
      }
    } catch {
      setError("导出失败，请检查画板中的图片和字体是否加载完成");
    }
  }

  return (
    <section className={style.page}>
      <AutoHideMenu>
        <div className={style.identity}>
          <span className={style.eyebrow}>NSOJ / 画板</span>
          <input
            aria-label="画板名称"
            maxLength={120}
            value={title}
            disabled={!editorKey || busy}
            onChange={e => {
              setTitle(e.target.value);
              changed(draft.current.scene, e.target.value);
            }}
          />
          <div className={style.status} aria-live="polite">
            <span>{localStatus}</span>
            <span>{cloudStatus}</span>
            <span>{assetStatus}</span>
          </div>
        </div>
        <div className={style.actions}>
          <button disabled={!editorKey || busy || saving} onClick={() => void switchBoard(blankDraft(userId))}>
            新建
          </button>
          <button disabled={!editorKey || busy} onClick={() => void showLibrary()}>
            我的画板
          </button>
          <button disabled={!editorKey || busy} onClick={() => fileInput.current.click()}>
            导入
          </button>
          <select
            aria-label="导出画板"
            value=""
            disabled={!editorKey || busy}
            onChange={e => void exportFile(e.target.value)}
          >
            <option value="" disabled>
              导出…
            </option>
            <option value="json">Excalidraw 文件</option>
            <option value="png">PNG 图片</option>
            <option value="svg">SVG 矢量图</option>
          </select>
          <button
            className={style.primary}
            disabled={!editorKey || busy || saving || conflict}
            onClick={() => void saveCloud(true)}
          >
            {saving ? "正在保存…" : "保存到云端"}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".excalidraw,application/json"
            hidden
            onChange={e => {
              if (e.target.files?.[0]) void importFile(e.target.files[0]);
              e.target.value = "";
            }}
          />
        </div>
      </AutoHideMenu>
      {assetError && (
        <div className={style.notice} role="alert">
          <span>{assetError}</span>
          <button onClick={() => void library.sync().catch(() => {})}>重试素材库同步</button>
        </div>
      )}
      {(error || localError) && (
        <div className={style.notice} role="alert">
          <span>{localError || error}</span>
          {conflict && (
            <button disabled={busy || saving} onClick={() => void copyBoard()}>
              另存为云端副本
            </button>
          )}
        </div>
      )}
      <div className={style.canvas} aria-label="绘图区域">
        {initialData ? (
          <Excalidraw
            key={editorKey}
            initialData={initialData}
            langCode="zh-CN"
            theme={appState.theme === "far" ? "dark" : "light"}
            excalidrawAPI={bindEditor}
            onChange={(elements, state, files) => {
              // Ignore initialization and purely transient selection/cursor changes after serialization.
              const scene = serializeAsJSON(elements, state, files, "local");
              if (draft.current) changed(scene);
            }}
          >
            <MainMenu>
              <MainMenu.Item onSelect={() => fileInput.current.click()}>导入画板（创建新画板）</MainMenu.Item>
              <MainMenu.Item onSelect={() => void exportFile("json")}>导出 Excalidraw 文件</MainMenu.Item>
              <MainMenu.DefaultItems.SaveAsImage />
              <MainMenu.DefaultItems.SearchMenu />
              <MainMenu.DefaultItems.Help />
              <MainMenu.DefaultItems.ClearCanvas />
              <MainMenu.Separator />
              <MainMenu.DefaultItems.ChangeCanvasBackground />
            </MainMenu>
          </Excalidraw>
        ) : (
          <div className={style.loading}>正在加载画板…</div>
        )}
      </div>
      {libraryOpen && (
        <div
          className={style.overlay}
          onKeyDown={e => {
            if (e.key === "Escape" && !busy) setLibraryOpen(false);
          }}
        >
          <div className={style.library} role="dialog" aria-modal="true" aria-label="我的画板">
            <div className={style.libraryHeader}>
              <h2>我的画板</h2>
              <button autoFocus disabled={busy} onClick={() => setLibraryOpen(false)}>
                关闭
              </button>
            </div>
            {libraryError && (
              <p role="alert">
                {libraryError} <button onClick={() => void showLibrary()}>重试</button>
              </p>
            )}
            <h3>账号云端画板</h3>
            <p className={style.hint}>仅当前账号可访问，换设备登录后可继续编辑。</p>
            {cloudBoards.length === 0 && <p className={style.hint}>暂无云端画板，绘图后会自动上传。</p>}
            <div className={style.boardList}>
              {cloudBoards.map(board => (
                <div className={style.board} key={board.id}>
                  <button className={style.boardTitle} disabled={busy} onClick={() => void openCloud(board.id)}>
                    {board.title}
                    <small>{new Date(board.updatedAt).toLocaleString("zh-CN")}</small>
                  </button>
                  <button
                    disabled={busy || saving}
                    onClick={async () => {
                      if (!window.confirm(`删除云端画板“${board.title}”？本机草稿会保留。`)) return;
                      setBusy(true);
                      try {
                        await boardsApi.delete(board.id, board.version);
                        if (draft.current.id === board.id) {
                          blocked.current = true;
                          setConflict(true);
                          setCloudStatus("云端画板已删除");
                          setError("云端画板已删除，本机草稿已保留。需要继续保存时请另存副本");
                        }
                        await showLibrary();
                      } catch (e) {
                        setLibraryError(e.message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    删除
                  </button>
                </div>
              ))}
            </div>
            <h3>本机恢复草稿</h3>
            <p className={style.hint}>仅保存在此浏览器。不同编辑窗口独立保留，打开旧草稿不会直接覆盖云端新版。</p>
            <div className={style.boardList}>
              {localDrafts.map(value => (
                <div className={style.board} key={value.localId}>
                  <button className={style.boardTitle} disabled={busy} onClick={() => void switchBoard(value)}>
                    {value.title}
                    <small>
                      {new Date(value.savedAt).toLocaleString("zh-CN")} · {value.dirty ? "有未上传修改" : "本机快照"}
                    </small>
                  </button>
                  <button
                    onClick={() =>
                      download(new Blob([value.scene], { type: "application/json" }), `${value.title}.excalidraw`)
                    }
                  >
                    导出
                  </button>
                  <button
                    disabled={busy || value.localId === draft.current?.localId}
                    onClick={async () => {
                      if (!window.confirm(`删除本机草稿“${value.title}”？`)) return;
                      try {
                        await deleteDraft(value.localId);
                        await showLibrary();
                      } catch {
                        setLibraryError("删除本机草稿失败");
                      }
                    }}
                  >
                    删除
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
});

// Remount all editor/library state when the authenticated account changes.
const DrawPage: React.FC = observer(() => <AccountDrawPage key={appState.currentUser.id} />);
export default DrawPage;
