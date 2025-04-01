'use client';

import { useEffect, useState } from "react";

export function FrontendConfigDisplay() {
  const [isPersistent, setIsPersistent] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout | undefined = undefined;

    function requestPersistentStorage() {
      if (navigator.storage && navigator.storage.persist) {
        navigator.storage.persist().then((result) => {
          setIsPersistent(result);
        
          if (result) {
            console.log(
              "Storage is persistent. Storage will not be cleared except by explicit user action"
            );
            clearInterval(interval);
          } else {
            console.log(
              "Storage is not persistent. Storage may be cleared by the UA under storage pressure."
            );
          }
        }).catch((err) => {
          console.error("Error requesting persistent storage", err);
        });
      }
    }
    requestPersistentStorage();

    interval = setInterval(requestPersistentStorage, 5000);
    return () => clearInterval(interval);
  }, []);

  const config = {
    isPersistent,
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Frontend Configuration</h2>
      <pre className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg overflow-auto max-h-[400px] scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
        {JSON.stringify(config, null, 2)}
      </pre>
    </div>
  );
}