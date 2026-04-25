
const { Client, GatewayIntentBits } = require("discord.js");
const { Pool } = require("pg");


const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

const HOTDOG_GIFS = [
  "https://media.giphy.com/media/ebPX2n2kvJHOM/giphy.gif",
  "https://media.giphy.com/media/xT8qB4HFqftRrLUpkQ/giphy.gif",
  "https://media.giphy.com/media/3T5wJtXxY7jD1U5QRq/giphy.gif",
  "https://media.giphy.com/media/W3NsNTTR1Zh23hWxR4/giphy.gif",
  "https://media.giphy.com/media/l49JZsJ57fBfyL5Xq/giphy.gif",
  "https://media.giphy.com/media/odcCgOkBew092GRc2D/giphy.gif",
  "https://media.giphy.com/media/wPKZ5Ud28wBJ6/giphy.gif",
  "https://media.giphy.com/media/nclBrU1D6CEEw/giphy.gif",
  "https://media.giphy.com/media/AUlNi9YCtzSnu/giphy.gif",
  "https://media.giphy.com/media/xT8qB4HFqftRrLUpkQ/giphy.gif",
  "https://media.giphy.com/media/cKVpzbAjNvZRciP7Qt/giphy.gif",
  "https://media.giphy.com/media/vZofZbbHzygxabGOck/giphy.gif",
  "https://media.giphy.com/media/4UyTGOohjQX64UuSvc/giphy.gif",
  "https://media.giphy.com/media/5He16eTgpabyeEQ9t6/giphy.gif",
  "https://media.giphy.com/media/14ebDjIY0awlt6/giphy.gif",
  "https://media.giphy.com/media/5E7vDOIamcWlzg97TG/giphy.gif",
  "https://media.giphy.com/media/aoF0MQK5t2kia3aqk8/giphy.gif",
  "https://media.giphy.com/media/Y4GerX1gMExqPj69p1/giphy.gif",
  "https://media.giphy.com/media/xs3qjhLVU2gKMfFAWV/giphy.gif",
  "https://media.giphy.com/media/eOkhXuornySWs/giphy.gif",
  "https://media.giphy.com/media/d8p7Yv6PojSLed06bq/giphy.gif",
  "https://media.giphy.com/media/zzHjALXvIDl3a/giphy.gif"
];


require("dotenv").config();



const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});


function buildHelp() {
  return (
    `🌭 **GlizzyBot Commands** 🌭\n\n` +
    `**/submit** — Submit a hotdog entry\n` +
    `**/scoreboard** — Show total hotdogs leaderboard\n` +
    `**/records** — Show current contest records\n` +
    `**/stats** — Show whole competition stats\n` +
    `**/mystats** — Show your personal stats\n` +
    `**/last** — Show your most recent submission\n` +
    `**/delete** — Delete your most recent submission\n`
  );
}

async function getLastSubmission(username) {
  const result = await pool.query(
    `
    SELECT
      id,
      user_name AS user,
      hotdogs,
      price,
      distance,
      type,
      rating,
      notes,
      date
    FROM submissions
    WHERE user_name = $1
    ORDER BY date DESC
    LIMIT 1
    `,
    [username]
  );

  return result.rows[0] || null;
}

function findPassedUsers(before, after, submitterId) {
  const beforeRanks = {};
  const afterRanks = {};

  before.forEach((user, index) => {
    beforeRanks[user.discordId] = index + 1;
  });

  after.forEach((user, index) => {
    afterRanks[user.discordId] = index + 1;
  });

  const submitterOldRank = beforeRanks[submitterId];
  const submitterNewRank = afterRanks[submitterId];

  if (!submitterNewRank) return [];

  const passed = [];

  for (const user of before) {
    if (user.discordId === submitterId) continue;

    const userOldRank = beforeRanks[user.discordId];
    const userNewRank = afterRanks[user.discordId];

    if (
      submitterOldRank &&
      userOldRank < submitterOldRank &&
      userNewRank > submitterNewRank
    ) {
      passed.push(user);
    }
  }

  return passed;
}
function buildRankings(submissions) {
  const totals = {};

  for (const sub of submissions) {
    if (!sub.discord_id) continue; // skip old data

    if (!totals[sub.discord_id]) {
      totals[sub.discord_id] = {
        user: sub.user,
        discordId: sub.discord_id,
        hotdogs: 0,
      };
    }

    totals[sub.discord_id].hotdogs += sub.hotdogs;
  }

  return Object.values(totals).sort((a, b) => b.hotdogs - a.hotdogs);
}

