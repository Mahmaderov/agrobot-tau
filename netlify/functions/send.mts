declare const Netlify: { env: { get(name: string): string | undefined } };
// Агробот ТАУ — пересылка заявок в группу агрономов Telegram.
// Токен и номер группы задаются в Netlify: Site configuration → Environment variables
//   BOT_TOKEN — токен бота от @BotFather
//   CHAT_ID   — номер группы агрономов (начинается с -100…)

const MAX_PHOTOS = 3;

export default async (req: Request) => {
  if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);
  const TOKEN = Netlify.env.get("BOT_TOKEN"), CHAT = Netlify.env.get("CHAT_ID");
  if (!TOKEN || !CHAT) return json({ ok: false, error: "not configured" }, 500);

  let d: any;
  try { d = await req.json(); } catch { return json({ ok: false, error: "bad request" }, 400); }

  const text = String(d.text || "").slice(0, 3500);
  const phone = String(d.phone || "").replace(/\D/g, "");
  if (text.length < 10 || phone.length < 9) return json({ ok: false, error: "invalid" }, 400);

  const api = `https://api.telegram.org/bot${TOKEN}/`;
  const first = await fetch(api + "sendMessage", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: CHAT, text })
  }).then((r) => r.json()).catch(() => ({ ok: false }));
  if (!first.ok) return json({ ok: false, error: "telegram" }, 502);

  const photos = (Array.isArray(d.photos) ? d.photos : []).slice(0, MAX_PHOTOS);
  if (photos.length) {
    const fd = new FormData();
    fd.append("chat_id", CHAT);
    fd.append("reply_to_message_id", String(first.result.message_id));
    const blob = (b64: string) => new Blob([Buffer.from(String(b64), "base64")], { type: "image/jpeg" });
    if (photos.length === 1) {
      fd.append("photo", blob(photos[0]), "photo1.jpg");
      await fetch(api + "sendPhoto", { method: "POST", body: fd }).catch(() => {});
    } else {
      fd.append("media", JSON.stringify(photos.map((_: unknown, i: number) => ({ type: "photo", media: `attach://p${i}` }))));
      photos.forEach((p: string, i: number) => fd.append(`p${i}`, blob(p), `photo${i + 1}.jpg`));
      await fetch(api + "sendMediaGroup", { method: "POST", body: fd }).catch(() => {});
    }
  }
  return json({ ok: true });
};

const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });

export const config = { path: "/api/send" };
