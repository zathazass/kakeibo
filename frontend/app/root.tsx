import type { LinksFunction } from "@remix-run/node";
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "@remix-run/react";
import type { ReactNode } from "react";

import styles from "./styles/app.css?url";

export const links: LinksFunction = () => [{ rel: "stylesheet", href: styles }];

export const meta = () => [
  { title: "kaKeiBo — household ledger" },
  { name: "description", content: "A kakeibo ledger: plan, log, and review a month of spending." },
  { name: "color-scheme", content: "light dark" },
];

/** Apply the saved theme before first paint so the page never flashes. */
const THEME_BOOT = `(function(){try{var t=localStorage.getItem("kakeibo-theme");
if(t==="dark"||t==="light"){document.documentElement.setAttribute("data-theme",t);}}catch(e){}})();`;

export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function HydrateFallback() {
  return (
    <div className="loading">
      <strong>kaKeiBo</strong>
      <span>Opening the ledger…</span>
    </div>
  );
}
