const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;

export function PaymentTestModeBanner() {
  if (!clientToken?.startsWith("pk_test_")) return null;
  return (
    <div className="w-full border-b border-amber-300/60 bg-amber-100/80 px-4 py-1.5 text-center text-[12px] text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
      Payments are in <strong>test mode</strong>. Use card{" "}
      <code className="rounded bg-amber-200/60 px-1 py-0.5 font-mono text-[11px] dark:bg-amber-500/20">
        4242 4242 4242 4242
      </code>{" "}
      to try checkout.
    </div>
  );
}
