interface ConsoleErrorProps {
  message: string;
}

export function ConsoleError({ message }: ConsoleErrorProps) {
  const isConfig = message.includes("FIREBASE_ADMIN_SERVICE_ACCOUNT");
  const isRole = message.includes("super_admin");

  return (
    <div className="surface-flat max-w-xl space-y-3 p-5">
      <p className="text-sm text-red-400">{message}</p>
      {isConfig && (
        <ol className="list-decimal space-y-2 pl-4 text-xs text-zinc-400">
          <li>
            Open Firebase Console → Project Settings → Service accounts
          </li>
          <li>Click &quot;Generate new private key&quot; and download the JSON</li>
          <li>
            Paste the full JSON as one line in <code className="text-amber-400">.env.local</code>:
            <pre className="mt-1 overflow-x-auto rounded bg-black p-2 text-[10px] text-zinc-500">
              FIREBASE_ADMIN_SERVICE_ACCOUNT=&#123;&quot;type&quot;:&quot;service_account&quot;,...&#125;
            </pre>
          </li>
          <li>Restart the dev server (<code className="text-amber-400">npm run dev</code>)</li>
        </ol>
      )}
      {isRole && (
        <p className="text-xs text-zinc-400">
          In Firestore, open <code className="text-amber-400">users/&#123;your-uid&#125;</code>{" "}
          and set <code className="text-amber-400">role</code> to{" "}
          <code className="text-amber-400">&quot;super_admin&quot;</code> (not
          &quot;admin&quot;).
        </p>
      )}
    </div>
  );
}
