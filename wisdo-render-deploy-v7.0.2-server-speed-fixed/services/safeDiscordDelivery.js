export async function safeSendUserMessage({ user, interaction, content, files = [], ephemeralFallbackContent = '', logger = console, logContext = {} } = {}) {
  try {
    if (user?.send) {
      await user.send({ content, files });
      return { ok: true, method: 'dm' };
    }
  } catch (error) {
    logger?.warn?.('Discord DM delivery failed', { ...logContext, message: error.message });
  }

  try {
    if (interaction?.followUp) {
      await interaction.followUp({ content: ephemeralFallbackContent || content, files, ephemeral: true });
      return { ok: true, method: 'ephemeral_followup' };
    }
  } catch (error) {
    logger?.warn?.('Discord fallback delivery failed', { ...logContext, message: error.message });
  }

  return { ok: false, method: 'none' };
}
