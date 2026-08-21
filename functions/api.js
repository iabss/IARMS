export async function onRequest(context) {
  const { request } = context;

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyWqHvGuhMZiZo0luz3avtesqza3y5RLaUsUGym5v32dKPjU_daFFguwuwr62tgTAM_GQ/exec";

  try {
    if (request.method === "POST") {
      const body = await request.text();
      const response = await fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        body: body,
        headers: { "Content-Type": "application/json" }
      });
      const result = await response.json();
      return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (request.method === "GET") {
      const response = await fetch(GOOGLE_SCRIPT_URL);
      const result = await response.json();
      return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: err.toString() }), { status: 500, headers: corsHeaders });
  }
}
