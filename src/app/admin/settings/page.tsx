'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { useAuth } from '@/providers/AuthProvider';
import { getAppSettings, saveInstagramCookies } from '@/lib/firebase/firestore';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import type { Timestamp } from 'firebase/firestore';

type CookieStatus = 'loading' | 'none' | 'set';

const MAX_COOKIE_FILE_SIZE = 50_000; // 50 KB — a real cookie file is typically 2-10 KB
const REQUIRED_COOKIES = ['sessionid'] as const;
const RECOMMENDED_COOKIES = ['csrftoken', 'ds_user_id'] as const;

interface ValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
}

function validateCookieFile(raw: string): ValidationResult {
  if (raw.length > MAX_COOKIE_FILE_SIZE) {
    return { valid: false, error: `File too large (${Math.round(raw.length / 1000)} KB). A cookie file should be under 50 KB.` };
  }

  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x08\x0E-\x1F]/.test(raw)) {
    return { valid: false, error: 'File contains invalid control characters. Paste the raw text content of the .txt file.' };
  }

  const lines = raw.split(/\r?\n/).filter((l) => l.trim() !== '');
  const dataLines = lines.filter((l) => !l.startsWith('#'));

  if (dataLines.length === 0) {
    return { valid: false, error: 'No cookie entries found. The file appears to be empty or only contains comments.' };
  }

  const invalidLines: number[] = [];
  const instagramCookies = new Map<string, string>();

  for (let i = 0; i < dataLines.length; i++) {
    const fields = dataLines[i].split('\t');
    if (fields.length < 7) {
      invalidLines.push(i + 1);
      continue;
    }

    const [domain, , , , , name, value] = fields;
    if (domain.includes('instagram.com') && name && value) {
      instagramCookies.set(name, value);
    }
  }

  if (invalidLines.length > 0 && invalidLines.length === dataLines.length) {
    return { valid: false, error: 'No valid cookie lines found. Expected tab-separated Netscape cookie format (7 fields per line).' };
  }

  if (instagramCookies.size === 0) {
    return { valid: false, error: 'No instagram.com cookies found. Make sure you export cookies while on instagram.com.' };
  }

  const missingRequired = REQUIRED_COOKIES.filter((c) => !instagramCookies.has(c));
  if (missingRequired.length > 0) {
    return { valid: false, error: `Missing required cookie: ${missingRequired.join(', ')}. You may not be logged in, or the export didn't capture session cookies.` };
  }

  const warnings: string[] = [];
  const missingRecommended = RECOMMENDED_COOKIES.filter((c) => !instagramCookies.has(c));
  if (missingRecommended.length > 0) {
    warnings.push(`Missing recommended cookies: ${missingRecommended.join(', ')}. This may still work but could be less reliable.`);
  }

  if (invalidLines.length > 0) {
    warnings.push(`${invalidLines.length} malformed line(s) skipped.`);
  }

  return { valid: true, warnings: warnings.length > 0 ? warnings : undefined };
}

