import "dotenv/config";
import { REST, Routes } from "discord.js";
import { createCommandRegistry } from "../commands/index.js";
import { config } from "../config.js";
import { logger } from "../logger.js";

const missing = [];

if (!config.discordToken) missing.push("DISCORD_TOKEN");
if (!config.clientId) missing.push("CLIENT_ID");
if (!config.guildId) missing.push("GUILD_ID");

if (missing.length > 0) {
  console.error("Command registration halted. Missing:", missing.join(", "));
  process.exit(1);
}

const registry = createCommandRegistry({
  service: null,
  config,
  mt4SyncService: null,
  mt4CommandService: null,
  wisdoAnalysisService: null,
  wisdoMemoryService: null,
  botStoreService: null,
  discordSignalGridService: null,
  logger,
});

const body = registry.commands.map((command) => command.data.toJSON());

console.log(`Registry audit: ${registry.audit.commandCount} unique commands, ${registry.audit.modalCount || registry.modalMap.size} modal handlers.`);
console.log("Registering commands:");
for (const command of body) {
  console.log(`- /${command.name}`);
}

const rest = new REST({ version: "10" }).setToken(config.discordToken);

try {
  await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), {
    body,
  });

  logger.info("Command registration success", {
    guildId: config.guildId,
    commandCount: body.length,
  });

  console.log(`✅ Registered ${body.length} commands.`);
} catch (error) {
  console.error("Command registration failure:", error);
  process.exit(1);
}