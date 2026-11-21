import React, { useMemo, useState } from 'react';
import { useWizardConnect, WizardConnectQRDialog } from '@wizardconnect/react';
import { api, sats } from './api.js';
import { walletKeys, buildDeposit, toWire } from './wizard.js';

const HAT = (
  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" style={{ verticalAlign: '-4px', marginRight: 6 }}>
    <path d="M12 2 6 17h12L12 2Z" fill="currentColor" opacity=".9" /><path d="M3 18.5c3-1.4 15-1.4 18 0-3 1.8-15 1.8-18 0Z" fill="currentColor" />
    <circle cx="11" cy="9" r="1" fill="#0b0c0e" /><circle cx="13.2" cy="12.5" r=".8" fill="#0b0c0e" />
  </svg>
);

/** WizardConnect: pair a BCH wallet by QR, then deposit with one approval on the phone. */
export default function WalletConnect({ network, onDeposited, onAddress }) {
  const wc = useWizardConnect({ dappName: 'PassBCH.cash', dappIcon: typeof location !== 'undefined' ? `${location.origin}/favicon.svg` : undefined });
  const [amount, setAmount] = useState(10000);
  const [busy, setBusy] = useState(null); const [err, setErr] = useState(null); const [done, setDone] = useState(null);
  const prefix = network === 'mainnet' ? 'bitcoincash' : 'bchtest';
  const keys = useMemo(() => (wc.state === 'connected' && wc.manager ? walletKeys(wc.manager, prefix) : []), [wc.state, wc.manager, prefix]);
  if (keys[0]) onAddress?.(keys[0].address);

  const deposit = async () => {
    setErr(null); setDone(null);
    try {
      setBusy('Finding your coins…');
      const { address: to } = await api('deposit');
      const found = await api('walletutxos', { body: { addresses: keys.map((k) => k.address) } });
      const utxos = keys.flatMap((k) => (found[k.address] ?? []).map((u) => ({ ...u, key: k })));
      const changeKey = keys.find((k) => k.path === 'change') ?? keys[0];
      const { transaction, sourceOutputs, inputPaths } = buildDeposit({ utxos, to, amount, changeKey });
      setBusy('Approve the deposit in your wallet…');
      const res = await wc.manager.signTransaction({
        transaction: toWire({ transaction, sourceOutputs, broadcast: true, userPrompt: `Deposit ${amount} sats to PassBCH.cash` }),
        inputPaths,
      });
      if (res.error) throw new Error(res.error);
      setBusy('Broadcasting…');
      await api('broadcast', { body: { hex: res.signedTransaction } }).catch(() => {}); // wallet may have broadcast already
      for (let i = 0; i < 10; i++) {
        const r = await api('deposit');
        if (r.added) { setDone(`Deposited ${sats(r.added)}`); onDeposited?.(); break; }
        await new Promise((ok) => setTimeout(ok, 1500));
      }
    } catch (e) { setErr(e.message); } finally { setBusy(null); }
  };

  return (
    <div className="wc">
      {wc.state !== 'connected' ? (
        <button className="wcbtn" onClick={wc.connect} disabled={wc.state === 'connecting'}>{HAT}{wc.state === 'connecting' ? 'Waiting for wallet…' : 'Connect wallet (WizardConnect)'}</button>
      ) : (
        <>
          <div className="row between"><span>{HAT}<b>{wc.walletName ?? 'Wallet'}</b> connected</span><button className="link" onClick={wc.disconnect}>disconnect</button></div>
          <div className="row gap" style={{ marginTop: 10 }}>
            {[10000, 50000, 100000].map((a) => <button key={a} className={`chip ${amount === a ? 'on' : ''}`} onClick={() => setAmount(a)}>{sats(a)}</button>)}
          </div>
          <button className="primary big" style={{ marginTop: 10, width: '100%' }} disabled={!!busy} onClick={deposit}>{busy ?? `Deposit ${sats(amount)} from wallet`}</button>
        </>
      )}
      {wc.uri && wc.qrUri && <WizardConnectQRDialog show={wc.state === 'connecting'} onClose={wc.disconnect} uri={wc.uri} qrUri={wc.qrUri} title="Connect your BCH wallet" subtitle="Scan with a WizardConnect wallet (e.g. Paytaca)" />}
      {done && <p className="ok">{done}</p>}
      {(err || wc.error) && <p className="err">{err ?? wc.error}</p>}
    </div>
  );
}
