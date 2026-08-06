import { NextRequest } from "next/server";
import unzipper from "unzipper";
import { Readable } from "stream";

// Cache for 30 days since covers never change
export const revalidate = 2592000;

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");

  if (!url || !url.startsWith("https://files.lnori.com/")) {
    return new Response("Invalid URL", { status: 400 });
  }

  try {
    const response = await fetch(url);
    if (!response.body) {
      throw new Error("No body in response");
    }

    // Convert Web ReadableStream to Node.js Readable
    const nodeStream = Readable.fromWeb(response.body as any);

    return new Promise<Response>((resolve, reject) => {
      let foundCover = false;

      nodeStream
        .pipe(unzipper.Parse())
        .on("entry", async (entry) => {
          const fileName = entry.path.toLowerCase();
          
          // Look for common cover image paths in EPUBs
          if (
            (fileName.includes("cover") && (fileName.endsWith(".jpg") || fileName.endsWith(".jpeg") || fileName.endsWith(".png"))) ||
            (fileName.includes("images/") && fileName.endsWith(".jpg")) // fallback to first image if no cover
          ) {
            if (foundCover) {
              entry.autodrain();
              return;
            }
            foundCover = true;
            
            try {
              const buffer = await entry.buffer();
              // Destroy the incoming fetch stream to save bandwidth
              nodeStream.destroy();
              
              const contentType = fileName.endsWith(".png") ? "image/png" : "image/jpeg";
              resolve(
                new Response(buffer, {
                  headers: {
                    "Content-Type": contentType,
                    "Cache-Control": "public, max-age=2592000, immutable",
                    "Access-Control-Allow-Origin": "*",
                  },
                })
              );
            } catch (e) {
              reject(e);
            }
          } else {
            entry.autodrain();
          }
        })
        .on("close", () => {
          if (!foundCover) {
            resolve(new Response("No cover found", { status: 404 }));
          }
        })
        .on("error", (err) => {
          if (!foundCover) {
            resolve(new Response("Error parsing zip: " + err.message, { status: 500 }));
          }
        });
    });
  } catch (error) {
    return new Response("Cover extraction failed", { status: 500 });
  }
}
