// Stashbook: a catalogue for collectors (vinyl, sneakers, yarn and more) with values, photos, a wishlist and an insurance export.
import { useEffect, useMemo, useState } from "react";
import { toCsv } from "./lib/csv";
import { idbGet, idbSet, shrinkImage } from "./lib/idb";
import { moneyFmt } from "./lib/money";
import { download, uid, useStored } from "./lib/store";
import { CurrencySelect, Section, Stat, Stats } from "./ui/kit";

const T = "stashbook";
const TEMPLATES: Record<string, string[]> = { Vinyl: ["Artist", "Title", "Year", "Label", "Condition"], Sneakers: ["Brand", "Model", "Colourway", "Size", "Condition"], Yarn: ["Brand", "Fibre", "Weight", "Colour", "Metres"], Watches: ["Brand", "Model", "Reference", "Year", "Condition"], Books: ["Author", "Title", "Edition", "Year", "Condition"], Other: ["Name", "Maker", "Year", "Condition"] };
type Item = { id: string; fields: Record<string, string>; paid: number; value: number; photo: boolean; wish: boolean; added: string };
type Coll = { id: string; name: string; kind: string; items: Item[] };
const it = (f: Record<string, string>, paid: number, value: number, wish = false): Item => ({ id: uid(), fields: f, paid, value, photo: false, wish, added: "2025-06-01" });
const SAMPLE: Coll[] = [{ id: "c1", name: "Records", kind: "Vinyl", items: [
  it({ Artist: "Anouar Brahem", Title: "Le Pas du Chat Noir", Year: "2002", Label: "ECM", Condition: "Near mint" }, 90, 140), it({ Artist: "Fairuz", Title: "Ma'rifti", Year: "1969", Label: "Voix de l'Orient", Condition: "Very good" }, 60, 180),
  it({ Artist: "Miles Davis", Title: "Kind of Blue", Year: "1959", Label: "Columbia", Condition: "Good" }, 150, 220), it({ Artist: "Dhafer Youssef", Title: "Birds Requiem", Year: "2013", Label: "Okeh", Condition: "Mint" }, 110, 105),
  it({ Artist: "Oum Kalthoum", Title: "Enta Omri", Year: "1964", Label: "Sono Cairo", Condition: "" }, 0, 0, true)] }];

function Pic({ id }: { id: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => { idbGet(`${T}:${id}`).then(v => setSrc(v ?? "")); }, [id]);
  return src ? <img src={src} alt="" className="sb-pic" /> : <div className="sb-pic sb-none" />;
}

