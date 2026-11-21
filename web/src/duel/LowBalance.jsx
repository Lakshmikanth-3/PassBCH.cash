import React from 'react';
import { lowBalance, sats } from './api.js';

/** Explains why the game buttons are disabled and what to do about it. */
export default function LowBalance({ player, rules }) {
  if (!lowBalance(player, rules)) return null;
  return (
    <p className="warnbox">
      Your balance ({sats(player.bonus + player.cash)}) is below the smallest stake ({sats(Math.min(...rules.stakes))}).{' '}
      <a href="/wallet">Deposit BCH</a> or invite a friend with your referral link to get a bonus.
    </p>
  );
}
