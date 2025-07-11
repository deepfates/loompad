const STARTERS_URL = '/api/story-starters';

// Cache for story starters to avoid repeated fetches
let startersCache: string[] | null = null;
let cacheTimestamp: number | null = null;
let refreshInterval: ReturnType<typeof setInterval> | null = null;

// Cache duration in milliseconds (5 minutes)
const CACHE_DURATION = 5 * 60 * 1000;

/**
 * Checks if the cache is stale based on timestamp
 * @returns boolean True if cache should be refreshed
 */
function isCacheStale(): boolean {
  if (!cacheTimestamp) return true;
  return Date.now() - cacheTimestamp > CACHE_DURATION;
}

/**
 * Fetches story starters from the remote URL
 * @param forceRefresh If true, ignores cache and fetches fresh data
 * @returns Promise<string[]> Array of story starters
 */
async function fetchStoryStarters(forceRefresh = false): Promise<string[]> {
  // If we have a fresh cache and not forcing refresh, return it
  if (!forceRefresh && startersCache && !isCacheStale()) {
    console.log('Using cached story starters:');
    startersCache.forEach((starter, index) => {
      console.log(`  ${index + 1}. "${starter}"`);
    });
    return startersCache;
  }

  try {
    console.log('Fetching fresh story starters from:', STARTERS_URL);
    const response = await fetch(STARTERS_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch starters: ${response.status}`);
    }
    
    const text = await response.text();
    const starters = text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    
    // Update cache with fresh data
    startersCache = starters;
    cacheTimestamp = Date.now();
    console.log('Story starters cache updated with', starters.length, 'entries:');
    starters.forEach((starter, index) => {
      console.log(`  ${index + 1}. "${starter}"`);
    });
    
    return starters;
  } catch (error) {
    console.warn('Failed to fetch story starters:', error);
    
    // If we have old cached data, use it
    if (startersCache && startersCache.length > 0) {
      console.log('Using stale cached story starters due to fetch failure:');
      startersCache.forEach((starter, index) => {
        console.log(`  ${index + 1}. "${starter}"`);
      });
      return startersCache;
    }
    
    // Ultimate fallback to default starters
    console.log('Using default fallback starters');
    const fallbackStarters = [
      'Once upon a time',
      'The first time I',
      'The craziest thing that happened to me was',
      'My favorite pizza flavor is'
    ];
    
    // Cache the fallback starters
    startersCache = fallbackStarters;
    cacheTimestamp = Date.now();
    console.log('Using fallback story starters:');
    fallbackStarters.forEach((starter, index) => {
      console.log(`  ${index + 1}. "${starter}"`);
    });
    
    return fallbackStarters;
  }
}

/**
 * Gets a random story starter, fetching from remote if not cached or stale
 * @param forceRefresh If true, forces a fresh fetch from remote
 * @returns Promise<string> A random story starter
 */
export async function getRandomStoryStarter(forceRefresh = false): Promise<string> {
  const starters = await fetchStoryStarters(forceRefresh);
  
  if (starters.length === 0) {
    return 'Once upon a time'; // Ultimate fallback
  }
  
  const randomIndex = Math.floor(Math.random() * starters.length);
  return starters[randomIndex];
}

/**
 * Gets a random story starter synchronously using cached data
 * If no cache exists, returns a default starter
 * @returns string A random story starter
 */
export function getRandomStoryStarterSync(): string {
  if (!startersCache || startersCache.length === 0) {
    return 'Once upon a time';
  }
  
  const randomIndex = Math.floor(Math.random() * startersCache.length);
  return startersCache[randomIndex];
}

/**
 * Starts the background refresh timer
 */
function startBackgroundRefresh(): void {
  // Clear existing interval if any
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
  
  // Set up interval to refresh every 5 minutes
  refreshInterval = setInterval(async () => {
    console.log('Background refresh: Updating story starters cache...');
    try {
      await fetchStoryStarters(true);
    } catch (error) {
      console.warn('Background refresh failed:', error);
    }
  }, CACHE_DURATION);
  
  console.log('Background refresh timer started (5 minute intervals)');
}

/**
 * Stops the background refresh timer
 */
function stopBackgroundRefresh(): void {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
    console.log('Background refresh timer stopped');
  }
}

/**
 * Preloads story starters into cache and starts background refresh
 * Call this early in the application lifecycle
 * @param forceRefresh If true, forces a fresh fetch from remote
 */
export async function preloadStoryStarters(forceRefresh = false): Promise<void> {
  try {
    await fetchStoryStarters(forceRefresh);
    console.log('Story starters preloaded successfully');
    
    // Start background refresh timer
    startBackgroundRefresh();
  } catch (error) {
    console.warn('Failed to preload story starters:', error);
  }
}

/**
 * Clears the story starters cache, forcing a fresh fetch on next use
 */
export function clearStoryStartersCache(): void {
  startersCache = null;
  cacheTimestamp = null;
  stopBackgroundRefresh();
}

/**
 * Immediately refreshes story starters cache (for menu opening)
 * @returns Promise<void>
 */
export async function refreshStoryStartersNow(): Promise<void> {
  console.log('Immediate refresh: Updating story starters cache...');
  await fetchStoryStarters(true);
}

/**
 * Refreshes story starters cache if it's stale
 * @returns Promise<void>
 */
export async function refreshStoryStartersIfStale(): Promise<void> {
  if (isCacheStale()) {
    console.log('Story starters cache is stale, refreshing...');
    await fetchStoryStarters(true);
  }
} 