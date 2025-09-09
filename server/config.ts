interface Config {
  openRouterApiKey: string;
  isDevelopment: boolean;
}

function validateConfig(): Config {
  const openRouterApiKey = process.env.OPENROUTER_API_KEY;
  if (!openRouterApiKey) {
    // Treat any non-production environment as development
    if (process.env.NODE_ENV !== "production") {
      console.warn("⚠️ Using placeholder OpenRouter API key for development");
      return {
        openRouterApiKey: "sk-or-placeholder-key",
        isDevelopment: true,
      };
    }
    throw new Error("OPENROUTER_API_KEY environment variable is required");
  }

  return {
    openRouterApiKey,
    isDevelopment: process.env.NODE_ENV !== "production",
  };
}

export const config = validateConfig();
