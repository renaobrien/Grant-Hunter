"use client";

// Choose the model provider: Anthropic (default, cloud, needs a key + spends) or
// a local Ollama model (free, private, local-only). Local models have no web
// search, so discovery can't verify live pages - drafting and profile work fully.
import { useState, useTransition } from "react";
import type { LlmProvider } from "@/lib/types";
import { saveLlmProvider, testOllama } from "./actions";

export default function LlmProviderForm({
  initialProvider,
  initialBaseUrl,
  initialModel,
}: {
  initialProvider: LlmProvider;
  initialBaseUrl: string;
  initialModel: string;
}) {
  const [provider, setProvider] = useState<LlmProvider>(initialProvider);
  const [baseUrl, setBaseUrl] = useState(initialBaseUrl || "http://localhost:11434");
  const [model, setModel] = useState(initialModel);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [models, setModels] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const [testing, startTest] = useTransition();

  function save() {
    setMsg(null);
    startTransition(async () => {
      const res = await saveLlmProvider({ provider, ollamaBaseUrl: baseUrl, ollamaModel: model });
      setMsg(
        res.ok
          ? { ok: true, text: provider === "ollama" ? "Using your local Ollama model now." : "Using Anthropic now." }
          : { ok: false, text: res.error },
      );
    });
  }

  function test() {
    setMsg(null);
    setModels([]);
    startTest(async () => {
      const res = await testOllama(baseUrl);
      if (res.ok) {
        setModels(res.models);
        if (res.models.length && !model) setModel(res.models[0]);
        setMsg({
          ok: true,
          text: res.models.length
            ? `Connected. Installed: ${res.models.join(", ")}`
            : "Connected, but no models are pulled yet. Run e.g. 'ollama pull llama3.1'.",
        });
      } else {
        setMsg({ ok: false, text: res.error });
      }
    });
  }

  return (
    <div className="stack">
      <label className="row" style={{ gap: "var(--s2)", fontWeight: 400 }}>
        <input
          type="radio"
          name="llm-provider"
          checked={provider === "anthropic"}
          onChange={() => setProvider("anthropic")}
        />
        Anthropic (Claude) - cloud, needs an API key, spends per run
      </label>
      <label className="row" style={{ gap: "var(--s2)", fontWeight: 400 }}>
        <input
          type="radio"
          name="llm-provider"
          checked={provider === "ollama"}
          onChange={() => setProvider("ollama")}
        />
        Local model (Ollama) - free and private, this machine only
      </label>

      {provider === "ollama" ? (
        <div className="stack" style={{ gap: "var(--s2)", paddingLeft: "var(--s3)" }}>
          <p className="field-hint" style={{ marginTop: 0 }}>
            Needs Ollama running locally (<code>ollama serve</code>) with a model
            pulled. Local models have no web search, so discovery can&rsquo;t verify
            live pages - drafting, judging, and profile compile work fully. Bigger
            instruct models follow the JSON format far better.
          </p>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="ollama-url">Ollama URL</label>
              <input
                id="ollama-url"
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="http://localhost:11434"
                disabled={pending || testing}
              />
            </div>
            <div className="field">
              <label htmlFor="ollama-model">Model</label>
              <input
                id="ollama-model"
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="llama3.1"
                list="ollama-models"
                disabled={pending || testing}
              />
              <datalist id="ollama-models">
                {models.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </div>
          </div>
          <div className="row">
            <button type="button" className="btn btn-sm" onClick={test} disabled={testing || pending}>
              {testing ? "Testing…" : "Test connection"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="row">
        <button type="button" className="btn btn-primary" onClick={save} disabled={pending || testing}>
          {pending ? "Saving…" : "Save provider"}
        </button>
        {msg ? (
          <span
            className="saved-note"
            style={{ color: msg.ok ? "var(--tone-good)" : "var(--tone-bad)" }}
          >
            {msg.text}
          </span>
        ) : null}
      </div>
    </div>
  );
}
