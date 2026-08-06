import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");

  if (!url || !url.startsWith("https://files.lnori.com/")) {
    return new Response("Invalid URL", { status: 400 });
  }

  try {
    const headers = new Headers();
    const range = req.headers.get("range");
    if (range) {
      headers.set("Range", range);
    }

    const response = await fetch(url, { headers });

    const proxyHeaders = new Headers();
    proxyHeaders.set("Access-Control-Allow-Origin", "*");
    proxyHeaders.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    proxyHeaders.set("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges");
    
    if (response.headers.has("Content-Type")) {
      proxyHeaders.set("Content-Type", response.headers.get("Content-Type") as string);
    }
    if (response.headers.has("Content-Length")) {
      proxyHeaders.set("Content-Length", response.headers.get("Content-Length") as string);
    }
    if (response.headers.has("Content-Range")) {
      proxyHeaders.set("Content-Range", response.headers.get("Content-Range") as string);
    }
    if (response.headers.has("Accept-Ranges")) {
      proxyHeaders.set("Accept-Ranges", response.headers.get("Accept-Ranges") as string);
    }

    return new Response(response.body, {
      status: response.status,
      headers: proxyHeaders,
    });
  } catch (error) {
    return new Response("Proxy Error", { status: 500 });
  }
}

export async function OPTIONS() {
  const headers = new Headers();
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Range, Content-Type");
  return new Response(null, { status: 204, headers });
}
