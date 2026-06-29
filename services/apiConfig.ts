
/**
 * API CONFIGURATION
 * 
 * When running in the Android APK, relative paths (like /api/storage) do NOT work.
 * The APK needs a full URL to communicate with your Vercel backend.
 */
const PRODUCTION_URL = 'https://www.noorpos.in'; 

export const getApiUrl = (path: string) => {
  // Check if we are running inside the Android/iOS app environment
  const isMobileApp = 
    window.location.protocol === 'capacitor:' || 
    window.location.protocol === 'http:' && window.location.hostname === 'localhost' && !window.location.port;
  
  if (isMobileApp) {
    // Force absolute URL for APK to reach the remote server
    return `${PRODUCTION_URL}${path}`;
  }
  
  // Use relative path for web browser environment
  return path;
};
