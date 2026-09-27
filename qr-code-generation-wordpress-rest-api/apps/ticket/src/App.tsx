import { useEffect, useState } from "react";

// Set by the [loopress_app name="ticket"] shortcode: where the REST API lives, and a
// nonce so fetch() runs as the logged-in visitor.
export const config = (globalThis as { loopressApp_ticket?: { mount: string; restUrl: string; restNonce: string } })
  .loopressApp_ticket;

type State = { qr?: string; error?: string };

export default function App() {
  const ticketId = new URLSearchParams(location.search).get("ticket");
  const [state, setState] = useState<State>({});

  useEffect(() => {
    fetch(`${config!.restUrl}loopress-api/v1/ticket-qr/${ticketId}`, {
      headers: { "X-WP-Nonce": config!.restNonce },
    })
      .then(async (res) => {
        const body = await res.json();
        setState(res.ok ? { qr: body.data_uri } : { error: body.message });
      })
      .catch(() => setState({ error: "Could not load this ticket." }));
  }, [ticketId]);

  return (
    <div style={card}>
      <h2 style={{ margin: "0 0 4px" }}>Ticket #{ticketId}</h2>
      <p style={{ margin: "0 0 20px", color: "#57606a" }}>Show this code at the door</p>
      {state.qr && <img src={state.qr} alt={`QR code for ticket ${ticketId}`} width={300} height={300} />}
      {state.error && <p style={{ color: "#cf222e", fontWeight: 600 }}>{state.error}</p>}
    </div>
  );
}

const card = {
  maxWidth: 420,
  margin: "0 auto",
  padding: 32,
  borderRadius: 16,
  textAlign: "center",
  background: "#fff",
  boxShadow: "0 8px 30px rgba(0,0,0,.08)",
} as const;