function formatTimestamp(ts: Timestamp | undefined): string {
  if (!ts) return '';
  const d = ts.toDate();
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AdminSettingsPage() {
  const { firebaseUser } = useAuth();
  const router = useRouter();

  const [cookieStatus, setCookieStatus] = useState<CookieStatus>('loading');
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [cookiesInput, setCookiesInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);

  const loadSettings = useCallback(async () => {
    try {
      const settings = await getAppSettings();
      if (settings?.instagram_cookies_base64) {
        setCookieStatus('set');
        setLastUpdated(formatTimestamp(settings.cookies_updated_at));
      } else {
        setCookieStatus('none');
      }
    } catch {
      setCookieStatus('none');
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSave = async () => {
    const trimmed = cookiesInput.trim();
    if (!trimmed || !firebaseUser) return;

    setFeedback(null);

    const validation = validateCookieFile(trimmed);
    if (!validation.valid) {
      setFeedback({ type: 'error', message: validation.error! });
      return;
    }

    setSaving(true);

    try {
      const base64 = btoa(trimmed);
      await saveInstagramCookies(base64, firebaseUser.uid);
      setCookiesInput('');
      setCookieStatus('set');

      if (validation.warnings?.length) {
        setFeedback({ type: 'warning', message: `Saved with warnings: ${validation.warnings.join(' ')}` });
      } else {
        setFeedback({ type: 'success', message: 'Cookies saved and validated' });
      }
      await loadSettings();
    } catch {
      setFeedback({ type: 'error', message: 'Failed to save cookies' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-4 pt-safe-t pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 py-5">
        <button
          onClick={() => router.back()}
          className="text-fg-muted hover:text-foreground transition-colors p-1 -ml-1"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold">Admin Settings</h1>
      </div>

      <div className="space-y-8">
        {/* Instagram Cookies Section */}
        <section className="space-y-4">
          <div>
            <h2 className="text-base font-medium">Instagram Cookies</h2>
            <p className="text-sm text-fg-muted mt-1">
              Required for downloading Instagram reels. Without valid cookies, imports will fail.
            </p>
          </div>

          {/* Status */}
          <div className="flex items-center gap-3 rounded-xl bg-bg-card border border-border px-4 py-3">
            {cookieStatus === 'loading' ? (
              <Spinner size={16} />
            ) : (
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  cookieStatus === 'set' ? 'bg-success' : 'bg-danger'
                }`}
              />
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {cookieStatus === 'loading'
                  ? 'Checking...'
                  : cookieStatus === 'set'
                    ? 'Cookies configured'
                    : 'No cookies set'}
              </p>
              {lastUpdated && (
                <p className="text-xs text-fg-subtle mt-0.5">
                  Last updated {lastUpdated}
                </p>
              )}
            </div>
          </div>

          {/* Input */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-fg-muted">
              Paste cookie file contents
            </label>
            <textarea
              value={cookiesInput}
              onChange={(e) => setCookiesInput(e.target.value)}
              placeholder="# Netscape HTTP Cookie File&#10;.instagram.com	TRUE	/	TRUE	..."
              rows={6}
              className="w-full rounded-xl bg-bg-elevated border border-border px-4 py-3 text-xs text-foreground placeholder:text-fg-subtle focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-colors resize-none font-mono"
            />
          </div>

          {/* Feedback */}
          {feedback && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className={`rounded-xl border px-4 py-3 text-sm ${
                feedback.type === 'success'
                  ? 'bg-success/10 border-success/20 text-success'
                  : feedback.type === 'warning'
                    ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'
                    : 'bg-danger/10 border-danger/20 text-danger'
              }`}
            >
              {feedback.message}
            </motion.div>
          )}

          <Button
            onClick={handleSave}
            loading={saving}
            disabled={!cookiesInput.trim()}
            fullWidth
          >
            Save Cookies
          </Button>
        </section>

        {/* Extraction Guide */}
        <section className="space-y-4">
          <h2 className="text-base font-medium">How to extract cookies</h2>

          <div className="space-y-3">
            <Step
              number={1}
              title="Install browser extension"
              description='Install "Get cookies.txt LOCALLY" for Chrome or Firefox. Do not use extensions that upload cookies to a server.'
            />
            <Step
              number={2}
              title="Log in to Instagram"
              description="Open instagram.com in your browser and make sure you're logged into the account you want to use."
            />
            <Step
              number={3}
              title="Export cookies"
              description="Click the extension icon while on instagram.com, then click Export or Download. This gives you a Netscape-format .txt file."
            />
            <Step
              number={4}
              title="Copy and paste"
              description="Open the downloaded .txt file, select all contents (Ctrl+A), copy (Ctrl+C), and paste into the field above."
            />
            <Step
              number={5}
              title="Save"
              description="Hit Save. The cloud function will use these cookies for all future Instagram downloads."
            />
          </div>

          <div className="rounded-xl bg-bg-card border border-border px-4 py-3">
            <p className="text-xs text-fg-muted leading-relaxed">
              Cookies typically expire after a few weeks. When Instagram imports start failing again, repeat these steps to refresh them.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

function Step({
  number,
  title,
  description,
}: {
  number: number;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-3">
      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-bg-elevated border border-border text-xs font-medium text-fg-muted shrink-0 mt-0.5">
        {number}
      </span>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-sm text-fg-muted mt-0.5">{description}</p>
      </div>
    </div>
  );
}
