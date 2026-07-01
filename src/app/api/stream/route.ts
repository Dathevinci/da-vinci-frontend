import { NextResponse } from 'next/server';
import { ApifyClient } from 'apify-client';

export async function POST(req: Request) {
  try {
    const { query } = await req.json();

    if (!query) {
      return NextResponse.json({ error: "Missing anime query" }, { status: 400 });
    }

    const token = process.env.APIFY_TOKEN;
    if (!token || token === '<YOUR_API_TOKEN>') {
      return NextResponse.json({ 
        error: "APIFY_TOKEN is missing in the environment variables. Please add it to .env to enable streaming." 
      }, { status: 500 });
    }

    const client = new ApifyClient({ token });

    const input = {
      query: query,
      maxItems: 5 // Keep it low to prevent long actor runs
    };

    // Run the Actor and wait for it to finish
    // vXPR3Xr9ngzXxiccT is the actor ID provided by the user
    const run = await client.actor("vXPR3Xr9ngzXxiccT").call(input);

    if (!run || !run.defaultDatasetId) {
      return NextResponse.json({ error: "Failed to run Apify actor." }, { status: 500 });
    }

    // Fetch Actor results from the run's dataset
    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "No streaming results found for this anime." }, { status: 404 });
    }

    return NextResponse.json({ success: true, results: items });

  } catch (error: any) {
    console.error("Apify API Error:", error);
    return NextResponse.json({ error: error.message || "An error occurred while fetching streams." }, { status: 500 });
  }
}
