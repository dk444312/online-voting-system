import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  const { email, token } = await req.json();

  if (!email || !token) {
    return new Response("Missing email or token", { status: 400 });
  }

  const APP_URL = Deno.env.get("APP_URL") || "http://localhost:3000";
  const verifyUrl = `${APP_URL.replace(/\/$/, "")}/verify-email?token=${token}`;

  const RESEND_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_KEY) {
    return new Response("RESEND_API_KEY not set", { status: 500 });
  }

  const html = `
    <div style="font-family: Arial; max-width: 500px; margin: auto; padding: 20px; border: 1px solid #eee;">
      <h2>CUNIMA Voting</h2>
      <p>Click below to verify your email:</p>
      <p style="text-align: center; margin: 30px 0;">
        <a href="${verifyUrl}"
           style="background: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 8px;">
          Verify Email
        </a>
      </p>
      <p style="font-size: 12px; color: #666;">
        Expires in 15 minutes.
      </p>
    </div>
  `;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "CUNIMA Voting <no-reply@campusvote.com>",
      to: email,
      subject: "Verify Your Email",
      html,
    }),
  });

  if (!res.ok) {
    console.error(await res.text());
    return new Response("Email failed", { status: 500 });
  }

  return new Response(JSON.stringify({ success: true }), { status: 200 });
});