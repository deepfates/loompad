interface Config {
  openRouterApiKey: string;
  isDevelopment: boolean;
}

function validateConfig(): Config {
  const openRouterApiKey = process.env.OPENROUTER_API_KEY;
  if (!openRouterApiKey) {
    // For development, use a placeholder key
    if (process.env.NODE_ENV === "development") {
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
    isDevelopment: process.env.NODE_ENV === "development",
  };
}

export const config = validateConfig();
