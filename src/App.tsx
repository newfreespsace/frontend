import React, { useEffect } from "react";
import { observer } from "mobx-react";
import { HelmetProvider, Helmet } from "react-helmet-async";

import { appState } from "./appState";
import { updateCodeFontCss, updateContentFontCss, updateUiFontCss } from "./misc/fonts";
import { setGlobalTheme } from "./themes";

import { remoteApi } from "./remote-judge/api";

import { startNotifications } from "./notifications/state";

import AppRouter from "./AppRouter";

const App: React.FC = () => {
  useEffect(
    () => startNotifications(),
    [appState.currentUser?.id, appState.token, appState.activeGroupContests.length]
  );
  useEffect(() => {
    updateCodeFontCss(appState.locale);
    updateContentFontCss(appState.locale);
    updateUiFontCss(appState.locale);
  }, [appState.userPreference.font, appState.locale]);

  useEffect(() => {
    setGlobalTheme(appState.theme);
  }, [appState.theme]);

  useEffect(() => {
    if (!appState.currentUser) return;
    // Only schedules work; the server enforces the shared upstream cooldown.
    const activate = () => {
      if (document.visibilityState === "visible" && !/^\/c\/\d+/.test(window.location.pathname))
        void remoteApi.activate({});
    };
    activate();
    document.addEventListener("visibilitychange", activate);
    return () => document.removeEventListener("visibilitychange", activate);
  }, [appState.currentUser?.id]);

  return (
    <>
      <HelmetProvider>
        <Helmet>
          <meta
            name="viewport"
            content={appState.responsiveLayout ? "width=device-width, initial-scale=1, maximum-scale=1" : "width=1024"}
          />
          <title>
            {appState.title && `${appState.title} - `}
            {appState.serverPreference.siteName}
          </title>
        </Helmet>
      </HelmetProvider>
      <AppRouter />
    </>
  );
};

export default observer(App);
