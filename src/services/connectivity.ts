import NetInfo from '@react-native-community/netinfo';

export async function isOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return Boolean(state.isConnected && state.isInternetReachable !== false);
}

/**
 * Fires `onReconnect` once per offline→online transition — never a loop,
 * never on every network blip while already online (see docs/FIREBASE.md
 * "Connectivity" for why this app doesn't do aggressive retry polling).
 */
export function subscribeToReconnect(onReconnect: () => void): () => void {
  let wasOnline = true;
  return NetInfo.addEventListener((state) => {
    const nowOnline = Boolean(state.isConnected && state.isInternetReachable !== false);
    if (nowOnline && !wasOnline) {
      onReconnect();
    }
    wasOnline = nowOnline;
  });
}
