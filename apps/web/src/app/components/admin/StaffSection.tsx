'use client';

import React, { useEffect, useState } from 'react';
import { Hash, Info, KeyRound, Loader2, Pencil, Plus, RefreshCw, UserCheck, UserX } from 'lucide-react';
import { useShop } from '../../ShopContext';
import { Field, Modal, Pill, apiError, formatDateTime, ghostButton, inputClass, primaryButton, secondaryButton, timeAgo } from './ui';

export type Role = 'OWNER' | 'MANAGER' | 'CASHIER';

export interface StaffUser {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
  lastLogin: string | null;
}

const ROLES: { value: Role; label: string; help: string }[] = [
  { value: 'CASHIER', label: 'Cashier', help: 'Billing, returns and customer lookups.' },
  { value: 'MANAGER', label: 'Manager', help: 'Adds inventory, purchases and approves discounts with their PIN.' },
  { value: 'OWNER', label: 'Owner', help: 'Full access, including staff, reports and settings.' },
];

const ROLE_TONE = { OWNER: 'violet', MANAGER: 'blue', CASHIER: 'neutral' } as const;

// Client-side copies of the API's validation rules (users.controller.ts)
const USERNAME_RULE = /^[a-zA-Z0-9._-]{3,30}$/;
const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,72}$/;
const PIN_RULE = /^\d{4}$/;
const EMAIL_RULE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateName(v: string) {
  return v.trim().length < 2 || v.trim().length > 80 ? 'Enter the full name (2-80 characters).' : '';
}
function validateEmail(v: string) {
  return EMAIL_RULE.test(v.trim()) ? '' : 'Enter a valid email address.';
}
function validatePassword(v: string) {
  return PASSWORD_RULE.test(v) ? '' : '8-72 characters with at least one letter and one digit.';
}
function validatePin(v: string) {
  return PIN_RULE.test(v) ? '' : 'PIN must be exactly 4 digits.';
}

type Dialog =
  | { kind: 'add' }
  | { kind: 'edit'; user: StaffUser }
  | { kind: 'password'; user: StaffUser }
  | { kind: 'pin'; user: StaffUser }
  | { kind: 'toggle'; user: StaffUser };

