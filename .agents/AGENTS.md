# Anime Likes Fetching Rule

When fetching a user's liked anime, ALWAYS use the /api/users/username/[username] endpoint and extract data.data.likes. Do NOT use the /api/likes/[userId] endpoint as it does not return the correct data and causes inconsistencies between the private dashboard and public profile.
