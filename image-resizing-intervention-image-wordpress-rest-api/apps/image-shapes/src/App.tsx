import { useEffect, useState, type FormEvent } from "react";

// Set by the [loopress_app name="image-shapes"] shortcode: where the REST API lives.
export const config = (globalThis as { loopressApp_image_shapes?: { mount: string; restUrl: string } })
  .loopressApp_image_shapes;

type Shape = { label: string; width: number; height: number; src?: string };

// What a design system might ask for, all from the same media library upload.
const presets: Shape[] = [
  { label: "Banner", width: 620, height: 140 },
  { label: "Card", width: 342, height: 180 },
  { label: "Avatar", width: 96, height: 96 },
];

// The route is public (#[Permission(public: true)]), so no nonce is needed.
async function resize(imageId: string, shape: Shape): Promise<Shape> {
  const res = await fetch(
    `${config!.restUrl}loopress-api/v1/image/${imageId}?width=${shape.width}&height=${shape.height}`,
  );
  const body = await res.json();
  if (!res.ok) throw new Error(body.message);
  return { ...shape, src: body.data_uri };
}

export default function App() {
  const imageId = new URLSearchParams(location.search).get("image") ?? "";
  const [shapes, setShapes] = useState<Shape[]>(presets);
  const [custom, setCustom] = useState<Shape>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    Promise.all(presets.map((shape) => resize(imageId, shape)))
      .then(setShapes)
      .catch((e: Error) => setError(e.message));
  }, [imageId]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const shape = { label: "Custom", width: Number(form.get("width")), height: Number(form.get("height")) };
    resize(imageId, shape).then(setCustom, (e: Error) => setError(e.message));
  }

  return (
    <div style={panel}>
      {error && <p style={{ color: "#cf222e", fontWeight: 600 }}>{error}</p>}
      <div id="presets" style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "flex-end" }}>
        {shapes.map((shape) => (
          <Tile key={shape.label} shape={shape} />
        ))}
      </div>
      <form onSubmit={onSubmit} style={{ display: "flex", gap: 12, alignItems: "center", margin: "28px 0 20px" }}>
        <input name="width" type="number" min={1} max={2000} required placeholder="Width" aria-label="Width" style={input} />
        <span>x</span>
        <input name="height" type="number" min={1} max={2000} required placeholder="Height" aria-label="Height" style={input} />
        <button type="submit" style={button}>Resize</button>
      </form>
      {custom && <Tile shape={custom} />}
    </div>
  );
}

function Tile({ shape }: { shape: Shape }) {
  return (
    <figure style={{ margin: 0 }}>
      <div style={{ width: shape.width, maxWidth: "100%", aspectRatio: `${shape.width} / ${shape.height}`, background: "#eaeef2", borderRadius: 8, overflow: "hidden" }}>
        {shape.src && <img src={shape.src} alt={`${shape.label}, ${shape.width}x${shape.height}`} style={{ display: "block", width: "100%" }} />}
      </div>
      <figcaption style={{ marginTop: 6, fontSize: 14, color: "#57606a" }}>
        {shape.label} · {shape.width}x{shape.height}
      </figcaption>
    </figure>
  );
}

const panel = { padding: 28, borderRadius: 16, background: "#fff", boxShadow: "0 8px 30px rgba(0,0,0,.08)" } as const;
const input = { width: 90, padding: "8px 10px", fontSize: 16, border: "1px solid #d0d7de", borderRadius: 8 } as const;
const button = { padding: "9px 18px", fontSize: 16, fontWeight: 600, color: "#fff", background: "#1f6feb", border: 0, borderRadius: 8, cursor: "pointer" } as const;
