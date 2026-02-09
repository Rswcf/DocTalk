"use client";

import React, { useState } from "react";
import { Download } from "lucide-react";
import { useLocale } from "../../i18n";
import { deleteUserAccount, exportUserData } from "../../lib/api";
import { signOut } from "next-auth/react";

interface Props {
  email: string;
}

export default function AccountActionsSection({ email }: Props) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const canConfirm = confirmEmail.trim() === email.trim();

  const onExport = async () => {
    setExporting(true);
    try {
      const blob = await exportUserData();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `doctalk-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // silent — user sees no download
    } finally {
      setExporting(false);
    }
  };

  const onDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      await deleteUserAccount();
      await signOut({ callbackUrl: "/" });
    } catch (e) {
      setError("error");
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Data Export */}
      <div className="border rounded-lg p-6 border-zinc-200 dark:border-zinc-700">
        <h3 className="text-lg font-medium mb-2 text-zinc-900 dark:text-zinc-100">
          {t("profile.account.exportTitle")}
        </h3>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
          {t("profile.account.exportDesc")}
        </p>
        <button
          type="button"
          onClick={onExport}
          disabled={exporting}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50"
        >
          <Download size={16} />
          {exporting ? t("profile.account.exporting") : t("profile.account.exportButton")}
        </button>
      </div>

      {/* Danger Zone */}
      <div className="border rounded-lg p-6 dark:border-zinc-700 border-red-300 dark:border-red-700">
        <h3 className="text-lg font-medium mb-2 text-red-700 dark:text-red-300">
          {t("profile.account.dangerZone")}
        </h3>
        <p className="text-sm text-red-700/90 dark:text-red-400 mb-4">
          {t("profile.account.deleteWarning")}
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700"
        >
          {t("profile.account.deleteAccount")}
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => !deleting && setOpen(false)} />
          <div className="relative bg-white dark:bg-zinc-900 border dark:border-zinc-700 rounded-lg p-6 w-full max-w-md shadow-lg">
            <h4 className="text-lg font-semibold mb-2 dark:text-zinc-100">
              {t("profile.account.deleteAccount")}
            </h4>
            <p className="text-sm text-zinc-700 dark:text-zinc-300 mb-4">
              {t("profile.account.deleteConfirm")}
            </p>
            <input
              type="text"
              className="w-full px-3 py-2 rounded border dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              placeholder={email}
              disabled={deleting}
            />
            {error && (
              <div className="mt-3 text-sm text-red-600">{t("error.somethingWrong")}</div>
            )}
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setOpen(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-zinc-100 text-zinc-800 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                disabled={!canConfirm || deleting}
                onClick={onDelete}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? t("profile.account.deleting") : t("profile.account.deleteAccount")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
