"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { BOTS_CATALOG_SEED } from "@/lib/bots-catalog";
import { BotCatalogItem } from "@/types";

export function useBotsCatalog() {
  const [bots, setBots] = useState<(BotCatalogItem & { id: string })[]>(
    BOTS_CATALOG_SEED
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db) {
      setLoading(false);
      return;
    }

    getDocs(query(collection(db, "botsCatalog"), orderBy("rank", "asc")))
      .then((snap) => {
        if (!snap.empty) {
          const docs = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as BotCatalogItem),
          }));
          const hasNewSchema = docs.every((bot) => bot.strategy && bot.walletAddress);
          if (hasNewSchema) {
            setBots(docs);
          }
        }
      })
      .finally(() => setLoading(false));
  }, []);

  return { bots, loading };
}
