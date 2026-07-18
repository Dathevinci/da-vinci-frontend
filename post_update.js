const fetch = require("node-fetch");

async function run() {
  try {
    const API_URL = "http://localhost:5000";
    
    // Get dejavuh's ID
    const userRes = await fetch(`${API_URL}/api/users/username/dejavuh`);
    const userData = await userRes.json();
    
    if (!userData.success || !userData.data) {
      console.log("Could not find user dejavuh");
      return;
    }
    
    const userId = userData.data.id;
    console.log("Found dejavuh with ID:", userId);
    
    // Post update
    const content = `
## Level System & Arise Points

We've overhauled the progression system to reward active users! Here's how it works:
- **Level System**: You gain EXP by watching anime, engaging with the community, and completing specific milestones. As you level up, you unlock new customizable options for your profile.
- **Arise Points**: A new premium currency that you earn from leveling up and completing special tasks. You can use Arise Points in the upcoming shop to buy exclusive banners, badges, and effects.

## The Watcher Role

We are introducing **The Watcher** role! This is an exclusive, highly sought-after role reserved only for our earliest supporters. 
**IMPORTANT**: This role will become completely unobtainable once the beta phase of the website ends. It is a badge of honor to show you were here from the very beginning. Grab it while you can!
    `.trim();

    const updateRes = await fetch(`${API_URL}/api/announcements`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        title: "Level System, Arise Points, and The Watcher Role",
        content,
        tag: "Platform Updates",
        image: null
      })
    });
    
    const updateData = await updateRes.json();
    console.log("Update response:", updateData);
  } catch (err) {
    console.error("Error:", err);
  }
}

run();