function formatSubmission(submission) {
  if (!submission) {
    return "🌭 No submissions found.";
  }

  return (
    `🌭 **Most Recent Submission** 🌭\n\n` +
    `**Hotdogs:** ${submission.hotdogs}\n` +
    `**Price:** $${Number(submission.price).toFixed(2)}\n` +
    `**Distance:** ${submission.distance} miles\n` +
    `**Type:** ${submission.type}\n` +
    (submission.rating !== null ? `⭐ **Stars:** ${submission.rating}\n` : "") +
    (submission.notes ? `📝 **Notes:** ${submission.notes}\n` : "")
  );
}

async function deleteLastSubmission(username) {
  const result = await pool.query(
    `
    DELETE FROM submissions
    WHERE id = (
      SELECT id
      FROM submissions
      WHERE user_name = $1
      ORDER BY date DESC
      LIMIT 1
    )
    RETURNING
      id,
      user_name AS user,
      hotdogs,
      price,
      distance,
      type,
      rating,
      notes,
      date
    `,
    [username]
  );

  return result.rows[0] || null;
}

async function buildRecords() {
  const submissions = await getSubmissions();

  if (submissions.length === 0) {
    return "🌭 No records yet!";
  }

  const mostExpensive = submissions.reduce((max, sub) =>
    sub.price > max.price ? sub : max
  );

  const mostDogs = submissions.reduce((max, sub) =>
    sub.hotdogs > max.hotdogs ? sub : max
  );

  const furthest = submissions.reduce((max, sub) =>
    sub.distance > max.distance ? sub : max
  );

  const ratedSubmissions = submissions.filter(sub => sub.rating !== null);

  const highestRated =
    ratedSubmissions.length > 0
      ? ratedSubmissions.reduce((max, sub) =>
          sub.rating > max.rating ? sub : max
        )
      : null;

  return (
    `🏆 **Current Glizzy Records** 🏆\n\n` +

    `💰 **Most Expensive Dog Run**\n` +
    `${mostExpensive.user} — $${mostExpensive.price.toFixed(2)} for ${mostExpensive.type}\n\n` +

    `🌭 **Most Dogs in One Submission**\n` +
    `${mostDogs.user} — ${mostDogs.hotdogs} dogs (${mostDogs.type})\n\n` +

    `🚶 **Furthest From Home**\n` +
    `${furthest.user} — ${furthest.distance} miles for ${furthest.type}\n\n` +

    (highestRated
      ? `⭐ **Highest Rated Dog**\n` +
        `${highestRated.user} — ${highestRated.rating} stars (${highestRated.type})`
      : `⭐ **Highest Rated Dog**\nNo rated submissions yet.`)
  );
}

async function getSubmissions() {
  const result = await pool.query(`
    SELECT
      id,
      user_name AS user,
      hotdogs,
discord_id,
      price,
      distance,
      type,
      rating,
      notes,
      date
    FROM submissions
    ORDER BY date ASC
  `);

  return result.rows;
}