export default function StaffSection() {
  const { API_BASE, secureFetch, user: me } = useShop();
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState('');
  const [dialog, setDialog] = useState<Dialog | null>(null);

  const load = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await secureFetch(`${API_BASE}/users`);
      if (!res.ok) {
        setLoadError(await apiError(res, 'Could not load staff'));
        return;
      }
      setUsers(await res.json());
    } catch {
      setLoadError('Could not reach the server. Check that the API is running.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(''), 5000);
    return () => clearTimeout(t);
  }, [notice]);

  const activeOwners = users.filter(u => u.role === 'OWNER' && u.isActive).length;
  const isSelf = (u: StaffUser) => u.id === me.userId || u.username === me.username;
  const deactivateBlock = (u: StaffUser): string => {
    if (!u.isActive) return '';
    if (isSelf(u)) return 'You cannot deactivate your own account.';
    if (u.role === 'OWNER' && activeOwners <= 1) return 'There must always be an active owner.';
    return '';
  };

  const done = async (message: string) => {
    setDialog(null);
    setNotice(message);
    await load();
  };

  const sorted = [...users].sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.fullName.localeCompare(b.fullName));

  return (
    <div className="flex-1 flex flex-col overflow-hidden space-y-3">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <p className="text-[11px] text-neutral-400 flex items-start gap-1.5 max-w-2xl">
          <Info className="w-3.5 h-3.5 text-neutral-500 shrink-0 mt-px" />
          Changing someone&apos;s role or resetting their password signs them out on every device. Managers and owners use their PIN to approve discounts and overrides; PINs must be unique among them.
        </p>
        <div className="flex gap-2">
          <button onClick={load} className={ghostButton}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button onClick={() => setDialog({ kind: 'add' })} className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer">
            <Plus className="w-3.5 h-3.5" />
            Add user
          </button>
        </div>
      </div>

      {notice && <div className="text-xs text-green-400 bg-green-950/40 border border-green-900/40 rounded-lg px-3 py-2">{notice}</div>}
      {loadError && <div className="text-xs text-red-400 bg-red-950/40 border border-red-900/40 rounded-lg px-3 py-2">{loadError}</div>}

      <div className="flex-1 overflow-y-auto bg-neutral-900 border border-neutral-800 rounded-xl mb-16">
        {loading && users.length === 0 ? (
          <p className="p-6 text-xs text-neutral-500 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading staff…</p>
        ) : users.length === 0 ? (
          <p className="p-12 text-center text-sm text-neutral-500">No staff accounts found.</p>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-neutral-900 z-10">
              <tr className="border-b border-neutral-800 text-neutral-500">
                <th className="p-3 font-semibold">Name</th>
                <th className="p-3 font-semibold">Username</th>
                <th className="p-3 font-semibold">Email</th>
                <th className="p-3 font-semibold">Role</th>
                <th className="p-3 font-semibold">Status</th>
                <th className="p-3 font-semibold">Last login</th>
                <th className="p-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-850 text-neutral-300">
              {sorted.map(u => {
                const block = deactivateBlock(u);
                return (
                  <tr key={u.id} className={`hover:bg-neutral-850/30 transition-colors ${u.isActive ? '' : 'opacity-60'}`}>
                    <td className="p-3 text-white font-medium">
                      {u.fullName}
                      {isSelf(u) && <span className="ml-2 text-[9px] font-bold uppercase text-violet-300">You</span>}
                    </td>
                    <td className="p-3 font-mono text-neutral-400">{u.username}</td>
                    <td className="p-3 text-neutral-400">{u.email}</td>
                    <td className="p-3"><Pill tone={ROLE_TONE[u.role] ?? 'neutral'}>{u.role}</Pill></td>
                    <td className="p-3">{u.isActive ? <Pill tone="green">Active</Pill> : <Pill tone="red">Inactive</Pill>}</td>
                    <td className="p-3 text-neutral-400 whitespace-nowrap" title={u.lastLogin ? formatDateTime(u.lastLogin) : 'Never signed in'}>{timeAgo(u.lastLogin)}</td>
                    <td className="p-3">
                      <div className="flex justify-end gap-1">
                        <IconButton title="Edit name, email or role" onClick={() => setDialog({ kind: 'edit', user: u })}><Pencil className="w-3.5 h-3.5" /></IconButton>
                        <IconButton title="Reset password" onClick={() => setDialog({ kind: 'password', user: u })}><KeyRound className="w-3.5 h-3.5" /></IconButton>
                        <IconButton title="Reset PIN" onClick={() => setDialog({ kind: 'pin', user: u })}><Hash className="w-3.5 h-3.5" /></IconButton>
                        {u.isActive ? (
                          <IconButton title={block || 'Deactivate'} danger disabled={!!block} onClick={() => setDialog({ kind: 'toggle', user: u })}><UserX className="w-3.5 h-3.5" /></IconButton>
                        ) : (
                          <IconButton title="Activate" onClick={() => setDialog({ kind: 'toggle', user: u })}><UserCheck className="w-3.5 h-3.5" /></IconButton>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {dialog?.kind === 'add' && <AddUserDialog onClose={() => setDialog(null)} onDone={done} />}
      {dialog?.kind === 'edit' && <EditUserDialog target={dialog.user} isSelf={isSelf(dialog.user)} lastOwner={dialog.user.role === 'OWNER' && dialog.user.isActive && activeOwners <= 1} onClose={() => setDialog(null)} onDone={done} />}
      {dialog?.kind === 'password' && <ResetDialog mode="password" target={dialog.user} isSelf={isSelf(dialog.user)} onClose={() => setDialog(null)} onDone={done} />}
      {dialog?.kind === 'pin' && <ResetDialog mode="pin" target={dialog.user} isSelf={isSelf(dialog.user)} onClose={() => setDialog(null)} onDone={done} />}
      {dialog?.kind === 'toggle' && <ToggleActiveDialog target={dialog.user} onClose={() => setDialog(null)} onDone={done} />}
    </div>
  );
}

function IconButton({ title, onClick, disabled, danger, children }: { title: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={`p-1.5 rounded-lg text-neutral-400 hover:bg-neutral-800 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent ${danger ? 'hover:text-red-400' : 'hover:text-white'}`}
    >
      {children}
    </button>
  );
}

interface DialogProps {
  onClose: () => void;
  onDone: (message: string) => Promise<void>;
}

// Shared POST/PUT helper for the dialogs; returns an error message or ''.
function useSubmit() {
  const { API_BASE, secureFetch } = useShop();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (path: string, method: 'POST' | 'PUT', body: unknown, fallback: string): Promise<boolean> => {
    setBusy(true);
    setError('');
    try {
      const res = await secureFetch(`${API_BASE}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (!res.ok) {
        setError(await apiError(res, fallback));
        return false;
      }
      return true;
    } catch {
      setError('Could not reach the server.');
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, setError, submit };
}

function AddUserDialog({ onClose, onDone }: DialogProps) {
  const [form, setForm] = useState({ username: '', fullName: '', email: '', role: 'CASHIER' as Role, password: '', pin: '' });
  const [touched, setTouched] = useState(false);
  const { busy, error, submit } = useSubmit();

  const errors = {
    username: USERNAME_RULE.test(form.username) ? '' : '3-30 letters, digits, dots, dashes or underscores.',
    fullName: validateName(form.fullName),
    email: validateEmail(form.email),
    password: validatePassword(form.password),
    pin: validatePin(form.pin),
  };
  const valid = Object.values(errors).every(e => !e);
  const show = (k: keyof typeof errors) => (touched || (form[k] as string).length > 0 ? errors[k] : '');

  const save = async () => {
    setTouched(true);
    if (!valid) return;
    const ok = await submit('/users', 'POST', { ...form, username: form.username.trim(), fullName: form.fullName.trim(), email: form.email.trim() }, 'Could not create the user');
    if (ok) await onDone(`Added ${form.fullName.trim()} (${form.username.trim()}).`);
  };

  return (
    <Modal
      title="Add user"
      onClose={onClose}
      busy={busy}
      width="max-w-lg"
      footer={
        <>
          <button onClick={onClose} disabled={busy} className={secondaryButton}>Cancel</button>
          <button onClick={save} disabled={busy || (touched && !valid)} className={primaryButton}>
            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Create user
          </button>
        </>
      }
    >
      <form onSubmit={e => { e.preventDefault(); save(); }} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Full name" error={show('fullName')}>
            <input autoFocus value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} placeholder="e.g. Priya Sharma" className={inputClass} />
          </Field>
          <Field label="Username" error={show('username')} help="Used to sign in.">
            <input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} placeholder="e.g. priya" autoComplete="off" className={`${inputClass} font-mono`} />
          </Field>
        </div>
        <Field label="Email" error={show('email')}>
          <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="priya@example.com" className={inputClass} />
        </Field>
        <Field label="Role" help={ROLES.find(r => r.value === form.role)?.help}>
          <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value as Role })} className={inputClass}>
            {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Password" error={show('password')} help="8-72 characters, a letter and a digit.">
            <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} autoComplete="new-password" className={inputClass} />
          </Field>
          <Field label="PIN" error={show('pin')} help={form.role === 'CASHIER' ? '4 digits.' : '4 digits, used to approve overrides.'}>
            <input inputMode="numeric" maxLength={4} value={form.pin} onChange={e => setForm({ ...form, pin: e.target.value.replace(/\D/g, '') })} autoComplete="off" className={`${inputClass} font-mono tracking-[0.4em]`} />
          </Field>
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

function EditUserDialog({ target, isSelf, lastOwner, onClose, onDone }: DialogProps & { target: StaffUser; isSelf: boolean; lastOwner: boolean }) {
  const [form, setForm] = useState({ fullName: target.fullName, email: target.email, role: target.role });
  const { busy, error, setError, submit } = useSubmit();
  const errors = { fullName: validateName(form.fullName), email: validateEmail(form.email) };
  const changes: Record<string, string> = {};
  if (form.fullName.trim() !== target.fullName) changes.fullName = form.fullName.trim();
  if (form.email.trim() !== target.email) changes.email = form.email.trim();
  if (form.role !== target.role) changes.role = form.role;
  const roleLocked = isSelf || lastOwner;

  const save = async () => {
    if (errors.fullName || errors.email) return;
    if (Object.keys(changes).length === 0) {
      setError('Nothing changed.');
      return;
    }
    const ok = await submit(`/users/${target.id}`, 'PUT', changes, 'Could not update the user');
    if (ok) await onDone(changes.role ? `Updated ${form.fullName.trim()}. They have been signed out and must sign in again.` : `Updated ${form.fullName.trim()}.`);
  };

  return (
    <Modal
      title={`Edit ${target.username}`}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button onClick={onClose} disabled={busy} className={secondaryButton}>Cancel</button>
          <button onClick={save} disabled={busy || !!errors.fullName || !!errors.email} className={primaryButton}>
            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Save changes
          </button>
        </>
      }
    >
      <form onSubmit={e => { e.preventDefault(); save(); }} className="space-y-3">
        <Field label="Full name" error={errors.fullName}>
          <input autoFocus value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} className={inputClass} />
        </Field>
        <Field label="Email" error={errors.email}>
          <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className={inputClass} />
        </Field>
        <Field
          label="Role"
          help={
            isSelf
              ? 'You cannot change your own role.'
              : lastOwner
                ? 'This is the only active owner; make someone else an owner first.'
                : form.role !== target.role
                  ? 'Changing the role signs this user out on every device.'
                  : ROLES.find(r => r.value === form.role)?.help
          }
        >
          <select value={form.role} disabled={roleLocked} onChange={e => setForm({ ...form, role: e.target.value as Role })} className={`${inputClass} disabled:opacity-50 disabled:cursor-not-allowed`}>
            {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </Field>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

function ResetDialog({ mode, target, isSelf, onClose, onDone }: DialogProps & { mode: 'password' | 'pin'; target: StaffUser; isSelf: boolean }) {
  const [value, setValue] = useState('');
  const [confirm, setConfirm] = useState('');
  const { busy, error, submit } = useSubmit();
  const isPin = mode === 'pin';
  const ruleError = isPin ? validatePin(value) : validatePassword(value);
  const mismatch = confirm.length > 0 && confirm !== value ? `The ${isPin ? 'PINs' : 'passwords'} do not match.` : '';
  const canSave = !ruleError && confirm === value && !busy;

  const save = async () => {
    if (!canSave) return;
    const ok = await submit(`/users/${target.id}/reset-${mode}`, 'POST', isPin ? { pin: value } : { password: value }, `Could not reset the ${mode}`);
    if (ok)
      await onDone(
        isPin
          ? `PIN updated for ${target.fullName}.`
          : isSelf
            ? 'Your password was changed. Other sessions have been signed out.'
            : `Password reset for ${target.fullName}. They have been signed out everywhere.`,
      );
  };

  const sanitize = (v: string) => (isPin ? v.replace(/\D/g, '').slice(0, 4) : v);

  return (
    <Modal
      title={`Reset ${isPin ? 'PIN' : 'password'} for ${target.fullName}`}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button onClick={onClose} disabled={busy} className={secondaryButton}>Cancel</button>
          <button onClick={save} disabled={!canSave} className={primaryButton}>
            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Reset {isPin ? 'PIN' : 'password'}
          </button>
        </>
      }
    >
      <form onSubmit={e => { e.preventDefault(); save(); }} className="space-y-3">
        <p className="text-[11px] text-neutral-400">
          {isPin
            ? target.role === 'CASHIER'
              ? 'Enter a new 4-digit PIN.'
              : 'Enter a new 4-digit PIN. Approver PINs must be different from every other manager and owner PIN.'
            : 'Set a new password and share it with them in person. This signs them out on every device.'}
        </p>
        <Field label={isPin ? 'New PIN' : 'New password'} error={value ? ruleError : ''} help={isPin ? '4 digits.' : '8-72 characters, a letter and a digit.'}>
          <input
            autoFocus
            type={isPin ? 'text' : 'password'}
            inputMode={isPin ? 'numeric' : undefined}
            autoComplete={isPin ? 'off' : 'new-password'}
            value={value}
            onChange={e => setValue(sanitize(e.target.value))}
            className={`${inputClass} ${isPin ? 'font-mono tracking-[0.4em]' : ''}`}
          />
        </Field>
        <Field label={`Confirm ${isPin ? 'PIN' : 'password'}`} error={mismatch}>
          <input
            type={isPin ? 'text' : 'password'}
            inputMode={isPin ? 'numeric' : undefined}
            autoComplete={isPin ? 'off' : 'new-password'}
            value={confirm}
            onChange={e => setConfirm(sanitize(e.target.value))}
            className={`${inputClass} ${isPin ? 'font-mono tracking-[0.4em]' : ''}`}
          />
        </Field>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

function ToggleActiveDialog({ target, onClose, onDone }: DialogProps & { target: StaffUser }) {
  const { busy, error, submit } = useSubmit();
  const deactivating = target.isActive;

  const save = async () => {
    const ok = await submit(`/users/${target.id}/${deactivating ? 'deactivate' : 'activate'}`, 'POST', undefined, `Could not ${deactivating ? 'deactivate' : 'activate'} the user`);
    if (ok) await onDone(deactivating ? `${target.fullName} can no longer sign in.` : `${target.fullName} can sign in again.`);
  };

  return (
    <Modal
      title={deactivating ? `Deactivate ${target.fullName}?` : `Activate ${target.fullName}?`}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button onClick={onClose} disabled={busy} className={secondaryButton}>Cancel</button>
          <button
            autoFocus
            onClick={save}
            disabled={busy}
            className={deactivating ? 'px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-xs font-semibold text-white cursor-pointer flex items-center gap-1.5' : primaryButton}
          >
            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {deactivating ? 'Deactivate' : 'Activate'}
          </button>
        </>
      }
    >
      <p className="text-xs text-neutral-300">
        {deactivating
          ? `${target.fullName} (${target.username}) will be signed out and will not be able to sign in or approve with their PIN. Their bills and history are kept. You can activate them again later.`
          : `${target.fullName} (${target.username}) will be able to sign in again with their existing password and PIN.`}
      </p>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </Modal>
  );
}