export default function Stashbook() {
  const [colls, setColls] = useStored<Coll[]>(T, "colls", SAMPLE);
  const [cur, setCur] = useStored(T, "cur", "TND");
  const [openId, setOpenId] = useState(colls[0]?.id ?? "");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"added" | "value" | "gain">("value");
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [money2, setMoney2] = useState({ paid: "", value: "", wish: false });
  const [file, setFile] = useState<File | null>(null);
  const money = moneyFmt(cur);
  const c = colls.find(x => x.id === openId) ?? colls[0];
  const fields = c ? TEMPLATES[c.kind] ?? TEMPLATES.Other : [];
  const owned = c ? c.items.filter(i => !i.wish) : [];
  const shown = useMemo(() => (c ? c.items.filter(i => !q || Object.values(i.fields).join(" ").toLowerCase().includes(q.toLowerCase())) : []).sort((a, b) => Number(a.wish) - Number(b.wish) || (sort === "value" ? b.value - a.value : sort === "gain" ? (b.value - b.paid) - (a.value - a.paid) : b.added.localeCompare(a.added))), [c, q, sort]);
  const allValue = colls.flatMap(x => x.items.filter(i => !i.wish)).reduce((a, i) => a + i.value, 0);
  const setC = (patch: Partial<Coll>) => setColls(colls.map(x => (x.id === c.id ? { ...x, ...patch } : x)));
  const title = (i: Item) => [i.fields[fields[0]], i.fields[fields[1]]].filter(Boolean).join(", ");
  const add = async (e: React.FormEvent) => { e.preventDefault(); if (!Object.values(draft).some(v => v.trim())) return; const id = uid(); let photo = false; if (file) { await idbSet(`${T}:${id}`, await shrinkImage(file, 700)); photo = true; } setC({ items: [...c.items, { id, fields: draft, paid: parseFloat(money2.paid) || 0, value: parseFloat(money2.value) || parseFloat(money2.paid) || 0, photo, wish: money2.wish, added: new Date().toISOString().slice(0, 10) }] }); setDraft({}); setMoney2({ paid: "", value: "", wish: false }); setFile(null); };

  return (
    <div className="stack">
      <Section title="Your collections" aside={<><CurrencySelect id="sb-cur" value={cur} onChange={setCur} /><button className="btn small" style={{ alignSelf: "flex-end" }} onClick={() => download("collection-for-insurance.csv", toCsv([["Collection", "Item", "Details", "Purchase price", "Current value", "Photo"], ...colls.flatMap(x => x.items.filter(i => !i.wish).map(i => [x.name, [i.fields[(TEMPLATES[x.kind] ?? TEMPLATES.Other)[0]], i.fields[(TEMPLATES[x.kind] ?? TEMPLATES.Other)[1]]].filter(Boolean).join(", "), Object.entries(i.fields).map(([k, v]) => `${k}: ${v}`).join("; "), i.paid, i.value, i.photo ? "yes" : "no"]))]), "text/csv")}>Insurance export</button></>}>
        <Stats><Stat value={colls.reduce((a, x) => a + x.items.filter(i => !i.wish).length, 0)} label="Items" /><Stat value={money(allValue)} label="Total value" tone="good" /><Stat value={money(allValue - colls.flatMap(x => x.items.filter(i => !i.wish)).reduce((a, i) => a + i.paid, 0))} label="Gain on what you paid" /><Stat value={colls.flatMap(x => x.items.filter(i => i.wish)).length} label="On the wishlist" /></Stats>
        <div className="row" style={{ gap: 6, marginTop: 12 }}>{colls.map(x => <button key={x.id} className="btn small" aria-pressed={x.id === c?.id} style={x.id === c?.id ? { background: "var(--ink)", color: "var(--bg)" } : undefined} onClick={() => setOpenId(x.id)}>{x.name} ({x.items.filter(i => !i.wish).length})</button>)}
          <select className="input" style={{ width: "auto" }} aria-label="New collection" value="" onChange={e => { if (!e.target.value) return; const n = { id: uid(), name: e.target.value, kind: e.target.value, items: [] }; setColls([...colls, n]); setOpenId(n.id); }}><option value="">New collection…</option>{Object.keys(TEMPLATES).map(k => <option key={k}>{k}</option>)}</select></div>
      </Section>
      {c && <>
        <Section title={`Add to ${c.name}`}>
          <form className="stack" style={{ gap: 10 }} onSubmit={add}>
            <div className="sb-form">{fields.map(f => <label key={f} className="field"><span>{f}</span><input className="input" value={draft[f] ?? ""} onChange={e => setDraft({ ...draft, [f]: e.target.value })} /></label>)}</div>
            <div className="row" style={{ alignItems: "flex-end" }}><label className="field"><span>Paid</span><input className="input num" value={money2.paid} onChange={e => setMoney2({ ...money2, paid: e.target.value })} /></label><label className="field"><span>Worth now</span><input className="input num" value={money2.value} onChange={e => setMoney2({ ...money2, value: e.target.value })} /></label><label className="check" style={{ paddingBottom: 10 }}><input type="checkbox" checked={money2.wish} onChange={e => setMoney2({ ...money2, wish: e.target.checked })} />Wishlist</label><label className="btn small">{file ? "Photo added" : "Photo"}<input type="file" accept="image/*" hidden onChange={e => setFile(e.target.files?.[0] ?? null)} /></label><button className="btn primary" type="submit">Add</button></div>
          </form>
        </Section>
        <Section title={c.name} aside={<><input className="input" type="search" style={{ width: 200 }} placeholder="Search" aria-label="Search" value={q} onChange={e => setQ(e.target.value)} /><select className="input" style={{ width: "auto" }} aria-label="Sort" value={sort} onChange={e => setSort(e.target.value as typeof sort)}><option value="value">Most valuable</option><option value="gain">Biggest gain</option><option value="added">Newest</option></select></>}>
          <p className="note" style={{ marginBottom: 10 }}>{owned.length} items worth {money(owned.reduce((a, i) => a + i.value, 0))}.</p>
          <div className="sb-grid">{shown.map(i => (
            <article key={i.id} className={"sb-card" + (i.wish ? " wish" : "")}>
              {i.photo ? <Pic id={i.id} /> : <div className="sb-pic sb-none"><span>{(i.fields[fields[0]] ?? "?").slice(0, 1)}</span></div>}
              <strong>{title(i) || "Untitled"}</strong>
              <span className="note">{fields.slice(2).map(f => i.fields[f]).filter(Boolean).join(" · ")}</span>
              {i.wish ? <span className="pill warn">Wishlist</span> : <div className="row" style={{ gap: 6, alignItems: "center" }}><span className="num">{money(i.value)}</span>{i.paid > 0 && <span className={"pill " + (i.value >= i.paid ? "good" : "bad")}>{i.value >= i.paid ? "+" : ""}{Math.round(((i.value - i.paid) / i.paid) * 100)}%</span>}</div>}
              <div className="row" style={{ gap: 4 }}><input className="input num" style={{ width: 90, fontSize: 13, padding: "4px 6px" }} aria-label="Current value" value={i.value} onChange={e => setC({ items: c.items.map(x => x.id === i.id ? { ...x, value: parseFloat(e.target.value) || 0 } : x) })} />{i.wish && <button className="btn ghost small" onClick={() => setC({ items: c.items.map(x => x.id === i.id ? { ...x, wish: false, added: new Date().toISOString().slice(0, 10) } : x) })}>Got it</button>}<button className="btn ghost small danger" onClick={() => setC({ items: c.items.filter(x => x.id !== i.id) })}>×</button></div>
            </article>))}</div>
        </Section>
        <div className="row"><label className="field" style={{ maxWidth: 280 }}><span>Collection name</span><input className="input" value={c.name} onChange={e => setC({ name: e.target.value })} /></label><button className="btn ghost small danger" style={{ alignSelf: "flex-end" }} disabled={colls.length < 2} onClick={() => { setColls(colls.filter(x => x.id !== c.id)); setOpenId(colls[0].id); }}>Delete collection</button></div>
      </>}
      <style>{`.sb-form{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px}.sb-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:12px}.sb-card{border:1px solid var(--line);border-radius:12px;padding:10px;display:grid;gap:5px;align-content:start}.sb-card.wish{border-style:dashed;opacity:.8}
      .sb-pic{width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px}.sb-none{background:repeating-linear-gradient(45deg,var(--sunk) 0 8px,transparent 8px 16px);display:grid;place-items:center}.sb-none span{font-family:var(--serif);font-size:48px;color:var(--muted)}`}</style>
    </div>
  );
}
