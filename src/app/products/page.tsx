"use client";
import { useState } from "react";
import { AppShell } from "@/components/app/AppShell";
import { allProducts } from "@/lib/catalog/sprinklers";
import { precipitationRate, headFlow } from "@/lib/irrigation/sprinkler";
import { HEAD_NAMES } from "@/lib/plan/symbols";
import { PIPE_SPECS, sizesFor } from "@/lib/hydraulics/pipes";
import { flowAtVelocity, frictionLossPer100Ft } from "@/lib/hydraulics/formulas";
import { pipeSizeLabel } from "@/lib/units/units";
import { Badge, cn } from "@/components/ui";
import type { PipeMaterial } from "@/lib/model/types";

export default function ProductsPage() {
  const [tab, setTab] = useState<"sprinklers" | "pipe">("sprinklers");
  const products = allProducts();
  const [sel, setSel] = useState(products[0].id);
  const p = products.find((x) => x.id === sel)!;
  const [mat, setMat] = useState<PipeMaterial>("pvc-sch40");
  return (
    <AppShell title="Product Library">
      <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {(
            [
              ["sprinklers", "Sprinklers & nozzles"],
              ["pipe", "Pipe data & friction tables"],
            ] as const
          ).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={cn("rounded-lg px-3 py-1.5 text-[13px] font-medium", tab === k ? "bg-slate-900 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200")}>
              {l}
            </button>
          ))}
          <p className="ml-auto text-[12px] text-slate-500">Generic representative products. Manufacturer catalogs (Hunter, Rain Bird, Toro, K-Rain) can be registered through the catalog API.</p>
        </div>
        {tab === "sprinklers" ? (
          <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
            <div className="rounded-xl border border-slate-200 bg-white p-2">
              {products.map((x) => (
                <button key={x.id} onClick={() => setSel(x.id)} className={cn("block w-full rounded-md px-2.5 py-2 text-left", sel === x.id ? "bg-brand-50 ring-1 ring-brand-200" : "hover:bg-slate-50")}>
                  <div className="text-[13px] font-medium text-slate-900">{x.model}</div>
                  <div className="text-[11.5px] text-slate-500">
                    {x.manufacturer} · {HEAD_NAMES[x.category]}
                  </div>
                </button>
              ))}
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold">{p.model}</h2>
                <Badge tone="brand">{HEAD_NAMES[p.category]}</Badge>
                {p.prsPsi && <Badge tone="green">PRS {p.prsPsi} psi</Badge>}
                {p.matchedPrecip && <Badge tone="blue">Matched precipitation</Badge>}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-3 text-[12.5px] md:grid-cols-5">
                <Spec k="Manufacturer / line" v={`${p.manufacturer} · ${p.productLine}`} />
                <Spec k="Inlet" v={pipeSizeLabel(p.inletSize) + " NPT"} />
                <Spec k="Pressure range" v={`${p.minPressure}–${p.maxPressure} PSI`} />
                <Spec k="Arc" v={p.arcAdjustable ? `${p.arcMin}–${p.arcMax}° adjustable` : `${p.arcMax}° fixed`} />
                <Spec k="Max radius reduction" v={`${Math.round(p.maxRadiusReduction * 100)}%`} />
              </div>
              {p.notes && <p className="mt-2 text-[12px] text-slate-600">{p.notes}</p>}
              <table className="mt-4 w-full text-[12.5px]">
                <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    {["Nozzle", "Radius", "Pressure", "Trajectory", "Flow 90°", "Flow 180°", "Flow 360°", "PR 90° (in/h)", "PR 180°", "PR 360°"].map((h) => (
                      <th key={h} className="px-2 py-2 font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="tabular">
                  {p.nozzles.map((n) => (
                    <tr key={n.id} className="border-t border-slate-100">
                      <td className="px-2 py-1.5 font-medium">{n.name}</td>
                      <td className="px-2">{n.radius}&apos;</td>
                      <td className="px-2">{n.pressure} psi</td>
                      <td className="px-2">{n.trajectory}°</td>
                      {[90, 180, 360].map((a) => (
                        <td key={a} className="px-2">
                          {headFlow(p, n, a).toFixed(2)} gpm
                        </td>
                      ))}
                      {[90, 180, 360].map((a) => (
                        <td key={`pr${a}`} className="px-2">
                          {p.category === "emitter" || p.category === "bubbler" ? "—" : precipitationRate(headFlow(p, n, a), a, n.radius).toFixed(2)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-[11.5px] text-slate-500">PR = 96.25 × GPM × (360 / arc) / radius² (square head-to-head spacing).</p>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex flex-wrap gap-1">
              {(Object.keys(PIPE_SPECS) as PipeMaterial[]).map((m) => (
                <button key={m} onClick={() => setMat(m)} className={cn("rounded-md px-2.5 py-1 text-[12px] ring-1", mat === m ? "bg-brand-600 text-white ring-brand-600" : "ring-slate-200")}>
                  {PIPE_SPECS[m].label}
                </button>
              ))}
            </div>
            <p className="mb-2 text-[12px] text-slate-600">Hazen-Williams C = {PIPE_SPECS[mat].c}. Friction loss in PSI per 100 ft; shaded cells exceed 5 ft/s.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-2 py-2 font-medium">GPM</th>
                    {sizesFor(mat).map((s) => (
                      <th key={s} className="px-2 py-2 text-right font-medium">
                        {pipeSizeLabel(s)} <span className="normal-case text-slate-400">(ID {PIPE_SPECS[mat].ids[String(s)]}&quot;)</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="tabular">
                  {[2, 4, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50].map((q) => (
                    <tr key={q} className="border-t border-slate-100">
                      <td className="px-2 py-1 font-medium">{q}</td>
                      {sizesFor(mat).map((s) => {
                        const id = PIPE_SPECS[mat].ids[String(s)];
                        const over = q > flowAtVelocity(5, id);
                        return (
                          <td key={s} className={cn("px-2 text-right", over && "bg-red-50 text-red-700")}>
                            {frictionLossPer100Ft(q, id, PIPE_SPECS[mat].c).toFixed(2)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  <tr className="border-t-2 border-slate-200 text-slate-600">
                    <td className="px-2 py-1">Max GPM @ 5 ft/s</td>
                    {sizesFor(mat).map((s) => (
                      <td key={s} className="px-2 text-right font-semibold">
                        {flowAtVelocity(5, PIPE_SPECS[mat].ids[String(s)]).toFixed(1)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Spec({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-wide text-slate-500">{k}</div>
      <div className="font-medium text-slate-900">{v}</div>
    </div>
  );
}
