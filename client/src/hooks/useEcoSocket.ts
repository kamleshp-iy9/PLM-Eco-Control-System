// ─── useEcoSocket — custom React hook for real-time ECO updates ───────────────
// This hook connects to the Socket.io server and listens for ECO events
// (created, updated, approved, rejected, etc.). When an event arrives it
// updates the Zustand store so every page that reads ECO data refreshes
// automatically — without the user having to reload the page.
//
// It's registered once in App.tsx so there's only ever ONE Socket.io
// connection for the entire session, regardless of which page is open.
//
// Hook used: useEffect — manages the Socket.io connection lifecycle.
//   • Runs when the component (App) mounts → connects and registers listeners.
//   • Returns a cleanup function that runs when the component unmounts →
//     removes all listeners and disconnects. This prevents memory leaks and
//     duplicate event handlers if the hook ever re-runs.
//   • Dependency [user?.id, fetchEco]: if the logged-in user changes
//     (unlikely but possible), the listeners are reset so events are still
//     attributed to the right user for the "show toast or not" logic.

import { useEffect } from 'react';
import { toast } from 'sonner';
import { socket } from '@/lib/socket';
import { clearGetRequestCache } from '@/lib/api';
import { useEcoStore } from '@/stores/ecoStore';
import { useAuthStore } from '@/stores/authStore';

interface EcoSocketPayload {
  eco: any;
  userId: string; // ID of the user who triggered the event on the server
}

export function useEcoSocket() {
  // We need the current user's ID to decide whether to show a toast.
  // If the event was triggered by the current user themselves we suppress it —
  // they already know what they just did. We only notify about OTHER users' actions.
  const { user } = useAuthStore();

  // fetchEco re-fetches a single ECO by ID and updates currentEco in the store.
  // Called when a mutation event arrives for the ECO the user is currently viewing.
  const fetchEco = useEcoStore((s) => s.fetchEco);

  // ─── useEffect: Socket.io lifecycle ────────────────────────────────────────
  // Everything here is a "side effect" — it interacts with a system outside React
  // (the WebSocket connection). useEffect is the correct place for this.
  useEffect(() => {
    socket.connect(); // open the WebSocket connection to the server

    // ── eco:created ──────────────────────────────────────────────────────────
    // Server emits this when any user creates a new ECO.
    // We prepend the new ECO to the store list so it appears at the top
    // without requiring a full refetch.
    const handleEcoCreated = ({ eco, userId }: EcoSocketPayload) => {
      useEcoStore.setState((state) => {
        // Guard: don't add a duplicate if the ECO somehow arrives twice
        const exists = state.ecos.some((e) => e.id === eco.id);
        if (exists) return state;
        return { ecos: [eco, ...state.ecos] }; // prepend to show newest first
      });

      // Only show a toast notification for other users' ECOs — not our own
      if (userId !== user?.id) {
        toast.info(`New ECO created: ${eco.reference} – ${eco.title}`);
      }
    };

    // ── eco:updated / started / approved / validated / rejected ──────────────
    // All mutation events share the same handler factory.
    // handleEcoMutated(event) returns a function that:
    //   1. Updates the ECO in the list view (patch the changed fields)
    //   2. If the user is currently viewing this ECO's detail page, re-fetches
    //      the full ECO so the approval panel + stage pipeline refresh
    //   3. Shows a toast for other users' actions
    const handleEcoMutated = (event: string) => ({ eco, userId }: EcoSocketPayload) => {
      // Patch the ECO in the list — spread existing fields and overwrite with new ones
      useEcoStore.setState((state) => ({
        ecos: state.ecos.map((e) => (e.id === eco.id ? { ...e, ...eco } : e)),
      }));

      // If this is the ECO the user is currently reading, force a fresh fetch
      // so the detail page shows the updated stage, approvals, and buttons
      const currentEco = useEcoStore.getState().currentEco;
      if (currentEco?.id === eco.id) {
        clearGetRequestCache(); // clear the 5-second GET cache so we actually hit the server
        fetchEco(eco.id);       // re-fetch and update currentEco in the store
      }

      // Human-readable event labels for the toast notification
      if (userId !== user?.id) {
        const labels: Record<string, string> = {
          'eco:updated':   'updated',
          'eco:started':   'started',
          'eco:approved':  'approved',
          'eco:validated': 'advanced to next stage',
          'eco:rejected':  'rejected',
        };
        toast.info(`ECO ${eco.reference} was ${labels[event] ?? 'changed'}`);
      }
    };

    // Register all event listeners on the socket
    socket.on('eco:created',   handleEcoCreated);
    socket.on('eco:updated',   handleEcoMutated('eco:updated'));
    socket.on('eco:started',   handleEcoMutated('eco:started'));
    socket.on('eco:approved',  handleEcoMutated('eco:approved'));
    socket.on('eco:validated', handleEcoMutated('eco:validated'));
    socket.on('eco:rejected',  handleEcoMutated('eco:rejected'));

    // ── Cleanup function ─────────────────────────────────────────────────────
    // React calls this when the component unmounts or before re-running the effect.
    // Without cleanup, old listeners would stack up and fire multiple times for
    // each event — a common bug when effects aren't cleaned up properly.
    return () => {
      socket.off('eco:created');
      socket.off('eco:updated');
      socket.off('eco:started');
      socket.off('eco:approved');
      socket.off('eco:validated');
      socket.off('eco:rejected');
      socket.disconnect(); // close the WebSocket connection cleanly
    };
  }, [user?.id, fetchEco]); // re-run only if the logged-in user changes
}
