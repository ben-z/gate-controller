import { config } from "@/config";

export function InstanceConfigDisplay() {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Instance Configuration</h2>
      <pre className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg overflow-auto max-h-[400px] scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
        {JSON.stringify(config, null, 2)}
      </pre>
    </div>
  );
} 
