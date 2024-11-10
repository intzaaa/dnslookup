/* @refresh reload */
import { render, Show } from "solid-js/web";

import "./index.css";
import { Route, Router, useSearchParams } from "@solidjs/router";
import { Accessor, Component, createMemo, createResource, For } from "solid-js";
import { isEmpty, uniqBy } from "ramda";

const root = document.getElementById("root");

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
  throw new Error("Root element not found. Did you forget to add it to your index.html? Or maybe the id attribute got misspelled?");
}

render(
  () => (
    <Router>
      <Route
        path="/"
        component={() => {
          let error = "";

          const [searchParams, setSearchParams] = useSearchParams();

          const domain = createMemo(() => String(searchParams["domain"]) as string);

          const Resolver: Component<{ domain: Accessor<string> }> = ({ domain }) => {
            const types = ["A", "AAAA", "CNAME", "TXT"] as const;
            type Types = (typeof types)[number];
            const typeMap: { [key: number]: Types } = {
              1: "A",
              5: "CNAME",
              16: "TXT",
              28: "AAAA",
            };

            const endpoints = ["https://1.1.1.1/dns-query", "https://dns.alidns.com/resolve"];

            const [results] = createResource(domain, async (domain) => {
              const res: Record<Types, { name: string; data: string }[]> = {
                A: [],
                AAAA: [],
                CNAME: [],
                TXT: [],
              };

              const fetchPromises = endpoints.flatMap((endpoint) =>
                types.map(async (type) => {
                  try {
                    const response = await fetch(`${endpoint}?name=${domain}&type=${type}`, {
                      headers: { accept: "application/dns-json" },
                    });
                    const json = await response.json();
                    const answers: { name: string; type: number; data: string }[] = json.Answer || [];
                    res[type].push(...answers.filter(({ type: _type }) => type === typeMap[_type]));
                    res[type] = uniqBy(String, res[type]);
                    res[type].sort();
                  } catch (err) {
                    error += "\n" + err;
                    throw err;
                  }
                })
              );

              await Promise.all(fetchPromises);
              return res;
            });

            return (
              <>
                <Show when={results.state === "errored"}>
                  <h2>Error</h2>
                  {error}
                </Show>
                <Show when={results.state === "ready"}>
                  <Show when={Object.values(results() ?? {}).every(isEmpty)}>
                    <h2>No Results</h2>
                  </Show>
                  <For each={types}>
                    {(type) => (
                      <Show when={results()?.[type].length}>
                        <h2>{type}</h2>
                        <ul>
                          <For each={results()![type]}>
                            {({ name, data }) => (
                              <li>
                                {new RegExp(`${domain()}?\.`).test(domain()) ? "" : `${name}: `}
                                {data}
                              </li>
                            )}
                          </For>
                        </ul>
                      </Show>
                    )}
                  </For>
                </Show>
              </>
            );
          };
          return (
            <>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const domain = new FormData(event.currentTarget).get("domain")!.toString();
                  setSearchParams({
                    domain,
                  });
                }}>
                <input
                  name="domain"
                  type="text"
                  placeholder={window.location.hostname}
                  value={domain() ?? ""}
                  style={{
                    width: "100%",
                    "line-height": "24px",
                    "font-size": "20px",
                    "font-family": "monospace",
                  }}></input>
              </form>
              <Show when={domain()}>
                <div>
                  <h1>{domain()}</h1>
                  <Resolver domain={domain}></Resolver>
                </div>
              </Show>
            </>
          );
        }}></Route>
    </Router>
  ),
  root!
);
