import fs from "fs";
import path from "path";

const DATA_DIR = path.resolve("./data/operator-desks");

function makeSafeChannelName(username, userId) {
  const cleaned = String(username || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

  return `desk-${cleaned || userId}`;
}

function readAllDeskRecords() {
  if (!fs.existsSync(DATA_DIR)) return [];

  const files = fs
    .readdirSync(DATA_DIR)
    .filter((file) => file.endsWith(".json"));

  const records = [];

  for (const file of files) {
    const fullPath = path.join(DATA_DIR, file);

    try {
      const record = JSON.parse(fs.readFileSync(fullPath, "utf8"));
      records.push({
        file,
        path: fullPath,
        ...record,
      });
    } catch (err) {
      records.push({
        file,
        path: fullPath,
        badJson: true,
        error: err.message,
      });
    }
  }

  return records;
}

function writeDeskRecord(record) {
  const cleanRecord = { ...record };

  delete cleanRecord.file;
  delete cleanRecord.path;
  delete cleanRecord.badJson;
  delete cleanRecord.error;

  fs.writeFileSync(record.path, JSON.stringify(cleanRecord, null, 2));
}

export async function renameDesksFromRecords(interaction) {
  const ownerId = process.env.OWNER_USER_ID;

  if (ownerId && interaction.user.id !== ownerId) {
    return interaction.reply({
      content: "❌ Only the WISDO owner can rename all desks.",
      ephemeral: true,
    });
  }

  const dryRun =
    interaction.options.getBoolean("dry_run") ??
    interaction.options.getBoolean("dryrun") ??
    true;

  await interaction.reply({
    content: dryRun
      ? "🔎 Desk rename dry run started. No channels will be renamed."
      : "🏷️ Desk rename started. Channels will be renamed from saved records.",
    ephemeral: true,
  });

  const guild = interaction.guild;
  const records = readAllDeskRecords();

  let checked = 0;
  let alreadyCorrect = 0;
  let wouldRename = 0;
  let renamed = 0;
  let missingChannel = 0;
  let badRecords = 0;
  const preview = [];

  for (const record of records) {
    checked++;

    if (record.badJson) {
      badRecords++;
      preview.push(`❌ Bad JSON: ${record.file}`);
      continue;
    }

    if (!record.userId || !record.channelId) {
      badRecords++;
      preview.push(`❌ Missing userId/channelId: ${record.file}`);
      continue;
    }

    const username =
      record.username ||
      record.tag?.split("#")[0] ||
      record.displayName ||
      record.userId;

    const expectedName = makeSafeChannelName(username, record.userId);

    const channel = await guild.channels
      .fetch(record.channelId)
      .catch(() => null);

    if (!channel) {
      missingChannel++;
      preview.push(`⚠️ Missing channel for ${username} — ${record.channelId}`);
      continue;
    }

    if (channel.name === expectedName) {
      alreadyCorrect++;
      continue;
    }

    wouldRename++;

    preview.push(`🏷️ ${channel.name} → ${expectedName}`);

    if (!dryRun) {
      await channel.setName(
        expectedName,
        `WISDO rename desk from saved record for ${username}`
      );

      record.channelName = expectedName;
      record.renamedAt = new Date().toISOString();

      writeDeskRecord(record);

      renamed++;
    }
  }

  const previewText = preview.length
    ? preview.slice(0, 25).join("\n")
    : "No rename changes needed.";

  const moreText =
    preview.length > 25
      ? `\n...and ${preview.length - 25} more.`
      : "";

  return interaction.followUp({
    content:
      `✅ **Desk Rename ${dryRun ? "Dry Run" : "Complete"}**\n\n` +
      `Records checked: ${checked}\n` +
      `Already correct: ${alreadyCorrect}\n` +
      `Would rename: ${wouldRename}\n` +
      `Renamed: ${renamed}\n` +
      `Missing channels: ${missingChannel}\n` +
      `Bad records: ${badRecords}\n\n` +
      `**Preview:**\n${previewText}${moreText}\n\n` +
      `Deleted data: 0`,
    ephemeral: true,
  });
}