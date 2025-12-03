import { useEffect } from "react";

let scrollLockCount = 0;
let previousOverflow: string | null = null;

export function useScrollLock(active: boolean) {
    useEffect(() => {
        if (!active) return;
        const body = document?.body;
        if (!body) return;

        if (scrollLockCount === 0) {
            previousOverflow = body.style.overflow || null;
            body.style.overflow = "hidden";
        }
        scrollLockCount += 1;

        return () => {
            scrollLockCount = Math.max(0, scrollLockCount - 1);
            if (scrollLockCount === 0 && body) {
                body.style.overflow = previousOverflow || "";
                previousOverflow = null;
            }
        };
    }, [active]);
}