'use client';

import { useEffect } from 'react';

export default function ClientInit() {
  useEffect(() => {
    // Request persistent storage so that cookies and localStorage can have a longer lifetime
    // https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist
    if (navigator.storage && navigator.storage.persist) {
      navigator.storage.persist().then((persistent) => {
        if (persistent) {
          console.log(
            "Storage is persistent. Storage will not be cleared except by explicit user action"
          );
        } else {
          console.log(
            "Storage is NOT persistent. Storage may be cleared by the UA under storage pressure."
          );
        }
      });
    }
  }, []);

  return null;
}
