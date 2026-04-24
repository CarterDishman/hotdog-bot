require("dotenv").config();

const { REST, Routes, SlashCommandBuilder } = require("discord.js");

const commands = [
  new SlashCommandBuilder()
  .setName("submit")
  .setDescription("Submit a hotdog contest entry")
  .addNumberOption(option =>
    option.setName("hotdogs").setDescription("Number of hotdogs eaten").setRequired(true)
  )
  .addNumberOption(option =>
    option.setName("price").setDescription("Price of the dogs").setRequired(true)
  )
  .addNumberOption(option =>
    option.setName("distance").setDescription("Distance from home in miles").setRequired(true)
  )
  .addStringOption(option =>
    option.setName("type").setDescription("Type of dog").setRequired(true)
  )

  // NEW 👇
  .addNumberOption(option =>
    option
      .setName("stars")
      .setDescription("Stars")
      .setRequired(false)
  )
  .addStringOption(option =>
    option
      .setName("notes")
      .setDescription("Optional notes about the experience")
      .setRequired(false)
  ),

new SlashCommandBuilder()
  .setName("help")
  .setDescription("Show all GlizzyBot commands"),

new SlashCommandBuilder()
  .setName("last")
  .setDescription("Show your most recent submission"),

new SlashCommandBuilder()
  .setName("delete")
  .setDescription("Delete your most recent submission"),



  new SlashCommandBuilder()
    .setName("scoreboard")
    .setDescription("Show the hotdog scoreboard"),

new SlashCommandBuilder()
  .setName("records")
  .setDescription("Show current hotdog contest records"),

  new SlashCommandBuilder()
    .setName("mystats")
    .setDescription("Show your personal hotdog stats"),
].map(command => command.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

async function deployCommands() {
  try {
    console.log("CLIENT_ID:", process.env.CLIENT_ID);
    console.log("GUILD_ID:", process.env.GUILD_ID);
    console.log("Commands being registered:", commands.map(c => c.name));

    console.log("Clearing old global commands...");
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: [] }
    );

    console.log("Registering guild slash commands...");
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );

    console.log("✅ Slash commands registered!");
  } catch (error) {
    console.error("❌ Error registering commands:");
    console.error(error);
  }
}

deployCommands();