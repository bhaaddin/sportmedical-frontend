/* The public bundle's component tree, shared by the server render (entry-server) and the browser
   (entry-client): theme, the "this is the public bundle" flag for SiteLink, the route table inside
   the layout, and a not-found page. Providers that differ (router, query client, emotion cache)
   are added by the entries. */

import { useEffect, useRef } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { publicTheme } from '../components/public/brand';
import { WebRouterContext } from './SiteLink';
import { WebLayout } from './WebLayout';
import { WebErrorBoundary } from './WebErrorBoundary';
import { NOT_FOUND_META, WEB_ROUTES } from './routes';
import type { WebRoute } from './routes';
import { PageHero, CtaButton } from './ui';

function setMeta(name: string, content: string): void {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (tag === null) {
    tag = document.createElement('meta');
    tag.name = name;
    document.head.appendChild(tag);
  }
  tag.content = content;
}

/** Keeps <title> and the description right after a client-side navigation, and starts the new page at its top. */
function useRouteMeta(meta: { title: string; description: string }): void {
  const { pathname, hash } = useLocation();
  const first = useRef(true);

  useEffect(() => {
    document.title = meta.title;
    setMeta('description', meta.description);
  }, [meta.title, meta.description]);

  useEffect(() => {
    // The prerendered page is already at the right place; only a navigation moves the scroll.
    if (first.current) { first.current = false; return; }
    if (hash !== '') {
      document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView?.();
      return;
    }
    window.scrollTo?.(0, 0);
  }, [pathname, hash]);
}

function RoutePage({ route }: { route: WebRoute }) {
  useRouteMeta(route);
  const { Component } = route;
  return <Component />;
}

function NotFoundPage() {
  useRouteMeta(NOT_FOUND_META);
  return (
    <PageHero eyebrow="404" title="Stránka nenalezena" lead="Tuto stránku jsme nenašli. Zkuste úvodní stránku nebo objednání termínu.">
      <CtaButton to="/" height={54} fontSize={16}>Na úvodní stránku</CtaButton>
    </PageHero>
  );
}

function RoutedPages() {
  const { pathname } = useLocation();
  return (
    <WebErrorBoundary resetKey={pathname}>
      <Routes>
        {WEB_ROUTES.map((route) => (
          <Route key={route.id} path={route.path} element={<RoutePage route={route} />} />
        ))}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </WebErrorBoundary>
  );
}

export function WebApp() {
  return (
    <ThemeProvider theme={publicTheme}>
      <WebRouterContext.Provider value>
        <WebLayout>
          <RoutedPages />
        </WebLayout>
      </WebRouterContext.Provider>
    </ThemeProvider>
  );
}

