"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoldButton } from "@/components/ui/gold-button";
import { DEPOSIT_PRESETS } from "@/lib/finance";
import {
  fulfillDepositOnClient,
  persistDepositOnClient,
} from "@/lib/deposits";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import {
  CheckCircle2,
  Download,
  FlaskConical,
  Loader2,
  QrCode,
} from "lucide-react";
import { PesoAmount } from "@/components/ui/peso-amount";

interface DepositModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type DepositStep = "input" | "payment" | "success" | "expired";

function normalizeQrSrc(url: string) {
  if (url.startsWith("data:")) return url;
  if (url.startsWith("http")) return url;
  return `data:image/png;base64,${url}`;
}

function downloadQrImage(qrImage: string, amount: number) {
  const link = document.createElement("a");
  link.href = qrImage;
  link.download = `tradiq-qrph-${amount}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function DepositModal({ open, onOpenChange }: DepositModalProps) {
  const { user, refreshProfile } = useAuth();
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<DepositStep>("input");
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [depositId, setDepositId] = useState<string | null>(null);
  const [intentId, setIntentId] = useState<string | null>(null);
  const [testUrl, setTestUrl] = useState<string | null>(null);
  const [showSimulator, setShowSimulator] = useState(false);
  const [paidAmount, setPaidAmount] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const handlePaid = useCallback(
    (value: number) => {
      setPaidAmount(value);
      setStep("success");
      setSyncError(null);
      refreshProfile();
      toast.success("Deposit received!");
    },
    [refreshProfile]
  );

  const syncPayment = useCallback(async () => {
    if (!user || !intentId) return false;

    setSyncing(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/deposits/claim", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ intentId, depositId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to sync payment");
      }

      if (data.paid && data.synced) {
        handlePaid(parseFloat(amount));
        return true;
      }

      if (data.paid && data.fulfillLocally && depositId && user) {
        await fulfillDepositOnClient({ depositId, userId: user.uid });
        handlePaid(parseFloat(amount));
        return true;
      }

      if (data.paid && !data.synced) {
        setSyncError(
          data.error ??
            "Paymongo confirmed payment, but balance sync is not configured yet."
        );
        return false;
      }

      setSyncError(null);
      return false;
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : "Failed to sync payment");
      return false;
    } finally {
      setSyncing(false);
    }
  }, [user, intentId, depositId, amount, handlePaid]);

  const pollPaymentStatus = useCallback(async () => {
    if (!user || !intentId || step !== "payment" || syncing) return;
    await syncPayment();
  }, [user, intentId, step, syncing, syncPayment]);

  useEffect(() => {
    if (!depositId || !db || step !== "payment") return;

    const unsub = onSnapshot(doc(db, "deposits", depositId), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      if (data.status === "paid") {
        handlePaid(data.amount as number);
      } else if (data.status === "expired") {
        setStep("expired");
        toast.error("QR code expired. Generate a new one.");
      }
    });

    return unsub;
  }, [depositId, step, handlePaid]);

  useEffect(() => {
    if (step !== "payment" || !intentId) return;

    const interval = setInterval(pollPaymentStatus, 3000);
    return () => clearInterval(interval);
  }, [step, intentId, pollPaymentStatus]);

  const handleCreate = async () => {
    const num = parseFloat(amount);
    if (!num || num < 100) {
      toast.error("Minimum deposit is ₱100");
      return;
    }
    if (!user) return;

    setLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/deposits/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amount: num }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create deposit");

      if (data.persistOnClient) {
        await persistDepositOnClient({
          depositId: data.depositId,
          userId: user.uid,
          amount: data.amount,
          intentId: data.intentId,
          qrImageUrl: data.qrImageUrl,
        });
      }

      setQrImage(normalizeQrSrc(data.qrImageUrl));
      setDepositId(data.depositId);
      setIntentId(data.intentId);
      setTestUrl(data.testUrl ?? null);
      setShowSimulator(false);
      setStep("payment");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Deposit failed");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setQrImage(null);
    setAmount("");
    setDepositId(null);
    setIntentId(null);
    setTestUrl(null);
    setShowSimulator(false);
    setPaidAmount(null);
    setSyncError(null);
    setSyncing(false);
    setStep("input");
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className={`border-amber-500/20 bg-zinc-950 text-white ${
          showSimulator ? "max-w-md" : "max-w-sm"
        }`}
      >
        <DialogHeader>
          <DialogTitle>
            {step === "input" ? "Deposit via QR Ph" : "Complete Payment"}
          </DialogTitle>
        </DialogHeader>

        {step === "payment" && qrImage ? (
          <div className="flex flex-col items-center gap-4 py-2">
            <div className="flex w-full items-center justify-between rounded-xl border border-amber-500/20 bg-black/50 px-4 py-3">
              <span className="text-sm text-zinc-400">Amount due</span>
              <PesoAmount
                amount={parseFloat(amount)}
                className="text-lg text-amber-400"
              />
            </div>

            <div className="rounded-xl bg-white p-4 shadow-lg shadow-amber-500/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrImage}
                alt="QR Ph payment code"
                width={220}
                height={220}
                className="h-[220px] w-[220px]"
              />
            </div>

            <div className="flex w-full gap-2">
              <button
                type="button"
                onClick={() => downloadQrImage(qrImage, parseFloat(amount))}
                className="flex flex-1 items-center justify-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-400 cursor-pointer hover:bg-amber-500/20"
              >
                <Download className="h-4 w-4" />
                Download QR
              </button>
              {testUrl && (
                <button
                  type="button"
                  onClick={() => setShowSimulator((v) => !v)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-md border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-sm text-violet-300 cursor-pointer hover:bg-violet-500/20"
                >
                  <FlaskConical className="h-4 w-4" />
                  {showSimulator ? "Hide simulator" : "Simulate payment"}
                </button>
              )}
            </div>

            {showSimulator && testUrl && (
              <div className="w-full overflow-hidden rounded-xl border border-violet-500/20 bg-black">
                <iframe
                  src={testUrl}
                  title="Paymongo test payment simulator"
                  className="h-80 w-full bg-white"
                />
              </div>
            )}

            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <Loader2
                className={`h-4 w-4 text-amber-400 ${syncing ? "animate-spin" : ""}`}
              />
              {syncing ? "Syncing payment…" : "Waiting for payment…"}
            </div>

            {syncError && (
              <div className="w-full rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                {syncError}
              </div>
            )}

            {syncError && (
              <button
                type="button"
                onClick={() => void syncPayment()}
                disabled={syncing}
                className="w-full rounded-md border border-amber-500/40 bg-amber-500/15 px-4 py-2 text-sm text-amber-300 cursor-pointer hover:bg-amber-500/25 disabled:opacity-50"
              >
                {syncing ? "Syncing…" : "Sync payment now"}
              </button>
            )}

            <p className="text-center text-xs text-zinc-500">
              {testUrl
                ? "Use Simulate payment to test without scanning. Expires in 30 minutes."
                : "Open your banking or e-wallet app and scan this QR Ph code. Expires in 30 minutes."}
            </p>

            <button
              type="button"
              onClick={() => handleClose(false)}
              className="w-full rounded-md border border-zinc-700 px-4 py-2 text-sm text-zinc-300 cursor-pointer hover:bg-zinc-900"
            >
              Close
            </button>
          </div>
        ) : step === "success" ? (
          <div className="flex flex-col items-center gap-4 py-6">
            <CheckCircle2 className="h-14 w-14 text-emerald-400" />
            <div className="text-center">
              <p className="text-lg font-medium text-white">Payment received</p>
              {paidAmount !== null && (
                <PesoAmount
                  amount={paidAmount}
                  className="mt-1 text-2xl text-emerald-400"
                />
              )}
              <p className="mt-2 text-sm text-zinc-400">
                Your wallet balance has been updated.
              </p>
            </div>
            <GoldButton onClick={() => handleClose(false)} className="w-full">
              Done
            </GoldButton>
          </div>
        ) : step === "expired" ? (
          <div className="flex flex-col items-center gap-4 py-6">
            <QrCode className="h-12 w-12 text-zinc-500" />
            <p className="text-center text-sm text-zinc-400">
              This QR code expired before payment was completed.
            </p>
            <GoldButton onClick={reset} className="w-full">
              Generate new QR
            </GoldButton>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label className="text-zinc-400">AMOUNT (₱)</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mt-1 border-amber-500/20 bg-black text-lg text-white"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {DEPOSIT_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setAmount(String(preset))}
                  className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-sm text-amber-400 cursor-pointer"
                >
                  ₱{preset.toLocaleString()}
                </button>
              ))}
            </div>
            <GoldButton
              onClick={handleCreate}
              disabled={loading || !amount}
              className="w-full"
            >
              {loading ? "Generating QR..." : "Generate QR Ph"}
            </GoldButton>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
