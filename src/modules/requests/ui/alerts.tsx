"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { myUnseenCountAction, staffAlertCountsAction } from "../actions";
import { messageSound, requestSound, shopperSound } from "./sounds";

/** Runs `check` every `ms` while the tab is open; checks at once when the tab comes back to front. */
function usePoll(check: () => Promise<void>, ms: number) {
  const ref = useRef(check);
  useEffect(() => {
    ref.current = check;
  });
  useEffect(() => {
    let busy = false;
    const run = async () => {
      if (busy) return;
      busy = true;
      try {
        await ref.current();
      } catch {
        // Offline or server restarting: try again next time.
      } finally {
        busy = false;
      }
    };
    const timer = setInterval(run, ms);
    const onVisible = () => document.visibilityState === "visible" && void run();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [ms]);
}

/**
 * Admin pages: every 3 seconds asks for new shopper steps and unread shopper messages.
 * A new message plays the message sound; a new request or step plays the request sound.
 */
export function StaffAlert({ initial }: { initial: { steps: number; messages: number } }) {
  const router = useRouter();
  const last = useRef(initial);
  usePoll(async () => {
    const now = await staffAlertCountsAction();
    const moreMessages = now.messages > last.current.messages;
    const moreSteps = now.steps > last.current.steps;
    if (moreMessages) messageSound();
    else if (moreSteps) requestSound();
    if (moreMessages || moreSteps) router.refresh();
    last.current = now;
  }, 3_000);
  return null;
}

/** Shop pages of a signed-in shopper: a sound when the shop answers a request. */
export function ShopperAlert({ initial }: { initial: number }) {
  const router = useRouter();
  const last = useRef(initial);
  usePoll(async () => {
    const n = await myUnseenCountAction();
    if (n > last.current) {
      shopperSound();
      router.refresh();
    }
    last.current = n;
  }, 5_000);
  return null;
}