async function addSubmission(entry) {
  await pool.query(
    `
    INSERT INTO submissions
  (user_name, discord_id, hotdogs, price, distance, type, rating, notes, date)
VALUES
  ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `,
    [
      entry.user,
      entry.discordId,
      entry.hotdogs,
      entry.price,
      entry.distance,
      entry.type,
      entry.rating,
      entry.notes,
      entry.date,
    ]
  );
}

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS submissions (
  id SERIAL PRIMARY KEY,
  user_name TEXT,
  discord_id TEXT,
  hotdogs INT,
  price FLOAT,
  distance FLOAT,
  type TEXT,
  rating FLOAT,
  notes TEXT,
  date TIMESTAMP
);
  `);
}




function validateSubmission({ hotdogs, price, distance, type, rating }) {
  const errors = [];

  if (!Number.isFinite(hotdogs) || hotdogs <= 0) {
    errors.push("Hotdogs must be greater than 0.");
  }

if (hotdogs > 1000) {
  errors.push("Hotdogs must be 1,000 or less. Please stop breaking GlizzyBot.");
}

  if (!Number.isInteger(hotdogs)) {
    errors.push("Hotdogs must be a whole number.");
  }

  if (rating !== null && !Number.isFinite(rating)) {
    errors.push("Stars must be a number.");
  }

  if (!Number.isFinite(price) || price < 0) {
    errors.push("Price must be $0 or more.");
  }

  if (!Number.isFinite(distance) || distance < 0) {
    errors.push("Distance must be 0 miles or more.");
  }

  if (!type || type.trim().length < 2) {
    errors.push("Type of dog must be at least 2 characters.");
  }

  return errors;
}

function getRandomGif() {
  return HOTDOG_GIFS[Math.floor(Math.random() * HOTDOG_GIFS.length)];
}

function checkBrokenRecords(newEntry, previousSubmissions) {
  const records = [];

  if (previousSubmissions.length === 0) {
    records.push("🏆 First official submission!");
    return records;
  }


 const mostExpensive = Math.max(...previousSubmissions.map(s => s.price));
const mostDogs = Math.max(...previousSubmissions.map(s => s.hotdogs));
const furthest = Math.max(...previousSubmissions.map(s => s.distance));

const highestRated = Math.max(
  ...previousSubmissions
    .filter(s => s.rating !== null)
    .map(s => s.rating),
  -Infinity
);
  if (newEntry.price > mostExpensive) {
    records.push(`💰 New most expensive dog purchase $${newEntry.price.toFixed(2)}!`);
  }

  if (newEntry.hotdogs > mostDogs) {
    records.push(`🌭 New single-submission hotdog record: ${newEntry.hotdogs} dogs!`);
  }

  if (newEntry.distance > furthest) {
    records.push(`🚶 New furthest glizzy pilgrimage: ${newEntry.distance} miles!`);
  }

if (newEntry.rating !== null && newEntry.rating > highestRated) {
  records.push(`⭐ New highest rated dog: ${newEntry.rating} stars!`);
}

  return records;
}

async function buildUserStats(username) {
  const submissions = await getSubmissions();

  const userSubs = submissions.filter(sub => sub.user === username);

  if (userSubs.length === 0) {
    return "🌭 You have no submissions yet!";
  }

  const totalDogs = userSubs.reduce((sum, sub) => sum + sub.hotdogs, 0);
  const totalSpent = userSubs.reduce((sum, sub) => sum + sub.price, 0);
  const totalDistance = userSubs.reduce((sum, sub) => sum + sub.distance, 0);

  return (
    `🌭 **Your Hotdog Stats** 🌭\n\n` +
    `**Total dogs:** ${totalDogs}\n` +
    `**Submissions:** ${userSubs.length}\n` +
    `**Total spent:** $${totalSpent.toFixed(2)}\n` +
    `**Avg price per dog:** $${(totalSpent / totalDogs).toFixed(2)}\n` +
    `**Avg distance:** ${(totalDistance / userSubs.length).toFixed(2)} miles`
  );
}
async function buildGlobalStats() {
  const submissions = await getSubmissions();

  if (submissions.length === 0) {
    return "🌭 No submissions yet!";
  }

  const totalDogs = submissions.reduce((sum, s) => sum + s.hotdogs, 0);
  const totalSpent = submissions.reduce((sum, s) => sum + s.price, 0);
  const totalDistance = submissions.reduce((sum, s) => sum + s.distance, 0);

  const avgPrice = totalSpent / submissions.length;
  const avgDistance = totalDistance / submissions.length;

  // ⭐ ratings (only count ones that exist)
  const rated = submissions.filter(s => s.rating !== null);
  const avgRating =
    rated.length > 0
      ? rated.reduce((sum, s) => sum + s.rating, 0) / rated.length
      : null;

  // 🌭 most popular type
  const typeCounts = {};
  for (const s of submissions) {
    typeCounts[s.type] = (typeCounts[s.type] || 0) + 1;
  }

  const mostPopularType = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])[0][0];

  return (
    `🌭 **Competition Stats** 🌭\n\n` +
    `**Total submissions:** ${submissions.length}\n` +
    `**Total hotdogs eaten:** ${totalDogs}\n` +
    `**Total spent:** $${totalSpent.toFixed(2)}\n` +
    `**Average price per run:** $${avgPrice.toFixed(2)}\n` +
    `**Average distance:** ${avgDistance.toFixed(2)} miles\n` +
    `**Most popular type:** ${mostPopularType}\n` +
    (avgRating !== null
      ? `⭐ **Average stars:** ${avgRating.toFixed(2)}\n`
      : "")
  );
}

async function buildScoreboard() {
  const submissions = await getSubmissions();

  if (submissions.length === 0) {
    return "🌭 No submissions yet!";
  }

  const totals = {};

  for (const sub of submissions) {
    if (!totals[sub.user]) {
      totals[sub.user] = { hotdogs: 0, submissions: 0 };
    }

    totals[sub.user].hotdogs += sub.hotdogs;
    totals[sub.user].submissions += 1;
  }

  const leaderboard = Object.entries(totals)
    .sort((a, b) => b[1].hotdogs - a[1].hotdogs)
    .map(([user, data], index) => {
      let medal = "";
      if (index === 0) medal = "🥇";
      else if (index === 1) medal = "🥈";
      else if (index === 2) medal = "🥉";

      return `${medal} ${index + 1}. ${user} — ${data.hotdogs} dogs (${data.submissions} submissions)`;
    })
    .join("\n");

  return `🌭 **Hotdog Scoreboard** 🌭\n\n${leaderboard}`;
}

client.once("ready", async () => {
  try {
    console.log(`✅ Logged in as ${client.user.tag}`);

    await initDB();
    console.log("📦 Database initialized");

  } catch (err) {
    console.error("❌ DB init failed:", err);
  }
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

if (interaction.commandName === "help") {
  return interaction.reply(buildHelp());
}

if (interaction.commandName === "last") {
  const lastSubmission = await getLastSubmission(interaction.user.username);
  return interaction.reply(formatSubmission(lastSubmission));
}

if (interaction.commandName === "delete") {
  const deletedSubmission = await deleteLastSubmission(interaction.user.username);

  if (!deletedSubmission) {
    return interaction.reply("🌭 You have no submissions to delete.");
  }

  return interaction.reply(
    `🗑️ Deleted your most recent submission:\n\n` +
    formatSubmission(deletedSubmission)
  );
}



if (interaction.commandName === "records") {
  return interaction.reply(await buildRecords());
}

  try {
    if (interaction.commandName === "submit") {
      const hotdogs = interaction.options.getNumber("hotdogs");
      const price = interaction.options.getNumber("price");
      const distance = interaction.options.getNumber("distance");
      const type = interaction.options.getString("type").trim();
      const rating = interaction.options.getNumber("stars");
      const notes = interaction.options.getString("notes");

      const errors = validateSubmission({ hotdogs, price, distance, type, rating });

      if (errors.length > 0) {
        return interaction.reply({
          content: "❌ Submission rejected:\n" + errors.map(e => `- ${e}`).join("\n"),
          ephemeral: true,
        });
      }

      const entry = {
  user: interaction.user.username,
  discordId: interaction.user.id,
  hotdogs,
  price,
  distance,
  type,
  rating: rating ?? null,
  notes: notes ?? null,
  date: new Date().toISOString(), // ← THIS is your timestamp
};

     const beforeSubmissions = await getSubmissions();
const beforeRankings = buildRankings(beforeSubmissions);

const brokenRecords = checkBrokenRecords(entry, beforeSubmissions);

await addSubmission(entry);

const afterSubmissions = await getSubmissions();
const afterRankings = buildRankings(afterSubmissions);

const passedUsers = findPassedUsers(
  beforeRankings,
  afterRankings,
  interaction.user.id
);
        const gif = getRandomGif();

return interaction.reply({
  content:
    `🌭 Submission recorded!\n\n` +
    `**Hotdogs:** ${entry.hotdogs}\n` +
    `**Price:** $${entry.price.toFixed(2)}\n` +
    `**Distance:** ${entry.distance} miles\n` +
    `**Type:** ${entry.type}\n` +
    (entry.rating !== null ? `⭐ **Stars:** ${entry.rating}\n` : "") +
    (entry.notes ? `📝 **Notes:** ${entry.notes}\n` : "") +
    (brokenRecords.length > 0
      ? `\n🏆 **New Record${brokenRecords.length > 1 ? "s" : ""}!**\n` +
        brokenRecords.map(r => `- ${r}`).join("\n")
      : "") +
    (passedUsers.length > 0
      ? `\n\n🔥 **Scoreboard Alert!**\n` +
        passedUsers
          .map(user => `<@${user.discordId}> just got passed by <@${interaction.user.id}>.`)
          .join("\n")
      : ""),

  embeds: [
    {
      image: {
        url: gif,
      },
    },
  ],
});

    }

    if (interaction.commandName === "stats") {
      return interaction.reply(await buildGlobalStats());
    }

    if (interaction.commandName === "scoreboard") {
      return interaction.reply(await buildScoreboard());
    }

    if (interaction.commandName === "mystats") {
      return interaction.reply(await buildUserStats(interaction.user.username));
    }
  } catch (error) {
    console.error(error);

    if (!interaction.replied) {
      return interaction.reply({
        content: "❌ Something broke",
        ephemeral: true,
      });
    }
  }
});

client.login(process.env.DISCORD_TOKEN);