import { useState, useEffect, useCallback } from "react";
import {
  isConnected,
  requestAccess, // Always opens account selection popup
  getAddress,
  getNetwork,
} from "@stellar/freighter-api";

export type WalletStatus = "idle" | "connecting" | "connected" | "error";

export interface FreighterState {
  status: WalletStatus;
  address: string | null;
  network: string | null;
  error: string | null;
  isInstalled: boolean;
}

export function useFreighter() {
  const [state, setState] = useState<FreighterState>({
    status: "idle",
    address: null,
    network: null,
    error: null,
    isInstalled: false,
  });

  // Only check if the extension is installed — do NOT auto-connect
  useEffect(() => {
    isConnected().then((result) => {
      setState((s) => ({ ...s, isInstalled: result.isConnected }));
    });
  }, []);

  /**
   * connect — always opens the Freighter account selection popup.
   * Uses requestAccess() instead of setAllowed() so the user picks
   * which account to use every time they click "Bağla".
   */
  const connect = useCallback(async () => {
    setState((s) => ({ ...s, status: "connecting", error: null }));

    try {
      const connResult = await isConnected();
      if (!connResult.isConnected) {
        setState((s) => ({
          ...s,
          status: "error",
          error: "Freighter yüklü değil. Chrome eklentisini kurun.",
          isInstalled: false,
        }));
        return;
      }

      // requestAccess always shows the account selector popup
      const accessResult = await requestAccess();
      if (accessResult.error) {
        throw new Error("Erişim reddedildi");
      }

      // After access granted, fetch current address and network
      const addrResult = await getAddress();
      const netResult = await getNetwork();

      if (addrResult.error || !addrResult.address) {
        throw new Error("Adres alınamadı");
      }

      setState({
        status: "connected",
        address: addrResult.address,
        network: netResult.network ?? null,
        error: null,
        isInstalled: true,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Bağlantı başarısız";
      setState((s) => ({ ...s, status: "error", error: message }));
    }
  }, []);

  /** disconnect — clears local state only (Freighter extension stays untouched) */
  const disconnect = useCallback(() => {
    setState((s) => ({
      ...s,
      status: "idle",
      address: null,
      network: null,
      error: null,
    }));
  }, []);

  return { ...state, connect, disconnect };
}
