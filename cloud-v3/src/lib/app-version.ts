const VERSION_PATTERN = /^[0-9a-f]{40}$/;

export function getAppVersion() {
  const version = process.env.APP_VERSION;
  if (!version || !VERSION_PATTERN.test(version)) {
    throw new Error('APP_VERSION must be a full lowercase Git commit SHA');
  }
  return version;
}
